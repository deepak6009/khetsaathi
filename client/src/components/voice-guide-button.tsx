import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2 } from "lucide-react";
import { motion } from "framer-motion";
import aiAvatarImage from "@/assets/images/ai-assistant-avatar.png";

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

const botLabel: Record<string, string> = {
  English: "Tap to listen",
  Telugu: "వినడానికి నొక్కండి",
  Hindi: "सुनने के लिए टैप करें",
};

const speakingLabel: Record<string, string> = {
  English: "Listening...",
  Telugu: "వింటోంది...",
  Hindi: "सुन रहा है...",
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
}

export default function VoiceGuideButton({ screen, language }: VoiceGuideButtonProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const hasAutoPlayed = useRef(false);
  const mountedRef = useRef(true);

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

    utterance.onstart = () => {
      if (mountedRef.current) {
        setIsSpeaking(true);
        setShowHint(false);
      }
    };
    utterance.onend = () => {
      if (mountedRef.current) setIsSpeaking(false);
    };
    utterance.onerror = () => {
      if (mountedRef.current) {
        setIsSpeaking(false);
        setShowHint(true);
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [screen, language]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (hasAutoPlayed.current) return;
    hasAutoPlayed.current = true;

    const trySpeak = () => {
      if (!mountedRef.current) return;
      try {
        speak();
        setTimeout(() => {
          if (mountedRef.current && !window.speechSynthesis?.speaking) {
            setShowHint(true);
          }
        }, 1500);
      } catch {
        if (mountedRef.current) setShowHint(true);
      }
    };

    const timer = setTimeout(() => {
      if (!mountedRef.current) return;
      const voices = window.speechSynthesis?.getVoices();
      if (voices && voices.length > 0) {
        trySpeak();
      } else {
        const handler = () => {
          if (mountedRef.current) trySpeak();
          if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
        };
        window.speechSynthesis.onvoiceschanged = handler;
      }
    }, 800);

    return () => {
      clearTimeout(timer);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speak]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleClick = () => {
    setShowHint(false);
    if (isSpeaking) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    } else {
      speak();
    }
  };

  const label = isSpeaking
    ? (speakingLabel[language] || speakingLabel.English)
    : (showHint ? (botLabel[language] || botLabel.English) : (botLabel[language] || botLabel.English));

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.4, type: "spring", stiffness: 200 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5"
    >
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="px-4 py-2 rounded-2xl shadow-lg text-[13px] font-bold whitespace-nowrap backdrop-blur-md"
        data-testid={`text-voice-label-${screen}`}
        style={{
          backgroundColor: isSpeaking ? "#6BC30D" : "rgba(255,255,255,0.95)",
          color: isSpeaking ? "#ffffff" : "#1a1a1a",
          border: isSpeaking ? "none" : "1px solid #e5e7eb",
        }}
      >
        {isSpeaking && (
          <span className="inline-flex items-center gap-1.5 mr-1">
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}
              className="w-1.5 h-1.5 rounded-full bg-white inline-block"
            />
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}
              className="w-1.5 h-1.5 rounded-full bg-white inline-block"
            />
            <motion.span
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}
              className="w-1.5 h-1.5 rounded-full bg-white inline-block"
            />
          </span>
        )}
        {label}
      </motion.div>

      <button
        onClick={handleClick}
        data-testid={`button-voice-guide-${screen}`}
        className="relative group active:scale-95 transition-transform duration-150"
        aria-label={isSpeaking ? "Stop voice guide" : "Play voice guide"}
      >
        <div
          className={`w-16 h-16 rounded-full overflow-hidden shadow-xl transition-all duration-300 ${
            isSpeaking ? "ring-4 ring-offset-2" : "ring-2 ring-offset-1"
          }`}
          style={{
            borderColor: "#6BC30D",
            boxShadow: isSpeaking
              ? "0 0 0 4px rgba(107, 195, 13, 0.3), 0 8px 25px rgba(0,0,0,0.2)"
              : "0 4px 15px rgba(0,0,0,0.15)",
          }}
        >
          <img
            src={aiAvatarImage}
            alt="AI Assistant"
            className="w-full h-full object-cover"
          />
        </div>

        {isSpeaking && (
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md"
            style={{ backgroundColor: "#6BC30D" }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Volume2 className="w-3 h-3 text-white" />
          </motion.div>
        )}

        {!isSpeaking && (
          <div
            className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center shadow-md border border-white"
            style={{ backgroundColor: "#6BC30D" }}
          >
            <Volume2 className="w-3 h-3 text-white" />
          </div>
        )}
      </button>
    </motion.div>
  );
}
