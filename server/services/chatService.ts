import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExtractedInfo {
  crop: string | null;
  location: string | null;
}

const GATHERING_PROMPT = `You are KhetSathi, a friendly and knowledgeable AI crop doctor assistant for Indian farmers.
You MUST respond ONLY in {LANGUAGE} language. Every single word must be in {LANGUAGE}.
You are warm, patient, and speak in simple farmer-friendly language like a village elder.
The farmer has uploaded photos of their sick crop.

YOUR CONVERSATION FLOW — follow this order strictly, asking ONE or TWO questions per message:

PHASE 1 - INTRODUCTION:
- First, greet the farmer warmly and ask their name.

PHASE 2 - CROP & LOCATION:
- Ask which crop they are growing.
- Ask where their farm is located (village/district/state).

PHASE 3 - CROP DETAILS (ask naturally, 1-2 at a time):
- How many days ago did you plant? (recently / 15-30 days / 30-60 days / more than 60 days)
- Is the plant small, medium or big now?
- Are flowers or fruits coming on the plant?

PHASE 4 - SOIL & WATER (ask naturally, 1-2 at a time):
- What color is your soil? (red/black/brown/sandy)
- Is the soil hard or soft?
- When did you last give water to the field?
- Is water standing in the field right now?

PHASE 5 - WEATHER & FERTILIZER (ask naturally, 1-2 at a time):
- Is the weather hot these days? Any heavy rain recently?
- Did you put any fertilizer? Which one? (Urea/DAP/organic manure)

PHASE 6 - DISEASE SYMPTOMS (ask naturally, 1-2 at a time):
- Are leaves turning yellow?
- Any black or brown spots on leaves?
- Is the plant drying suddenly?
- Are insects visible on the leaves?
- How much of your crop is affected?

IMPORTANT RULES:
- Keep responses SHORT (2-3 sentences max). Ask only 1-2 questions per message.
- Look at the conversation history to know what has already been asked. NEVER repeat a question already answered.
- Move to the next phase once current questions are answered. Skip questions the farmer already answered naturally.
- Be encouraging after each answer ("That's helpful!", "Thank you!", "I understand").
- If the farmer gives extra info voluntarily, acknowledge it and skip those questions later.
- Use simple village-level language, avoid technical jargon.
- Always respond in {LANGUAGE} only.`;

const DIAGNOSIS_PROMPT = `You are KhetSathi, a friendly AI crop doctor for Indian farmers.
You MUST respond ONLY in {LANGUAGE} language.

You now have the disease diagnosis results. Share them with the farmer in a caring, simple way.
Diagnosis data: {DIAGNOSIS}

RULES:
- Explain the disease name, how serious it is, and what immediate steps to take — all in simple farmer language.
- After explaining, ask the farmer if they would like a detailed 7-day treatment plan.
- Keep it short (3-5 sentences). Be reassuring — tell them it can be managed.
- Always respond in {LANGUAGE} only.`;

const PLAN_DONE_PROMPT = `You are KhetSathi, a friendly AI crop doctor for Indian farmers.
You MUST respond ONLY in {LANGUAGE} language.
The 7-day treatment plan has been generated and shown to the farmer.
Answer any follow-up questions helpfully. Be supportive and encouraging.
Keep responses short (2-3 sentences).`;

export async function generateChatReply(
  messages: ChatMessage[],
  language: string,
  diagnosisData?: Record<string, any> | null,
  planGenerated?: boolean,
  diagnosisAvailable?: boolean
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let systemContext: string;

  if (diagnosisAvailable && diagnosisData && !planGenerated) {
    systemContext = DIAGNOSIS_PROMPT
      .replace(/\{LANGUAGE\}/g, language)
      .replace("{DIAGNOSIS}", JSON.stringify(diagnosisData));
  } else if (planGenerated) {
    systemContext = PLAN_DONE_PROMPT.replace(/\{LANGUAGE\}/g, language);
  } else {
    systemContext = GATHERING_PROMPT.replace(/\{LANGUAGE\}/g, language);
  }

  const chatHistory = messages.map((m) => ({
    role: m.role === "assistant" ? "model" as const : "user" as const,
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({
    history: [
      { role: "user" as const, parts: [{ text: systemContext }] },
      { role: "model" as const, parts: [{ text: getGreeting(language) }] },
      ...chatHistory.slice(0, -1),
    ],
  });

  const lastMessage = chatHistory[chatHistory.length - 1];
  const result = await chat.sendMessage(lastMessage.parts[0].text);
  return result.response.text();
}

export async function extractCropAndLocation(
  messages: ChatMessage[]
): Promise<ExtractedInfo> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const conversation = messages
    .map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Analyze this conversation between a farmer and an AI assistant. Extract the crop name and location (state/district in India) if mentioned by the farmer.

Conversation:
${conversation}

Respond in STRICT JSON format only, no extra text:
{"crop": "crop name or null", "location": "location or null"}

Rules:
- Only extract information explicitly stated by the farmer (user messages), not the assistant.
- crop should be the specific crop name (e.g., "Tomato", "Rice", "Cotton")
- location should be the Indian state or district (e.g., "Andhra Pradesh", "Punjab")
- Use null (not the string "null") if not mentioned yet.
- Return just the JSON, nothing else.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      crop: parsed.crop === "null" || !parsed.crop ? null : parsed.crop,
      location: parsed.location === "null" || !parsed.location ? null : parsed.location,
    };
  } catch {
    return { crop: null, location: null };
  }
}

export async function detectPlanIntent(
  messages: ChatMessage[]
): Promise<boolean> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const recentMessages = messages.slice(-4);
  const conversation = recentMessages
    .map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `The assistant asked the farmer if they want a 7-day treatment plan. Based on the farmer's latest response, did they agree?

Conversation:
${conversation}

Respond with ONLY "yes" or "no". The farmer might say yes in any language (Hindi: हाँ/हां, Telugu: అవును, English: yes/sure/okay/please).`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim().toLowerCase();
  return text.includes("yes");
}

export async function generateConversationalPlan(
  messages: ChatMessage[],
  diagnosis: Record<string, any>,
  language: string,
  imageUrls: string[]
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const conversation = messages
    .map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Act as an experienced agricultural crop doctor.
Based on the full conversation with the farmer (which includes their soil, weather, crop stage, fertilizer, and symptom details), the disease diagnosis, and images analyzed, generate a highly personalized 7-day treatment plan.
Respond ENTIRELY in ${language} language.

**Full Conversation with Farmer:**
${conversation}

**Disease Diagnosis:**
${JSON.stringify(diagnosis, null, 2)}

Use the farmer's specific context (soil type, weather, crop stage, fertilizers used, water conditions) to tailor the plan.

Please provide:
1. A brief summary of the diagnosis
2. Day-by-day treatment plan (Day 1 through Day 7)
3. Each day should include specific actions, products to use (with dosage), and application methods
4. Include preventive measures for future crops
5. Any warnings or precautions

Format the response clearly with markdown headings and bullet points.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

function getGreeting(language: string): string {
  switch (language) {
    case "Telugu":
      return "నమస్కారం! నేను ఖేత్ సాథీ, మీ AI పంట వైద్యుడిని. మీ పంట ఫోటోలు చూశాను. ముందుగా మీ పేరు చెప్పగలరా?";
    case "Hindi":
      return "नमस्ते! मैं खेतसाथी हूं, आपका AI फसल डॉक्टर। मैंने आपकी फसल की तस्वीरें देखी हैं। पहले अपना नाम बताइए?";
    default:
      return "Hello! Welcome to KhetSathi, your AI Crop Doctor. I've seen your crop photos. May I know your name please?";
  }
}

export { getGreeting };
