import { useState, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import type { Language, DiagnosisResult } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Leaf, Upload, X, Camera, Stethoscope, Calendar, Sprout, MapPin, FileText } from "lucide-react";
import { DiagnosisCard } from "@/components/diagnosis-card";
import { TreatmentPlan } from "@/components/treatment-plan";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [language, setLanguage] = useState<Language>("English");
  const [cropName, setCropName] = useState("");
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [treatmentPlan, setTreatmentPlan] = useState<string | null>(null);

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

  const diagnoseMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      selectedFiles.forEach((file) => formData.append("images", file));
      formData.append("crop", cropName);
      formData.append("location", location);
      formData.append("language", language);
      formData.append("summary", summary);

      const res = await fetch("/api/diagnose", {
        method: "POST",
        body: formData,
      });
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
        body: JSON.stringify({
          diagnosis,
          crop: cropName,
          location,
          language,
          summary,
        }),
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
    tagline: { English: "Upload crop images, get instant disease diagnosis and treatment plans", Telugu: "పంట చిత్రాలను అప్‌లోడ్ చేయండి, తక్షణ రోగ నిర్ధారణ మరియు చికిత్స ప్రణాళికలను పొందండి", Hindi: "फसल की तस्वीरें अपलोड करें, तुरंत रोग निदान और उपचार योजनाएं प्राप्त करें" },
    language: { English: "Language", Telugu: "భాష", Hindi: "भाषा" },
    cropName: { English: "Crop Name", Telugu: "పంట పేరు", Hindi: "फसल का नाम" },
    cropPlaceholder: { English: "e.g., Tomato, Rice, Cotton", Telugu: "ఉదా., టమాటా, వరి, పత్తి", Hindi: "जैसे, टमाटर, चावल, कपास" },
    location: { English: "Location", Telugu: "ప్రదేశం", Hindi: "स्थान" },
    locationPlaceholder: { English: "e.g., Andhra Pradesh, Telangana", Telugu: "ఉదా., ఆంధ్ర ప్రదేశ్, తెలంగాణ", Hindi: "जैसे, आंध्र प्रदेश, तेलंगाना" },
    description: { English: "Describe the Problem", Telugu: "సమస్యను వివరించండి", Hindi: "समस्या का वर्णन करें" },
    descPlaceholder: { English: "Describe what you observe on your crops - yellowing leaves, spots, wilting, etc.", Telugu: "మీ పంటలపై మీరు గమనించినది వివరించండి - పసుపు ఆకులు, మచ్చలు, వాడిపోవడం మొదలైనవి.", Hindi: "अपनी फसलों पर जो आप देख रहे हैं उसका वर्णन करें - पीली पत्तियाँ, धब्बे, मुरझाना आदि।" },
    uploadImages: { English: "Upload Crop Images", Telugu: "పంట చిత్రాలను అప్‌లోడ్ చేయండి", Hindi: "फसल की तस्वीरें अपलोड करें" },
    uploadHint: { English: "Upload 1-3 images of the affected crop", Telugu: "ప్రభావిత పంట యొక్క 1-3 చిత్రాలను అప్‌లోడ్ చేయండి", Hindi: "प्रभावित फसल की 1-3 तस्वीरें अपलोड करें" },
    diagnose: { English: "Diagnose Disease", Telugu: "రోగ నిర్ధారణ చేయండి", Hindi: "रोग का निदान करें" },
    diagnosing: { English: "Analyzing...", Telugu: "విశ్లేషిస్తోంది...", Hindi: "विश्लेषण हो रहा है..." },
    generatePlan: { English: "Generate 7-Day Treatment Plan", Telugu: "7-రోజుల చికిత్స ప్రణాళిక రూపొందించండి", Hindi: "7-दिन की उपचार योजना बनाएं" },
    generatingPlan: { English: "Generating Plan...", Telugu: "ప్రణాళిక రూపొందిస్తోంది...", Hindi: "योजना बन रही है..." },
    diagnosisComplete: { English: "Diagnosis complete!", Telugu: "రోగ నిర్ధారణ పూర్తయింది!", Hindi: "निदान पूरा हुआ!" },
    diagnosisFailed: { English: "Diagnosis failed", Telugu: "రోగ నిర్ధారణ విఫలమైంది", Hindi: "निदान विफल रहा" },
    planGenerated: { English: "Treatment plan ready!", Telugu: "చికిత్స ప్రణాళిక సిద్ధం!", Hindi: "उपचार योजना तैयार!" },
    planFailed: { English: "Plan generation failed", Telugu: "ప్రణాళిక రూపకల్పన విఫలమైంది", Hindi: "योजना बनाना विफल रहा" },
    addMore: { English: "Add More", Telugu: "మరిన్ని జోడించండి", Hindi: "और जोड़ें" },
  };

  function getLabel(key: string): string {
    return labels[key]?.[language] || labels[key]?.English || key;
  }

  const resetForm = () => {
    setSelectedFiles([]);
    previews.forEach((p) => URL.revokeObjectURL(p));
    setPreviews([]);
    setCropName("");
    setLocation("");
    setSummary("");
    setDiagnosis(null);
    setTreatmentPlan(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-primary">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 w-20 h-20 rounded-full border-2 border-primary-foreground" />
          <div className="absolute top-16 right-16 w-32 h-32 rounded-full border-2 border-primary-foreground" />
          <div className="absolute bottom-4 left-1/3 w-16 h-16 rounded-full border-2 border-primary-foreground" />
        </div>
        <div className="relative max-w-4xl mx-auto px-4 py-8 sm:py-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center gap-3 mb-3"
          >
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary-foreground/20">
              <Leaf className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-primary-foreground tracking-tight" data-testid="text-app-title">
              {getLabel("title")}
            </h1>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg sm:text-xl font-medium text-primary-foreground/90 mb-2"
            data-testid="text-app-subtitle"
          >
            {getLabel("subtitle")}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-sm sm:text-base text-primary-foreground/70 max-w-lg mx-auto"
          >
            {getLabel("tagline")}
          </motion.p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Language Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Label className="text-sm font-medium text-muted-foreground" data-testid="label-language">
                {getLabel("language")}
              </Label>
              <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
                <SelectTrigger className="w-44" data-testid="select-language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="English" data-testid="option-english">English</SelectItem>
                  <SelectItem value="Telugu" data-testid="option-telugu">తెలుగు (Telugu)</SelectItem>
                  <SelectItem value="Hindi" data-testid="option-hindi">हिन्दी (Hindi)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>
        </motion.div>

        {/* Input Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card className="p-4 sm:p-6">
            <div className="space-y-5">
              {/* Image Upload Section */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Camera className="w-4 h-4 text-primary" />
                  {getLabel("uploadImages")}
                </Label>
                <p className="text-xs text-muted-foreground">{getLabel("uploadHint")}</p>

                <div className="flex flex-wrap items-start gap-3">
                  {previews.map((preview, idx) => (
                    <div key={idx} className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-md overflow-hidden border border-border">
                      <img
                        src={preview}
                        alt={`Crop ${idx + 1}`}
                        className="w-full h-full object-cover"
                        data-testid={`img-preview-${idx}`}
                      />
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
                      className="w-24 h-24 sm:w-28 sm:h-28 rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover-elevate cursor-pointer transition-colors"
                      data-testid="button-upload-image"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-xs">{selectedFiles.length > 0 ? getLabel("addMore") : getLabel("uploadImages").split(" ")[0]}</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
              </div>

              {/* Crop Name & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="crop" className="flex items-center gap-2 text-sm font-medium">
                    <Sprout className="w-4 h-4 text-primary" />
                    {getLabel("cropName")}
                  </Label>
                  <Input
                    id="crop"
                    placeholder={getLabel("cropPlaceholder")}
                    value={cropName}
                    onChange={(e) => setCropName(e.target.value)}
                    data-testid="input-crop-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location" className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="w-4 h-4 text-primary" />
                    {getLabel("location")}
                  </Label>
                  <Input
                    id="location"
                    placeholder={getLabel("locationPlaceholder")}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    data-testid="input-location"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-1.5">
                <Label htmlFor="summary" className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="w-4 h-4 text-primary" />
                  {getLabel("description")}
                </Label>
                <Textarea
                  id="summary"
                  placeholder={getLabel("descPlaceholder")}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  data-testid="input-summary"
                />
              </div>

              {/* Diagnose Button */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => diagnoseMutation.mutate()}
                  disabled={!canDiagnose || diagnoseMutation.isPending}
                  className="gap-2"
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
                {(diagnosis || selectedFiles.length > 0) && (
                  <Button variant="outline" onClick={resetForm} data-testid="button-reset">
                    {language === "Telugu" ? "రీసెట్" : language === "Hindi" ? "रीसेट" : "Reset"}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Diagnosis Results */}
        <AnimatePresence>
          {diagnosis && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <DiagnosisCard diagnosis={diagnosis} language={language} />

              {/* Generate Plan Button */}
              {!treatmentPlan && (
                <div className="mt-4 flex justify-center">
                  <Button
                    onClick={() => planMutation.mutate()}
                    disabled={planMutation.isPending}
                    variant="default"
                    className="gap-2"
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
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Treatment Plan */}
        <AnimatePresence>
          {treatmentPlan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
            >
              <TreatmentPlan plan={treatmentPlan} language={language} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-8">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          KhetSathi AI Crop Doctor &mdash; {language === "Telugu" ? "రైతుల కోసం తయారు చేయబడింది" : language === "Hindi" ? "किसानों के लिए बनाया गया" : "Built for Farmers"}
        </div>
      </footer>
    </div>
  );
}
