import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Language } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, X, Camera, Phone as PhoneIcon, Globe, ArrowRight,
  Check, Send, Bot, Languages, FileText, Download, Mic, MapPin,
  History, RotateCcw, ChevronLeft, Plus, Leaf, Clock,
  ScanLine, CalendarDays, Sprout, ChevronRight, Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import VoiceChat from "@/components/voice-chat";
import logoImage from "@assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png";

type AppScreen = "onboarding" | "dashboard" | "capture" | "chat";
type OnboardingStep = "language" | "phone" | "location";

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
  stepLocation: { English: "Location", Telugu: "స్థానం", Hindi: "स्थान" } as Record<Language, string>,
  detectingLocation: { English: "Detecting your location...", Telugu: "మీ స్థానాన్ని గుర్తిస్తోంది...", Hindi: "आपका स्थान पता लगा रहा है..." } as Record<Language, string>,
  locationDetected: { English: "Location detected", Telugu: "స్థానం గుర్తించబడింది", Hindi: "स्थान पता चला" } as Record<Language, string>,
  locationFailed: { English: "Could not detect location", Telugu: "స్థానం గుర్తించలేకపోయింది", Hindi: "स्थान पता नहीं चल पाया" } as Record<Language, string>,
  skipLocation: { English: "Skip & Continue", Telugu: "దాటవేసి కొనసాగించు", Hindi: "छोड़ें और जारी रखें" } as Record<Language, string>,
  scanCrop: { English: "Scan Your Crop", Telugu: "మీ పంటను స్కాన్ చేయండి", Hindi: "अपनी फसल स्कैन करें" } as Record<Language, string>,
  scanDesc: { English: "Take photos of affected crops for instant AI diagnosis", Telugu: "తక్షణ AI రోగనిర్ధారణ కోసం పంట ఫోటోలు తీయండి", Hindi: "तुरंत AI निदान के लिए फसल की फोटो लें" } as Record<Language, string>,
  recentDiagnoses: { English: "Recent Diagnoses", Telugu: "ఇటీవలి రోగ నిర్ధారణలు", Hindi: "हाल के निदान" } as Record<Language, string>,
  viewAll: { English: "View All", Telugu: "అన్ని చూడండి", Hindi: "सभी देखें" } as Record<Language, string>,
  noDiagnoses: { English: "No diagnoses yet", Telugu: "ఇంకా రోగ నిర్ధారణలు లేవు", Hindi: "अभी तक कोई निदान नहीं" } as Record<Language, string>,
  noDiagnosesHint: { English: "Scan your first crop to get started", Telugu: "ప్రారంభించడానికి మీ మొదటి పంటను స్కాన్ చేయండి", Hindi: "शुरू करने के लिए अपनी पहली फसल स्कैन करें" } as Record<Language, string>,
  quickActions: { English: "Quick Actions", Telugu: "త్వరిత చర్యలు", Hindi: "त्वरित कार्य" } as Record<Language, string>,
  newScan: { English: "New Scan", Telugu: "కొత్త స్కాన్", Hindi: "नई स्कैन" } as Record<Language, string>,
  myHistory: { English: "My History", Telugu: "నా చరిత్ర", Hindi: "मेरा इतिहास" } as Record<Language, string>,
  welcome: { English: "Welcome back!", Telugu: "తిరిగి స్వాగతం!", Hindi: "वापस स्वागत है!" } as Record<Language, string>,
  welcomeNew: { English: "Welcome to KhetSathi!", Telugu: "ఖేత్‌సాథికి స్వాగతం!", Hindi: "खेतसाथी में आपका स्वागत!" } as Record<Language, string>,
  tapToCapture: { English: "Tap to capture photos", Telugu: "ఫోటోలు తీయడానికి నొక్కండి", Hindi: "फोटो लेने के लिए टैप करें" } as Record<Language, string>,
  photosSelected: { English: "photos selected", Telugu: "ఫోటోలు ఎంచుకోబడ్డాయి", Hindi: "फोटो चयनित" } as Record<Language, string>,
  getStarted: { English: "Get Started", Telugu: "ప్రారంభించండి", Hindi: "शुरू करें" } as Record<Language, string>,
  footer: { English: "Built for Farmers", Telugu: "రైతుల కోసం", Hindi: "किसानों के लिए" } as Record<Language, string>,
};

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
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationDone, setLocationDone] = useState(false);

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

  const detectLocation = useCallback(() => {
    setLocationLoading(true);
    const fallbackTimeout = setTimeout(() => {
      setLocationDone(true);
      setLocationLoading(false);
    }, 10000);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          clearTimeout(fallbackTimeout);
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`, {
              headers: { 'Accept-Language': 'en' }
            });
            const data = await res.json();
            const district = data.address?.state_district || data.address?.county || data.address?.city || "";
            const state = data.address?.state || "";
            const loc = [district, state].filter(Boolean).join(", ");
            if (loc) setUserLocation(loc);
          } catch {} finally {
            setLocationDone(true);
            setLocationLoading(false);
          }
        },
        () => {
          clearTimeout(fallbackTimeout);
          setLocationDone(true);
          setLocationLoading(false);
        },
        { timeout: 8000, enableHighAccuracy: false }
      );
    } else {
      clearTimeout(fallbackTimeout);
      setLocationDone(true);
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (onboardingStep === "location" && !locationDone) {
      detectLocation();
    }
  }, [onboardingStep, locationDone, detectLocation]);

  useEffect(() => {
    if (locationDone && onboardingStep === "location") {
      const timer = setTimeout(() => {
        localStorage.setItem("ks_phone", phoneNumber);
        localStorage.setItem("ks_language", language);
        if (userLocation) localStorage.setItem("ks_location", userLocation);
        fetch("/api/set-language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: phoneNumber, language }),
        }).catch(() => {});
        setScreen("dashboard");
        fetchRecentHistory(phoneNumber);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [locationDone, onboardingStep, phoneNumber, language, userLocation, fetchRecentHistory]);

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
    onSuccess: () => setOnboardingStep("location"),
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

  const goToDashboard = () => {
    setScreen("dashboard");
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
    fetchRecentHistory(phoneNumber);
  };

  const goToCapture = () => {
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
    setScreen("capture");
  };

  const getLabel = (key: keyof typeof labels) => labels[key][language] || labels[key].English;

  const onboardingSteps: OnboardingStep[] = ["language", "phone", "location"];
  const currentOnboardingIdx = onboardingSteps.indexOf(onboardingStep);
  const stepLabelKeys: Record<OnboardingStep, keyof typeof labels> = { language: "stepLanguage", phone: "stepPhone", location: "stepLocation" };

  if (screen === "onboarding") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-primary text-primary-foreground sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-3 py-2.5">
            <div className="flex items-center gap-2">
              {onboardingStep !== "language" && (
                <button
                  onClick={() => {
                    const idx = onboardingSteps.indexOf(onboardingStep);
                    if (idx > 0) setOnboardingStep(onboardingSteps[idx - 1]);
                  }}
                  className="flex items-center gap-1 text-primary-foreground/80 text-sm active:bg-white/10 rounded-md px-1 py-1"
                  data-testid="button-back-header"
                >
                  <ChevronLeft className="w-5 h-5" />
                  <span className="text-xs font-medium">{getLabel("back")}</span>
                </button>
              )}
              <img src={logoImage} alt="KhetSathi" className="w-9 h-9 rounded-md object-contain bg-white/10 p-0.5" data-testid="img-logo" />
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight leading-tight" data-testid="text-app-title">{getLabel("title")}</h1>
                <p className="text-[10px] text-primary-foreground/70 leading-tight">{getLabel("subtitle")}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-card border-b border-border sticky top-[52px] z-40">
          <div className="max-w-lg mx-auto px-3 py-2">
            <div className="flex items-center gap-0">
              {onboardingSteps.map((step, idx) => {
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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-all ${
                        isDone ? "bg-primary text-primary-foreground cursor-pointer"
                          : isActive ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-card"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <span className={`text-xs font-medium hidden min-[360px]:inline ${isActive || isDone ? "text-foreground" : "text-muted-foreground"}`}>
                        {getLabel(stepLabelKeys[step])}
                      </span>
                    </button>
                    {idx < onboardingSteps.length - 1 && (
                      <div className={`flex-1 h-[2px] mx-2 rounded-full transition-colors ${idx < currentOnboardingIdx ? "bg-primary" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4">
          <AnimatePresence mode="wait">
            {onboardingStep === "language" && (
              <motion.div key="lang" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="space-y-4">
                  <div className="text-center mb-1">
                    <h2 className="text-lg font-semibold">{getLabel("chooseLanguage")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{getLabel("languageHint")}</p>
                  </div>
                  <div className="space-y-2.5">
                    {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                      <button key={lang} onClick={() => setLanguage(lang)}
                        className={`w-full px-4 py-3.5 rounded-md border-2 text-left flex items-center gap-3 transition-colors active:scale-[0.98] ${
                          language === lang ? "border-primary bg-primary/5" : "border-border"
                        }`} data-testid={`button-lang-${lang.toLowerCase()}`}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                          language === lang ? "border-primary bg-primary" : "border-muted-foreground/50"
                        }`}>
                          {language === lang && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-[15px] leading-tight">{lang === "Telugu" ? "తెలుగు" : lang === "Hindi" ? "हिन्दी" : "English"}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{lang}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <Button className="w-full gap-2 h-12" size="lg" onClick={() => setOnboardingStep("phone")} data-testid="button-continue-language">
                    {getLabel("continueBtn")}<ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {onboardingStep === "phone" && (
              <motion.div key="phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <PhoneIcon className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-lg font-semibold">{getLabel("enterPhone")}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{getLabel("phoneHint")}</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label htmlFor="phone" className="text-sm font-medium mb-1.5 block text-foreground">{getLabel("phoneLabel")}</label>
                      <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ""))}
                        className="text-lg text-center tracking-wider h-12" data-testid="input-phone" />
                    </div>
                    <Button className="w-full gap-2 h-12" size="lg" onClick={() => registerPhoneMutation.mutate()}
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

            {onboardingStep === "location" && (
              <motion.div key="location" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-5">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors ${
                    locationDone && userLocation ? "bg-primary/10" : locationDone ? "bg-muted" : "bg-primary/10"
                  }`}>
                    {locationLoading ? (
                      <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    ) : locationDone && userLocation ? (
                      <MapPin className="w-10 h-10 text-primary" />
                    ) : locationDone ? (
                      <MapPin className="w-10 h-10 text-muted-foreground" />
                    ) : (
                      <MapPin className="w-10 h-10 text-primary" />
                    )}
                  </div>

                  {locationLoading && (
                    <div>
                      <p className="text-base font-semibold">{getLabel("detectingLocation")}</p>
                      <p className="text-xs text-muted-foreground mt-1">{getLabel("stepLocation")}</p>
                    </div>
                  )}

                  {locationDone && userLocation && (
                    <div>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Check className="w-5 h-5 text-primary" />
                        <p className="text-base font-semibold text-primary">{getLabel("locationDetected")}</p>
                      </div>
                      <p className="text-sm text-foreground font-medium">{userLocation}</p>
                    </div>
                  )}

                  {locationDone && !userLocation && (
                    <div>
                      <p className="text-base font-semibold text-muted-foreground">{getLabel("locationFailed")}</p>
                      <Button variant="outline" className="mt-3 gap-2" onClick={() => { setScreen("dashboard"); fetchRecentHistory(phoneNumber); }} data-testid="button-skip-location">
                        {getLabel("skipLocation")} <ArrowRight className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="border-t border-border mt-auto">
          <div className="max-w-lg mx-auto px-4 py-2.5 text-center text-[11px] text-muted-foreground">
            {getLabel("title")} &mdash; {getLabel("footer")}
          </div>
        </footer>
      </div>
    );
  }

  if (screen === "dashboard") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-primary text-primary-foreground sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <img src={logoImage} alt="KhetSathi" className="w-9 h-9 rounded-md object-contain bg-white/10 p-0.5" />
                <div className="min-w-0">
                  <h1 className="text-base font-bold tracking-tight leading-tight">{getLabel("title")}</h1>
                  <p className="text-[10px] text-primary-foreground/70 leading-tight">{getLabel("subtitle")}</p>
                </div>
              </div>
              {userLocation && (
                <div className="flex items-center gap-1 text-primary-foreground/70 text-[10px]">
                  <MapPin className="w-3 h-3" />
                  <span className="max-w-[100px] truncate">{userLocation}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4 space-y-5">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <p className="text-sm text-muted-foreground mb-1">{getLabel("welcomeNew")}</p>

            <button
              onClick={goToCapture}
              className="w-full rounded-md bg-primary text-primary-foreground p-5 flex flex-col items-center gap-3 active:scale-[0.98] transition-transform"
              data-testid="button-scan-crop"
            >
              <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center">
                <Camera className="w-8 h-8" />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{getLabel("scanCrop")}</p>
                <p className="text-xs text-primary-foreground/75 mt-0.5">{getLabel("scanDesc")}</p>
              </div>
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.1 }}>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={goToCapture}
                className="flex flex-col items-center gap-2 p-4 rounded-md bg-card border border-border active:scale-[0.98] transition-transform"
                data-testid="button-quick-new-scan"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ScanLine className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-medium text-foreground">{getLabel("newScan")}</span>
              </button>
              <Link href={`/history?phone=${encodeURIComponent(phoneNumber)}&lang=${language}`}>
                <button
                  className="w-full flex flex-col items-center gap-2 p-4 rounded-md bg-card border border-border active:scale-[0.98] transition-transform"
                  data-testid="button-quick-history"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{getLabel("myHistory")}</span>
                </button>
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: 0.2 }}>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <h3 className="text-sm font-semibold text-foreground">{getLabel("recentDiagnoses")}</h3>
              {recentHistory.length > 0 && (
                <Link href={`/history?phone=${encodeURIComponent(phoneNumber)}&lang=${language}`}>
                  <span className="text-xs text-primary font-medium">{getLabel("viewAll")} <ChevronRight className="w-3 h-3 inline" /></span>
                </Link>
              )}
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : recentHistory.length === 0 ? (
              <div className="text-center py-8 rounded-md border border-dashed border-border">
                <Leaf className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">{getLabel("noDiagnoses")}</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{getLabel("noDiagnosesHint")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentHistory.map((item, idx) => (
                  <Card key={idx} className="p-3" data-testid={`card-recent-${idx}`}>
                    <div className="flex items-start gap-2.5">
                      {item.imageUrls && item.imageUrls.length > 0 ? (
                        <img src={item.imageUrls[0]} alt="Crop" className="w-12 h-12 rounded-md object-cover flex-shrink-0 border border-border" />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <Sprout className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {item.diagnosis?.disease && (
                          <p className="text-[13px] font-semibold text-foreground truncate">{item.diagnosis.disease}</p>
                        )}
                        {item.diagnosis?.crop_identified && (
                          <p className="text-[11px] text-muted-foreground truncate">{item.diagnosis.crop_identified}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          <CalendarDays className="w-2.5 h-2.5 inline mr-0.5" />
                          {new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </p>
                      </div>
                      {item.diagnosis?.severity && (
                        <Badge variant="secondary" className="text-[9px] flex-shrink-0">{item.diagnosis.severity}</Badge>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </motion.div>
        </main>

        <footer className="border-t border-border mt-auto">
          <div className="max-w-lg mx-auto px-4 py-2.5 text-center text-[11px] text-muted-foreground">
            {getLabel("title")} &mdash; {getLabel("footer")}
          </div>
        </footer>
      </div>
    );
  }

  if (screen === "capture") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="bg-primary text-primary-foreground sticky top-0 z-50">
          <div className="max-w-lg mx-auto px-3 py-2.5">
            <div className="flex items-center gap-2">
              <button
                onClick={goToDashboard}
                className="flex items-center gap-1 text-primary-foreground/80 text-sm active:bg-white/10 rounded-md px-1 py-1"
                data-testid="button-back-capture"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-xs font-medium">{getLabel("back")}</span>
              </button>
              <img src={logoImage} alt="KhetSathi" className="w-9 h-9 rounded-md object-contain bg-white/10 p-0.5" />
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight leading-tight">{getLabel("title")}</h1>
                <p className="text-[10px] text-primary-foreground/70 leading-tight">{getLabel("uploadPhotos")}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-lg mx-auto w-full px-3 py-4">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-semibold">{getLabel("uploadPhotos")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{getLabel("uploadHint")}</p>
            </div>

            {previews.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-14 rounded-md border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-3 text-primary active:scale-[0.98] active:bg-primary/5 transition-transform"
                data-testid="button-upload-image"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Camera className="w-8 h-8" />
                </div>
                <span className="text-sm font-medium">{getLabel("tapToCapture")}</span>
                <span className="text-[11px] text-muted-foreground">1-6 photos</span>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{selectedFiles.length} {getLabel("photosSelected")}</span>
                  {selectedFiles.length < 6 && (
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-add-more-images" className="gap-1">
                      <Plus className="w-3.5 h-3.5" />{getLabel("addMore")}
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((preview, idx) => (
                    <div key={idx} className="relative aspect-square rounded-md overflow-hidden border border-border">
                      <img src={preview} alt={`Crop ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-preview-${idx}`} />
                      <button onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center active:bg-black/80"
                        data-testid={`button-remove-image-${idx}`}>
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleFileSelect} className="hidden" data-testid="input-file-upload" />

            <Button className="w-full gap-2 h-12" size="lg" onClick={() => uploadMutation.mutate()}
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
      <header className="bg-primary text-primary-foreground sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={goToDashboard}
                className="flex items-center gap-1 text-primary-foreground/80 text-sm active:bg-white/10 rounded-md px-1 py-1"
                data-testid="button-back-chat"
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="text-xs font-medium">{getLabel("back")}</span>
              </button>
              <img src={logoImage} alt="KhetSathi" className="w-9 h-9 rounded-md object-contain bg-white/10 p-0.5" />
              <div className="min-w-0">
                <h1 className="text-base font-bold tracking-tight leading-tight">{getLabel("title")}</h1>
                <p className="text-[10px] text-primary-foreground/70 leading-tight">{getLabel("subtitle")}</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="sm" className="text-primary-foreground/80 gap-1 text-xs px-2" data-testid="button-new-diagnosis"
                onClick={() => { goToDashboard(); setTimeout(goToCapture, 100); }}>
                <RotateCcw className="w-3.5 h-3.5" />
                {getLabel("newDiagnosis")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" data-testid="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                }`}
                data-testid={`chat-message-${idx}`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {chatPhase === "awaiting_plan_language" && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Languages className="w-3.5 h-3.5 text-primary" />
              </div>
              <Card className="max-w-[85%] p-3" data-testid="card-plan-language-picker">
                <p className="text-sm font-medium mb-2">{getLabel("choosePlanLanguage")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                    <Button key={lang} variant="outline" size="sm" onClick={() => handlePlanLanguageSelect(lang)} data-testid={`button-plan-lang-${lang.toLowerCase()}`}>
                      {lang === "English" ? "English" : lang === "Telugu" ? "తెలుగు" : "हिन्दी"}
                    </Button>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {treatmentPlan && planLanguage && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="max-w-[82%]">
                {pdfUrl ? (
                  <div className="bg-muted rounded-2xl rounded-bl-sm overflow-hidden cursor-pointer" onClick={() => window.open(pdfUrl, "_blank")} data-testid="card-pdf-preview">
                    <div className="bg-primary/10 px-3 py-2.5 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-red-500/90 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate" data-testid="text-pdf-title">
                          {planLanguage === "Telugu" ? "7-రోజుల ప్రణాళిక" : planLanguage === "Hindi" ? "7-दिन की योजना" : "7-Day Treatment Plan"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">PDF</p>
                      </div>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {planLanguage === "Telugu" ? "తెలుగు" : planLanguage === "Hindi" ? "हिन्दी" : "English"}
                      </span>
                      <a href={pdfUrl} download target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary" data-testid="button-download-pdf">
                        <Download className="w-3.5 h-3.5" />
                        {planLanguage === "Telugu" ? "డౌన్‌లోడ్" : planLanguage === "Hindi" ? "डाउनलोड" : "Download"}
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2.5" data-testid="card-plan-text-fallback">
                    <div className="flex items-center gap-2 mb-1.5">
                      <FileText className="w-4 h-4 text-primary" />
                      <p className="text-sm font-medium text-foreground">
                        {planLanguage === "Telugu" ? "7-రోజుల ప్రణాళిక" : planLanguage === "Hindi" ? "7-दिन की योजना" : "7-Day Treatment Plan"}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground">{getLabel("getPlanIn")}:</span>
                  {(["English", "Telugu", "Hindi"] as Language[]).filter((l) => l !== planLanguage).map((lang) => (
                    <Button key={lang} variant="ghost" size="sm" onClick={() => regeneratePlanInLanguage(lang)} disabled={isTyping} data-testid={`button-regen-plan-${lang.toLowerCase()}`}>
                      <Languages className="w-3.5 h-3.5 mr-1" />
                      {lang === "English" ? "English" : lang === "Telugu" ? "తెలుగు" : "हिन्दी"}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {isTyping && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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

        <div className="border-t border-border px-3 py-2 bg-card pb-[env(safe-area-inset-bottom,8px)]">
          <div className="flex gap-2 items-center max-w-lg mx-auto">
            <Input
              ref={chatInputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={getLabel("typeMessage")}
              className="flex-1 h-10"
              disabled={isTyping || chatPhase === "awaiting_plan_language" || isVoiceActive}
              data-testid="input-chat"
            />
            <Button size="icon" variant={isVoiceActive ? "default" : "outline"} onClick={() => setIsVoiceActive(!isVoiceActive)} disabled={isTyping} data-testid="button-voice-call">
              <Mic className="w-4 h-4" />
            </Button>
            <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim() || isTyping || chatPhase === "awaiting_plan_language" || isVoiceActive} data-testid="button-send-chat">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
