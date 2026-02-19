# KhetSathi - AI Crop Doctor

## Overview
Agricultural AI assistant where farmers upload crop images and receive disease diagnosis, immediate action recommendations, and personalized 7-day treatment plans. Supports English, Telugu, and Hindi languages.

## Architecture
- **Frontend**: React + TypeScript + Tailwind CSS + shadcn/ui components
- **Backend**: Express.js with multer for file uploads
- **External Services**: AWS S3 (image storage), CloudFront (CDN), Disease Detection API, Google Gemini (treatment plans)
- **No database** - this is a stateless diagnostic tool

## Project Structure
- `client/src/pages/home.tsx` - Main single-page application
- `client/src/components/diagnosis-card.tsx` - Disease diagnosis results display
- `client/src/components/treatment-plan.tsx` - 7-day treatment plan display
- `server/routes.ts` - API endpoints (/api/diagnose, /api/treatment-plan)
- `server/services/s3Service.ts` - AWS S3 upload service
- `server/services/diseaseService.ts` - Disease detection API proxy
- `server/services/geminiService.ts` - Gemini treatment plan generation
- `shared/schema.ts` - Shared TypeScript types and Zod schemas

## API Endpoints
- `POST /api/diagnose` - Accepts multipart form with images + crop details, uploads to S3, calls disease API
- `POST /api/treatment-plan` - Accepts JSON with diagnosis + details, generates 7-day plan via Gemini

## Environment Variables (Secrets)
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME, CLOUDFRONT_URL
- GEMINI_API_KEY

## App Flow
1. Select language (English/Telugu/Hindi)
2. Upload 1-3 crop images + enter crop name, location, description
3. Click "Diagnose Disease" → uploads images to S3, calls disease detection API
4. View diagnosis results (disease, severity, pesticide, dosage, etc.)
5. Click "Generate 7-Day Treatment Plan" → calls Gemini API
6. View formatted treatment plan
