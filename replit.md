# KhetSathi - AI Crop Doctor

## Overview
Agricultural AI assistant where farmers upload crop images and receive disease diagnosis, immediate action recommendations, and personalized 7-day treatment plans. Supports English, Telugu, and Hindi languages.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with multer for file uploads
- **Database**: DynamoDB (ap-south-1, table: KhetSathiUsers) for user storage, PostgreSQL (Drizzle ORM) available but not actively used for users
- **External Services**: AWS S3 (image storage), CloudFront (CDN), Disease Detection API, Google Gemini (treatment plans)

## App Flow (Widget/Wizard - 3 Steps)
1. **Step 1 - Phone**: Enter phone number → saved to DynamoDB (no OTP required)
2. **Step 2 - Language**: Choose English, Telugu, or Hindi
3. **Step 3 - Diagnose**: Upload 1-3 crop images + enter crop name, location, description → get disease diagnosis → generate 7-day treatment plan

## Project Structure
- `client/src/pages/home.tsx` - Main wizard page with all 3 steps
- `client/src/components/diagnosis-card.tsx` - Disease diagnosis results display
- `client/src/components/treatment-plan.tsx` - 7-day treatment plan display
- `server/routes.ts` - API endpoints
- `server/db.ts` - PostgreSQL connection (Drizzle + pg)
- `server/storage.ts` - PostgreSQL operations interface (legacy, OTP tables)
- `server/services/dynamoService.ts` - DynamoDB user storage (ap-south-1, auto-creates table)
- `server/services/s3Service.ts` - AWS S3 upload service
- `server/services/diseaseService.ts` - Disease detection API proxy
- `server/services/geminiService.ts` - Gemini treatment plan generation
- `shared/schema.ts` - Database tables + shared TypeScript types + Zod schemas

## API Endpoints
- `POST /api/register-phone` - Register phone number, save user to DynamoDB
- `POST /api/set-language` - Save user's language preference to DynamoDB
- `POST /api/diagnose` - Multipart form: images + crop details → S3 upload + disease API
- `POST /api/treatment-plan` - JSON: diagnosis + details → Gemini 7-day plan

## DynamoDB Table
- **Table**: KhetSathiUsers (region: ap-south-1, auto-created on first use)
- **Key**: phone (String, partition key)
- **Attributes**: phone, language, createdAt

## Environment Variables (Secrets)
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_URL
- GEMINI_API_KEY
- DATABASE_URL (auto-configured, PostgreSQL)
