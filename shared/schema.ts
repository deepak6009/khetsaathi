import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  phone: varchar("phone", { length: 15 }).primaryKey(),
  language: varchar("language", { length: 10 }).default("English"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({ phone: true, language: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const languageSchema = z.enum(["English", "Telugu", "Hindi"]);
export type Language = z.infer<typeof languageSchema>;

export const phoneSchema = z.object({
  phone: z.string().min(10).max(15).regex(/^\+?\d{10,15}$/, "Enter a valid phone number"),
});

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
