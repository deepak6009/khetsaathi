import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { uploadToS3 } from "./services/s3Service";
import { detectDisease } from "./services/diseaseService";
import { generateTreatmentPlan } from "./services/geminiService";
import { treatmentPlanRequestSchema, languageSchema, phoneSchema, otpVerifySchema } from "@shared/schema";
import { z } from "zod";
import { storage } from "./storage";
import { log } from "./index";

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

const formFieldsSchema = z.object({
  crop: z.string().min(1, "Crop name is required"),
  location: z.string().min(1, "Location is required"),
  language: languageSchema,
  summary: z.string().min(1, "Description is required"),
});

function generateOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const requiredEnvVars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "S3_BUCKET_NAME", "CLOUDFRONT_URL", "GEMINI_API_KEY"];
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    log(`WARNING: Missing environment variables: ${missing.join(", ")}`);
  }

  app.post("/api/send-otp", async (req, res) => {
    try {
      const validation = phoneSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }

      const { phone } = validation.data;
      const code = generateOtpCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      await storage.saveOtp(phone, code, expiresAt);

      const isDev = process.env.NODE_ENV !== "production";
      if (isDev) {
        log(`OTP for ${phone}: ${code} (dev only)`);
      }

      return res.json({
        success: true,
        message: "OTP sent successfully",
        ...(isDev ? { otp_preview: code } : {}),
      });
    } catch (error: any) {
      log(`Send OTP error: ${error.message}`);
      return res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  app.post("/api/verify-otp", async (req, res) => {
    try {
      const validation = otpVerifySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }

      const { phone, code } = validation.data;
      const otp = await storage.getOtp(phone);

      if (!otp) {
        return res.status(400).json({ message: "No OTP found. Please request a new one." });
      }

      if (otp.attempts >= 5) {
        await storage.deleteOtp(phone);
        return res.status(400).json({ message: "Too many attempts. Please request a new OTP." });
      }

      if (new Date() > otp.expiresAt) {
        await storage.deleteOtp(phone);
        return res.status(400).json({ message: "OTP expired. Please request a new one." });
      }

      if (otp.code !== code) {
        await storage.incrementOtpAttempts(phone);
        return res.status(400).json({ message: "Invalid OTP. Please try again." });
      }

      await storage.deleteOtp(phone);
      await storage.upsertUser({ phone });

      log(`User verified: ${phone}`);
      return res.json({ success: true, phone });
    } catch (error: any) {
      log(`Verify OTP error: ${error.message}`);
      return res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/set-language", async (req, res) => {
    try {
      const schema = z.object({
        phone: z.string().min(10),
        language: languageSchema,
      });
      const validation = schema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }

      const { phone, language } = validation.data;
      const user = await storage.upsertUser({ phone, language });

      return res.json({ success: true, user });
    } catch (error: any) {
      log(`Set language error: ${error.message}`);
      return res.status(500).json({ message: "Failed to update language" });
    }
  });

  app.post("/api/diagnose", upload.array("images", 3), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "At least one image is required" });
      }

      const fieldValidation = formFieldsSchema.safeParse(req.body);
      if (!fieldValidation.success) {
        return res.status(400).json({ message: fieldValidation.error.errors.map(e => e.message).join(", ") });
      }

      const { crop, location, language, summary } = fieldValidation.data;

      log(`Uploading ${files.length} images to S3...`);
      const imageUrls = await Promise.all(
        files.map((file) => uploadToS3(file.buffer, file.originalname, file.mimetype))
      );
      log(`Images uploaded: ${imageUrls.join(", ")}`);

      log("Calling disease detection API...");
      const diagnosisResponse = await detectDisease({
        images: imageUrls,
        crop,
        location,
        language,
        summary,
      });
      log("Disease detection complete");

      let result = diagnosisResponse;
      if (typeof result === "string") {
        try { result = JSON.parse(result); } catch {}
      }

      if (result && typeof result === "object") {
        const normalized: Record<string, any> = {};
        for (const [key, value] of Object.entries(result)) {
          const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase().replace(/^_/, "").replace(/\s+/g, "_");
          normalized[snakeKey] = value;
        }
        result = normalized;
      }

      return res.json(result);
    } catch (error: any) {
      log(`Diagnose error: ${error.message}`);
      return res.status(500).json({ message: error.message || "Diagnosis failed" });
    }
  });

  app.post("/api/treatment-plan", async (req, res) => {
    try {
      const validation = treatmentPlanRequestSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ message: validation.error.errors.map(e => e.message).join(", ") });
      }

      const { diagnosis, crop, location, language, summary } = validation.data;

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ message: "Gemini API key is not configured" });
      }

      log("Generating treatment plan with Gemini...");
      const plan = await generateTreatmentPlan({ diagnosis, crop, location: location || "", language, summary: summary || "" });
      log("Treatment plan generated");

      return res.json({ plan });
    } catch (error: any) {
      log(`Treatment plan error: ${error.message}`);
      return res.status(500).json({ message: error.message || "Plan generation failed" });
    }
  });

  return httpServer;
}
