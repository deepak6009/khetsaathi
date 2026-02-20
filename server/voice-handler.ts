import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { speechToText, textToSpeech, getLanguageCode } from "./services/voiceService";
import { generateChatReply, extractCropAndLocation, detectPlanIntent, generateConversationalPlan, generateConversationSummary, getGreeting, type ChatMessage } from "./services/chatService";
import { detectDisease } from "./services/diseaseService";
import { saveUserCase, saveChatSummary } from "./services/dynamoService";
import { generatePdf } from "./services/pdfService";
import { uploadPdfToS3 } from "./services/s3Service";
import { log } from "./index";

interface VoiceSession {
  phone: string;
  language: string;
  messages: ChatMessage[];
  extractedCrop: string | null;
  extractedLocation: string | null;
  diagnosis: Record<string, any> | null;
  diagnosisInProgress: boolean;
  planGenerated: boolean;
  imageUrls: string[];
}

function sendJson(ws: WebSocket, data: Record<string, any>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function setupVoiceWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    if (request.url === "/ws/voice") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (ws) => {
    log("Voice WebSocket connected", "voice");
    let session: VoiceSession | null = null;

    ws.on("message", async (data, isBinary) => {
      if (!isBinary) {
        try {
          const msg = JSON.parse(data.toString());
          await handleTextMessage(ws, msg, session, (s) => { session = s; });
        } catch (err: any) {
          log(`Voice text message error: ${err.message}`, "voice");
          sendJson(ws, { type: "error", message: err.message });
        }
        return;
      }

      if (!session) {
        sendJson(ws, { type: "error", message: "Session not started" });
        return;
      }

      try {
        const audioBuffer = Buffer.from(data as ArrayBuffer);
        log(`Received audio chunk: ${(audioBuffer.length / 1024).toFixed(1)}KB`, "voice");

        sendJson(ws, { type: "status", status: "transcribing" });

        const langCode = getLanguageCode(session.language);
        const sttResult = await speechToText(audioBuffer, langCode);

        if (!sttResult.transcript || sttResult.transcript.trim().length === 0) {
          log("No speech detected in audio", "voice");
          sendJson(ws, { type: "status", status: "listening" });
          return;
        }

        log(`[STT] Farmer said: "${sttResult.transcript}" (confidence: ${sttResult.confidence.toFixed(2)})`, "voice");
        sendJson(ws, { type: "transcript", role: "user", text: sttResult.transcript });

        sendJson(ws, { type: "status", status: "thinking" });

        const userMsg: ChatMessage = { role: "user", content: sttResult.transcript };
        session.messages.push(userMsg);

        const hasDiagnosis = session.diagnosis !== null;
        const reply = await generateChatReply(
          session.messages,
          session.language,
          hasDiagnosis ? session.diagnosis : null,
          session.planGenerated,
          hasDiagnosis && !session.planGenerated
        );

        const assistantMsg: ChatMessage = { role: "assistant", content: reply };
        session.messages.push(assistantMsg);

        log(`[AI] Reply: "${reply.substring(0, 100)}..."`, "voice");
        sendJson(ws, { type: "transcript", role: "assistant", text: reply });

        sendJson(ws, { type: "status", status: "speaking" });

        try {
          const ttsResult = await textToSpeech(reply, session.language);
          ws.send(ttsResult.audioContent);
          log(`[TTS] Sent ${(ttsResult.audioContent.length / 1024).toFixed(1)}KB audio`, "voice");
        } catch (ttsErr: any) {
          log(`TTS error: ${ttsErr.message}`, "voice");
          sendJson(ws, { type: "error", message: "Could not generate speech" });
        }

        runBackgroundAgents(ws, session);

      } catch (err: any) {
        log(`Voice processing error: ${err.message}`, "voice");
        sendJson(ws, { type: "error", message: "Processing failed" });
        sendJson(ws, { type: "status", status: "listening" });
      }
    });

    ws.on("close", () => {
      log("Voice WebSocket disconnected", "voice");
      session = null;
    });
  });

  log("Voice WebSocket server ready on /ws/voice", "voice");
}

async function handleTextMessage(
  ws: WebSocket,
  msg: Record<string, any>,
  session: VoiceSession | null,
  setSession: (s: VoiceSession) => void
) {
  switch (msg.type) {
    case "start": {
      const newSession: VoiceSession = {
        phone: msg.phone || "",
        language: msg.language || "English",
        messages: [],
        extractedCrop: null,
        extractedLocation: null,
        diagnosis: null,
        diagnosisInProgress: false,
        planGenerated: false,
        imageUrls: msg.imageUrls || [],
      };
      setSession(newSession);

      log(`Voice session started: phone=${newSession.phone}, lang=${newSession.language}`, "voice");
      sendJson(ws, { type: "started" });

      const greeting = getGreeting(newSession.language);
      newSession.messages.push({ role: "assistant", content: greeting });
      sendJson(ws, { type: "transcript", role: "assistant", text: greeting });

      try {
        const ttsResult = await textToSpeech(greeting, newSession.language);
        ws.send(ttsResult.audioContent);
        log("[TTS] Sent greeting audio", "voice");
      } catch (err: any) {
        log(`Greeting TTS error: ${err.message}`, "voice");
      }

      sendJson(ws, { type: "status", status: "listening" });
      break;
    }

    case "plan_language": {
      if (!session) return;
      const lang = msg.language || "English";
      log(`Plan requested in ${lang}`, "voice");
      sendJson(ws, { type: "status", status: "generating_plan" });

      try {
        const plan = await generateConversationalPlan(
          session.messages,
          session.diagnosis!,
          lang,
          session.imageUrls
        );

        let pdfUrl = "";
        try {
          const pdfBuffer = await generatePdf(plan, lang);
          pdfUrl = await uploadPdfToS3(pdfBuffer, session.phone);
          log(`PDF uploaded: ${pdfUrl}`, "voice");
        } catch (pdfErr: any) {
          log(`PDF error: ${pdfErr.message}`, "voice");
        }

        try {
          const summary = await generateConversationSummary(session.messages, session.diagnosis!);
          await saveChatSummary({
            phone: session.phone,
            timestamp: new Date().toISOString(),
            conversationSummary: summary,
            pdfUrl: pdfUrl || "pdf_generation_failed",
            language: lang,
            diagnosis: session.diagnosis!,
            imageUrls: session.imageUrls,
          });
        } catch (saveErr: any) {
          log(`Summary save error: ${saveErr.message}`, "voice");
        }

        session.planGenerated = true;
        sendJson(ws, { type: "plan_ready", pdfUrl, language: lang });

        const confirmMsg = lang === "Telugu"
          ? "మీ 7-రోజుల చికిత్స ప్రణాళిక సిద్ధంగా ఉంది!"
          : lang === "Hindi"
            ? "आपकी 7-दिन की उपचार योजना तैयार है!"
            : "Your 7-day treatment plan is ready!";

        session.messages.push({ role: "assistant", content: confirmMsg });
        sendJson(ws, { type: "transcript", role: "assistant", text: confirmMsg });

        try {
          const ttsResult = await textToSpeech(confirmMsg, lang);
          ws.send(ttsResult.audioContent);
        } catch {}

        sendJson(ws, { type: "status", status: "listening" });
      } catch (err: any) {
        log(`Plan generation error: ${err.message}`, "voice");
        sendJson(ws, { type: "error", message: "Plan generation failed" });
        sendJson(ws, { type: "status", status: "listening" });
      }
      break;
    }
  }
}

async function runBackgroundAgents(ws: WebSocket, session: VoiceSession) {
  if (!session.extractedCrop || !session.extractedLocation) {
    if (!session.diagnosisInProgress && !session.diagnosis) {
      try {
        const extracted = await extractCropAndLocation(session.messages);
        if (extracted.crop) session.extractedCrop = extracted.crop;
        if (extracted.location) session.extractedLocation = extracted.location;

        if (session.extractedCrop && session.extractedLocation && !session.diagnosisInProgress) {
          session.diagnosisInProgress = true;
          log(`Triggering diagnosis: crop=${session.extractedCrop}, location=${session.extractedLocation}`, "voice");
          sendJson(ws, { type: "status_info", info: "analyzing_images" });

          try {
            const result = await detectDisease({
              images: session.imageUrls,
              crop: session.extractedCrop,
              location: session.extractedLocation,
              language: session.language,
            });
            let diagnosis = result;
            if (typeof diagnosis === "string") {
              try { diagnosis = JSON.parse(diagnosis); } catch {}
            }
            if (diagnosis && diagnosis.diagnosis) {
              diagnosis = diagnosis.diagnosis;
            }
            session.diagnosis = diagnosis;
            log(`Diagnosis complete`, "voice");
            sendJson(ws, { type: "diagnosis_ready" });

            try {
              const conversationSummary = session.messages
                .map((m) => `${m.role === "user" ? "Farmer" : "AI"}: ${m.content}`)
                .join("\n");
              await saveUserCase({
                phone: session.phone,
                timestamp: new Date().toISOString(),
                conversationSummary,
                diagnosis: session.diagnosis || undefined,
                language: session.language,
                imageUrls: session.imageUrls,
              });
            } catch {}
          } catch (diagErr: any) {
            log(`Diagnosis error: ${diagErr.message}`, "voice");
          } finally {
            session.diagnosisInProgress = false;
          }
        }
      } catch (extErr: any) {
        log(`Extraction error: ${extErr.message}`, "voice");
      }
    }
  }

  if (session.diagnosis && !session.planGenerated) {
    try {
      const wantsPlan = await detectPlanIntent(session.messages);
      if (wantsPlan) {
        log("Farmer wants a plan (detected via voice)", "voice");
        sendJson(ws, { type: "wants_plan" });
      }
    } catch {}
  }
}
