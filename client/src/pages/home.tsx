import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Language } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Upload, X, Camera, Phone, Globe, ArrowRight, Check, Send, Bot, Languages, FileText, Download } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Step = "phone" | "language" | "upload" | "chat";
const stepOrder: Step[] = ["phone", "language", "upload", "chat"];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ChatPhase = "gathering" | "diagnosing" | "diagnosed" | "asking_plan" | "awaiting_plan_language" | "generating_plan" | "plan_ready";

export default function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [language, setLanguage] = useState<Language>("English");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

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

  const stepIndex = stepOrder.indexOf(currentStep);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 3) {
      toast({ title: labels.maxImages[language], variant: "destructive" });
      return;
    }
    const newFiles = [...selectedFiles, ...files].slice(0, 3);
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
        body: JSON.stringify({ phone: phoneNumber }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
    onSuccess: () => setCurrentStep("language"),
    onError: (err: Error) => toast({ title: err.message, variant: "destructive" }),
  });

  const setLanguageMutation = useMutation({
    mutationFn: async (lang: Language) => {
      const res = await fetch("/api/set-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, language: lang }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
    onSuccess: () => setCurrentStep("upload"),
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
      setCurrentStep("chat");
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
  }, [chatInput, messages, isTyping, language, toast, runExtractionAgent, runPlanIntentAgent]);

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
        body: JSON.stringify({
          phone,
          conversationSummary,
          diagnosis: data.diagnosis,
          language: lang,
          imageUrls: urls,
        }),
      });
    } catch (err: any) {
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
    } catch (err: any) {
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

  const labels = {
    title: { English: "KhetSathi", Telugu: "ఖేత్ సాథీ", Hindi: "खेतसाथी" } as Record<Language, string>,
    subtitle: { English: "AI Crop Doctor", Telugu: "AI పంట వైద్యుడు", Hindi: "AI फसल डॉक्टर" } as Record<Language, string>,
    tagline: { English: "Your smart farming companion", Telugu: "మీ తెలివైన వ్యవసాయ సహచరుడు", Hindi: "आपका स्मार्ट खेती साथी" } as Record<Language, string>,
    enterPhone: { English: "Enter your phone number", Telugu: "మీ ఫోన్ నంబర్ ఎంటర్ చేయండి", Hindi: "अपना फोन नंबर डालें" } as Record<Language, string>,
    phoneHint: { English: "Start by entering your phone number", Telugu: "మీ ఫోన్ నంబర్ ఎంటర్ చేయడం ద్వారా ప్రారంభించండి", Hindi: "अपना फोन नंबर डालकर शुरू करें" } as Record<Language, string>,
    continueBtn: { English: "Continue", Telugu: "కొనసాగించు", Hindi: "आगे बढ़ें" } as Record<Language, string>,
    registering: { English: "Please wait...", Telugu: "దయచేసి వేచి ఉండండి...", Hindi: "कृपया प्रतीक्षा करें..." } as Record<Language, string>,
    chooseLanguage: { English: "Choose your language", Telugu: "మీ భాషను ఎంచుకోండి", Hindi: "अपनी भाषा चुनें" } as Record<Language, string>,
    languageHint: { English: "All results will be shown in your language", Telugu: "అన్ని ఫలితాలు మీ భాషలో చూపబడతాయి", Hindi: "सभी परिणाम आपकी भाषा में दिखाए जाएंगे" } as Record<Language, string>,
    uploadPhotos: { English: "Upload Crop Photos", Telugu: "పంట ఫోటోలు అప్‌లోడ్ చేయండి", Hindi: "फसल की फोटो अपलोड करें" } as Record<Language, string>,
    uploadHint: { English: "Take 1-3 photos of the affected crop", Telugu: "ఆరోగ్యంగా లేని పంట యొక్క 1-3 ఫోటోలు తీయండి", Hindi: "प्रभावित फसल की 1-3 फोटो लें" } as Record<Language, string>,
    addMore: { English: "Add More", Telugu: "మరిన్ని", Hindi: "और जोड़ें" } as Record<Language, string>,
    next: { English: "Next", Telugu: "తదుపరి", Hindi: "अगला" } as Record<Language, string>,
    uploading: { English: "Uploading...", Telugu: "అప్‌లోడ్ అవుతోంది...", Hindi: "अपलोड हो रहा है..." } as Record<Language, string>,
    maxImages: { English: "Maximum 3 images allowed", Telugu: "గరిష్టంగా 3 చిత్రాలు అనుమతించబడతాయి", Hindi: "अधिकतम 3 छवियाँ अनुमत हैं" } as Record<Language, string>,
    typeMessage: { English: "Type your message...", Telugu: "మీ సందేశం టైప్ చేయండి...", Hindi: "अपना संदेश टाइप करें..." } as Record<Language, string>,
    planReady: { English: "Your 7-day treatment plan is ready! You can see it below.", Telugu: "మీ 7-రోజుల చికిత్స ప్రణాళిక సిద్ధంగా ఉంది! దిగువ చూడండి.", Hindi: "आपकी 7-दिन की उपचार योजना तैयार है! नीचे देखें." } as Record<Language, string>,
    choosePlanLanguage: { English: "Choose language for your treatment plan", Telugu: "మీ చికిత్స ప్రణాళిక కోసం భాషను ఎంచుకోండి", Hindi: "अपनी उपचार योजना के लिए भाषा चुनें" } as Record<Language, string>,
    getPlanIn: { English: "Get plan in another language", Telugu: "మరొక భాషలో ప్లాన్ పొందండి", Hindi: "दूसरी भाषा में प्लान पाएं" } as Record<Language, string>,
    analyzing: { English: "Analyzing your crop images...", Telugu: "మీ పంట చిత్రాలను విశ్లేషిస్తోంది...", Hindi: "आपकी फसल की तस्वीरों का विश्लेषण..." } as Record<Language, string>,
    footer: { English: "Built for Farmers", Telugu: "రైతుల కోసం", Hindi: "किसानों के लिए" } as Record<Language, string>,
  };

  const getLabel = (key: keyof typeof labels) => labels[key][language] || labels[key].English;

  const stepLabels: Record<Step, string> = { phone: "1", language: "2", upload: "3", chat: "4" };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-lg mx-auto px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Leaf className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-app-title">
              {getLabel("title")}
            </h1>
          </div>
          <p className="text-xs text-primary-foreground/80" data-testid="text-app-subtitle">
            {getLabel("subtitle")} — {getLabel("tagline")}
          </p>
        </div>
      </header>

      <div className="bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-1">
            {stepOrder.map((step, idx) => {
              const isActive = idx === stepIndex;
              const isDone = idx < stepIndex;
              return (
                <div key={step} className="flex items-center flex-1 gap-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isDone ? "bg-primary text-primary-foreground" : isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${step}`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : stepLabels[step]}
                  </div>
                  {idx < stepOrder.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full ${idx < stepIndex ? "bg-primary" : "bg-muted"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className={`flex-1 max-w-lg mx-auto w-full ${currentStep === "chat" ? "flex flex-col" : "px-4 py-6"}`}>
        <AnimatePresence mode="wait">
          {currentStep === "phone" && (
            <motion.div key="phone" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Card className="p-5 sm:p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-phone-title">{getLabel("enterPhone")}</h2>
                  <p className="text-sm text-muted-foreground">{getLabel("phoneHint")}</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium mb-1.5 block">Phone Number</Label>
                    <Input id="phone" type="tel" placeholder="+91 98765 43210" value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ""))}
                      className="text-lg text-center tracking-wider" data-testid="input-phone" />
                  </div>
                  <Button className="w-full gap-2" onClick={() => registerPhoneMutation.mutate()}
                    disabled={phoneNumber.length < 10 || registerPhoneMutation.isPending} data-testid="button-continue-phone">
                    {registerPhoneMutation.isPending ? (
                      <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />{getLabel("registering")}</>
                    ) : (
                      <>{getLabel("continueBtn")}<ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {currentStep === "language" && (
            <motion.div key="language" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Card className="p-5 sm:p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-language-title">{getLabel("chooseLanguage")}</h2>
                  <p className="text-sm text-muted-foreground">{getLabel("languageHint")}</p>
                </div>
                <div className="space-y-3">
                  {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                    <button key={lang} onClick={() => setLanguage(lang)}
                      className={`w-full p-4 rounded-md border-2 text-left flex items-center gap-3 transition-colors ${
                        language === lang ? "border-primary bg-primary/5" : "border-border hover-elevate"
                      }`} data-testid={`button-lang-${lang.toLowerCase()}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        language === lang ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {language === lang && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{lang === "Telugu" ? "తెలుగు" : lang === "Hindi" ? "हिन्दी" : "English"}</p>
                        <p className="text-xs text-muted-foreground">{lang}</p>
                      </div>
                    </button>
                  ))}
                  <Button className="w-full gap-2 mt-2" onClick={() => setLanguageMutation.mutate(language)}
                    disabled={setLanguageMutation.isPending} data-testid="button-continue-language">
                    {setLanguageMutation.isPending ? (
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>{getLabel("continueBtn")}<ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {currentStep === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
              <Card className="p-5 sm:p-6">
                <div className="text-center mb-5">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Camera className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-upload-title">{getLabel("uploadPhotos")}</h2>
                  <p className="text-sm text-muted-foreground">{getLabel("uploadHint")}</p>
                </div>
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start gap-3">
                    {previews.map((preview, idx) => (
                      <div key={idx} className="relative group w-24 h-24 rounded-md overflow-hidden border border-border">
                        <img src={preview} alt={`Crop ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-preview-${idx}`} />
                        <button onClick={() => removeImage(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ visibility: "visible" }} data-testid={`button-remove-image-${idx}`}>
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {selectedFiles.length < 3 && (
                      <button onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-md border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 text-primary hover-elevate cursor-pointer"
                        data-testid="button-upload-image">
                        <Upload className="w-6 h-6" />
                        <span className="text-xs font-medium">{selectedFiles.length > 0 ? getLabel("addMore") : "Upload"}</span>
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" data-testid="input-file-upload" />
                  <Button className="w-full gap-2" onClick={() => uploadMutation.mutate()}
                    disabled={selectedFiles.length === 0 || uploadMutation.isPending} data-testid="button-next-upload">
                    {uploadMutation.isPending ? (
                      <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />{getLabel("uploading")}</>
                    ) : (
                      <>{getLabel("next")}<ArrowRight className="w-4 h-4" /></>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {currentStep === "chat" && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col flex-1 h-full">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" data-testid="chat-messages">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                        <Bot className="w-4 h-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                      }`}
                      data-testid={`chat-message-${idx}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {chatPhase === "awaiting_plan_language" && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Languages className="w-4 h-4 text-primary" />
                    </div>
                    <Card className="max-w-[85%] p-3" data-testid="card-plan-language-picker">
                      <p className="text-sm font-medium mb-2.5">{getLabel("choosePlanLanguage")}</p>
                      <div className="flex flex-wrap gap-2">
                        {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                          <Button
                            key={lang}
                            variant="outline"
                            size="sm"
                            onClick={() => handlePlanLanguageSelect(lang)}
                            data-testid={`button-plan-lang-${lang.toLowerCase()}`}
                          >
                            {lang === "English" ? "English" : lang === "Telugu" ? "తెలుగు" : "हिन्दी"}
                          </Button>
                        ))}
                      </div>
                    </Card>
                  </div>
                )}

                {treatmentPlan && planLanguage && (
                  <div className="flex gap-2 justify-start">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="max-w-[80%]">
                      {pdfUrl ? (
                        <div
                          className="bg-muted rounded-2xl rounded-bl-sm overflow-hidden cursor-pointer"
                          onClick={() => window.open(pdfUrl, "_blank")}
                          data-testid="card-pdf-preview"
                        >
                          <div className="bg-primary/10 px-4 py-3 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-md bg-red-500/90 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate" data-testid="text-pdf-title">
                                {planLanguage === "Telugu" ? "7-రోజుల చికిత్స ప్రణాళిక" : planLanguage === "Hindi" ? "7-दिन की उपचार योजना" : "7-Day Treatment Plan"}
                              </p>
                              <p className="text-xs text-muted-foreground">PDF &middot; KhetSathi</p>
                            </div>
                          </div>
                          <div className="px-4 py-2 flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              {planLanguage === "Telugu" ? "తెలుగు" : planLanguage === "Hindi" ? "हिन्दी" : "English"}
                            </span>
                            <a
                              href={pdfUrl}
                              download
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                              data-testid="button-download-pdf"
                            >
                              <Download className="w-3.5 h-3.5" />
                              {planLanguage === "Telugu" ? "డౌన్‌లోడ్" : planLanguage === "Hindi" ? "डाउनलोड" : "Download"}
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3" data-testid="card-plan-text-fallback">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-primary" />
                            <p className="text-sm font-medium text-foreground">
                              {planLanguage === "Telugu" ? "7-రోజుల చికిత్స ప్రణాళిక" : planLanguage === "Hindi" ? "7-दिन की उपचार योजना" : "7-Day Treatment Plan"}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {planLanguage === "Telugu" ? "మీ ప్లాన్ సిద్ధంగా ఉంది" : planLanguage === "Hindi" ? "आपकी योजना तैयार है" : "Your plan is ready"}
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{getLabel("getPlanIn")}:</span>
                        {(["English", "Telugu", "Hindi"] as Language[]).filter((l) => l !== planLanguage).map((lang) => (
                          <Button
                            key={lang}
                            variant="ghost"
                            size="sm"
                            onClick={() => regeneratePlanInLanguage(lang)}
                            disabled={isTyping}
                            data-testid={`button-regen-plan-${lang.toLowerCase()}`}
                          >
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
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                      <div className="flex gap-1.5 items-center">
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div className="border-t border-border px-3 py-2.5 bg-card">
                <div className="flex gap-2 items-center max-w-lg mx-auto">
                  <Input
                    ref={chatInputRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={getLabel("typeMessage")}
                    className="flex-1"
                    disabled={isTyping || chatPhase === "awaiting_plan_language"}
                    data-testid="input-chat"
                  />
                  <Button size="icon" onClick={sendMessage} disabled={!chatInput.trim() || isTyping || chatPhase === "awaiting_plan_language"} data-testid="button-send-chat">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {currentStep !== "chat" && (
        <footer className="border-t border-border mt-auto">
          <div className="max-w-lg mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
            KhetSathi &mdash; {getLabel("footer")}
          </div>
        </footer>
      )}
    </div>
  );
}
