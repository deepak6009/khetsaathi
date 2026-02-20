import asyncio
import os
import json
import logging
import aiohttp
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext
from livekit.plugins import sarvam, google, silero

load_dotenv()

if not os.environ.get("GOOGLE_API_KEY"):
    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key:
        os.environ["GOOGLE_API_KEY"] = gemini_key

logger = logging.getLogger("khetsaathi-agent")
logger.setLevel(logging.INFO)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")

LANGUAGE_MAP = {
    "English": {"stt": "en-IN", "tts": "en-IN"},
    "Hindi": {"stt": "hi-IN", "tts": "hi-IN"},
    "Telugu": {"stt": "te-IN", "tts": "te-IN"},
}

GATHERING_PROMPT = """You are KhetSathi — think of yourself as a kind, experienced elder farmer who also happens to be a crop doctor. You genuinely care about the farmer and their family. You speak like a neighbor having chai together, not like a doctor in a clinic.

CRITICAL LANGUAGE RULE: You MUST respond ENTIRELY in {LANGUAGE}. Every single word must be in {LANGUAGE}. Do NOT mix English words or phrases.
- If {LANGUAGE} is Hindi: Speak pure Hindi using Devanagari script. Say "टमाटर" not "tomato", "बीमारी" not "disease", "कीटनाशक" not "pesticide", "खेत" not "field", "सिंचाई" not "irrigation". Use everyday rural Hindi — simple words like "भाई", "जी", "अच्छा", "चलो". Avoid English completely.
- If {LANGUAGE} is Telugu: Speak pure Telugu. Use words like "పంట", "వ్యాధి", "పురుగుమందు". Avoid English.
- If {LANGUAGE} is English: Speak simple English.
- If the farmer switches language mid-conversation, switch with them.

The farmer has uploaded photos of their sick crop. You need to understand their full situation before you can help.

CONVERSATION FLOW — follow this order. Ask ONLY ONE question per message:
NOTE: The greeting and name question has ALREADY been spoken to the farmer. Do NOT repeat it. Start from their response.

BASICS:
1. (Already done) Greeting and asking their name.
2. Which crop they are growing.
3. Where is their farm (village or district).

CROP STAGE:
4. How long ago did they plant this crop?

SCOPE OF THE PROBLEM:
5. How much of the field is affected — just one corner, or spread across the field?

WEATHER:
6. Is there any rain fall in the last 24 hours?

CROP HISTORY:
7. Have they applied any fertilizer? Which one — Urea, DAP, organic manure? When?
8. Have they sprayed any pesticide or fungicide already? Which one?

HOW TO TALK:
- Ask ONLY ONE question per message. Never two. Never a list.
- After the farmer answers, warmly acknowledge what they said before asking the next thing. For example: "Ah, tomatoes! Good crop." or "I see, that helps me understand."
- Sound like a caring person, not a form or a survey. Weave the question into natural speech.
- Keep each message to 1-2 short sentences only. This is VOICE conversation so be very brief.
- If the farmer already mentioned something, don't ask again — just move to the next topic.
- Never say "Phase" or "Step" or number your questions. It should feel like a flowing conversation.
- Be warm, patient, encouraging. Use phrases like "Don't worry", "We'll figure this out together".
- NEVER use technical English terms when speaking Hindi or Telugu. Always use the native word."""

DIAGNOSIS_PROMPT = """You are KhetSathi — a kind, experienced elder farmer and crop doctor.
CRITICAL LANGUAGE RULE: You MUST respond ENTIRELY in {LANGUAGE}. Do NOT use English words when speaking Hindi or Telugu.
- If {LANGUAGE} is Hindi: Use pure Hindi. Say "झुलसा रोग" not "blight", "फफूंदनाशक" not "fungicide", "छिड़काव" not "spray".
- If {LANGUAGE} is Telugu: Use pure Telugu. Avoid English technical terms.

You have received disease diagnosis results:
{DIAGNOSIS}

IMPORTANT: A diagnosis message with the disease name has ALREADY been spoken to the farmer by the system. Do NOT repeat the diagnosis again. The farmer already knows the disease name.

YOUR JOB NOW:
1. Ask 1-2 quick follow-up questions (only the ones NOT already answered in the conversation):
   - Have they used any fertilizer? Which one?
   - Have they sprayed any pesticide already?
2. After getting answers (or if the farmer seems eager to proceed), CLEARLY offer the 7-day treatment plan. Say something like:
   - Hindi: "क्या आप चाहेंगे कि मैं आपके लिए 7 दिन की पूरी उपचार योजना बनाऊं?"
   - Telugu: "మీ కోసం 7 రోజుల చికిత్స ప్రణాళిక తయారు చేయమంటారా?"
   - English: "Would you like me to prepare a detailed 7-day treatment plan for you?"
3. If the farmer says YES, respond with ONLY: "बहुत अच्छा, मैं आपकी योजना तैयार कर रहा हूँ!" (or equivalent in their language). Do NOT generate the plan yourself.

RULES:
- Keep each message SHORT (1-2 sentences). ONE question per message. This is VOICE.
- Be warm and encouraging. Sound like a caring neighbor.
- If the farmer asks about the disease, answer briefly, then move to offering the plan.
- Do NOT repeat the disease name or diagnosis — it was already shared."""

PLAN_DONE_PROMPT = """You are KhetSathi — a kind elder farmer and crop doctor.
CRITICAL: Respond ENTIRELY in {LANGUAGE}. No English words when speaking Hindi or Telugu.
The farmer's preferred language is {LANGUAGE}.

The 7-day treatment plan has been generated and shown to the farmer separately.
Answer follow-up questions helpfully. Be supportive and encouraging.
Keep responses short (1-2 sentences). Stay warm and neighborly. This is a voice conversation so be brief."""


class KhetSaathiAgent(Agent):
    def __init__(self, language: str, image_urls: list, phone: str, chat_history: list[dict] | None = None):
        self.user_language = language
        self.image_urls = image_urls
        self.phone = phone
        self.extracted_crop: str | None = None
        self.extracted_location: str | None = None
        self.diagnosis: dict | None = None
        self.diagnosis_in_progress = False
        self.plan_generated = False
        self.message_count = 0
        self._conversation_history: list[dict] = chat_history[:] if chat_history else []
        self._has_prior_history = bool(chat_history and len(chat_history) > 0)

        if self._has_prior_history:
            self.message_count = sum(1 for m in self._conversation_history if m.get("role") == "user")

        instructions = GATHERING_PROMPT.replace("{LANGUAGE}", language)
        if self._has_prior_history:
            history_summary = "\n".join(
                f"{'Farmer' if m['role'] == 'user' else 'You'}: {m['content']}"
                for m in self._conversation_history[-10:]
            )
            instructions += f"\n\nIMPORTANT: This is a CONTINUING conversation. The farmer switched from text to voice. Here is the recent conversation so far:\n{history_summary}\n\nDo NOT repeat the greeting. Do NOT ask questions already answered. Continue naturally from where the conversation left off. Acknowledge the switch briefly and continue with the next unanswered question."

        super().__init__(instructions=instructions)

    async def on_enter(self):
        if self._has_prior_history:
            resume_msg = self._get_resume_message()
            self._conversation_history.append({"role": "assistant", "content": resume_msg})
            self.session.say(resume_msg, add_to_chat_ctx=True)
        else:
            greeting = self._get_greeting()
            self._conversation_history.append({"role": "assistant", "content": greeting})
            self.session.say(greeting, add_to_chat_ctx=True)

    def _get_resume_message(self) -> str:
        if self.user_language == "Telugu":
            return "హా జీ, నేను ఇక్కడ ఉన్నాను. మన మాటలు కొనసాగిద్దాం."
        elif self.user_language == "Hindi":
            return "हाँ जी, मैं यहाँ हूँ। चलिए बात आगे बढ़ाते हैं।"
        else:
            return "Yes, I'm here. Let's continue our conversation."

    def _get_greeting(self) -> str:
        if self.user_language == "Telugu":
            return "నమస్కారం! నేను ఖేత్ సాథీ, మీ AI పంట వైద్యుడిని. మీ పంట ఫోటోలు చూశాను. ముందుగా మీ పేరు చెప్పగలరా?"
        elif self.user_language == "Hindi":
            return "नमस्ते! मैं खेतसाथी हूं, आपका AI फसल डॉक्टर। मैंने आपकी फसल की तस्वीरें देखी हैं। पहले अपना नाम बताइए?"
        else:
            return "Hello! Welcome to KhetSathi, your AI Crop Doctor. I've seen your crop photos. May I know your name please?"

    async def on_user_turn_completed(self, turn_ctx, new_message):  # type: ignore[override]
        self.message_count += 1

        user_text = ""
        if hasattr(new_message, 'content'):
            content = new_message.content
            if isinstance(content, str):
                user_text = content
            elif isinstance(content, list):
                for part in content:
                    if hasattr(part, 'text'):
                        user_text += getattr(part, 'text', '')
        if not user_text and hasattr(new_message, 'text'):
            user_text = getattr(new_message, 'text', '')

        if user_text:
            self._conversation_history.append({"role": "user", "content": user_text})

        if self.message_count >= 2 and not self.extracted_crop and not self.diagnosis_in_progress:
            asyncio.create_task(self._run_extraction())

        if self.diagnosis and not self.plan_generated:
            asyncio.create_task(self._check_plan_intent())

    async def _run_extraction(self):
        try:
            messages = self._conversation_history.copy()
            if len(messages) < 2:
                return

            async with aiohttp.ClientSession() as http_session:
                async with http_session.post(
                    f"{BACKEND_URL}/api/chat/extract",
                    json={"messages": messages},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("crop"):
                            self.extracted_crop = data["crop"]
                            logger.info(f"Extracted crop: {self.extracted_crop}")
                        if data.get("location"):
                            self.extracted_location = data["location"]
                            logger.info(f"Extracted location: {self.extracted_location}")

                        if self.extracted_crop and self.extracted_location and not self.diagnosis and not self.diagnosis_in_progress:
                            await self._run_diagnosis()
        except Exception as e:
            logger.error(f"Extraction error: {e}")

    async def _run_diagnosis(self):
        if self.diagnosis_in_progress or self.diagnosis:
            return
        self.diagnosis_in_progress = True
        try:
            async with aiohttp.ClientSession() as http_session:
                async with http_session.post(
                    f"{BACKEND_URL}/api/chat/diagnose",
                    json={
                        "imageUrls": self.image_urls,
                        "crop": self.extracted_crop,
                        "location": self.extracted_location,
                        "language": self.user_language,
                    },
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        self.diagnosis = data.get("diagnosis")
                        logger.info("Diagnosis complete, updating agent instructions")

                        new_instructions = DIAGNOSIS_PROMPT.replace(
                            "{LANGUAGE}", self.user_language
                        ).replace("{DIAGNOSIS}", json.dumps(self.diagnosis))

                        await self.update_instructions(new_instructions)
                        logger.info("Updated agent instructions with diagnosis results")

                        diagnosis_msg = await self._build_diagnosis_message()
                        if diagnosis_msg:
                            self._conversation_history.append({"role": "assistant", "content": diagnosis_msg})
                            self.session.say(diagnosis_msg, add_to_chat_ctx=True)
                            logger.info("Spoke diagnosis results to farmer")
        except Exception as e:
            logger.error(f"Diagnosis error: {e}")
        finally:
            self.diagnosis_in_progress = False

    async def _build_diagnosis_message(self) -> str:
        if not self.diagnosis:
            return ""
        disease = self.diagnosis.get("disease", "")
        recommended_pesticide = self.diagnosis.get("recommended_pesticide", "")
        immediate_action = self.diagnosis.get("immediate_action", "")

        try:
            from google import genai
            api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", "")
            client = genai.Client(api_key=api_key)
            prompt = f"""Generate a SHORT diagnosis message (2-3 sentences max) in {self.user_language} for a farmer.
Disease: {disease}
Recommended pesticide: {recommended_pesticide}
Immediate action: {immediate_action}

Rules:
1) Name the disease in {self.user_language} — translate the disease name fully (e.g. "Early Blight" becomes "झुलसा रोग" in Hindi, "ముందస్తు ఎండు తెగులు" in Telugu)
2) Mention the recommended pesticide name (pesticide brand names can stay as-is)
3) Tell ONE immediate thing to do in simple words
4) Say something encouraging like "Don't worry, we can treat this together"
5) Do NOT use English words for disease, symptoms, or actions. Only pesticide brand names can be in English.
6) Keep it SHORT — this will be spoken aloud in a voice conversation.
7) Be warm like a caring elder farmer neighbor.
8) Just return the message text, nothing else."""

            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            msg = response.text.strip()
            if msg:
                logger.info(f"Generated localized diagnosis message: {msg[:50]}...")
                return msg
        except Exception as e:
            logger.error(f"Failed to generate localized diagnosis message: {e}")

        if self.user_language == "Hindi":
            return "आपकी फसल में बीमारी मिली है। चिंता मत करिए, हम इसका इलाज कर सकते हैं! कुछ और सवाल पूछकर मैं आपको पूरी योजना बनाकर दूँगा।"
        elif self.user_language == "Telugu":
            return "మీ పంటలో వ్యాధి కనుగొనబడింది. చింతించకండి, మనం దీన్ని నయం చేయగలం! కొన్ని ప్రశ్నలు అడిగి పూర్తి ప్రణాళిక తయారు చేస్తాను."
        else:
            return f"I've found the issue with your crop — it's {disease}. Don't worry, we can treat this together! Let me ask a few more questions to prepare a complete plan for you."

    async def _check_plan_intent(self):
        try:
            messages = self._conversation_history.copy()
            if len(messages) < 4:
                return

            async with aiohttp.ClientSession() as http_session:
                async with http_session.post(
                    f"{BACKEND_URL}/api/chat/detect-plan-intent",
                    json={"messages": messages},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        if data.get("wantsPlan") and not self.plan_generated:
                            logger.info("Farmer wants treatment plan, generating...")
                            await self._generate_plan()
        except Exception as e:
            logger.error(f"Plan intent check error: {e}")

    async def _generate_plan(self):
        if self.plan_generated:
            return
        self.plan_generated = True
        try:
            async with aiohttp.ClientSession() as http_session:
                async with http_session.post(
                    f"{BACKEND_URL}/api/chat/generate-plan",
                    json={
                        "messages": self._conversation_history,
                        "diagnosis": self.diagnosis,
                        "language": self.user_language,
                        "imageUrls": self.image_urls,
                        "phone": self.phone,
                    },
                    timeout=aiohttp.ClientTimeout(total=60)
                ) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        plan_summary = data.get("planSummaryMessage", "")
                        logger.info("Plan generated successfully")

                        new_instructions = PLAN_DONE_PROMPT.replace("{LANGUAGE}", self.user_language)
                        await self.update_instructions(new_instructions)

                        if plan_summary:
                            self._conversation_history.append({"role": "assistant", "content": plan_summary})
                            self.session.say(plan_summary, add_to_chat_ctx=True)
                            logger.info("Spoke plan summary to farmer")
                        else:
                            fallback = self._get_plan_fallback()
                            self._conversation_history.append({"role": "assistant", "content": fallback})
                            self.session.say(fallback, add_to_chat_ctx=True)
        except Exception as e:
            logger.error(f"Plan generation error: {e}")
            self.plan_generated = False

    def _get_plan_fallback(self) -> str:
        if self.user_language == "Hindi":
            return "आपकी 7 दिन की उपचार योजना तैयार है! इसमें आपकी फसल के इलाज की पूरी जानकारी है। कोई सवाल हो तो पूछिए।"
        elif self.user_language == "Telugu":
            return "మీ 7 రోజుల చికిత్స ప్రణాళిక సిద్ధంగా ఉంది! దీనిలో మీ పంట చికిత్స వివరాలు ఉన్నాయి. ఏవైనా సందేహాలు ఉంటే అడగండి."
        else:
            return "Your 7-day treatment plan is ready! It has all the details for treating your crop. Feel free to ask if you have any questions."


async def entrypoint(ctx: JobContext):
    await ctx.connect()

    room = ctx.room
    metadata = {}

    if room.metadata:
        try:
            metadata = json.loads(room.metadata)
        except Exception:
            pass

    language = metadata.get("language", "English")
    phone = metadata.get("phone", "")
    image_urls = metadata.get("imageUrls", [])
    chat_history = metadata.get("chatHistory", [])

    lang_config = LANGUAGE_MAP.get(language, LANGUAGE_MAP["English"])

    STT_PROMPTS = {
        "Hindi": "खेती, किसान, फसल, बीमारी, कीटनाशक, दवाई, खाद, उर्वरक, टमाटर, धान, चावल, गेहूं, कपास, मिर्च, बैंगन, आम, केला, गन्ना, मूंगफली, सोयाबीन, प्याज, आलू, सरसों, चना, अरहर, मक्का, बाजरा, ज्वार, गाँव, जिला, तहसील, ब्लॉक, मंडी, सिंचाई, ड्रिप, स्प्रिंकलर, बोरवेल, नहर, झुलसा, पत्ती, तना, जड़, फल, फूल, पीलापन, धब्बे, कीड़ा, इल्ली, माहू, सफेद मक्खी, thrips, blight, wilt, fungicide, Mancozeb, neem oil, urea, DAP, potash",
        "Telugu": "వ్యవసాయం, రైతు, పంట, వ్యాధి, పురుగుమందు, ఎరువు, టమాటో, వరి, గోధుమ, పత్తి, మిర్చి, వంకాయ, మామిడి, అరటి, చెరకు, వేరుశనగ, ఉల్లి, బంగాళదుంప, గ్రామం, మండలం, జిల్లా, నీటిపారుదల, బోరు, కాలువ, ఆకు, కాండం, వేరు, పండు, పువ్వు, పచ్చదనం, మచ్చలు, పురుగు, తెల్ల ఈగ, blight, wilt, fungicide, Mancozeb, neem oil, urea, DAP",
        "English": "Agriculture, farming, crop disease, pesticide, fertilizer, tomato, rice, wheat, cotton, paddy, chilli, brinjal, mango, banana, sugarcane, groundnut, village, district, mandal, irrigation, drip, sprinkler, borewell, blight, wilt, fungicide, Mancozeb, neem oil, urea, DAP, potash"
    }

    stt_prompt = STT_PROMPTS.get(language, STT_PROMPTS["English"])

    session = AgentSession(
        stt=sarvam.STT(
            language=lang_config["stt"],
            model="saarika:v2.5",
            prompt=stt_prompt,
        ),
        llm=google.LLM(
            model="gemini-2.0-flash",
        ),
        tts=sarvam.TTS(
            target_language_code=lang_config["tts"],
            model="bulbul:v3",
            speaker="shubh",
            pace=0.9,
            enable_preprocessing=True,
        ),
        vad=silero.VAD.load(),
    )

    agent = KhetSaathiAgent(
        language=language,
        image_urls=image_urls,
        phone=phone,
        chat_history=chat_history,
    )

    await session.start(
        room=room,
        agent=agent,
    )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
