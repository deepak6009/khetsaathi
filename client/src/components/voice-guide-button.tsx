import { useEffect, useRef, useState, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import aiAvatarImage from "@/assets/images/ai-assistant-avatar.png";

type ScreenKey = "phone" | "photo" | "welcome" | "dashboard" | "capture" | "chat";

interface SpotlightTarget {
  selector: string;
  duration: number;
}

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

const spotlightSequences: Record<ScreenKey, SpotlightTarget[]> = {
  phone: [
    { selector: '[data-testid="input-phone"]', duration: 3000 },
    { selector: '[data-testid="button-continue-phone"]', duration: 3000 },
  ],
  photo: [
    { selector: '[data-testid="button-take-selfie"], [data-testid="input-selfie-capture"]', duration: 3000 },
    { selector: '[data-testid="button-skip-selfie"]', duration: 3000 },
  ],
  welcome: [
    { selector: '[data-testid="button-start-now"]', duration: 4000 },
  ],
  dashboard: [
    { selector: '[data-testid="button-scan-crop"]', duration: 3500 },
    { selector: '[data-testid="button-quick-new-scan"]', duration: 3000 },
    { selector: '[data-testid="button-quick-history"]', duration: 3000 },
  ],
  capture: [
    { selector: '[data-testid="button-upload-image"], [data-testid="button-add-more-images"]', duration: 3500 },
    { selector: '[data-testid="button-analyze-crop"]', duration: 3000 },
  ],
  chat: [
    { selector: '[data-testid="input-chat"]', duration: 3000 },
    { selector: '[data-testid="button-voice-call"]', duration: 3000 },
    { selector: '[data-testid="button-send-chat"]', duration: 2500 },
  ],
};

const botLabel: Record<string, string> = {
  English: "Ask me anything",
  Telugu: "ఏదైనా అడగండి",
  Hindi: "कुछ भी पूछें",
};

const speakingLabel: Record<string, string> = {
  English: "Speaking...",
  Telugu: "చెప్తోంది...",
  Hindi: "बोल रहा है...",
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
  const [spokenText, setSpokenText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [spotlightEl, setSpotlightEl] = useState<HTMLElement | null>(null);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const hasAutoPlayed = useRef(false);
  const mountedRef = useRef(true);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSpotlight = useCallback(() => {
    spotlightTimerRef.current.forEach(clearTimeout);
    spotlightTimerRef.current = [];
    setSpotlightEl(null);
    setSpotlightRect(null);
    setShowOverlay(false);
    document.querySelectorAll("[data-spotlight-active]").forEach(el => {
      (el as HTMLElement).removeAttribute("data-spotlight-active");
      (el as HTMLElement).style.removeProperty("position");
      (el as HTMLElement).style.removeProperty("z-index");
      (el as HTMLElement).style.removeProperty("box-shadow");
      (el as HTMLElement).style.removeProperty("border-radius");
    });
  }, []);

  const runSpotlightSequence = useCallback((screenKey: ScreenKey) => {
    const sequence = spotlightSequences[screenKey];
    if (!sequence || sequence.length === 0) return;

    let delay = 500;
    const timers: ReturnType<typeof setTimeout>[] = [];

    sequence.forEach((target, idx) => {
      const startTimer = setTimeout(() => {
        if (!mountedRef.current) return;

        document.querySelectorAll("[data-spotlight-active]").forEach(el => {
          (el as HTMLElement).removeAttribute("data-spotlight-active");
          (el as HTMLElement).style.removeProperty("z-index");
          (el as HTMLElement).style.removeProperty("box-shadow");
        });

        const el = document.querySelector(target.selector) as HTMLElement;
        if (el) {
          el.setAttribute("data-spotlight-active", "true");
          el.style.zIndex = "60";
          el.style.boxShadow = "0 0 0 4px rgba(107, 195, 13, 0.5), 0 0 20px rgba(107, 195, 13, 0.3)";
          const rect = el.getBoundingClientRect();
          setSpotlightEl(el);
          setSpotlightRect(rect);
          setShowOverlay(true);
        }
      }, delay);
      timers.push(startTimer);

      const endTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        if (idx === sequence.length - 1) {
          clearSpotlight();
        }
      }, delay + target.duration);
      timers.push(endTimer);

      delay += target.duration + 300;
    });

    spotlightTimerRef.current = timers;
  }, [clearSpotlight]);

  const startTypewriter = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setSpokenText(text);
    setDisplayedText("");
    let i = 0;
    typewriterRef.current = setInterval(() => {
      if (!mountedRef.current) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
        return;
      }
      i++;
      setDisplayedText(text.slice(0, i));
      if (i >= text.length) {
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, 35);
  }, []);

  const speak = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const text = voiceMessages[screen]?.[language] || voiceMessages[screen]?.English || "";
    if (!text) return;

    startTypewriter(text);

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
        runSpotlightSequence(screen);
      }
    };
    utterance.onend = () => {
      if (mountedRef.current) {
        setIsSpeaking(false);
        setTimeout(() => {
          if (mountedRef.current) clearSpotlight();
        }, 1000);
      }
    };
    utterance.onerror = () => {
      if (mountedRef.current) {
        setIsSpeaking(false);
        clearSpotlight();
      }
    };

    window.speechSynthesis.speak(utterance);
  }, [screen, language, startTypewriter, runSpotlightSequence, clearSpotlight]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearSpotlight();
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [clearSpotlight]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (hasAutoPlayed.current) return;
    hasAutoPlayed.current = true;

    const trySpeak = () => {
      if (!mountedRef.current) return;
      try {
        speak();
      } catch {
        /* autoplay blocked */
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
    if (isSpeaking) {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      clearSpotlight();
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    } else {
      speak();
    }
  };

  const idleLabel = botLabel[language] || botLabel.English;

  return (
    <>
      <AnimatePresence>
        {showOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[55] pointer-events-none"
            style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
            onClick={(e) => { e.stopPropagation(); clearSpotlight(); }}
          >
            {spotlightRect && (
              <div
                className="absolute rounded-2xl"
                style={{
                  top: spotlightRect.top - 6,
                  left: spotlightRect.left - 6,
                  width: spotlightRect.width + 12,
                  height: spotlightRect.height + 12,
                  backgroundColor: "transparent",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                  border: "3px solid rgba(107, 195, 13, 0.8)",
                  pointerEvents: "none",
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, type: "spring", stiffness: 200 }}
        className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[70] flex flex-col items-center gap-3"
      >
        <AnimatePresence mode="wait">
          {isSpeaking && displayedText ? (
            <motion.div
              key="speech-bubble"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="max-w-[85vw] w-auto mx-4 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-lg"
              style={{
                backgroundColor: "rgba(255,255,255,0.97)",
                border: "1.5px solid #6BC30D40",
              }}
              data-testid={`text-voice-speech-${screen}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="flex gap-1 items-center mt-1 flex-shrink-0">
                  <motion.span animate={{ scaleY: [0.5, 1.2, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0 }}
                    className="w-[3px] h-4 rounded-full" style={{ backgroundColor: "#6BC30D" }} />
                  <motion.span animate={{ scaleY: [0.5, 1.2, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.15 }}
                    className="w-[3px] h-4 rounded-full" style={{ backgroundColor: "#6BC30D" }} />
                  <motion.span animate={{ scaleY: [0.5, 1.2, 0.5] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.3 }}
                    className="w-[3px] h-4 rounded-full" style={{ backgroundColor: "#6BC30D" }} />
                </div>
                <p className="text-[14px] font-semibold text-gray-800 leading-relaxed flex-1">
                  {displayedText}
                  {displayedText.length < spokenText.length && (
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ repeat: Infinity, duration: 0.6 }}
                      className="inline-block w-0.5 h-4 ml-0.5 align-text-bottom"
                      style={{ backgroundColor: "#6BC30D" }}
                    />
                  )}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle-label"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-2 rounded-full shadow-lg text-[13px] font-bold whitespace-nowrap backdrop-blur-md"
              data-testid={`text-voice-label-${screen}`}
              style={{
                backgroundColor: "rgba(255,255,255,0.95)",
                color: "#1a1a1a",
                border: "1px solid #e5e7eb",
              }}
            >
              {idleLabel}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleClick}
          data-testid={`button-voice-guide-${screen}`}
          className="relative group active:scale-95 transition-transform duration-150"
          aria-label={isSpeaking ? "Stop voice guide" : "Play voice guide"}
        >
          {isSpeaking && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: "rgba(107, 195, 13, 0.15)" }}
                animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ backgroundColor: "rgba(107, 195, 13, 0.1)" }}
                animate={{ scale: [1, 2.2, 1], opacity: [0.3, 0, 0.3] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.3 }}
              />
            </>
          )}

          <div
            className="w-[68px] h-[68px] rounded-full overflow-hidden shadow-xl transition-all duration-300 relative"
            style={{
              border: isSpeaking ? "3px solid #6BC30D" : "3px solid rgba(107,195,13,0.4)",
              boxShadow: isSpeaking
                ? "0 0 0 4px rgba(107, 195, 13, 0.25), 0 8px 30px rgba(0,0,0,0.2)"
                : "0 4px 20px rgba(0,0,0,0.15)",
            }}
          >
            <img
              src={aiAvatarImage}
              alt="AI Assistant"
              className="w-full h-full object-cover"
            />
          </div>

          <div
            className="absolute -top-0.5 -right-0.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2 border-white"
            style={{ backgroundColor: "#6BC30D" }}
          >
            {isSpeaking ? (
              <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <Volume2 className="w-3 h-3 text-white" />
              </motion.div>
            ) : (
              <Volume2 className="w-3 h-3 text-white" />
            )}
          </div>
        </button>
      </motion.div>
    </>
  );
}
