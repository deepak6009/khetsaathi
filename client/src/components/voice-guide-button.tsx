import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";

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

interface VoiceGuideButtonProps {
  screen: ScreenKey;
  language: string;
  dark?: boolean;
}

export default function VoiceGuideButton({ screen, language, dark = false }: VoiceGuideButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const hasAutoPlayed = useRef(false);
  const mountId = useRef(`${screen}-${Date.now()}`);

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
    const match = voices.find(v => v.lang === langCode) ||
                  voices.find(v => v.lang.startsWith(langCode.split("-")[0]));
    if (match) utterance.voice = match;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [screen, language]);

  useEffect(() => {
    if (hasAutoPlayed.current) return;
    hasAutoPlayed.current = true;

    const timer = setTimeout(() => {
      const voices = window.speechSynthesis?.getVoices();
      if (voices && voices.length > 0) {
        speak();
      } else if (window.speechSynthesis) {
        const handler = () => {
          speak();
          window.speechSynthesis.onvoiceschanged = null;
        };
        window.speechSynthesis.onvoiceschanged = handler;
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    };
  }, [speak]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const handleClick = () => {
    if (isSpeaking) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      speak();
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3, duration: 0.3 }}
      onClick={handleClick}
      data-testid={`button-voice-guide-${screen}`}
      className={`fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95 ${
        isSpeaking
          ? "ring-2 ring-offset-2"
          : ""
      }`}
      style={{
        backgroundColor: isSpeaking ? "#6BC30D" : dark ? "rgba(255,255,255,0.15)" : "#ffffff",
        borderColor: "#6BC30D",
        border: isSpeaking ? "none" : "2px solid #6BC30D",
      }}
      aria-label={isSpeaking ? "Stop voice guide" : "Play voice guide"}
    >
      {isSpeaking ? (
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          <Volume2 className="w-5 h-5 text-white" />
        </motion.div>
      ) : (
        <Volume2 className="w-5 h-5" style={{ color: dark ? "#ffffff" : "#6BC30D" }} />
      )}
    </motion.button>
  );
}
