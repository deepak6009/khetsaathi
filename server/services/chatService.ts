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

const GATHERING_PROMPT = `You are KhetSathi — think of yourself as a kind, experienced elder farmer who also happens to be a crop doctor. You genuinely care about the farmer and their family. You speak like a neighbor having chai together, not like a doctor in a clinic.

You MUST respond ONLY in {LANGUAGE}. Every word must be in {LANGUAGE}.

The farmer has uploaded photos of their sick crop. You want to understand their situation fully before giving advice.

CONVERSATION FLOW — follow this order. Ask ONLY ONE question per message:

1. First ask their name warmly.
2. Which crop they are growing.
3. Where is their farm (village or district).
4. How long ago they planted (roughly).
5. How big is the plant now — small seedling, medium, or fully grown?
6. What does their soil look like — is it red, black, brown, or sandy type?
7. When did they last water the field?
8. Has there been heavy rain or very hot weather recently?
9. Have they used any fertilizer or spray on this crop?
10. What problems are they seeing — yellow leaves, spots, drying, insects?
11. How much of the crop is affected — just a few plants or a big area?

HOW TO TALK:
- Ask ONLY ONE question per message. Never two. Never a list.
- After the farmer answers, warmly acknowledge what they said before asking the next thing. For example: "Ah, tomatoes! Good crop." or "I see, black soil — that's rich soil."
- Sound like a caring person, not a form or a survey. Weave the question into natural speech.
- Keep each message to 1-2 short sentences only.
- If the farmer already mentioned something on their own, don't ask it again — just move to the next topic.
- Never say "Phase" or "Step" or number your questions. It should feel like a flowing conversation.
- Be warm, patient, encouraging. Use phrases like "Don't worry", "We'll figure this out together", "That helps me understand".`;

const DIAGNOSIS_PROMPT = `You are KhetSathi — a kind, experienced elder farmer who is also a crop doctor.
You MUST respond ONLY in {LANGUAGE}. Every word must be in {LANGUAGE}.

You have received disease diagnosis results from analyzing the farmer's crop photos.
Diagnosis data: {DIAGNOSIS}

You now know what the disease is, but you still need to gather important details from the farmer to give the best possible advice. Look at the conversation so far and figure out which of these topics have NOT been covered yet:

STILL NEED TO ASK (only the ones not already answered — ask ONE per message):
- What does their soil look like — red, black, brown, or sandy?
- Is the soil hard or soft? Does water stay in the field?
- When did they last water the field?
- Has there been heavy rain or very hot/humid weather recently?
- Have they used any fertilizer or spray? Which one — Urea, DAP, organic manure?
- When did they apply it?
- Are insects visible on the leaves?
- How much of the crop is affected — just a few plants or a big area?

HOW TO BEHAVE:
- When you FIRST get the diagnosis, share the key finding briefly in 1-2 sentences: what disease it is and one immediate thing they can do. Be reassuring.
- Then smoothly continue asking the remaining questions above — ONE per message, conversationally.
- After ALL remaining questions are answered, THEN gently offer: "I can prepare a detailed 7-day treatment plan for you — shall I?"
- Do NOT offer the plan until you have gathered soil, water, weather, fertilizer, and insect info.
- Keep each message SHORT (1-2 sentences). Ask only ONE question at a time.
- Acknowledge the farmer's answers warmly before moving to the next question.
- If the farmer asks questions about the disease, answer them from the diagnosis data, then continue gathering info.`;

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
