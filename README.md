# KhetSathi - AI Crop Doctor

An AI-powered, mobile-first agricultural assistant that helps farmers diagnose crop diseases, get real-time treatment recommendations in their local language, and receive structured 7-day treatment plans — all through a simple, conversational interface designed for low-bandwidth environments.

---

## Table of Contents

1. [Problem Statement](#problem-statement--ps7-digital-doctor-for-farmers)
2. [High-Level Architecture](#high-level-architecture)
3. [User Flow — The 4-Step Wizard](#user-flow--the-4-step-wizard)
   - [Step 1: Phone Number Registration](#step-1--phone-number-registration)
   - [Step 2: Language Selection](#step-2--language-selection)
   - [Step 3: Image Upload & Compression](#step-3--image-upload--compression)
   - [Step 4: AI Chat Interface](#step-4--ai-chat-interface)
4. [Image Upload & S3 Storage Pipeline](#image-upload--s3-storage-pipeline)
5. [Disease Detection — Lambda Architecture](#disease-detection--lambda-architecture)
6. [AI Chat System — The Conversational Engine](#ai-chat-system--the-conversational-engine)
   - [Main Chatbot Architecture](#main-chatbot-architecture)
   - [Agent 1: Extraction Agent](#agent-1--extraction-agent-background)
   - [Agent 2: Plan Intent Agent](#agent-2--plan-intent-agent-background)
7. [PDF Treatment Plan Generation](#pdf-treatment-plan-generation)
8. [Voice-to-Voice Interaction](#voice-to-voice-interaction)
9. [Tech Stack](#tech-stack)
10. [Database Design](#database-design)
11. [API Reference](#api-reference)
12. [Environment Variables](#environment-variables)
13. [Running the Project](#running-the-project)

---

## Problem Statement — PS7: Digital Doctor for Farmers

**Objective:** Develop a mobile-first crop disease diagnosis system providing real-time, location-specific treatment advice in local dialects.

### Functional Requirements

| # | Requirement | How KhetSathi Solves It |
|---|-------------|------------------------|
| 1 | Image upload of diseased crops | Farmers upload 1–3 photos through a simple mobile UI. Images are compressed server-side before processing. |
| 2 | Disease & pest detection | AWS Lambda runs a computer vision model on the uploaded images to identify the disease, severity, and cause. |
| 3 | Location-based recommendations | The AI conversationally extracts the farmer's location (village/district) and tailors treatment advice to their region's climate, soil, and available products. |
| 4 | Local dialect support (text + voice) | Full support for **English**, **Telugu**, and **Hindi** — both in the text chat and in voice-to-voice mode. The AI auto-detects and switches language mid-conversation. |
| 5 | Pesticide & soil treatment guidance | The 7-day treatment plan includes specific product names, dosages (e.g., "2ml per 1 liter of water"), application methods, and safety precautions. |
| 6 | Structured 7-day action plan | A day-by-day action calendar is generated as a downloadable PDF, covering sanitation, spray schedules, nutrient boosts, and re-evaluation steps. |
| 7 | Diagnosis history tracking | Every diagnosis and treatment plan is saved to DynamoDB with timestamps, enabling farmers to revisit their history. |

### Technical Requirements

| # | Requirement | Implementation |
|---|-------------|----------------|
| 1 | Computer vision plant disease detection | AWS Lambda endpoint with a trained disease detection model, called via API Gateway |
| 2 | Geolocation integration | Location extracted conversationally by the AI (no GPS required — works on any device) |
| 3 | Multilingual NLP engine | Google Gemini 2.0 Flash with custom multilingual prompts that auto-detect and respond in the farmer's language |
| 4 | Crop & pesticide knowledge base | Gemini's agricultural knowledge combined with diagnosis data to generate hyper-specific recommendations |
| 5 | Low-bandwidth optimized mobile app | Images compressed server-side using Sharp (resize to 1200px, JPEG quality 80%), compact UI, minimal data transfer |
| 6 | Scalable cloud infrastructure | Stateless Express backend, DynamoDB for storage, S3 + CloudFront for assets, autoscale deployment |

---

## High-Level Architecture

<!-- [PASTE HIGH-LEVEL ARCHITECTURE DIAGRAM HERE] -->

The system follows a **stateless backend** pattern where the frontend (React) manages all conversation state and the backend provides thin, fast-responding API endpoints. Here's how the major components connect:

- **Frontend (React + Vite)** — Manages the 4-step wizard, conversation state, and all UI rendering. Runs two background agents (extraction + plan intent) alongside the main chat.
- **Backend (Express.js)** — Stateless API layer that handles image upload, AI chat (via Gemini), disease detection (via Lambda), PDF generation (via Puppeteer), and data persistence (via DynamoDB).
- **AWS Lambda** — Separate service that runs the computer vision disease detection model. Called by the Express backend, not directly by the frontend.
- **AWS S3 + CloudFront** — Object storage for crop images and generated PDFs, served through a CDN for fast delivery.
- **Amazon DynamoDB** — NoSQL database storing user profiles, diagnosis cases, and chat summaries.
- **Google Gemini 2.0 Flash** — Powers all AI capabilities: conversational chat, information extraction, intent detection, plan generation, and conversation summarization.
- **LiveKit + OpenAI** — Powers the voice-to-voice interaction with speech-to-text (Whisper), LLM (GPT-4.1-mini), and text-to-speech (TTS-1).

---

## User Flow — The 4-Step Wizard

The application is designed as a simple 4-step wizard. Each step is one screen. The farmer moves forward linearly — no complex navigation, no back-and-forth confusion. The UI is fully localized based on the language selected in Step 2.

<!-- [PASTE FULL WIZARD OVERVIEW SCREENSHOT HERE] -->

---

### Step 1 — Phone Number Registration

The farmer enters their 10-digit phone number. This is the only identification required — **no OTP, no email, no password, no sign-up form**. The goal is zero friction for farmers who may not be comfortable with complex authentication flows.

**What happens behind the scenes:**
1. The phone number is validated on the frontend (minimum 10 digits).
2. A `POST /api/register-phone` request is sent to the backend.
3. The backend validates using a Zod schema and saves the phone number to **DynamoDB** (`KhetSathiUsers` table) in the `ap-south-1` region.
4. If the user already exists, their record is simply updated (upsert behavior).
5. On success, the wizard advances to Step 2.

<!-- [PASTE STEP 1 - PHONE NUMBER SCREEN SCREENSHOT HERE] -->

---

### Step 2 — Language Selection

The farmer picks their preferred language: **English**, **Telugu**, or **Hindi**. This selection determines:
- The language of the AI chat conversation
- The language of all UI labels, buttons, and hints
- The initial greeting the AI delivers

**Important:** The treatment plan language is chosen separately later in Step 4. A farmer can chat in Telugu but request their treatment plan PDF in Hindi or English.

**What happens behind the scenes:**
1. A `POST /api/set-language` request saves the language preference to DynamoDB alongside the phone number.
2. All UI labels dynamically switch to the selected language using a localization dictionary built into the frontend.
3. The wizard advances to Step 3.

<!-- [PASTE STEP 2 - LANGUAGE SELECTION SCREEN SCREENSHOT HERE] -->

---

### Step 3 — Image Upload & Compression

The farmer uploads **1 to 3 photos** of their affected crop. This is intentionally the only input at this stage — **there are no fields for crop name, location, or problem description**. The AI will gather all of that naturally through conversation in Step 4.

**Why no form fields?** Because many farmers are not comfortable filling out forms. A conversational approach (asking questions one at a time) is far more natural and inclusive.

**What happens when the farmer taps "Next":**

1. The selected images are sent as a multipart `POST /api/upload-images` request to the backend.
2. **Server-side compression** using the `Sharp` library:
   - Each image is resized to fit within **1200 x 1200 pixels** (maintaining aspect ratio, no upscaling).
   - Converted to **JPEG at 80% quality**.
   - This significantly reduces file size — for example, a 3MB phone photo might become 200KB — critical for farmers on slow 2G/3G connections.
3. Each compressed image is uploaded to **AWS S3** (`khetsathi-crop-images` bucket) under a folder named with the last 5 digits of the farmer's phone number (e.g., `12345/uuid.jpg`).
4. The **CloudFront CDN URLs** are returned to the frontend and stored in state.
5. The wizard advances to Step 4 (AI Chat).

<!-- [PASTE STEP 3 - IMAGE UPLOAD SCREEN SCREENSHOT HERE] -->

---

### Step 4 — AI Chat Interface

This is where the core experience happens. The farmer enters a conversational chat with an AI avatar named **KhetSathi** — designed to feel like talking to a kind, experienced elder farmer who also happens to be a crop doctor.

The chat follows a carefully orchestrated multi-phase flow with two background agents running silently alongside the main conversation. The farmer never sees the complexity — they just have a natural conversation.

<!-- [PASTE STEP 4 - CHAT INTERFACE SCREENSHOT HERE] -->

**The chat phases (managed by the frontend state machine):**

| Phase | What's Happening | User Experience |
|-------|-----------------|-----------------|
| `gathering` | AI asks about crop name, location, farm details one question at a time | Natural conversation — farmer answers questions |
| `diagnosing` | Disease detection API is called in background | Farmer continues chatting, may see a subtle "analyzing" indicator |
| `diagnosed` | Diagnosis results are available | AI shares the disease name and continues gathering remaining farm details |
| `asking_plan` | AI offers a 7-day treatment plan | AI asks "Shall I prepare a plan for you?" |
| `awaiting_plan_language` | Farmer agreed to a plan | Language selection buttons appear (English, Telugu, Hindi) |
| `generating_plan` | PDF is being generated server-side | Loading state shown |
| `plan_ready` | Plan PDF is ready | WhatsApp-style PDF preview card appears in chat with download link |

The detailed breakdown of each component follows in the sections below.

---

## Image Upload & S3 Storage Pipeline

This section explains how farmer images flow from their phone to cloud storage, optimized for low-bandwidth environments.

**The complete flow:**

```
Farmer's Phone Camera
        │
        ▼
  [Frontend: File selection (max 3 images)]
        │
        ▼
  [Express Backend: /api/upload-images]
        │
        ▼
  [Sharp: Resize to 1200px + JPEG 80% quality]
        │  (e.g., 3MB → 200KB)
        │
        ▼
  [AWS S3: khetsathi-crop-images bucket]
        │  (stored as: {last5digits}/{uuid}.jpg)
        │
        ▼
  [CloudFront CDN URL returned to frontend]
```

**Key design decisions:**
- **Compression happens on the server, not the client.** This means the farmer uploads the original photo (which may be slow on 2G), but subsequent API calls (disease detection, etc.) use the compressed version. This is a tradeoff — we could compress on the client for faster upload, but server-side compression is more reliable across different phone browsers.
- **S3 folder structure** uses the last 5 digits of the phone number to organize images by user, with UUID filenames to prevent collisions.
- **CloudFront CDN** ensures the images load fast when referenced later (in diagnosis calls, chat summaries, etc.).

<!-- [PASTE IMAGE UPLOAD ARCHITECTURE DIAGRAM HERE] -->

---

## Disease Detection — Lambda Architecture

Once the extraction agent (described below) identifies the **crop name** and **location** from the conversation, the disease detection pipeline triggers automatically in the background.

**The complete flow:**

```
  [Extraction Agent detects crop + location]
        │
        ▼
  [Frontend triggers: POST /api/chat/diagnose]
        │
        ▼
  [Express Backend: Forwards request to AWS Lambda]
        │  Payload: { imageUrls, crop, location, language }
        │
        ▼
  [AWS Lambda: Disease Detection Model]
        │  - Receives CloudFront image URLs
        │  - Runs computer vision inference
        │  - Returns: disease name, severity, confidence, description
        │
        ▼
  [Express Backend: Parses and normalizes response]
        │
        ▼
  [Frontend: Stores diagnosis in state, switches chat phase to "diagnosed"]
        │
        ▼
  [Main Chatbot: Now shares diagnosis with farmer conversationally]
```

**The Lambda endpoint:**
- URL: `https://8beihzhrx1.execute-api.ap-south-1.amazonaws.com/images`
- Region: `ap-south-1` (Mumbai — closest to Indian farmers)
- Timeout: 60 seconds (to account for model inference time)
- Input: JSON with `images` (CloudFront URLs), `crop`, `location`, `language`
- Output: Diagnosis object with disease details

**Important:** The diagnosis happens **asynchronously** from the chat. The farmer keeps chatting while the model processes. When results arrive, the chat phase transitions and the AI naturally weaves the diagnosis into the ongoing conversation — it doesn't interrupt with a sudden system message.

**Side effect:** When diagnosis completes, the frontend also calls `POST /api/save-usercase` to save the case to DynamoDB's `usercases` table. This ensures every diagnosis is tracked for history, even if the farmer doesn't proceed to generate a treatment plan.

<!-- [PASTE LAMBDA ARCHITECTURE DIAGRAM HERE] -->

---

## AI Chat System — The Conversational Engine

The chat system is the heart of KhetSathi. It uses **Google Gemini 2.0 Flash** as the LLM, with three distinct components working together: the **main chatbot** and two **background agents**.

---

### Main Chatbot Architecture

The main chatbot handles all visible conversation with the farmer. It uses three different system prompts depending on the current phase:

| Chat Phase | System Prompt | Behavior |
|------------|--------------|----------|
| **Gathering** (before diagnosis) | `GATHERING_PROMPT` | Acts as a kind elder farmer. Asks 20 mandatory questions one at a time — crop name, location, crop stage, scope of problem, weather, irrigation, soil, crop history. Never asks two questions in one message. |
| **Diagnosed** (after diagnosis, before plan) | `DIAGNOSIS_PROMPT` | Has access to the diagnosis data. Shares the disease name briefly, then continues gathering remaining unanswered questions. Only offers the 7-day plan after ALL questions are covered. |
| **Plan Done** (after plan generated) | `PLAN_DONE_PROMPT` | Answers follow-up questions about the plan, disease, products, dosage. Stays in warm, supportive tone. |

**The 20 mandatory questions** (asked naturally, one per message):

1. Farmer's name
2. Crop name
3. Farm location (village/district)
4. When was the crop planted
5. Growth stage (small/medium/full, flowers/fruits)
6. Variety/hybrid and seed source
7. How much of the field is affected
8. Where is the damage (fruit, leaves, stems)
9. When was the problem first noticed, getting worse?
10. Are nearby farms affected
11. Recent weather (hot, humid, rainy)
12. Heavy rain in last 7-10 days
13. Irrigation method (drip, sprinkler, flood, rain-fed)
14. Last watering time
15. Standing water / wet soil
16. Soil color (red, black, brown, sandy)
17. Soil hardness
18. Previous season's crop
19. Fertilizer applied (which, when)
20. Pesticide/fungicide already sprayed (which)

**Multilingual behavior:** Every system prompt includes a critical instruction — the AI must detect the farmer's language and respond in that same language. If the farmer switches mid-conversation (e.g., starts in English, then types in Hindi), the AI switches too. The `language` parameter sets the initial language, but the AI adapts dynamically.

<!-- [PASTE MAIN CHATBOT ARCHITECTURE DIAGRAM HERE] -->

---

### Agent 1 — Extraction Agent (Background)

The extraction agent runs **silently in the background** after every message exchange. The farmer never sees it or knows it exists. Its job is simple: read the conversation and extract two pieces of information — the **crop name** and the **location**.

**How it works:**

```
  [Farmer sends a message]
        │
        ▼
  [Main chatbot generates reply]
        │
        ▼
  [Extraction Agent triggers (POST /api/chat/extract)]
        │  Sends: full conversation history
        │
        ▼
  [Gemini 2.0 Flash analyzes conversation]
        │  Prompt: "Extract crop name and location from farmer's messages"
        │  Output: { "crop": "Tomato" | null, "location": "Andhra Pradesh" | null }
        │
        ▼
  [Frontend checks: Are BOTH crop AND location now available?]
        │
       YES ──────────────────── NO
        │                        │
        ▼                        ▼
  [Auto-trigger diagnosis]   [Keep waiting, run again after next message]
  [Switch phase to "diagnosing"]
```

**Key design decisions:**
- The agent only extracts from **farmer messages** (user role), never from the AI's own responses.
- It runs on **every message** during the `gathering` phase only. Once both values are found, it stops.
- It doesn't interrupt the conversation — even if it finds the crop and location on message 3, the main chatbot continues its natural flow of questions. The diagnosis happens in parallel.
- If the farmer mentions the crop first and the location three messages later, the agent remembers the crop and only needs to pick up the location.

<!-- [PASTE AGENT 1 EXTRACTION ARCHITECTURE DIAGRAM HERE] -->

---

### Agent 2 — Plan Intent Agent (Background)

The plan intent agent also runs silently in the background. Its job is to detect when the farmer **agrees** to receiving a 7-day treatment plan.

**How it works:**

```
  [AI asks: "Shall I prepare a 7-day treatment plan for you?"]
        │
        ▼
  [Farmer responds]
        │
        ▼
  [Plan Intent Agent triggers (POST /api/chat/detect-plan-intent)]
        │  Sends: last 4 messages of conversation
        │
        ▼
  [Gemini 2.0 Flash analyzes]
        │  Prompt: "Did the farmer agree to the plan?"
        │  Understands "yes" in any language:
        │    English: yes, sure, okay, please
        │    Hindi: हाँ, हां, ठीक है
        │    Telugu: అవును, సరే
        │
        ▼
  [Returns: "yes" or "no"]
        │
       YES ────────────────── NO
        │                      │
        ▼                      ▼
  [Show language selection   [Continue conversation]
   buttons: English,
   Telugu, Hindi]
```

**Why a separate agent?** Because intent detection needs to be fast and focused. The main chatbot is busy generating contextual replies. A separate, lightweight Gemini call with just the last 4 messages can quickly determine if the farmer said "yes" — without slowing down the primary conversation.

**The plan language selection:** When the farmer agrees to a plan, three language buttons appear in the chat UI. The farmer picks which language they want the plan in — this is **independent** from the chat language. A farmer chatting in Telugu can request their plan in English or Hindi.

<!-- [PASTE AGENT 2 PLAN INTENT ARCHITECTURE DIAGRAM HERE] -->

---

## PDF Treatment Plan Generation

When the farmer selects a plan language, the system generates a comprehensive 7-day treatment plan and converts it to a downloadable PDF.

**The complete flow:**

```
  [Farmer selects plan language (e.g., Telugu)]
        │
        ▼
  [Frontend: POST /api/chat/generate-plan]
        │  Payload: { messages, diagnosis, language, imageUrls, phone }
        │
        ▼
  [Step 1: Gemini generates the treatment plan]
        │  Input: Full conversation + diagnosis data + selected language
        │  Output: Structured markdown with 7 sections:
        │    - Diagnosis Summary
        │    - Immediate Actions (Day 1-2)
        │    - Prescription (product, dosage, method, wait time)
        │    - 7-Day Action Calendar (day-by-day)
        │    - Budget Estimate (per acre)
        │    - Safety Rules
        │    - Prevention for Future
        │
        ▼
  [Step 2: Puppeteer renders PDF]
        │  - Markdown converted to styled HTML
        │  - Chromium (headless) renders the HTML
        │  - Outputs A4 PDF with:
        │    - KhetSathi branded header
        │    - Noto Sans font family (supports Devanagari + Telugu scripts)
        │    - Green accent colors, clean bullet-point layout
        │    - Date stamp and footer
        │
        ▼
  [Step 3: PDF uploaded to S3]
        │  Path: {last5digits}/plans/{uuid}.pdf
        │  Content-Disposition: inline (opens in browser)
        │  Returns: CloudFront CDN URL
        │
        ▼
  [Step 4: Conversation summary generated]
        │  Gemini summarizes the entire conversation in 3-5 sentences
        │  Includes: farmer name, crop, location, disease, farm details, treatment
        │
        ▼
  [Step 5: Chat summary saved to DynamoDB]
        │  Table: chatsummary
        │  Data: { phone, timestamp, conversationSummary, pdfUrl, language, diagnosis, imageUrls }
        │
        ▼
  [Frontend receives: { plan, pdfUrl }]
        │
        ▼
  [WhatsApp-style PDF preview card appears in chat]
        │  Shows: PDF icon, title, download button
        │  Plus: "Get plan in another language" buttons
```

**Plan regeneration:** If the farmer wants the plan in a different language, they tap one of the language buttons below the PDF card. The entire pipeline runs again — new Gemini call, new PDF, new S3 upload, new chat summary saved. Each regeneration is a completely fresh document.

**Font support:** The HTML template uses `Noto Sans`, `Noto Sans Devanagari`, and `Noto Sans Telugu` font families. These fonts are installed as system dependencies via Nix (`noto-fonts`), ensuring Telugu and Hindi scripts render correctly in the PDF.

<!-- [PASTE PDF PREVIEW IN CHAT SCREENSHOT HERE] -->

<!-- [PASTE SAMPLE GENERATED PDF SCREENSHOT HERE] -->

<!-- [PASTE PDF GENERATION ARCHITECTURE DIAGRAM HERE] -->

---

## Voice-to-Voice Interaction

For farmers who prefer speaking over typing — which is a significant portion of the target audience — KhetSathi includes a **voice-to-voice** mode powered by LiveKit.

**How the farmer accesses voice mode:**
The farmer taps the **mic button** in the chat input area. A voice panel slides up with a live audio visualizer, mute button, and end call button.

<!-- [PASTE VOICE CHAT INTERFACE SCREENSHOT HERE] -->

**The complete voice pipeline:**

```
  [Farmer taps mic button]
        │
        ▼
  [Frontend: POST /api/livekit/token]
        │  Sends: { phone, language }
        │  Receives: { token, url, roomName }
        │
        ▼
  [LiveKit Room created on LiveKit Cloud]
        │  Room name: khetsathi-{phone}-{timestamp}
        │  Metadata: { language, phone }
        │
        ▼
  [Farmer connects to room as participant]
        │  Identity: farmer-{phone}
        │  Permissions: publish audio, subscribe to agent audio
        │
        ▼
  [LiveKit Voice Agent auto-joins the room]
        │  (runs as a separate server process)
        │
        ▼
  ┌─────────────────────────────────────────┐
  │         Voice Agent Pipeline            │
  │                                         │
  │  Farmer speaks                          │
  │       │                                 │
  │       ▼                                 │
  │  [Silero VAD: Detects speech start/end] │
  │       │  Activation threshold: 0.3      │
  │       │  Min speech: 30ms               │
  │       │  Min silence: 800ms             │
  │       │                                 │
  │       ▼                                 │
  │  [OpenAI Whisper: Speech-to-Text]       │
  │       │  Language-aware (en/hi/te)      │
  │       │                                 │
  │       ▼                                 │
  │  [GPT-4.1-mini: Generate response]      │
  │       │  Same KhetSathi persona         │
  │       │  Same 20-question flow          │
  │       │  Multilingual support           │
  │       │                                 │
  │       ▼                                 │
  │  [OpenAI TTS-1: Text-to-Speech]         │
  │       │  Voice: "Coral"                 │
  │       │                                 │
  │       ▼                                 │
  │  Agent speaks back to farmer            │
  └─────────────────────────────────────────┘
```

**Key technical details:**

| Component | Technology | Details |
|-----------|-----------|---------|
| Voice Activity Detection | Silero VAD | Detects when the farmer starts/stops speaking. Low activation threshold (0.3) for better sensitivity with background farm noise. Supports interruption — farmer can speak over the AI. |
| Speech-to-Text | OpenAI Whisper (`whisper-1`) | Transcribes farmer's speech. Language parameter set based on farmer's selection (en/hi/te). |
| Language Model | OpenAI GPT-4.1-mini | Generates contextual responses using the same KhetSathi persona and question flow as the text chat. Temperature: 0.7 for natural-sounding responses. |
| Text-to-Speech | OpenAI TTS-1 | Converts AI responses to speech. Voice: "Coral" — chosen for its warm, natural tone. |
| Room Management | LiveKit Cloud | Handles WebRTC connections, audio streaming, and participant management. Token-based authentication with 30-minute TTL. |

**The voice agent runs as a separate process** (`npx tsx server/livekit-agent.ts dev`), not as part of the main Express server. It registers with LiveKit Cloud and automatically joins rooms when farmers connect.

<!-- [PASTE VOICE ARCHITECTURE DIAGRAM HERE] -->

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18, TypeScript, Vite | Single-page application with 4-step wizard |
| **UI Framework** | Tailwind CSS, shadcn/ui, Framer Motion | Mobile-first responsive design with smooth animations |
| **Backend** | Express.js 5, Node.js 20 | Stateless API layer |
| **AI (Chat)** | Google Gemini 2.0 Flash | Conversational chat, extraction, intent detection, plan generation, summarization |
| **AI (Voice)** | OpenAI Whisper + GPT-4.1-mini + TTS-1 | Speech-to-text, language understanding, text-to-speech |
| **Disease Detection** | AWS Lambda | Computer vision model for crop disease identification |
| **Database** | Amazon DynamoDB | User profiles, diagnosis cases, chat summaries |
| **Object Storage** | AWS S3 + CloudFront CDN | Crop images and PDF treatment plans |
| **Image Processing** | Sharp | Server-side image compression (resize + JPEG optimization) |
| **PDF Generation** | Puppeteer + Chromium | Server-side HTML-to-PDF rendering with multilingual font support |
| **Voice Infrastructure** | LiveKit Cloud + Silero VAD | WebRTC rooms, voice activity detection, real-time audio streaming |
| **Validation** | Zod + drizzle-zod | Request body validation on all API endpoints |
| **State Management** | React useState + useRef | Frontend-managed conversation state machine |
| **Data Fetching** | TanStack React Query | Mutation-based API calls with loading states |

---

## Database Design

### DynamoDB Tables (Region: ap-south-1)

**Table 1: `KhetSathiUsers`**
| Attribute | Type | Description |
|-----------|------|-------------|
| `phone` (PK) | String | Farmer's phone number |
| `language` | String | Preferred language (English/Telugu/Hindi) |
| `createdAt` | String | ISO timestamp of registration |

**Table 2: `usercases`**
| Attribute | Type | Description |
|-----------|------|-------------|
| `phone` (PK) | String | Farmer's phone number |
| `timestamp` (SK) | String | ISO timestamp of this diagnosis |
| `conversationSummary` | String | Text summary of the conversation |
| `diagnosis` | Map | Disease detection results |
| `treatmentPlan` | String | Generated plan text (if any) |
| `language` | String | Language used |
| `imageUrls` | List | CloudFront URLs of uploaded images |

**Table 3: `chatsummary`**
| Attribute | Type | Description |
|-----------|------|-------------|
| `phone` (PK) | String | Farmer's phone number |
| `timestamp` (SK) | String | ISO timestamp of this summary |
| `conversationSummary` | String | AI-generated 3-5 sentence summary |
| `pdfUrl` | String | CloudFront URL of the generated PDF |
| `language` | String | Language the plan was generated in |
| `diagnosis` | Map | Disease detection results |
| `imageUrls` | List | CloudFront URLs of uploaded images |

---

## API Reference

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|-------------|
| POST | `/api/register-phone` | Register a farmer | `{ phone }` |
| POST | `/api/set-language` | Save language preference | `{ phone, language }` |
| POST | `/api/upload-images` | Upload & compress crop photos | Multipart: `images` (files) + `phone` |
| GET | `/api/chat/greeting` | Get initial AI greeting | Query: `?language=English` |
| POST | `/api/chat/message` | Send message, get AI reply | `{ messages, language, diagnosis?, planGenerated?, diagnosisAvailable? }` |
| POST | `/api/chat/extract` | Extract crop & location from conversation | `{ messages }` |
| POST | `/api/chat/diagnose` | Run disease detection | `{ imageUrls, crop, location, language }` |
| POST | `/api/chat/detect-plan-intent` | Check if farmer wants a plan | `{ messages }` |
| POST | `/api/chat/generate-plan` | Generate plan + PDF + save summary | `{ messages, diagnosis, language, imageUrls, phone }` |
| POST | `/api/save-usercase` | Save diagnosis case to history | `{ phone, conversationSummary, diagnosis?, treatmentPlan?, language?, imageUrls? }` |
| POST | `/api/livekit/token` | Generate LiveKit voice token | `{ phone, language }` |

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Google Gemini AI API key for all chat/extraction/plan functions |
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials for S3 and DynamoDB access |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials for S3 and DynamoDB access |
| `AWS_REGION` | Yes | AWS region — should be `ap-south-1` |
| `S3_BUCKET_NAME` | Yes | S3 bucket name (`khetsathi-crop-images`) |
| `CLOUDFRONT_URL` | Yes | CloudFront CDN distribution URL for serving images and PDFs |
| `LIVEKIT_API_KEY` | For voice | LiveKit Cloud API key |
| `LIVEKIT_API_SECRET` | For voice | LiveKit Cloud API secret |
| `LIVEKIT_URL` | For voice | LiveKit Cloud server URL |
| `OPENAI_API_KEY` | For voice | OpenAI API key for Whisper STT, GPT-4.1-mini, and TTS-1 |
| `SESSION_SECRET` | Yes | Express session secret |
| `DATABASE_URL` | Auto | PostgreSQL connection string (auto-configured by Replit) |

---

## Running the Project

```bash
npm install
npm run dev
```

The application starts on **port 5000** with the Express backend and Vite frontend running together on the same port.

**For voice agent (separate process):**
```bash
npx tsx server/livekit-agent.ts dev
```

**Production build:**
```bash
npm run build     # Compiles TypeScript and bundles frontend
npm run start     # Starts production server from dist/
```

The project is configured for **autoscale deployment** — the server starts only when requests come in and scales down during idle periods.
