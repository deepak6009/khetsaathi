# KhetSaathi - AI Crop Doctor

## Overview
Agricultural AI assistant where farmers upload crop images and receive disease diagnosis, immediate action recommendations, and personalized 7-day treatment plans through a conversational AI chat interface. Supports English, Telugu, and Hindi languages. Built as a mobile-first SaaS application.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui components + Framer Motion
- **Backend**: Express.js with multer for file uploads, stateless API endpoints
- **Database**: DynamoDB (ap-south-1) for user storage (KhetSathiUsers), case history (usercases), and chat summaries (chatsummary). PostgreSQL (Drizzle ORM) available but not actively used
- **AI Services**: Google Gemini 2.0-flash (conversational chat, extraction, plan generation), External Disease Detection API
- **External Services**: AWS S3 (image storage), CloudFront (CDN)

## App Flow (Mobile SaaS Architecture)

### Onboarding (3 steps):
1. **Language**: Choose English, Telugu, or Hindi
2. **Phone**: Enter phone number → saved to DynamoDB
3. **Welcome**: Feature highlights + "Start Now" button → redirects to dashboard

### Dashboard (Main Home Screen):
- Camera hero section (primary CTA - "Scan Your Crop")
- Quick action cards (New Scan, My History)
- Recent diagnoses list (last 3 items from DynamoDB)
- Location display in header

### Capture Screen (from Dashboard):
- Photo upload (1-6 images with camera/gallery)
- "Analyze Crop" button → uploads to S3 → enters chat

### AI Chat Screen:
- Conversational AI avatar with voice interaction
- Background extraction agent pulls crop/location from conversation
- Auto-triggers disease diagnosis API when both are available
- Shares diagnosis results conversationally
- Asks if farmer wants 7-day treatment plan
- Farmer chooses plan language (independent from chat language)
- Generates PDF server-side, uploads to S3, shows WhatsApp-style PDF preview
- Can regenerate plan in different language

### Screen Navigation:
- `onboarding` → `dashboard` → `capture` → `chat`
- All screens have localized "Back" button text (changes with language)
- Dashboard is the main hub after onboarding

## Project Structure
- `client/src/pages/home.tsx` - Main app with 4 screens: onboarding, dashboard, capture, chat
- `client/src/pages/history.tsx` - Full diagnosis history page
- `client/src/components/voice-chat.tsx` - LiveKit voice chat component
- `client/src/components/treatment-plan.tsx` - Legacy treatment plan display
- `server/routes.ts` - API endpoints (10+ endpoints)
- `server/services/chatService.ts` - Gemini-powered conversational AI
- `server/services/dynamoService.ts` - DynamoDB storage
- `server/services/s3Service.ts` - AWS S3 upload service
- `server/services/pdfService.ts` - Server-side PDF generation
- `server/services/diseaseService.ts` - Disease detection API proxy
- `shared/schema.ts` - Zod schemas + TypeScript types

## API Endpoints
- `POST /api/register-phone` - Register phone number to DynamoDB
- `POST /api/set-language` - Save user's language preference to DynamoDB
- `POST /api/upload-images` - Multipart: upload 1-6 images to S3, returns CloudFront URLs
- `GET /api/chat/greeting?language=X` - Get AI greeting in user's language
- `POST /api/chat/message` - Send conversation + get AI reply
- `POST /api/chat/extract` - Extract crop name and location from conversation
- `POST /api/chat/diagnose` - Run disease detection API with extracted info
- `POST /api/chat/detect-plan-intent` - Detect if farmer wants treatment plan
- `POST /api/chat/generate-plan` - Generate 7-day plan, create PDF, upload to S3
- `POST /api/save-usercase` - Save case history to DynamoDB
- `GET /api/history/:phone` - Get user's diagnosis history

## DynamoDB Tables
- **KhetSathiUsers** (region: ap-south-1): PK=phone, Attributes: phone, language, createdAt
- **usercases** (region: ap-south-1): PK=phone, SK=timestamp, Attributes: conversationSummary, diagnosis, treatmentPlan, language, imageUrls
- **chatsummary** (region: ap-south-1): PK=phone, SK=timestamp, Attributes: conversationSummary, pdfUrl, language, diagnosis, imageUrls

## Voice Integration (LiveKit)
- **LiveKit Agent**: `server/livekit-agent.ts` - Standalone voice agent using Gemini Realtime API
- **Frontend Component**: `client/src/components/voice-chat.tsx` - LiveKit room with voice UI
- **Token Endpoint**: `POST /api/livekit/token` - Generates LiveKit access tokens
- **Agent runs as separate process**: `npx tsx server/livekit-agent.ts dev`

## Environment Variables (Secrets)
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_URL
- GEMINI_API_KEY
- LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL
- SESSION_SECRET
- DATABASE_URL (auto-configured, PostgreSQL)

## Design Decisions
- Mobile-first SaaS architecture with dashboard as central hub
- Onboarding flow: Language → Phone → Welcome → Dashboard
- Camera/photo capture is the hero action on dashboard
- Recent diagnoses shown on dashboard for quick reference
- All navigation buttons show localized "Back" text in selected language
- Chat flow replaces traditional forms - AI naturally gathers info through conversation
- Frontend manages all state; backend endpoints are stateless
- Diagnosis happens async from chat flow (background agent pattern)
- Plan language is independent from chat language
- PDF generated server-side via Puppeteer/Chromium, uploaded to S3
- Logo asset: `attached_assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png`

## Design System (v3 - Farmer-Friendly Green)
- **Primary green**: #6BC30D (logo green) - buttons, accents, icons
- **Secondary brown**: #964B00 (logo brown) - history icons, PDF badge
- **Dark bg**: #032B22 - welcome screen, scan card, user chat bubbles
- **White**: #ffffff - dashboard background, cards, light screens
- **Black**: text color for readability
- **Font**: Inter (Google Fonts) - clean, modern sans-serif
- **Border radius**: rounded-2xl for cards, rounded-xl for buttons
- **Headers**: Frosted glass (backdrop-blur-xl, bg-white/90), logo + "KhetSaathi" centered
- **All icons have text labels** (farmer-friendly UX, no icon-only buttons)
- **Multi-language spacing**: Telugu/Hindi get extra leading-relaxed + tracking-wide
- **Onboarding**: Language & Phone on white, Welcome on dark #032B22
- **Dashboard**: White bg, dark green scan hero card, green/brown accent icon boxes
- **Chat**: User bubbles dark #032B22, assistant bubbles white with green bot icon
- **Shadows**: shadow-sm for cards, shadow-md for active states, shadow-lg for hero CTA
