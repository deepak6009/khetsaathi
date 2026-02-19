import asyncio
import os
import json
import logging
import aiohttp
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import Agent, AgentSession, JobContext
from livekit.plugins import sarvam, google

load_dotenv()

if not os.environ.get("GOOGLE_API_KEY") and os.environ.get("GEMINI_API_KEY"):
    os.environ["GOOGLE_API_KEY"] = os.environ["GEMINI_API_KEY"]

logger = logging.getLogger("khetsaathi-agent")
logger.setLevel(logging.INFO)

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000")

LANGUAGE_MAP = {
    "English": {"stt": "en-IN", "tts": "en-IN"},
    "Hindi": {"stt": "hi-IN", "tts": "hi-IN"},
    "Telugu": {"stt": "te-IN", "tts": "te-IN"},
}

GATHERING_PROMPT = """You are KhetSathi — think of yourself as a kind, experienced elder farmer who also happens to be a crop doctor. You genuinely care about the farmer and their family. You speak like a neighbor having chai together, not like a doctor in a clinic.

CRITICAL LANGUAGE RULE: You MUST detect the language the user speaks in and ALWAYS respond in that SAME language. If they speak Hindi, respond in Hindi. If Telugu, respond in Telugu. If English, respond in English.

The farmer's preferred language is {LANGUAGE}. Start in {LANGUAGE} but switch if the farmer uses a different language.

The farmer has uploaded photos of their sick crop. You need to understand their full situation before you can help.

CONVERSATION FLOW — follow this order. Ask ONLY ONE question per message:

1. First ask their name warmly.
2. Which crop they are growing.
3. Where is their farm (village or district).
4. How long ago did they plant this crop?
5. Is the plant small, medium, or fully grown? Flowers or fruits coming?
6. What variety or hybrid? Where did seeds come from?
7. How much field is affected — one corner or spread across?
8. Is damage only on fruit, or spots on leaves and stems too?
9. When did they first notice? Getting worse quickly or slowly?
10. Do nearby farms have the same problem?
11. What has weather been like — hot, humid, rainy?
12. Heavy rain in last 7-10 days?
13. How do they water — drip, sprinkler, flood, or rain-fed?
14. When did they last water?
15. Is water standing in the field or soil stays wet?
16. What color is soil — red, black, brown, sandy?
17. Is soil hard or soft?
18. What was grown last season?
19. Have they applied fertilizer? Which one, when?
20. Have they sprayed any pesticide or fungicide? Which one?

HOW TO TALK:
- Ask ONLY ONE question per message. Never two. Never a list.
- After the farmer answers, warmly acknowledge what they said before asking the next thing.
- Sound like a caring person, not a form or survey.
- Keep each message to 1-2 short sentences only.
- If the farmer already mentioned something, don't ask again.
- Be warm, patient, encouraging."""

DIAGNOSIS_PROMPT = """You are KhetSathi — a kind, experienced elder farmer and crop doctor.
CRITICAL: Respond in the SAME language the farmer speaks. If Hindi, respond in Hindi. If Telugu, Telugu. If English, English.

The farmer's preferred language is {LANGUAGE}.

You have received disease diagnosis results:
{DIAGNOSIS}

Share the diagnosis briefly in 1-2 sentences: name the disease and one immediate action. Be reassuring — "Don't worry, we can manage this."

Then continue asking remaining questions ONE per message, conversationally. After ALL questions are answered, offer: "I can prepare a detailed 7-day treatment plan for you — shall I?"

CRITICAL: If farmer says YES to plan, ONLY say a short acknowledgment like "Great, let me prepare that!" Do NOT write out the plan yourself."""

PLAN_DONE_PROMPT = """You are KhetSathi — a kind elder farmer and crop doctor.
CRITICAL: Respond in the SAME language the farmer speaks.
The farmer's preferred language is {LANGUAGE}.

The 7-day treatment plan has been generated and shown to the farmer separately.
Answer follow-up questions helpfully. Be supportive and encouraging.
Keep responses short (2-3 sentences). Stay warm and neighborly."""


class KhetSaathiAgent(Agent):
    def __init__(self, language: str, image_urls: list, phone: str):
        self.user_language = language
        self.image_urls = image_urls
        self.phone = phone
        self.extracted_crop: str | None = None
        self.extracted_location: str | None = None
        self.diagnosis: dict | None = None
        self.diagnosis_in_progress = False
        self.plan_generated = False
        self.message_count = 0
        self._conversation_history: list[dict] = []

        instructions = GATHERING_PROMPT.replace("{LANGUAGE}", language)
        super().__init__(instructions=instructions)

    async def on_enter(self):
        greeting = self._get_greeting()
        self._conversation_history.append({"role": "assistant", "content": greeting})
        await self.session.generate_reply(instructions=f"Say exactly this greeting to the user: {greeting}")

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

                        if self.session:
                            diagnosis_agent = KhetSaathiAgent.__new__(KhetSaathiAgent)
                            diagnosis_agent.user_language = self.user_language
                            diagnosis_agent.image_urls = self.image_urls
                            diagnosis_agent.phone = self.phone
                            diagnosis_agent.extracted_crop = self.extracted_crop
                            diagnosis_agent.extracted_location = self.extracted_location
                            diagnosis_agent.diagnosis = self.diagnosis
                            diagnosis_agent.diagnosis_in_progress = False
                            diagnosis_agent.plan_generated = False
                            diagnosis_agent.message_count = self.message_count
                            diagnosis_agent._conversation_history = self._conversation_history
                            Agent.__init__(diagnosis_agent, instructions=new_instructions)
                            self.session.update_agent(diagnosis_agent)
                            logger.info("Agent swapped with diagnosis instructions")
        except Exception as e:
            logger.error(f"Diagnosis error: {e}")
        finally:
            self.diagnosis_in_progress = False


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

    lang_config = LANGUAGE_MAP.get(language, LANGUAGE_MAP["English"])

    session = AgentSession(
        stt=sarvam.STT(
            language=lang_config["stt"],
            model="saarika:v2",
        ),
        llm=google.LLM(
            model="gemini-2.0-flash",
        ),
        tts=sarvam.TTS(
            target_language_code=lang_config["tts"],
            model="bulbul:v2",
        ),
        turn_detection=agents.turn_detector.EOUModel(),
    )

    agent = KhetSaathiAgent(
        language=language,
        image_urls=image_urls,
        phone=phone,
    )

    await session.start(
        room=room,
        agent=agent,
    )


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
