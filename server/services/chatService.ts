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

const MULTILINGUAL_INSTRUCTION = `MULTILINGUAL INSTRUCTION (CRITICAL - ALWAYS FOLLOW):
You MUST detect the language the user is writing in and ALWAYS respond in that SAME language.
If the user writes in Hindi, respond entirely in Hindi.
If the user writes in Telugu, respond entirely in Telugu.
If the user writes in English, respond entirely in English.
If the user writes in any other language, respond in that language.
If the user changes language during the conversation, adapt your replies to match their language. However, maintain the same script style used at the beginning of the conversation.
For example, if the bot’s first message is in English script, continue using English script throughout. If the user speaks Telugu written in English letters (e.g., “meeru ela unnaru”), you should also reply in Telugu using English letters only — not in Telugu script.
This applies to ALL your responses including greetings, questions, and information.
Never mix languages in a single response unless the user does so first.`;

const GATHERING_PROMPT = `${MULTILINGUAL_INSTRUCTION}

You are KhetSathi — think of yourself as a kind, experienced elder farmer who also happens to be a crop doctor. You genuinely care about the farmer and their family. You speak like a neighbor having chai together, not like a doctor in a clinic.

The farmer's preferred language is {LANGUAGE}. Start the conversation in {LANGUAGE}, but if they reply in a different language, switch to match them.

The farmer has uploaded photos of their sick crop. You need to understand their full situation before you can help. These questions are MANDATORY — you must cover all of them before moving on.

CONVERSATION FLOW — follow this order. Ask ONLY ONE question per message:

BASICS:
1. First ask their name warmly.
2. Which crop they are growing.
3. Where is their farm (village or district).

CROP STAGE:
4. How long ago did they plant this crop?

SCOPE OF THE PROBLEM:
5. How much of the field is affected — just one corner, or spread across the field?

WEATHER & ENVIRONMENT:
6. Is there any rain fall in the last 24 hours?

CROP HISTORY:
7. Have they applied any fertilizer? Which one — Urea, DAP, organic manure? When?
8. Have they sprayed any pesticide or fungicide already? Which one?

HOW TO TALK:
- Ask ONLY ONE question per message. Never two. Never a list.
- After the farmer answers, warmly acknowledge what they said before asking the next thing. For example: "Ah, tomatoes! Good crop." or "I see, black soil — that's rich soil."
- Sound like a caring person, not a form or a survey. Weave the question into natural speech.
- Keep each message to 1-2 short sentences only.
- If the farmer already mentioned something on their own, don't ask it again — just move to the next topic.
- Never say "Phase" or "Step" or number your questions. It should feel like a flowing conversation.
- Be warm, patient, encouraging. Use phrases like "Don't worry", "We'll figure this out together", "That helps me understand".`;

const DIAGNOSIS_PROMPT = `${MULTILINGUAL_INSTRUCTION}

You are KhetSathi — a kind, experienced elder farmer who is also a crop doctor.
The farmer's preferred language is {LANGUAGE}. Start in {LANGUAGE}, but if they reply in a different language, switch to match them.

You have received disease diagnosis results from analyzing the farmer's crop photos.
Diagnosis data: {DIAGNOSIS}

You now know what the disease is. But you MUST continue gathering the remaining mandatory information before offering any plan. Look at the conversation history and figure out which of these have NOT been covered yet:
- Have they applied any fertilizer? Which one, and when?
- Have they sprayed any pesticide or fungicide already? Which one?

HOW TO BEHAVE:
- When you FIRST share the diagnosis, do it briefly in 1-2 sentences: name the disease and one immediate thing they can do. Be reassuring — "Don't worry, we can manage this."
- Then smoothly continue asking the remaining questions — ONE per message, conversationally.
- You already have the diagnosis data. Use it to make your questions smarter. For example if the disease is fungal, ask about rain and humidity with more purpose.
- If the farmer asks questions about the disease, answer them from the diagnosis data, then get back to gathering info.
- After ALL mandatory questions are answered, THEN gently offer: "Now that I have the full picture, I can prepare a detailed 7-day treatment plan for you — shall I?"
- Do NOT offer the plan until you have gathered ALL the remaining info above.
- Keep each message SHORT (1-2 sentences). ONE question per message only.
- Acknowledge answers warmly before asking the next thing.
- CRITICAL: If the farmer says YES to the plan, ONLY respond with a short acknowledgment like "Great, let me prepare that for you!" or "Sure, give me a moment to put together your plan." Do NOT generate the actual plan yourself. The plan will be generated separately and shown to the farmer. NEVER write out the plan details in your message.`;

const PLAN_DONE_PROMPT = `${MULTILINGUAL_INSTRUCTION}

You are KhetSathi — a kind, experienced elder farmer who is also a crop doctor.
The farmer's preferred language is {LANGUAGE}. Start in {LANGUAGE}, but if they reply in a different language, switch to match them.

The 7-day treatment plan has already been generated and shown to the farmer separately.

WHAT TO DO NOW:
- The farmer may have follow-up questions about the plan, disease, products, dosage, or anything else. Answer them helpfully from your agricultural knowledge.
- Be supportive and encouraging. Say things like "Don't worry, follow the plan and your crop will recover."
- If the farmer asks for the plan in another language, tell them they can use the language buttons shown below the plan card.
- Keep responses short (2-3 sentences). Stay in your warm, neighborly tone.
- The conversation continues — the farmer can keep asking questions as long as they want.`;

export async function generateChatReply(
  messages: ChatMessage[],
  language: string,
  diagnosisData?: Record<string, any> | null,
  planGenerated?: boolean,
  diagnosisAvailable?: boolean,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  let systemContext: string;

  if (diagnosisAvailable && diagnosisData && !planGenerated) {
    systemContext = DIAGNOSIS_PROMPT.replace(/\{LANGUAGE\}/g, language).replace(
      "{DIAGNOSIS}",
      JSON.stringify(diagnosisData),
    );
  } else if (planGenerated) {
    systemContext = PLAN_DONE_PROMPT.replace(/\{LANGUAGE\}/g, language);
  } else {
    systemContext = GATHERING_PROMPT.replace(/\{LANGUAGE\}/g, language);
  }

  const chatHistory = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
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
  messages: ChatMessage[],
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
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    return {
      crop: parsed.crop === "null" || !parsed.crop ? null : parsed.crop,
      location:
        parsed.location === "null" || !parsed.location ? null : parsed.location,
    };
  } catch {
    return { crop: null, location: null };
  }
}

export async function detectPlanIntent(
  messages: ChatMessage[],
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
  imageUrls: string[],
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const conversation = messages
    .map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `You are an experienced agricultural crop doctor creating a 7-Day Treatment Plan for a farmer.
Respond ENTIRELY in ${language} language. Use simple farmer-friendly language.

**Full Conversation with Farmer:**
${conversation}

**Disease Diagnosis:**
${JSON.stringify(diagnosis, null, 2)}

Use ALL the context the farmer shared (soil type, weather, irrigation, crop stage, fertilizers, pesticides used) to make this plan hyper-specific to their situation.

Generate the plan in this EXACT structure using markdown:

## Diagnosis Summary
- Disease name and severity in 2-3 simple sentences
- What is causing it (in simple terms)

## Immediate Actions (Day 1-2)
- **Sanitation**: What infected parts to remove and how to dispose (burn, not compost)
- **Isolation**: How to prevent spread to healthy plants
- **Water Management**: Any immediate changes to irrigation needed

## Prescription
- **Product Name**: Specific active ingredient (e.g., Azoxystrobin, Copper Oxychloride)
- **Dosage**: Exact mixing ratio (e.g., "2ml per 1 liter of water")
- **How to Apply**: Spray method, time of day, coverage area
- **Wait Time (PHI)**: How many days after spraying before fruits can be safely harvested/sold

## 7-Day Action Calendar
- **Day 1**: Scouting, removal of infected parts, purchase supplies
- **Day 2**: First spray application (specify early morning or late evening)
- **Day 3**: What to observe, keep foliage dry
- **Day 4**: Check if lesions are drying, continue monitoring
- **Day 5**: Nutrient boost — foliar spray of micronutrients to help plant recover
- **Day 6**: Continue observation, check nearby plants
- **Day 7**: Re-evaluate — is spread stopped? If not, what next step

## Budget Estimate (per acre)
- **Chemical Cost**: Approximate cost of products needed
- **Low Budget Option**: Affordable alternative (e.g., Neem oil, organic options)
- **High Efficacy Option**: Best commercial product with cost
- **Expected Savings**: Estimated crop value saved vs treatment cost

## Safety Rules
- **Protective Gear**: Mask, gloves, long sleeves while spraying
- **Weather**: Do not spray if rain expected within 4 hours or strong wind
- **Resistance Warning**: Do not use the same chemical more than twice in a row

## Prevention for Future
- What to do differently next season to prevent this
- Crop rotation advice
- Seed selection tips

Use bullet points throughout. Keep each point short and actionable. The farmer should be able to read one bullet and know exactly what to do.`;

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

export async function generateConversationSummary(
  messages: ChatMessage[],
  diagnosis: Record<string, any>,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const conversation = messages
    .map((m) => `${m.role === "user" ? "Farmer" : "Assistant"}: ${m.content}`)
    .join("\n");

  const prompt = `Summarize this conversation between a farmer and an AI crop doctor in 3-5 sentences. Include: farmer's name (if mentioned), crop name, location, disease diagnosed, key details about their farm (soil type, irrigation, crop stage), and what treatment was recommended.

Conversation:
${conversation}

Diagnosis Data:
${JSON.stringify(diagnosis, null, 2)}

Write a concise summary in English. Just the summary text, nothing else.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function generatePlanSummaryMessage(
  plan: string,
  diagnosis: Record<string, any>,
  language: string,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `You are KhetSathi, a kind elder farmer and crop doctor. The 7-day treatment plan has just been generated for the farmer.

Plan content:
${plan.substring(0, 2000)}

Diagnosis:
${JSON.stringify(diagnosis)}

Write a SHORT summary message (3-4 sentences max) in ${language} that:
1. Says "Here is your 7-day treatment plan" in ${language}
2. Briefly mentions the disease name and the key treatment (main pesticide/action)
3. Mentions one important thing from the plan (like Day 1 action or safety tip)
4. Asks warmly if they have any questions or doubts

CRITICAL RULES:
- Respond ENTIRELY in ${language}. If Hindi, use pure Hindi (Devanagari). If Telugu, use pure Telugu script. No English mixing.
- Keep it SHORT — this will be spoken aloud. Maximum 3-4 sentences.
- Be warm and encouraging like a caring neighbor.
- Just the message text, nothing else.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export { getGreeting };
