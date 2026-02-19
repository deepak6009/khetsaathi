# KhetSathi - AI Crop Doctor

## Overview
Agricultural AI assistant where farmers upload crop images and receive disease diagnosis, immediate action recommendations, and personalized 7-day treatment plans. Supports English, Telugu, and Hindi languages.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with multer for file uploads
- **Database**: PostgreSQL (Drizzle ORM) - users table with phone as primary key, OTP storage
- **External Services**: AWS S3 (image storage), CloudFront (CDN), Disease Detection API, Google Gemini (treatment plans)

## App Flow (Widget/Wizard)
1. **Step 1 - Phone**: Enter phone number, receive OTP (shown on screen for testing)
2. **Step 2 - OTP**: Enter 6-digit code to verify phone
3. **Step 3 - Language**: Choose English, Telugu, or Hindi
4. **Step 4 - Diagnose**: Upload 1-3 crop images + enter crop name, location, description → get disease diagnosis → generate 7-day treatment plan

## Project Structure
- `client/src/pages/home.tsx` - Main wizard page with all 4 steps
- `client/src/components/diagnosis-card.tsx` - Disease diagnosis results display
- `client/src/components/treatment-plan.tsx` - 7-day treatment plan display
- `server/routes.ts` - API endpoints
- `server/db.ts` - Database connection (Drizzle + pg)
- `server/storage.ts` - Database operations interface
- `server/services/s3Service.ts` - AWS S3 upload service
- `server/services/diseaseService.ts` - Disease detection API proxy
- `server/services/geminiService.ts` - Gemini treatment plan generation
- `shared/schema.ts` - Database tables + shared TypeScript types + Zod schemas

## API Endpoints
- `POST /api/send-otp` - Send OTP to phone (currently shows on screen for testing)
- `POST /api/verify-otp` - Verify phone OTP
- `POST /api/set-language` - Save user's language preference
- `POST /api/diagnose` - Multipart form: images + crop details → S3 upload + disease API
- `POST /api/treatment-plan` - JSON: diagnosis + details → Gemini 7-day plan

## Database Tables
- `users` - phone (PK), language, created_at
- `otps` - phone (PK), code, expires_at, attempts

## Environment Variables (Secrets)
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_URL
- GEMINI_API_KEY
- DATABASE_URL (auto-configured)
