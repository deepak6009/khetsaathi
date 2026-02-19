import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Language } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  X, Camera, Phone as PhoneIcon, ArrowRight,
  Check, Send, Bot, Languages, FileText, Download, Mic, MapPin,
  RotateCcw, ChevronLeft, Plus, Leaf, Clock,
  ScanLine, CalendarDays, Sprout, ChevronRight, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import VoiceChat from "@/components/voice-chat";
import logoImage from "@assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png";

type AppScreen = "onboarding" | "dashboard" | "capture" | "chat";
type OnboardingStep = "language" | "phone" | "welcome";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ChatPhase = "gathering" | "diagnosing" | "diagnosed" | "asking_plan" | "awaiting_plan_language" | "generating_plan" | "plan_ready";

interface HistoryItem {
  phone: string;
  timestamp: string;
  conversationSummary: string;
  pdfUrl?: string;
  language?: string;
  diagnosis?: Record<string, any>;
  imageUrls?: string[];
}

const labels = {
  title: { English: "KhetSathi", Telugu: "ఖేత్ సాథీ", Hindi: "खेतसाथी" } as Record<Language, string>,
  subtitle: { English: "AI Crop Doctor", Telugu: "AI పంట వైద్యుడు", Hindi: "AI फसल डॉक्टर" } as Record<Language, string>,
  tagline: { English: "Your smart farming companion", Telugu: "మీ తెలివైన వ్యవసాయ సహచరుడు", Hindi: "आपका स्मार्ट खेती साथी" } as Record<Language, string>,
  enterPhone: { English: "Enter your phone number", Telugu: "మీ ఫోన్ నంబర్ నమోదు చేయండి", Hindi: "अपना फोन नंबर दर्ज करें" } as Record<Language, string>,
  phoneHint: { English: "We'll save your crop diagnosis history", Telugu: "మీ పంట చరిత్రను సేవ్ చేస్తాము", Hindi: "हम आपकी फसल का इतिहास सहेजेंगे" } as Record<Language, string>,
  phoneLabel: { English: "Phone Number", Telugu: "ఫోన్ నంబర్", Hindi: "फोन नंबर" } as Record<Language, string>,
  continueBtn: { English: "Continue", Telugu: "కొనసాగించు", Hindi: "आगे बढ़ें" } as Record<Language, string>,
  registering: { English: "Please wait...", Telugu: "దయచేసి వేచి ఉండండి...", Hindi: "कृपया प्रतीक्षा करें..." } as Record<Language, string>,
  chooseLanguage: { English: "Choose your language", Telugu: "మీ భాషను ఎంచుకోండి", Hindi: "अपनी भाषा चुनें" } as Record<Language, string>,
  languageHint: { English: "The entire app will be in your language", Telugu: "యాప్ మొత్తం మీ భాషలో ఉంటుంది", Hindi: "पूरा ऐप आपकी भाषा में होगा" } as Record<Language, string>,
  uploadPhotos: { English: "Upload Crop Photos", Telugu: "పంట ఫోటోలు అప్‌లోడ్ చేయండి", Hindi: "फसल की फोटो अपलोड करें" } as Record<Language, string>,
  uploadHint: { English: "Take 1-6 clear photos of affected leaves or crop", Telugu: "ప్రభావిత ఆకులు లేదా పంట యొక్క 1-6 ఫోటోలు తీయండి", Hindi: "प्रभावित पत्तियों या फसल की 1-6 फोटो लें" } as Record<Language, string>,
  addMore: { English: "Add More", Telugu: "మరిన్ని జోడించు", Hindi: "और जोड़ें" } as Record<Language, string>,
  analyzeBtn: { English: "Analyze Crop", Telugu: "పంటను విశ్లేషించు", Hindi: "फसल का विश्लेषण करें" } as Record<Language, string>,
  uploading: { English: "Uploading...", Telugu: "అప్‌లోడ్ అవుతోంది...", Hindi: "अपलोड हो रहा है..." } as Record<Language, string>,
  maxImages: { English: "Maximum 6 images allowed", Telugu: "గరిష్టంగా 6 చిత్రాలు అనుమతించబడతాయి", Hindi: "अधिकतम 6 छवियाँ अनुमत हैं" } as Record<Language, string>,
  typeMessage: { English: "Type your message...", Telugu: "మీ సందేశం టైప్ చేయండి...", Hindi: "अपना संदेश टाइप करें..." } as Record<Language, string>,
  planReady: { English: "Your 7-day treatment plan is ready! You can see it below.", Telugu: "మీ 7-రోజుల చికిత్స ప్రణాళిక సిద్ధంగా ఉంది! దిగువ చూడండి.", Hindi: "आपकी 7-दिन की उपचार योजना तैयार है! नीचे देखें." } as Record<Language, string>,
  choosePlanLanguage: { English: "Choose language for your treatment plan", Telugu: "మీ చికిత్స ప్రణాళిక కోసం భాషను ఎంచుకోండి", Hindi: "अपनी उपचार योजना के लिए भाषा चुनें" } as Record<Language, string>,
  getPlanIn: { English: "Get plan in another language", Telugu: "మరొక భాషలో ప్లాన్ పొందండి", Hindi: "दूसरी भाषा में प्लान पाएं" } as Record<Language, string>,
  back: { English: "Back", Telugu: "వెనక్కి", Hindi: "वापस" } as Record<Language, string>,
  newDiagnosis: { English: "New", Telugu: "కొత్త", Hindi: "नया" } as Record<Language, string>,
  history: { English: "History", Telugu: "చరిత్ర", Hindi: "इतिहास" } as Record<Language, string>,
  stepLanguage: { English: "Language", Telugu: "భాష", Hindi: "भाषा" } as Record<Language, string>,
  stepPhone: { English: "Phone", Telugu: "ఫోన్", Hindi: "फोन" } as Record<Language, string>,
  stepWelcome: { English: "Welcome", Telugu: "స్వాగతం", Hindi: "स्वागत" } as Record<Language, string>,
  welcomeTitle: { English: "Welcome to KhetSathi!", Telugu: "ఖేత్‌సాథీకి స్వాగతం!", Hindi: "खेतसाथी में आपका स्वागत है!" } as Record<Language, string>,
  welcomeDesc: { English: "Your AI-powered crop doctor is ready to help you diagnose crop diseases and get personalized treatment plans.", Telugu: "మీ AI పంట వైద్యుడు పంట రోగాలను నిర్ధారించడానికి మరియు వ్యక్తిగత చికిత్స ప్రణాళికలను పొందడానికి సిద్ధంగా ఉంది.", Hindi: "आपका AI फसल डॉक्टर फसल रोगों का निदान करने और व्यक्तिगत उपचार योजना प्राप्त करने के लिए तैयार है।" } as Record<Language, string>,
  startNow: { English: "Start Now", Telugu: "ఇప్పుడు ప్రారంభించండి", Hindi: "अभी शुरू करें" } as Record<Language, string>,
  welcomeFeature1: { English: "Instant AI crop diagnosis", Telugu: "తక్షణ AI పంట రోగ నిర్ధారణ", Hindi: "तुरंत AI फसल निदान" } as Record<Language, string>,
  welcomeFeature2: { English: "7-day treatment plans", Telugu: "7-రోజుల చికిత్స ప్రణాళిక", Hindi: "7-दिन की उपचार योजना" } as Record<Language, string>,
  welcomeFeature3: { English: "Track your crop health", Telugu: "మీ పంట ఆరోగ్యం ట్రాక్ చేయండి", Hindi: "अपनी फसल की सेहत ट्रैक करें" } as Record<Language, string>,
  scanCrop: { English: "Scan Your Crop", Telugu: "మీ పంటను స్కాన్ చేయండి", Hindi: "अपनी फसल स्कैन करें" } as Record<Language, string>,
  scanDesc: { English: "Take photos of affected crops for instant AI diagnosis", Telugu: "తక్షణ AI రోగనిర్ధారణ కోసం పంట ఫోటోలు తీయండి", Hindi: "तुरंत AI निदान के लिए फसल की फोटो लें" } as Record<Language, string>,
  recentDiagnoses: { English: "Recent Diagnoses", Telugu: "ఇటీవలి రోగ నిర్ధారణలు", Hindi: "हाल के निदान" } as Record<Language, string>,
  viewAll: { English: "View All", Telugu: "అన్ని చూడండి", Hindi: "सभी देखें" } as Record<Language, string>,
  noDiagnoses: { English: "No diagnoses yet", Telugu: "ఇంకా రోగ నిర్ధారణలు లేవు", Hindi: "अभी तक कोई निदान नहीं" } as Record<Language, string>,
  noDiagnosesHint: { English: "Scan your first crop to get started", Telugu: "ప్రారంభించడానికి మీ మొదటి పంటను స్కాన్ చేయండి", Hindi: "शुरू करने के लिए अपनी पहली फसल स्कैन करें" } as Record<Language, string>,
  newScan: { English: "New Scan", Telugu: "కొత్త స్కాన్", Hindi: "नई स्कैन" } as Record<Language, string>,
  myHistory: { English: "My History", Telugu: "నా చరిత్ర", Hindi: "मेरा इतिहास" } as Record<Language, string>,
  tapToCapture: { English: "Tap to capture photos", Telugu: "ఫోటోలు తీయడానికి నొక్కండి", Hindi: "फोटो लेने के लिए टैप करें" } as Record<Language, string>,
  photosSelected: { English: "photos selected", Telugu: "ఫోటోలు ఎంచుకోబడ్డాయి", Hindi: "फोटो चयनित" } as Record<Language, string>,
  footer: { English: "Built for Farmers", Telugu: "రైతుల కోసం", Hindi: "किसानों के लिए" } as Record<Language, string>,
};

function MinimalHeader({ logo, centered, children }: { logo?: boolean; centered?: boolean; children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/60">
      <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
        {children}
        {centered && logo && (
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <img src={logoImage} alt="KhetSathi" className="w-8 h-8 rounded-lg object-contain" data-testid="img-logo" />
          </div>
        )}
      </div>
    </header>
  );
}

export default function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const savedPhone = localStorage.getItem("ks_phone") || "";
  const savedLang = (localStorage.getItem("ks_language") as Language) || "English";
  const savedLocation = localStorage.getItem("ks_location") || null;
  const isReturningUser = !!(savedPhone && savedLang);

  const [screen, setScreen] = useState<AppScreen>(isReturningUser ? "dashboard" : "onboarding");
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>("language");
  const [phoneNumber, setPhoneNumber] = useState(savedPhone);
  const [language, setLanguage] = useState<Language>(savedLang);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [userLocation, setUserLocation] = useState<string | null>(savedLocation);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatPhase, setChatPhase] = useState<ChatPhase>("gathering");
  const [extractedCrop, setExtractedCrop] = useState<string | null>(null);
  const [extractedLocation, setExtractedLocation] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<Record<string, any> | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<string | null>(null);
  const [planLanguage, setPlanLanguage] = useState<Language | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [diagnosisInProgress, setDiagnosisInProgress] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isReturningUser && screen === "dashboard") {
      fetchRecentHistory(savedPhone);
    }
  }, []);

  const fetchRecentHistory = useCallback(async (phone: string) => {
    if (!phone) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history/${encodeURIComponent(phone)}`);
      const data = await res.json();
      setRecentHistory((data.history || []).sort((a: HistoryItem, b: HistoryItem) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 3));
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLocation && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`, {
              headers: { 'Accept-Language': 'en' }
            });
            const data = await res.json();
            const district = data.address?.state_district || data.address?.county || data.address?.city || "";
            const state = data.address?.state || "";
            const loc = [district, state].filter(Boolean).join(", ");
            if (loc) {
              setUserLocation(loc);
              localStorage.setItem("ks_location", loc);
            }
          } catch {}
        },
        () => {},
        { timeout: 10000, enableHighAccuracy: false }
      );
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 6) {
      toast({ title: labels.maxImages[language], variant: "destructive" });
      return;
    }
    const newFiles = [...selectedFiles, ...files].slice(0, 6);
    setSelectedFiles(newFiles);
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews(newPreviews);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedFiles, previews, toast, language]);

  const removeImage = useCallback((index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((f) => f.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  }, [previews]);

  const registerPhoneMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/register-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, language }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
    onSuccess: () => {
      localStorage.setItem("ks_phone", phoneNumber);
      localStorage.setItem("ks_language", language);
      fetch("/api/set-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, language }),
      }).catch(() => {});
      setOnboardingStep("welcome");
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("images", file));
      formData.append("phone", phoneNumber);
      const res = await fetch("/api/upload-images", { method: "POST", body: formData });
      if (!res.ok) throw new Error((await res.json()).message || "Upload failed");
      return res.json() as Promise<{ imageUrls: string[] }>;
    },
    onSuccess: async (data) => {
      setImageUrls(data.imageUrls);
      setScreen("chat");
      if (userLocation) setExtractedLocation(userLocation);
      const greetRes = await fetch(`/api/chat/greeting?language=${language}`);
      const greetData = await greetRes.json();
      setMessages([{ role: "assistant", content: greetData.greeting }]);
    },
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const chatPhaseRef = useRef(chatPhase);
  const extractedCropRef = useRef(extractedCrop);
  const extractedLocationRef = useRef(extractedLocation);
  const diagnosisRef = useRef(diagnosis);
  const diagnosisInProgressRef = useRef(diagnosisInProgress);
  const imageUrlsRef = useRef(imageUrls);
  const phoneRef = useRef(phoneNumber);
  const languageRef = useRef(language);

  useEffect(() => { chatPhaseRef.current = chatPhase; }, [chatPhase]);
  useEffect(() => { extractedCropRef.current = extractedCrop; }, [extractedCrop]);
  useEffect(() => { extractedLocationRef.current = extractedLocation; }, [extractedLocation]);
  useEffect(() => { diagnosisRef.current = diagnosis; }, [diagnosis]);
  useEffect(() => { diagnosisInProgressRef.current = diagnosisInProgress; }, [diagnosisInProgress]);
  useEffect(() => { imageUrlsRef.current = imageUrls; }, [imageUrls]);
  useEffect(() => { phoneRef.current = phoneNumber; }, [phoneNumber]);
  useEffect(() => { languageRef.current = language; }, [language]);

  const runExtractionAgent = useCallback(async (allMessages: ChatMessage[]) => {
    if (extractedCropRef.current && extractedLocationRef.current) return;
    if (diagnosisInProgressRef.current) return;
    if (chatPhaseRef.current !== "gathering") return;
    try {
      const res = await fetch("/api/chat/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      });
      if (!res.ok) return;
      const extracted = await res.json();
      const newCrop = extracted.crop || extractedCropRef.current;
      const newLocation = extracted.location || extractedLocationRef.current;
      if (extracted.crop) setExtractedCrop(extracted.crop);
      if (extracted.location) setExtractedLocation(extracted.location);
      if (newCrop && newLocation && !diagnosisInProgressRef.current && chatPhaseRef.current === "gathering") {
        setChatPhase("diagnosing");
        setDiagnosisInProgress(true);
        triggerDiagnosis(newCrop, newLocation, allMessages);
      }
    } catch {}
  }, []);

  const runPlanIntentAgent = useCallback(async (allMessages: ChatMessage[]) => {
    const phase = chatPhaseRef.current;
    if (phase !== "diagnosed" && phase !== "asking_plan") return;
    try {
      const res = await fetch("/api/chat/detect-plan-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const curPhase = chatPhaseRef.current;
      if (data.wantsPlan && (curPhase === "diagnosed" || curPhase === "asking_plan")) {
        setChatPhase("awaiting_plan_language");
      }
    } catch {}
  }, []);

  const sendMessage = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isTyping) return;
    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput("");
    setIsTyping(true);
    try {
      const currentPhase = chatPhaseRef.current;
      const hasDiagnosis = currentPhase === "diagnosed" || currentPhase === "asking_plan" || currentPhase === "awaiting_plan_language";
      const isDiagnosedReply = currentPhase === "diagnosed" || currentPhase === "awaiting_plan_language";
      const chatRes = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages,
          language,
          diagnosis: hasDiagnosis ? diagnosisRef.current : null,
          planGenerated: currentPhase === "plan_ready",
          diagnosisAvailable: isDiagnosedReply,
          location: userLocation,
        }),
      });
      const chatData = await chatRes.json();
      if (!chatRes.ok) throw new Error(chatData.message);
      const assistantMsg: ChatMessage = { role: "assistant", content: chatData.reply };
      const newMessages = [...updatedMessages, assistantMsg];
      setMessages(newMessages);
      runExtractionAgent(newMessages);
      runPlanIntentAgent(newMessages);
    } catch (err: any) {
      toast({ title: err.message || "Chat failed", variant: "destructive" });
    } finally {
      setIsTyping(false);
    }
  }, [chatInput, messages, isTyping, language, userLocation, toast, runExtractionAgent, runPlanIntentAgent]);

  const triggerDiagnosis = async (crop: string, location: string, currentMessages: ChatMessage[]) => {
    try {
      const urls = imageUrlsRef.current;
      const lang = languageRef.current;
      const phone = phoneRef.current;
      const res = await fetch("/api/chat/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls: urls, crop, location, language: lang }),
      });
      if (!res.ok) throw new Error("Diagnosis failed");
      const data = await res.json();
      setDiagnosis(data.diagnosis);
      setChatPhase("diagnosed");
      const conversationSummary = currentMessages
        .map((m) => `${m.role === "user" ? "Farmer" : "AI"}: ${m.content}`)
        .join("\n");
      await fetch("/api/save-usercase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, conversationSummary, diagnosis: data.diagnosis, language: lang, imageUrls: urls }),
      });
    } catch {
      toast({ title: "Could not diagnose disease", variant: "destructive" });
    } finally {
      setDiagnosisInProgress(false);
    }
  };

  const triggerPlanGeneration = async (currentMessages: ChatMessage[], selectedLang: Language) => {
    try {
      setIsTyping(true);
      const currentDiagnosis = diagnosisRef.current;
      const urls = imageUrlsRef.current;
      const phone = phoneRef.current;
      const res = await fetch("/api/chat/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: currentMessages, diagnosis: currentDiagnosis, language: selectedLang, imageUrls: urls, phone }),
      });
      if (!res.ok) throw new Error("Plan generation failed");
      const data = await res.json();
      setTreatmentPlan(data.plan);
      setPlanLanguage(selectedLang);
      setPdfUrl(data.pdfUrl || null);
      setChatPhase("plan_ready");
      setMessages((prev) => [...prev, { role: "assistant", content: labels.planReady[selectedLang] || labels.planReady.English }]);
    } catch {
      toast({ title: "Plan generation failed", variant: "destructive" });
    } finally {
      setIsTyping(false);
    }
  };

  const handlePlanLanguageSelect = (selectedLang: Language) => {
    setChatPhase("generating_plan");
    triggerPlanGeneration(messages, selectedLang);
  };

  const regeneratePlanInLanguage = (selectedLang: Language) => {
    setTreatmentPlan(null);
    setChatPhase("generating_plan");
    triggerPlanGeneration(messages, selectedLang);
  };

  const resetChatState = () => {
    setSelectedFiles([]);
    setPreviews([]);
    setImageUrls([]);
    setMessages([]);
    setChatInput("");
    setChatPhase("gathering");
    setExtractedCrop(null);
    setExtractedLocation(null);
    setDiagnosis(null);
    setTreatmentPlan(null);
    setPlanLanguage(null);
    setPdfUrl(null);
    setDiagnosisInProgress(false);
    setIsVoiceActive(false);
  };

  const goToDashboard = () => {
    setScreen("dashboard");
    resetChatState();
    fetchRecentHistory(phoneNumber);
  };

  const goToCapture = () => {
    resetChatState();
    setScreen("capture");
  };

  const getLabel = (key: keyof typeof labels) => labels[key][language] || labels[key].English;

  const onboardingSteps: OnboardingStep[] = ["language", "phone", "welcome"];
  const currentOnboardingIdx = onboardingSteps.indexOf(onboardingStep);

  if (screen === "onboarding") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MinimalHeader logo centered>
          {onboardingStep !== "language" ? (
            <button
              onClick={() => {
                const idx = onboardingSteps.indexOf(onboardingStep);
                if (idx > 0) setOnboardingStep(onboardingSteps[idx - 1]);
              }}
              className="flex items-center gap-1 text-muted-foreground text-sm active:opacity-70 rounded-lg px-1 py-1"
              data-testid="button-back-header"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-xs font-medium">{getLabel("back")}</span>
            </button>
          ) : <div />}
          <div />
        </MinimalHeader>

        {onboardingStep !== "welcome" && (
          <div className="max-w-lg mx-auto w-full px-5 pt-4">
            <div className="flex items-center gap-0">
              {onboardingSteps.filter(s => s !== "welcome").map((step, idx) => {
                const isActive = idx === currentOnboardingIdx;
                const isDone = idx < currentOnboardingIdx;
                return (
                  <div key={step} className="flex items-center flex-1">
                    <button
                      type="button"
                      disabled={!isDone}
                      onClick={() => isDone && setOnboardingStep(step)}
                      className="flex items-center gap-1.5 flex-shrink-0"
                      data-testid={`step-indicator-${step}`}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 transition-all ${
                        isDone ? "bg-primary text-primary-foreground"
                          : isActive ? "bg-primary text-primary-foreground ring-2 ring-primary/20 ring-offset-2 ring-offset-background"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={`text-xs font-medium ${isActive || isDone ? "text-foreground" : "text-muted-foreground"}`}>
                        {getLabel(step === "language" ? "stepLanguage" : "stepPhone")}
                      </span>
                    </button>
                    {idx < 1 && (
                      <div className={`flex-1 h-[2px] mx-3 rounded-full transition-colors ${idx < currentOnboardingIdx ? "bg-primary" : "bg-border"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <main className="flex-1 max-w-lg mx-auto w-full px-5 py-6">
          <AnimatePresence mode="wait">
            {onboardingStep === "language" && (
              <motion.div key="lang" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <div className="space-y-5">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-semibold text-foreground tracking-tight">{getLabel("chooseLanguage")}</h2>
                    <p className="text-sm text-muted-foreground">{getLabel("languageHint")}</p>
                  </div>
                  <div className="space-y-2.5">
                    {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                      <button key={lang} onClick={() => setLanguage(lang)}
                        className={`w-full px-4 py-4 rounded-xl text-left flex items-center gap-3.5 transition-all active:scale-[0.98] ${
                          language === lang ? "bg-card border-2 border-primary shadow-sm" : "bg-card border-2 border-transparent shadow-xs hover:shadow-sm"
                        }`} data-testid={`button-lang-${lang.toLowerCase()}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          language === lang ? "border-primary bg-primary" : "border-input"
                        }`}>
                          {language === lang && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-[15px] leading-tight">{lang === "Telugu" ? "తెలుగు" : lang === "Hindi" ? "हिन्दी" : "English"}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{lang}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full gap-2 h-12 rounded-xl text-[15px] font-semibold shadow-sm" size="lg" onClick={() => setOnboardingStep("phone")} data-testid="button-continue-language">
                    {getLabel("continueBtn")}<ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {onboardingStep === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
                <div className="space-y-5">
                  <div className="text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto">
                      <PhoneIcon className="w-7 h-7 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-semibold text-foreground tracking-tight">{getLabel("enterPhone")}</h2>
                      <p className="text-sm text-muted-foreground">{getLabel("phoneHint")}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="phone" className="text-sm font-medium mb-2 block text-foreground">{getLabel("phoneLabel")}</label>
                      <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ""))}
                        className="text-lg text-center tracking-wider h-13 rounded-xl bg-card border-border/80 shadow-xs" data-testid="input-phone" />
                    </div>
                    <Button className="w-full gap-2 h-12 rounded-xl text-[15px] font-semibold shadow-sm" size="lg" onClick={() => registerPhoneMutation.mutate()}
                      disabled={phoneNumber.length < 10 || registerPhoneMutation.isPending} data-testid="button-continue-phone">
                      {registerPhoneMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />{getLabel("registering")}</>
                      ) : (
                        <>{getLabel("continueBtn")}<ArrowRight className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {onboardingStep === "welcome" && (
              <motion.div key="welcome" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}>
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-md">
                    <img src={logoImage} alt="KhetSathi" className="w-full h-full object-contain bg-white p-1" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-foreground tracking-tight">{getLabel("welcomeTitle")}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">{getLabel("welcomeDesc")}</p>
                  </div>
                  <div className="w-full space-y-2.5">
                    {[
                      { icon: ScanLine, label: "welcomeFeature1" as const },
                      { icon: CalendarDays, label: "welcomeFeature2" as const },
                      { icon: Clock, label: "welcomeFeature3" as const },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl bg-card shadow-xs">
                        <div className="w-9 h-9 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-[18px] h-[18px] text-primary" />
                        </div>
                        <span className="text-sm font-medium text-foreground text-left">{getLabel(label)}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full gap-2 h-13 rounded-xl text-[15px] font-semibold shadow-md" size="lg" onClick={() => { setScreen("dashboard"); fetchRecentHistory(phoneNumber); }} data-testid="button-start-now">
                    {getLabel("startNow")} <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="mt-auto">
          <div className="max-w-lg mx-auto px-4 py-3 text-center text-xs text-muted-foreground/60">
            {getLabel("title")} &middot; {getLabel("footer")}
          </div>
        </footer>
      </div>
    );
  }

  if (screen === "dashboard") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MinimalHeader logo centered>
          <div className="flex items-center gap-1 text-muted-foreground">
            {userLocation && (
              <span className="text-[11px] flex items-center gap-1 bg-muted/60 px-2 py-1 rounded-full">
                <MapPin className="w-3 h-3 text-primary" />
                <span className="max-w-[80px] truncate">{userLocation}</span>
              </span>
            )}
          </div>
          <div />
        </MinimalHeader>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5 space-y-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
            <button
              onClick={goToCapture}
              className="w-full rounded-2xl overflow-hidden shadow-md active:scale-[0.98] transition-transform"
              data-testid="button-scan-crop"
              style={{ background: "linear-gradient(135deg, hsl(152 45% 28%), hsl(152 35% 22%))" }}
            >
              <div className="p-6 text-white flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Camera className="w-7 h-7" />
                </div>
                <div className="text-left flex-1">
                  <p className="text-lg font-bold leading-tight">{getLabel("scanCrop")}</p>
                  <p className="text-xs text-white/70 mt-1 leading-snug">{getLabel("scanDesc")}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-white/50 flex-shrink-0" />
              </div>
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.08 }}>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={goToCapture}
                className="flex items-center gap-3 p-4 rounded-xl bg-card shadow-xs active:scale-[0.98] transition-transform"
                data-testid="button-quick-new-scan"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                  <ScanLine className="w-5 h-5 text-primary" />
                </div>
                <span className="text-sm font-medium text-foreground">{getLabel("newScan")}</span>
              </button>
              <Link href={`/history?phone=${encodeURIComponent(phoneNumber)}&lang=${language}`}>
                <button
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-card shadow-xs active:scale-[0.98] transition-transform"
                  data-testid="button-quick-history"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/8 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium text-foreground">{getLabel("myHistory")}</span>
                </button>
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.16 }}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-foreground">{getLabel("recentDiagnoses")}</h3>
              {recentHistory.length > 0 && (
                <Link href={`/history?phone=${encodeURIComponent(phoneNumber)}&lang=${language}`}>
                  <span className="text-xs text-primary font-medium flex items-center gap-0.5">{getLabel("viewAll")} <ChevronRight className="w-3.5 h-3.5" /></span>
                </Link>
              )}
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : recentHistory.length === 0 ? (
              <div className="text-center py-10 rounded-xl bg-card shadow-xs">
                <Leaf className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2.5" />
                <p className="text-sm font-medium text-muted-foreground">{getLabel("noDiagnoses")}</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">{getLabel("noDiagnosesHint")}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentHistory.map((item, idx) => (
                  <div key={idx} className="rounded-xl bg-card shadow-xs p-3.5" data-testid={`card-recent-${idx}`}>
                    <div className="flex items-start gap-3">
                      {item.imageUrls && item.imageUrls.length > 0 ? (
                        <img src={item.imageUrls[0]} alt="Crop" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <Sprout className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {item.diagnosis?.disease && (
                          <p className="text-[13px] font-semibold text-foreground truncate">{item.diagnosis.disease}</p>
                        )}
                        {item.diagnosis?.crop_identified && (
                          <p className="text-xs text-muted-foreground truncate">{item.diagnosis.crop_identified}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      {item.diagnosis?.severity && (
                        <Badge variant="secondary" className="text-[10px] font-medium rounded-full px-2">{item.diagnosis.severity}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </main>

        <footer className="mt-auto">
          <div className="max-w-lg mx-auto px-4 py-3 text-center text-xs text-muted-foreground/60">
            {getLabel("title")} &middot; {getLabel("footer")}
          </div>
        </footer>
      </div>
    );
  }

  if (screen === "capture") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <MinimalHeader logo centered>
          <button
            onClick={goToDashboard}
            className="flex items-center gap-1 text-muted-foreground text-sm active:opacity-70 rounded-lg px-1 py-1"
            data-testid="button-back-capture"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-xs font-medium">{getLabel("back")}</span>
          </button>
          <div />
        </MinimalHeader>

        <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
          <div className="space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-semibold text-foreground tracking-tight">{getLabel("uploadPhotos")}</h2>
              <p className="text-sm text-muted-foreground">{getLabel("uploadHint")}</p>
            </div>

            {previews.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-16 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 active:scale-[0.98] active:bg-muted/30 transition-all"
                data-testid="button-upload-image"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/8 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-medium text-foreground block">{getLabel("tapToCapture")}</span>
                  <span className="text-xs text-muted-foreground mt-0.5 block">1-6 photos</span>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{selectedFiles.length} {getLabel("photosSelected")}</span>
                  {selectedFiles.length < 6 && (
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-add-more-images" className="gap-1.5 rounded-lg text-xs">
                      <Plus className="w-3.5 h-3.5" />{getLabel("addMore")}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {previews.map((preview, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden shadow-xs">
                      <img src={preview} alt={`Crop ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-preview-${idx}`} />
                      <button onClick={() => removeImage(idx)}
                        className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm text-white flex items-center justify-center active:bg-black/70"
                        data-testid={`button-remove-image-${idx}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} className="hidden" data-testid="input-file-upload" />

            <Button className="w-full gap-2 h-12 rounded-xl text-[15px] font-semibold shadow-sm" size="lg" onClick={() => uploadMutation.mutate()}
              disabled={selectedFiles.length === 0 || uploadMutation.isPending} data-testid="button-analyze-crop">
              {uploadMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{getLabel("uploading")}</>
              ) : (
                <>{getLabel("analyzeBtn")}<ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <MinimalHeader logo centered>
        <button
          onClick={goToDashboard}
          className="flex items-center gap-1 text-muted-foreground text-sm active:opacity-70 rounded-lg px-1 py-1"
          data-testid="button-back-chat"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-xs font-medium">{getLabel("back")}</span>
        </button>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs h-8 rounded-lg" data-testid="button-new-diagnosis"
          onClick={() => { goToDashboard(); setTimeout(goToCapture, 100); }}>
          <RotateCcw className="w-3.5 h-3.5" />
          {getLabel("newDiagnosis")}
        </Button>
      </MinimalHeader>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" data-testid="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card text-foreground rounded-bl-md"
                }`}
                data-testid={`chat-message-${idx}`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {chatPhase === "awaiting_plan_language" && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Languages className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[85%] rounded-2xl bg-card shadow-sm p-4 rounded-bl-md" data-testid="card-plan-language-picker">
                <p className="text-sm font-medium mb-3 text-foreground">{getLabel("choosePlanLanguage")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                    <Button key={lang} variant="outline" size="sm" onClick={() => handlePlanLanguageSelect(lang)} className="rounded-lg" data-testid={`button-plan-lang-${lang.toLowerCase()}`}>
                      {lang === "English" ? "English" : lang === "Telugu" ? "తెలుగు" : "हिन्दी"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {treatmentPlan && planLanguage && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="max-w-[82%]">
                {pdfUrl ? (
                  <div className="bg-card rounded-2xl rounded-bl-md overflow-hidden shadow-sm cursor-pointer" onClick={() => window.open(pdfUrl, "_blank")} data-testid="card-pdf-preview">
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/90 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate" data-testid="text-pdf-title">
                          {planLanguage === "Telugu" ? "7-రోజుల ప్రణాళిక" : planLanguage === "Hindi" ? "7-दिन की योजना" : "7-Day Treatment Plan"}
                        </p>
                        <p className="text-xs text-muted-foreground">PDF &middot; {planLanguage === "Telugu" ? "తెలుగు" : planLanguage === "Hindi" ? "हिन्दी" : "English"}</p>
                      </div>
                      <a href={pdfUrl} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center" data-testid="button-download-pdf">
                        <Download className="w-4 h-4 text-primary" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3 shadow-xs" data-testid="card-plan-text-fallback">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">
                        {planLanguage === "Telugu" ? "7-రోజుల ప్రణాళిక" : planLanguage === "Hindi" ? "7-दिन की योजना" : "7-Day Treatment Plan"}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{getLabel("getPlanIn")}:</span>
                  {(["English", "Telugu", "Hindi"] as Language[]).filter((l) => l !== planLanguage).map((lang) => (
                    <Button key={lang} variant="ghost" size="sm" onClick={() => regeneratePlanInLanguage(lang)} disabled={isTyping} className="text-xs h-7 rounded-lg" data-testid={`button-regen-plan-${lang.toLowerCase()}`}>
                      <Languages className="w-3 h-3 mr-1" />
                      {lang === "English" ? "English" : lang === "Telugu" ? "తెలుగు" : "हिन्दी"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="flex gap-2.5 justify-start">
              <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card rounded-2xl rounded-bl-md px-4 py-3.5 shadow-xs">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {isVoiceActive && (
          <div className="border-t border-border bg-card">
            <VoiceChat phone={phoneNumber} language={language} onClose={() => setIsVoiceActive(false)} />
          </div>
        )}

        <div className="border-t border-border/60 px-4 py-2.5 bg-background pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex gap-2 items-center max-w-lg mx-auto">
            <Input
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={getLabel("typeMessage")}
              className="flex-1 h-10 rounded-xl bg-card border-border/60 shadow-xs"
              disabled={isTyping || chatPhase === "awaiting_plan_language" || isVoiceActive}
              data-testid="input-chat"
            />
            <button onClick={() => setIsVoiceActive(!isVoiceActive)} disabled={isTyping}
              className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${isVoiceActive ? "bg-primary text-primary-foreground" : "bg-card border border-border/60 text-muted-foreground shadow-xs"}`}
              data-testid="button-voice-call">
              <Mic className="w-4 h-4" />
            </button>
            <button onClick={sendMessage} disabled={!chatInput.trim() || isTyping || chatPhase === "awaiting_plan_language" || isVoiceActive}
              className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 shadow-xs disabled:opacity-40"
              data-testid="button-send-chat">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
