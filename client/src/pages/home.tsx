import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Language, DiagnosisResult } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Upload, X, Camera, Stethoscope, Calendar, Sprout, MapPin, FileText, Phone, KeyRound, Globe, ArrowRight, ArrowLeft, Check } from "lucide-react";
import { DiagnosisCard } from "@/components/diagnosis-card";
import { TreatmentPlan } from "@/components/treatment-plan";
import { motion, AnimatePresence } from "framer-motion";

type Step = "phone" | "otp" | "language" | "diagnose";

const stepOrder: Step[] = ["phone", "otp", "language", "diagnose"];

export default function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentStep, setCurrentStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpPreview, setOtpPreview] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>("English");
  const [cropName, setCropName] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<string | null>(null);

  const stepIndex = stepOrder.indexOf(currentStep);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 3) {
      toast({ title: "Maximum 3 images allowed", variant: "destructive" });
      return;
    }
    const newFiles = [...selectedFiles, ...files].slice(0, 3);
    setSelectedFiles(newFiles);
    const newPreviews = newFiles.map((file) => URL.createObjectURL(file));
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews(newPreviews);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedFiles, previews, toast]);

  const removeImage = useCallback((index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((f) => f.filter((_, i) => i !== index));
    setPreviews((p) => p.filter((_, i) => i !== index));
  }, [previews]);

  const sendOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to send OTP");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOtpPreview(data.otp_preview || null);
      setCurrentStep("otp");
      toast({ title: "OTP sent to your phone!" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, code: otpCode }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Verification failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setCurrentStep("language");
      toast({ title: "Phone verified!" });
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const setLanguageMutation = useMutation({
    mutationFn: async (lang: Language) => {
      const res = await fetch("/api/set-language", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneNumber, language: lang }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed");
      }
      return res.json();
    },
    onSuccess: () => {
      setCurrentStep("diagnose");
    },
    onError: (err: Error) => {
      toast({ title: err.message, variant: "destructive" });
    },
  });

  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("images", file));
      formData.append("crop", cropName);
      formData.append("location", location);
      formData.append("language", language);
      formData.append("summary", summary);
      const res = await fetch("/api/diagnose", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Diagnosis failed");
      }
      return res.json() as Promise<DiagnosisResult>;
    },
    onSuccess: (data) => {
      setDiagnosis(data);
      setTreatmentPlan(null);
      toast({ title: getLabel("diagnosisComplete") });
    },
    onError: (error: Error) => {
      toast({ title: getLabel("diagnosisFailed"), description: error.message, variant: "destructive" });
    },
  });

  const planMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/treatment-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis, crop: cropName, location, language, summary }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Plan generation failed");
      }
      return res.json() as Promise<{ plan: string }>;
    },
    onSuccess: (data) => {
      setTreatmentPlan(data.plan);
      toast({ title: getLabel("planGenerated") });
    },
    onError: (error: Error) => {
      toast({ title: getLabel("planFailed"), description: error.message, variant: "destructive" });
    },
  });

  const canDiagnose = selectedFiles.length > 0 && cropName.trim() && location.trim() && summary.trim();

  const labels: Record<string, Record<Language, string>> = {
    title: { English: "KhetSathi", Telugu: "ఖేత్ సాథీ", Hindi: "खेतसाथी" },
    subtitle: { English: "AI Crop Doctor", Telugu: "AI పంట వైద్యుడు", Hindi: "AI फसल डॉक्टर" },
    tagline: { English: "Your smart farming companion", Telugu: "మీ తెలివైన వ్యవసాయ సహచరుడు", Hindi: "आपका स्मार्ट खेती साथी" },
    enterPhone: { English: "Enter your phone number", Telugu: "మీ ఫోన్ నంబర్ ఎంటర్ చేయండి", Hindi: "अपना फोन नंबर डालें" },
    phoneHint: { English: "We'll send you a verification code", Telugu: "మేము మీకు వెరిఫికేషన్ కోడ్ పంపుతాము", Hindi: "हम आपको एक सत्यापन कोड भेजेंगे" },
    sendOtp: { English: "Send Code", Telugu: "కోడ్ పంపండి", Hindi: "कोड भेजें" },
    sending: { English: "Sending...", Telugu: "పంపుతోంది...", Hindi: "भेज रहे हैं..." },
    enterOtp: { English: "Enter verification code", Telugu: "వెరిఫికేషన్ కోడ్ ఎంటర్ చేయండి", Hindi: "सत्यापन कोड डालें" },
    otpHint: { English: "Enter the 6-digit code sent to your phone", Telugu: "మీ ఫోన్‌కు పంపిన 6-అంకెల కోడ్ ఎంటర్ చేయండి", Hindi: "अपने फोन पर भेजा गया 6-अंकीय कोड डालें" },
    verify: { English: "Verify", Telugu: "ధృవీకరించండి", Hindi: "सत्यापित करें" },
    verifying: { English: "Verifying...", Telugu: "ధృవీకరిస్తోంది...", Hindi: "सत्यापित हो रहा है..." },
    chooseLanguage: { English: "Choose your language", Telugu: "మీ భాషను ఎంచుకోండి", Hindi: "अपनी भाषा चुनें" },
    languageHint: { English: "All results will be shown in your language", Telugu: "అన్ని ఫలితాలు మీ భాషలో చూపబడతాయి", Hindi: "सभी परिणाम आपकी भाषा में दिखाए जाएंगे" },
    continue: { English: "Continue", Telugu: "కొనసాగించు", Hindi: "आगे बढ़ें" },
    cropName: { English: "Crop Name", Telugu: "పంట పేరు", Hindi: "फसल का नाम" },
    cropPlaceholder: { English: "e.g., Tomato, Rice, Cotton", Telugu: "ఉదా., టమాటా, వరి, పత్తి", Hindi: "जैसे, टमाटर, चावल, कपास" },
    location: { English: "Location", Telugu: "ప్రదేశం", Hindi: "स्थान" },
    locationPlaceholder: { English: "e.g., Andhra Pradesh", Telugu: "ఉదా., ఆంధ్ర ప్రదేశ్", Hindi: "जैसे, आंध्र प्रदेश" },
    description: { English: "Describe the Problem", Telugu: "సమస్యను వివరించండి", Hindi: "समस्या का वर्णन करें" },
    descPlaceholder: { English: "What do you see on your crops? Yellow leaves, spots, wilting...", Telugu: "మీ పంటలపై ఏమి కనిపిస్తోంది? పసుపు ఆకులు, మచ్చలు, వాడిపోవడం...", Hindi: "आपकी फसलों पर क्या दिख रहा है? पीली पत्तियाँ, धब्बे, मुरझाना..." },
    uploadImages: { English: "Upload Crop Photos", Telugu: "పంట ఫోటోలు అప్‌లోడ్ చేయండి", Hindi: "फसल की फोटो अपलोड करें" },
    uploadHint: { English: "Take 1-3 photos of the sick crop", Telugu: "ఆరోగ్యంగా లేని పంట యొక్క 1-3 ఫోటోలు తీయండి", Hindi: "बीमार फसल की 1-3 फोटो लें" },
    diagnose: { English: "Find Disease", Telugu: "వ్యాధిని కనుగొనండి", Hindi: "बीमारी खोजें" },
    diagnosing: { English: "Checking...", Telugu: "తనిఖీ చేస్తోంది...", Hindi: "जाँच हो रही है..." },
    generatePlan: { English: "Get 7-Day Treatment Plan", Telugu: "7-రోజుల చికిత్స ప్రణాళిక పొందండి", Hindi: "7-दिन की उपचार योजना पाएं" },
    generatingPlan: { English: "Creating Plan...", Telugu: "ప్రణాళిక రూపొందిస్తోంది...", Hindi: "योजना बन रही है..." },
    diagnosisComplete: { English: "Disease found!", Telugu: "వ్యాధి కనుగొనబడింది!", Hindi: "बीमारी मिल गई!" },
    diagnosisFailed: { English: "Could not diagnose", Telugu: "నిర్ధారణ చేయలేకపోయింది", Hindi: "निदान नहीं हो सका" },
    planGenerated: { English: "Treatment plan ready!", Telugu: "చికిత్స ప్రణాళిక సిద్ధం!", Hindi: "उपचार योजना तैयार!" },
    planFailed: { English: "Plan failed", Telugu: "ప్రణాళిక విఫలమైంది", Hindi: "योजना विफल रही" },
    addMore: { English: "Add More", Telugu: "మరిన్ని", Hindi: "और जोड़ें" },
    step: { English: "Step", Telugu: "దశ", Hindi: "चरण" },
    of: { English: "of", Telugu: "లో", Hindi: "में से" },
    resend: { English: "Resend Code", Telugu: "కోడ్ మళ్ళీ పంపు", Hindi: "कोड दोबारा भेजें" },
    testOtp: { English: "Test OTP (shown for testing)", Telugu: "టెస్ట్ OTP (పరీక్ష కోసం చూపబడింది)", Hindi: "टेस्ट OTP (परीक्षण के लिए दिखाया गया)" },
    back: { English: "Back", Telugu: "వెనుకకు", Hindi: "वापस" },
    newDiagnosis: { English: "New Diagnosis", Telugu: "కొత్త నిర్ధారణ", Hindi: "नया निदान" },
  };

  function getLabel(key: string): string {
    return labels[key]?.[language] || labels[key]?.English || key;
  }

  const resetDiagnosis = () => {
    setSelectedFiles([]);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews([]);
    setCropName("");
    setLocation("");
    setSummary("");
    setDiagnosis(null);
    setTreatmentPlan(null);
  };

  const stepLabels: Record<Step, string> = {
    phone: "1",
    otp: "2",
    language: "3",
    diagnose: "4",
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-lg mx-auto px-4 py-5 text-center">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 mb-1"
          >
            <Leaf className="w-7 h-7" />
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-app-title">
              {getLabel("title")}
            </h1>
          </motion.div>
          <p className="text-sm text-primary-foreground/80" data-testid="text-app-subtitle">
            {getLabel("subtitle")} — {getLabel("tagline")}
          </p>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-1">
            {stepOrder.map((step, idx) => {
              const isActive = idx === stepIndex;
              const isDone = idx < stepIndex;
              return (
                <div key={step} className="flex items-center flex-1 gap-1">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isDone
                        ? "bg-primary text-primary-foreground"
                        : isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`step-indicator-${step}`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : stepLabels[step]}
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

      {/* Main Content */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <AnimatePresence mode="wait">
          {/* Step 1: Phone Number */}
          {currentStep === "phone" && (
            <motion.div
              key="phone"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="p-5 sm:p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-phone-title">
                    {getLabel("enterPhone")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{getLabel("phoneHint")}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium mb-1.5 block">
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ""))}
                      className="text-lg text-center tracking-wider"
                      data-testid="input-phone"
                    />
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={() => sendOtpMutation.mutate()}
                    disabled={phoneNumber.length < 10 || sendOtpMutation.isPending}
                    data-testid="button-send-otp"
                  >
                    {sendOtpMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        {getLabel("sending")}
                      </>
                    ) : (
                      <>
                        {getLabel("sendOtp")}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 2: OTP Verification */}
          {currentStep === "otp" && (
            <motion.div
              key="otp"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="p-5 sm:p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <KeyRound className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-otp-title">
                    {getLabel("enterOtp")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{getLabel("otpHint")}</p>
                </div>

                {otpPreview && (
                  <div className="mb-4 p-3 rounded-md bg-accent text-accent-foreground text-center">
                    <p className="text-xs text-muted-foreground mb-1">{getLabel("testOtp")}</p>
                    <p className="text-2xl font-bold tracking-[0.3em]" data-testid="text-otp-preview">{otpPreview}</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="text-2xl text-center tracking-[0.4em] font-mono"
                      data-testid="input-otp"
                    />
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={() => verifyOtpMutation.mutate()}
                    disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}
                    data-testid="button-verify-otp"
                  >
                    {verifyOtpMutation.isPending ? (
                      <>
                        <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        {getLabel("verifying")}
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        {getLabel("verify")}
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between gap-2">
                    <Button variant="ghost" onClick={() => setCurrentStep("phone")} className="gap-1" data-testid="button-back-to-phone">
                      <ArrowLeft className="w-4 h-4" />
                      {getLabel("back")}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOtpCode("");
                        sendOtpMutation.mutate();
                      }}
                      disabled={sendOtpMutation.isPending}
                      data-testid="button-resend-otp"
                    >
                      {getLabel("resend")}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 3: Language Selection */}
          {currentStep === "language" && (
            <motion.div
              key="language"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <Card className="p-5 sm:p-6">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-8 h-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-1" data-testid="text-language-title">
                    {getLabel("chooseLanguage")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{getLabel("languageHint")}</p>
                </div>

                <div className="space-y-3">
                  {(["English", "Telugu", "Hindi"] as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`w-full p-4 rounded-md border-2 text-left flex items-center gap-3 transition-colors ${
                        language === lang
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                      data-testid={`button-lang-${lang.toLowerCase()}`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        language === lang ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {language === lang && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {lang === "Telugu" ? "తెలుగు" : lang === "Hindi" ? "हिन्दी" : "English"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lang === "Telugu" ? "Telugu" : lang === "Hindi" ? "Hindi" : "English"}
                        </p>
                      </div>
                    </button>
                  ))}

                  <Button
                    className="w-full gap-2 mt-2"
                    onClick={() => setLanguageMutation.mutate(language)}
                    disabled={setLanguageMutation.isPending}
                    data-testid="button-continue-language"
                  >
                    {setLanguageMutation.isPending ? (
                      <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <>
                        {getLabel("continue")}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Step 4: Crop Diagnosis */}
          {currentStep === "diagnose" && (
            <motion.div
              key="diagnose"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {!diagnosis ? (
                <Card className="p-5 sm:p-6">
                  <div className="text-center mb-5">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Camera className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-semibold mb-1" data-testid="text-diagnose-title">
                      {getLabel("uploadImages")}
                    </h2>
                    <p className="text-sm text-muted-foreground">{getLabel("uploadHint")}</p>
                  </div>

                  <div className="space-y-4">
                    {/* Image Upload */}
                    <div className="flex flex-wrap items-start gap-3">
                      {previews.map((preview, idx) => (
                        <div key={idx} className="relative group w-24 h-24 rounded-md overflow-hidden border border-border">
                          <img src={preview} alt={`Crop ${idx + 1}`} className="w-full h-full object-cover" data-testid={`img-preview-${idx}`} />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ visibility: "visible" }}
                            data-testid={`button-remove-image-${idx}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {selectedFiles.length < 3 && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-24 h-24 rounded-md border-2 border-dashed border-primary/40 flex flex-col items-center justify-center gap-1 text-primary hover-elevate cursor-pointer"
                          data-testid="button-upload-image"
                        >
                          <Upload className="w-6 h-6" />
                          <span className="text-xs font-medium">{selectedFiles.length > 0 ? getLabel("addMore") : "Upload"}</span>
                        </button>
                      )}
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" data-testid="input-file-upload" />

                    {/* Crop Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="crop" className="flex items-center gap-2 text-sm font-medium">
                        <Sprout className="w-4 h-4 text-primary" />
                        {getLabel("cropName")}
                      </Label>
                      <Input id="crop" placeholder={getLabel("cropPlaceholder")} value={cropName} onChange={(e) => setCropName(e.target.value)} data-testid="input-crop-name" />
                    </div>

                    {/* Location */}
                    <div className="space-y-1.5">
                      <Label htmlFor="location" className="flex items-center gap-2 text-sm font-medium">
                        <MapPin className="w-4 h-4 text-primary" />
                        {getLabel("location")}
                      </Label>
                      <Input id="location" placeholder={getLabel("locationPlaceholder")} value={location} onChange={(e) => setLocation(e.target.value)} data-testid="input-location" />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <Label htmlFor="summary" className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="w-4 h-4 text-primary" />
                        {getLabel("description")}
                      </Label>
                      <Textarea id="summary" placeholder={getLabel("descPlaceholder")} value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} data-testid="input-summary" />
                    </div>

                    {/* Diagnose Button */}
                    <Button
                      className="w-full gap-2"
                      onClick={() => diagnoseMutation.mutate()}
                      disabled={!canDiagnose || diagnoseMutation.isPending}
                      data-testid="button-diagnose"
                    >
                      {diagnoseMutation.isPending ? (
                        <>
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          {getLabel("diagnosing")}
                        </>
                      ) : (
                        <>
                          <Stethoscope className="w-4 h-4" />
                          {getLabel("diagnose")}
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
                  <DiagnosisCard diagnosis={diagnosis} language={language} />

                  {!treatmentPlan && (
                    <div className="flex flex-col gap-3">
                      <Button
                        className="w-full gap-2"
                        onClick={() => planMutation.mutate()}
                        disabled={planMutation.isPending}
                        data-testid="button-generate-plan"
                      >
                        {planMutation.isPending ? (
                          <>
                            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            {getLabel("generatingPlan")}
                          </>
                        ) : (
                          <>
                            <Calendar className="w-4 h-4" />
                            {getLabel("generatePlan")}
                          </>
                        )}
                      </Button>
                      <Button variant="outline" className="w-full" onClick={resetDiagnosis} data-testid="button-new-diagnosis">
                        {getLabel("newDiagnosis")}
                      </Button>
                    </div>
                  )}

                  {treatmentPlan && (
                    <>
                      <TreatmentPlan plan={treatmentPlan} language={language} />
                      <Button variant="outline" className="w-full" onClick={resetDiagnosis} data-testid="button-new-diagnosis-after-plan">
                        {getLabel("newDiagnosis")}
                      </Button>
                    </>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto">
        <div className="max-w-lg mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          KhetSathi &mdash; {language === "Telugu" ? "రైతుల కోసం" : language === "Hindi" ? "किसानों के लिए" : "Built for Farmers"}
        </div>
      </footer>
    </div>
  );
}
