# KhetSathi - AI Crop Doctor

## Overview
Agricultural AI assistant where farmers upload crop images and receive disease diagnosis, immediate action recommendations, and personalized 7-day treatment plans through a conversational AI chat interface. Supports English, Telugu, and Hindi languages.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui components + Framer Motion
- **Backend**: Express.js with multer for file uploads, stateless API endpoints
- **Database**: DynamoDB (ap-south-1) for user storage (KhetSathiUsers) and case history (usercases), PostgreSQL (Drizzle ORM) available but not actively used
- **AI Services**: Google Gemini 2.0-flash (conversational chat, extraction, plan generation), External Disease Detection API
- **External Services**: AWS S3 (image storage), CloudFront (CDN)

## App Flow (4-Step Wizard)
1. **Step 1 - Phone**: Enter phone number → saved to DynamoDB (no OTP required)
2. **Step 2 - Language**: Choose English, Telugu, or Hindi
3. **Step 3 - Upload**: Upload 1-3 crop photos only (NO crop name/location/description fields)
4. **Step 4 - AI Chat**: Conversational AI avatar that:
   - Greets farmer and asks about crop name and location naturally
   - Background extraction agent pulls crop/location from conversation
   - Auto-triggers disease diagnosis API when both are available
   - Shares diagnosis results conversationally
   - Asks if farmer wants 7-day treatment plan
   - Generates and displays plan in markdown format
   - Saves complete case history to DynamoDB

## Project Structure
- `client/src/pages/home.tsx` - Main wizard page with all 4 steps (phone, language, upload, chat)
- `client/src/components/treatment-plan.tsx` - 7-day treatment plan markdown display
- `server/routes.ts` - API endpoints (10 endpoints total)
- `server/services/chatService.ts` - Gemini-powered conversational AI (reply, extract, intent detection, plan generation)
- `server/services/dynamoService.ts` - DynamoDB user storage + usercases storage
- `server/services/s3Service.ts` - AWS S3 upload service
- `server/services/diseaseService.ts` - Disease detection API proxy
- `shared/schema.ts` - Zod schemas + TypeScript types

## API Endpoints
- `POST /api/register-phone` - Register phone number to DynamoDB
- `POST /api/set-language` - Save user's language preference to DynamoDB
- `POST /api/upload-images` - Multipart: upload 1-3 images to S3, returns CloudFront URLs
- `GET /api/chat/greeting?language=X` - Get AI greeting in user's language
- `POST /api/chat/message` - Send conversation + get AI reply (supports diagnosis context via diagnosisAvailable flag)
- `POST /api/chat/extract` - Extract crop name and location from conversation
- `POST /api/chat/diagnose` - Run disease detection API with extracted info
- `POST /api/chat/detect-plan-intent` - Detect if farmer wants treatment plan
- `POST /api/chat/generate-plan` - Generate 7-day plan using Gemini
- `POST /api/save-usercase` - Save case history to DynamoDB usercases table

## DynamoDB Tables
- **KhetSathiUsers** (region: ap-south-1): PK=phone, Attributes: phone, language, createdAt
- **usercases** (region: ap-south-1): PK=phone, SK=timestamp, Attributes: conversationSummary, diagnosis, treatmentPlan, language, imageUrls

## Environment Variables (Secrets)
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_URL
- GEMINI_API_KEY
- SESSION_SECRET
- DATABASE_URL (auto-configured, PostgreSQL)

## Design Decisions
- Chat flow replaces traditional forms - AI naturally gathers info through conversation
- Frontend manages all state; backend endpoints are stateless and fast-responding
- Diagnosis happens async from chat flow (background agent pattern)
- Case saved on diagnosis completion (not just when plan is generated)
- diagnosisAvailable flag used to trigger diagnosis sharing (no fake system messages in chat history)
