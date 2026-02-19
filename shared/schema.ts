import { z } from "zod";

export const languageSchema = z.enum(["English", "Telugu", "Hindi"]);
export type Language = z.infer<typeof languageSchema>;

export const diagnoseRequestSchema = z.object({
  images: z.array(z.string()).min(1).max(3),
  crop: z.string().min(1),
  location: z.string().min(1),
  language: languageSchema,
  summary: z.string().min(1),
});
export type DiagnoseRequest = z.infer<typeof diagnoseRequestSchema>;

export const diagnosisResultSchema = z.object({
  crop_identified: z.string().optional(),
  disease: z.string().optional(),
  confidence: z.string().optional(),
  severity: z.string().optional(),
  symptoms_observed: z.union([z.string(), z.array(z.string())]).optional(),
  recommended_pesticide: z.string().optional(),
  dosage: z.string().optional(),
  immediate_action: z.union([z.string(), z.array(z.string())]).optional(),
});
export type DiagnosisResult = z.infer<typeof diagnosisResultSchema>;

export const treatmentPlanRequestSchema = z.object({
  diagnosis: diagnosisResultSchema,
  crop: z.string(),
  location: z.string(),
  language: languageSchema,
  summary: z.string(),
});
export type TreatmentPlanRequest = z.infer<typeof treatmentPlanRequestSchema>;

export const uploadResponseSchema = z.object({
  urls: z.array(z.string()),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;
