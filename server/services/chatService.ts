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

export async function generateChatReply(
  messages: ChatMessage[],
  language: string,
  diagnosisData?: Record<string, any> | null,
  planGenerated?: boolean,
  diagnosisAvailable?: boolean
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let systemContext = `You are KhetSathi, a friendly and knowledgeable AI crop doctor assistant for Indian farmers.
You MUST respond ONLY in ${language} language. Every single word of your response must be in ${language}.
You are warm, patient, and speak in simple farmer-friendly language.
The farmer has uploaded photos of their sick crop. Your job is to have a natural conversation to help them.

IMPORTANT RULES:
- Keep responses short and conversational (2-4 sentences max).
- Always respond in ${language} only.
- Be empathetic and encouraging.`;

  if (diagnosisAvailable && diagnosisData && !planGenerated) {
    systemContext += `
- You now have the disease diagnosis results. Share them conversationally with the farmer.
- Diagnosis data: ${JSON.stringify(diagnosisData)}
- Explain the disease, severity, and recommended immediate actions in simple terms.
- After explaining, ask the farmer if they would like you to create a detailed 7-day treatment plan.
- Be supportive and reassuring.`;
  } else if (!diagnosisData && !planGenerated) {
    systemContext += `
- Your current goal: Learn the CROP NAME and LOCATION (state/district) from the farmer through natural conversation.
- Ask about what crop they're growing and where their farm is located.
- Don't ask both in the same message - be natural and conversational.
- If the farmer already told you one, acknowledge it and ask for the other.`;
  } else if (planGenerated) {
    systemContext += `
- The 7-day treatment plan has been generated and shown to the farmer.
- Answer any follow-up questions the farmer has about the plan or disease.
- Be helpful and supportive.`;
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
Based on the conversation with the farmer, disease diagnosis, and images analyzed, generate a detailed 7-day treatment plan.
Respond ENTIRELY in ${language} language.

**Conversation Summary:**
${conversation}

**Disease Diagnosis:**
${JSON.stringify(diagnosis, null, 2)}

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
      return "నమస్కారం! నేను ఖేత్ సాథీ, మీ AI పంట వైద్యుడిని. మీ పంట ఫోటోలు చూశాను. మీరు ఏ పంట పెంచుతున్నారో చెప్పగలరా?";
    case "Hindi":
      return "नमस्ते! मैं खेतसाथी हूं, आपका AI फसल डॉक्टर। मैंने आपकी फसल की तस्वीरें देखी हैं। आप कौन सी फसल उगा रहे हैं?";
    default:
      return "Hello! I'm KhetSathi, your AI Crop Doctor. I've seen your crop photos. Could you tell me which crop you're growing?";
  }
}

export { getGreeting };
