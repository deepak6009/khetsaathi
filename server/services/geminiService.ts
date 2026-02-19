import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

interface PlanInput {
  diagnosis: Record<string, any>;
  crop: string;
  location: string;
  language: string;
  summary: string;
}

export async function generateTreatmentPlan(input: PlanInput): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const prompt = `Act as an experienced agricultural crop doctor.
Based on the following disease diagnosis and farmer details, generate a clear, step-by-step 7-day treatment plan.
Make it practical, easy to follow, and actionable for a farmer.
Localize the response in ${input.language} language.

**Crop:** ${input.crop}
**Location:** ${input.location}
**Farmer's Description:** ${input.summary}

**Disease Diagnosis:**
${JSON.stringify(input.diagnosis, null, 2)}

Please provide:
1. A brief summary of the diagnosis
2. Day-by-day treatment plan (Day 1 through Day 7)
3. Each day should include specific actions, products to use (with dosage), and application methods
4. Include preventive measures for future crops
5. Any warnings or precautions

Format the response clearly with markdown headings and bullet points.`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}
