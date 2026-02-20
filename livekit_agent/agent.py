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

You now know what the disease is. But you MUST continue gathering the remaining mandatory information before offering any plan. Look at the conversation history and figure out which of these have NOT been covered yet:
- Have they applied any fertilizer? Which one, and when?
- Have they sprayed any pesticide or fungicide already? Which one?

HOW TO BEHAVE:
- When you FIRST share the diagnosis, do it briefly in 1-2 sentences: name the disease and one immediate thing they can do. Be reassuring — "Don't worry, we can manage this."
- Then smoothly continue asking the remaining questions — ONE per message, conversationally.
- If the farmer asks questions about the disease, answer them briefly, then get back to gathering info.
- After ALL mandatory questions are answered, THEN gently offer to prepare a detailed 7-day treatment plan.
- Do NOT offer the plan until you have gathered ALL the remaining info above.
- Keep each message SHORT (1-2 sentences). ONE question per message only. This is VOICE conversation so be very brief.
- CRITICAL: If the farmer says YES to the plan, ONLY say a short acknowledgment like "Great, let me prepare that for you!" Do NOT generate the actual plan yourself."""

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

                        diagnosis_msg = self._build_diagnosis_message()
                        if diagnosis_msg:
                            self._conversation_history.append({"role": "assistant", "content": diagnosis_msg})
                            self.session.say(diagnosis_msg, add_to_chat_ctx=True)
                            logger.info("Spoke diagnosis results to farmer")
        except Exception as e:
            logger.error(f"Diagnosis error: {e}")
        finally:
            self.diagnosis_in_progress = False

    def _build_diagnosis_message(self) -> str:
        if not self.diagnosis:
            return ""
        disease = self.diagnosis.get("disease", "")
        symptoms = self.diagnosis.get("symptoms_observed", "")
        immediate_action = self.diagnosis.get("immediate_action", "")
        severity = self.diagnosis.get("severity", "")

        if self.user_language == "Hindi":
            msg = f"आपकी फसल की तस्वीरें देखकर पता चला है कि यह {disease} बीमारी है।"
            if severity:
                msg += f" इसकी गंभीरता {severity} स्तर की है।"
            if symptoms:
                msg += f" लक्षण: {symptoms}।"
            if immediate_action:
                msg += f" तुरंत यह करें: {immediate_action}।"
            msg += " चिंता मत करिए, हम इसका इलाज कर सकते हैं!"
        elif self.user_language == "Telugu":
            msg = f"మీ పంట ఫోటోలు చూసి తెలిసింది, ఇది {disease} వ్యాధి."
            if severity:
                msg += f" తీవ్రత {severity} స్థాయిలో ఉంది."
            if symptoms:
                msg += f" లక్షణాలు: {symptoms}."
            if immediate_action:
                msg += f" వెంటనే చేయండి: {immediate_action}."
            msg += " చింతించకండి, మనం దీన్ని నయం చేయగలం!"
        else:
            msg = f"After looking at your crop photos, I can see this is {disease}."
            if severity:
                msg += f" The severity is {severity}."
            if symptoms:
                msg += f" I can see {symptoms}."
            if immediate_action:
                msg += f" As an immediate step, {immediate_action}."
            msg += " Don't worry, we can manage this together!"
        return msg


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
