import axios from "axios";

const GOOGLE_CLOUD_API_KEY = () => process.env.GOOGLE_CLOUD_API_KEY || "";

export interface STTResult {
  transcript: string;
  confidence: number;
}

export async function speechToText(
  audioBuffer: Buffer,
  languageCode: string = "en-IN"
): Promise<STTResult> {
  const apiKey = GOOGLE_CLOUD_API_KEY();
  if (!apiKey) throw new Error("GOOGLE_CLOUD_API_KEY is not configured");

  const audioContent = audioBuffer.toString("base64");

  const response = await axios.post(
    `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
    {
      config: {
        encoding: "WEBM_OPUS",
        sampleRateHertz: 48000,
        languageCode,
        alternativeLanguageCodes: ["te-IN", "hi-IN", "en-IN"],
        model: "latest_long",
        enableAutomaticPunctuation: true,
      },
      audio: {
        content: audioContent,
      },
    },
    { timeout: 15000 }
  );

  const results = response.data.results;
  if (!results || results.length === 0) {
    return { transcript: "", confidence: 0 };
  }

  const best = results[0].alternatives[0];
  return {
    transcript: best.transcript || "",
    confidence: best.confidence || 0,
  };
}

export function getLanguageCode(language: string): string {
  switch (language) {
    case "Telugu":
      return "te-IN";
    case "Hindi":
      return "hi-IN";
    default:
      return "en-IN";
  }
}

export interface TTSResult {
  audioContent: Buffer;
}

export async function textToSpeech(
  text: string,
  language: string = "English"
): Promise<TTSResult> {
  const apiKey = GOOGLE_CLOUD_API_KEY();
  if (!apiKey) throw new Error("GOOGLE_CLOUD_API_KEY is not configured");

  const langCode = getLanguageCode(language);

  const voiceMap: Record<string, { name: string; languageCode: string }> = {
    "en-IN": { name: "en-IN-Neural2-A", languageCode: "en-IN" },
    "hi-IN": { name: "hi-IN-Neural2-A", languageCode: "hi-IN" },
    "te-IN": { name: "te-IN-Standard-A", languageCode: "te-IN" },
  };

  const voiceConfig = voiceMap[langCode] || voiceMap["en-IN"];

  const response = await axios.post(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      input: { text },
      voice: {
        languageCode: voiceConfig.languageCode,
        name: voiceConfig.name,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0,
      },
    },
    { timeout: 30000 }
  );

  const audioContent = Buffer.from(response.data.audioContent, "base64");
  return { audioContent };
}
