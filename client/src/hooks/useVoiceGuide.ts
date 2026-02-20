import { useEffect, useRef, useCallback, useState } from "react";

type ScreenKey = "phone" | "photo" | "welcome" | "dashboard" | "capture" | "chat";

const voiceMessages: Record<ScreenKey, Record<string, string>> = {
  phone: {
    English: "Please enter your phone number to get started.",
    Telugu: "దయచేసి మీ ఫోన్ నంబర్ నమోదు చేయండి.",
    Hindi: "कृपया शुरू करने के लिए अपना फ़ोन नंबर दर्ज करें।",
  },
  photo: {
    English: "Take a selfie for your profile, or skip this step.",
    Telugu: "మీ ప్రొఫైల్ కోసం సెల్ఫీ తీసుకోండి, లేదా ఈ దశను దాటవేయండి.",
    Hindi: "अपनी प्रोफ़ाइल के लिए सेल्फी लें, या इस चरण को छोड़ दें।",
  },
  welcome: {
    English: "Welcome to KhetSaathi! Tap Start Now to begin scanning your crops.",
    Telugu: "ఖేత్‌సాథీకి స్వాగతం! మీ పంటలను స్కాన్ చేయడం ప్రారంభించడానికి ఇప్పుడు ప్రారంభించు నొక్కండి.",
    Hindi: "खेतसाथी में आपका स्वागत है! अपनी फसलों की जांच शुरू करने के लिए अभी शुरू करें दबाएं।",
  },
  dashboard: {
    English: "This is your home screen. Tap Scan Your Crop to check for diseases, or view your history.",
    Telugu: "ఇది మీ హోమ్ స్క్రీన్. వ్యాధుల కోసం మీ పంటను స్కాన్ చేయండి నొక్కండి, లేదా మీ చరిత్ర చూడండి.",
    Hindi: "यह आपकी होम स्क्रीन है। बीमारियों की जांच के लिए अपनी फसल स्कैन करें दबाएं, या अपना इतिहास देखें।",
  },
  capture: {
    English: "Take one to three photos of your crop and tap Analyze Crop.",
    Telugu: "మీ పంట యొక్క ఒకటి నుండి మూడు ఫోటోలు తీసి, పంట విశ్లేషించు నొక్కండి.",
    Hindi: "अपनी फसल की एक से तीन तस्वीरें लें और फसल का विश्लेषण करें दबाएं।",
  },
  chat: {
    English: "Tell me about your crop problem. I will help you find the disease and treatment.",
    Telugu: "మీ పంట సమస్య గురించి చెప్పండి. నేను వ్యాధి మరియు చికిత్స కనుగొనడంలో సహాయం చేస్తాను.",
    Hindi: "अपनी फसल की समस्या बताएं। मैं बीमारी और इलाज खोजने में आपकी मदद करूंगा।",
  },
};

function getVoiceLang(language: string): string {
  switch (language) {
    case "Telugu": return "te-IN";
    case "Hindi": return "hi-IN";
    default: return "en-IN";
  }
}

export function useVoiceGuide(screen: ScreenKey, language: string, enabled: boolean = true) {
  const spokenRef = useRef(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const text = voiceMessages[screen]?.[language] || voiceMessages[screen]?.English || "";
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getVoiceLang(language);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const langCode = getVoiceLang(language);
    const matchingVoice = voices.find(v => v.lang === langCode) ||
                          voices.find(v => v.lang.startsWith(langCode.split("-")[0]));
    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [screen, language]);

  const replay = useCallback(() => {
    speak();
  }, [speak]);

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled || spokenRef.current) return;
    spokenRef.current = true;

    const timer = setTimeout(() => {
      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          speak();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [enabled, speak, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { isSpeaking, replay, stop };
}
