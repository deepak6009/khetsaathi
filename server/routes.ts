import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import sharp from "sharp";
import { uploadToS3 } from "./services/s3Service";
import { detectDisease } from "./services/diseaseService";
import { generateChatReply, extractCropAndLocation, detectPlanIntent, generateConversationalPlan, generateConversationSummary, getGreeting, type ChatMessage } from "./services/chatService";
import { saveUserToDynamo, saveUserCase, saveChatSummary, getChatSummaries, getUserCases, updateUserProfileImage, getUserFromDynamo } from "./services/dynamoService";
import { generatePdf } from "./services/pdfService";
import { uploadPdfToS3 } from "./services/s3Service";
import { phoneSchema, languageSchema } from "@shared/schema";
import { z } from "zod";
import { log } from "./index";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

const chatMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  language: z.string(),
  diagnosis: z.record(z.any()).nullable().optional(),
  planGenerated: z.boolean().optional(),
  diagnosisAvailable: z.boolean().optional(),
});

const extractSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const diagnoseFromChatSchema = z.object({
  imageUrls: z.array(z.string()).min(1),
  crop: z.string().min(1),
  location: z.string().min(1),
  language: z.string(),
});

const planIntentSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
});

const generatePlanSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })),
  diagnosis: z.record(z.any()),
  language: z.string(),
  imageUrls: z.array(z.string()),
  phone: z.string().min(10),
});

const saveUsercaseSchema = z.object({
  phone: z.string().min(10),
  conversationSummary: z.string(),
  diagnosis: z.record(z.any()).optional(),
  treatmentPlan: z.string().optional(),
  language: z.string().optional(),
  imageUrls: z.array(z.string()).optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const requiredEnvVars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "S3_BUCKET_NAME", "CLOUDFRONT_URL", "GEMINI_API_KEY"];
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    log(`WARNING: Missing environment variables: ${missing.join(", ")}`);
  }

  app.post("/api/register-phone", async (req, res) => {
    try {
      const validation = phoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { phone } = validation.data;
      const language = req.body.language || "English";
      const user = await saveUserToDynamo(phone, language);
      log(`User registered: ${phone}, language: ${language}`);
      return res.json({ success: true, user });
    } catch (error: any) {
      log(`Register phone error: ${error.message}`);
      return res.status(500).json({ message: "Failed to register phone number" });
    }
  });

  app.post("/api/set-language", async (req, res) => {
    try {
      const schema = z.object({ phone: z.string().min(10), language: languageSchema });
      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { phone, language } = validation.data;
      const user = await saveUserToDynamo(phone, language);
      return res.json({ success: true, user });
    } catch (error: any) {
      log(`Set language error: ${error.message}`);
      return res.status(500).json({ message: "Failed to update language" });
    }
  });

  app.post("/api/upload-selfie", upload.single("selfie"), async (req, res) => {
    try {
      const file = req.file;
      const phone = req.body.phone;
      if (!file) {
        return res.status(400).json({ message: "Selfie image is required" });
      }
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      log(`Uploading selfie for user ${phone}...`);
      const compressed = await sharp(file.buffer)
        .resize(400, 400, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toBuffer();
      const imageUrl = await uploadToS3(compressed, "selfie.jpg", "image/jpeg", phone);
      await updateUserProfileImage(phone, imageUrl);
      log(`Selfie uploaded: ${imageUrl}`);
      return res.json({ success: true, profileImageUrl: imageUrl });
    } catch (error: any) {
      log(`Upload selfie error: ${error.message}`);
      return res.status(500).json({ message: "Failed to upload selfie" });
    }
  });

  app.get("/api/user-profile/:phone", async (req, res) => {
    try {
      const phone = req.params.phone;
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }
      const user = await getUserFromDynamo(phone);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      return res.json({ success: true, user });
    } catch (error: any) {
      log(`Get user profile error: ${error.message}`);
      return res.status(500).json({ message: "Failed to get user profile" });
    }
  });

  app.post("/api/upload-images", upload.array("images", 6), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      const phone = req.body.phone;
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "At least one image is required" });
      }
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Phone number is required" });
      }
      log(`Compressing & uploading ${files.length} images to S3 for user ${phone}...`);
      const imageUrls = await Promise.all(
        files.map(async (file) => {
          const compressed = await sharp(file.buffer)
            .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
          log(`Compressed ${file.originalname}: ${(file.buffer.length / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);
          return uploadToS3(compressed, file.originalname.replace(/\.[^.]+$/, ".jpg"), "image/jpeg", phone);
        })
      );
      log(`Images uploaded: ${imageUrls.join(", ")}`);
      return res.json({ success: true, imageUrls });
    } catch (error: any) {
      log(`Upload images error: ${error.message}`);
      return res.status(500).json({ message: "Failed to upload images" });
    }
  });

  app.get("/api/chat/greeting", (req, res) => {
    const language = (req.query.language as string) || "English";
    const greeting = getGreeting(language);
    return res.json({ greeting });
  });

  app.post("/api/chat/message", async (req, res) => {
    try {
      const validation = chatMessageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { messages, language, diagnosis, planGenerated, diagnosisAvailable } = validation.data;
      const reply = await generateChatReply(messages, language, diagnosis, planGenerated, diagnosisAvailable);
      return res.json({ reply });
    } catch (error: any) {
      log(`Chat message error: ${error.message}`);
      return res.status(500).json({ message: "Failed to generate response" });
    }
  });

  app.post("/api/chat/extract", async (req, res) => {
    try {
      const validation = extractSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { messages } = validation.data;
      const extracted = await extractCropAndLocation(messages);
      return res.json(extracted);
    } catch (error: any) {
      log(`Extract info error: ${error.message}`);
      return res.status(500).json({ message: "Failed to extract info" });
    }
  });

  app.post("/api/chat/diagnose", async (req, res) => {
    try {
      const validation = diagnoseFromChatSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { imageUrls, crop, location, language } = validation.data;
      log(`Diagnosing from chat: crop=${crop}, location=${location}`);
      const result = await detectDisease({ images: imageUrls, crop, location, language });

      let diagnosis = result;
      if (typeof diagnosis === "string") {
        try { diagnosis = JSON.parse(diagnosis); } catch {}
      }
      if (diagnosis && diagnosis.diagnosis) {
        diagnosis = diagnosis.diagnosis;
      }

      return res.json({ success: true, diagnosis });
    } catch (error: any) {
      log(`Chat diagnose error: ${error.message}`);
      return res.status(500).json({ message: "Diagnosis failed" });
    }
  });

  app.post("/api/chat/detect-plan-intent", async (req, res) => {
    try {
      const validation = planIntentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { messages } = validation.data;
      const wantsPlan = await detectPlanIntent(messages);
      return res.json({ wantsPlan });
    } catch (error: any) {
      log(`Plan intent error: ${error.message}`);
      return res.status(500).json({ message: "Failed to detect intent" });
    }
  });

  app.post("/api/chat/generate-plan", async (req, res) => {
    try {
      const validation = generatePlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const { messages, diagnosis, language, imageUrls, phone } = validation.data;
      log("Generating treatment plan from conversation...");
      const plan = await generateConversationalPlan(messages, diagnosis, language, imageUrls);
      log("Treatment plan generated, generating PDF...");

      let pdfUrl = "";
      try {
        const pdfBuffer = await generatePdf(plan, language);
        pdfUrl = await uploadPdfToS3(pdfBuffer, phone);
        log(`PDF uploaded to S3: ${pdfUrl}`);
      } catch (pdfErr: any) {
        log(`PDF generation/upload error: ${pdfErr.message}`);
      }

      try {
        const conversationSummary = await generateConversationSummary(messages, diagnosis);
        await saveChatSummary({
          phone,
          timestamp: new Date().toISOString(),
          conversationSummary,
          pdfUrl: pdfUrl || "pdf_generation_failed",
          language,
          diagnosis,
          imageUrls,
        });
        log(`Chat summary saved for ${phone}`);
      } catch (summaryErr: any) {
        log(`Chat summary save error: ${summaryErr.message}`);
      }

      return res.json({ plan, pdfUrl });
    } catch (error: any) {
      log(`Generate plan error: ${error.message}`);
      return res.status(500).json({ message: "Plan generation failed" });
    }
  });

  app.post("/api/save-usercase", async (req, res) => {
    try {
      const validation = saveUsercaseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }
      const data = validation.data;
      const saved = await saveUserCase({
        phone: data.phone,
        timestamp: new Date().toISOString(),
        conversationSummary: data.conversationSummary,
        diagnosis: data.diagnosis,
        treatmentPlan: data.treatmentPlan,
        language: data.language,
        imageUrls: data.imageUrls,
      });
      log(`User case saved for ${data.phone}`);
      return res.json({ success: true, usercase: saved });
    } catch (error: any) {
      log(`Save usercase error: ${error.message}`);
      return res.status(500).json({ message: "Failed to save case" });
    }
  });

  app.get("/api/history/:phone", async (req, res) => {
    try {
      const phone = decodeURIComponent(req.params.phone);
      if (!phone || phone.length < 10) {
        return res.status(400).json({ message: "Valid phone number is required" });
      }
      const [cases, summaries] = await Promise.all([
        getUserCases(phone),
        getChatSummaries(phone),
      ]);
      const combined = [...summaries.map(s => ({
        phone: s.phone,
        timestamp: s.timestamp,
        conversationSummary: s.conversationSummary,
        pdfUrl: s.pdfUrl,
        language: s.language,
        diagnosis: s.diagnosis,
        imageUrls: s.imageUrls,
      })), ...cases.filter(c => !summaries.some(s => s.timestamp === c.timestamp)).map(c => ({
        phone: c.phone,
        timestamp: c.timestamp,
        conversationSummary: c.conversationSummary,
        diagnosis: c.diagnosis,
        language: c.language,
        imageUrls: c.imageUrls,
      }))];
      return res.json({ history: combined });
    } catch (error: any) {
      log(`History fetch error: ${error.message}`);
      return res.status(500).json({ message: "Failed to fetch history" });
    }
  });

  app.post("/api/livekit/token", async (req, res) => {
    try {
      const schema = z.object({
        phone: z.string().min(10),
        language: z.string(),
        imageUrls: z.array(z.string()),
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }

      const { phone, language, imageUrls } = validation.data;

      const apiKey = process.env.LIVEKIT_API_KEY;
      const apiSecret = process.env.LIVEKIT_API_SECRET;
      const livekitUrl = process.env.LIVEKIT_URL;

      if (!apiKey || !apiSecret || !livekitUrl) {
        return res.status(500).json({ message: "LiveKit not configured" });
      }

      const roomName = `khetsaathi-${phone}-${Date.now()}`;
      const participantIdentity = `farmer-${phone}`;
      const roomMetadata = JSON.stringify({ phone, language, imageUrls });

      const roomService = new RoomServiceClient(livekitUrl, apiKey, apiSecret);
      await roomService.createRoom({
        name: roomName,
        metadata: roomMetadata,
        emptyTimeout: 300,
        maxParticipants: 2,
      });
      log(`Room created: ${roomName} (agent auto-dispatched)`);

      const token = new AccessToken(apiKey, apiSecret, {
        identity: participantIdentity,
      });
      token.addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      });

      const jwt = await token.toJwt();

      log(`LiveKit token generated for ${phone}, room: ${roomName}`);
      return res.json({
        token: jwt,
        url: livekitUrl,
        roomName,
      });
    } catch (error: any) {
      log(`LiveKit token error: ${error.message}`);
      return res.status(500).json({ message: "Failed to generate token" });
    }
  });

  return httpServer;
}
