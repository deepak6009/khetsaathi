import { useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Monitor, Camera, MessageSquare,
  FileText, Wifi, Languages, MapPin, Shield, Fingerprint,
  Smartphone, ArrowRight, Scan, Leaf
} from "lucide-react";
import { Button } from "@/components/ui/button";
import logoImage from "@assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png";
import aiAvatarImage from "@/assets/images/ai-assistant-avatar.png";

const kioskSteps = [
  {
    id: "welcome",
    title: "Walk Up & Start",
    titleHi: "आएं और शुरू करें",
    titleTe: "రండి మరియు ప్రారంభించండి",
    desc: "Farmer walks up to the kiosk at a village center, cooperative, or agriculture office. Tap the screen to begin.",
    descHi: "किसान गांव केंद्र, सहकारी या कृषि कार्यालय में कियोस्क पर आता है। शुरू करने के लिए स्क्रीन टैप करें।",
    descTe: "రైతు గ్రామ కేంద్రం, సహకార సంస్థ లేదా వ్యవసాయ కార్యాలయంలో కియోస్క్ వద్దకు వస్తారు. ప్రారంభించడానికి స్క్రీన్‌ను నొక్కండి.",
    icon: Monitor,
    color: "#6BC30D",
    mockUI: "welcome",
  },
  {
    id: "language",
    title: "Choose Language",
    titleHi: "भाषा चुनें",
    titleTe: "భాషను ఎంచుకోండి",
    desc: "Select your preferred language. The entire kiosk experience adapts — voice, text, and treatment plans.",
    descHi: "अपनी पसंदीदा भाषा चुनें। पूरा कियोस्क अनुभव बदल जाता है — आवाज़, टेक्स्ट और उपचार योजनाएं।",
    descTe: "మీకు నచ్చిన భాషను ఎంచుకోండి. మొత్తం కియోస్క్ అనుభవం మారుతుంది — వాయిస్, టెక్స్ట్ మరియు చికిత్స ప్రణాళికలు.",
    icon: Languages,
    color: "#2563eb",
    mockUI: "language",
  },
  {
    id: "scan",
    title: "Scan Crop Sample",
    titleHi: "फसल का नमूना स्कैन करें",
    titleTe: "పంట నమూనాను స్కాన్ చేయండి",
    desc: "Place the affected leaf or crop sample on the scanning tray. The built-in camera captures high-resolution images automatically.",
    descHi: "प्रभावित पत्ती या फसल का नमूना स्कैनिंग ट्रे पर रखें। बिल्ट-इन कैमरा स्वचालित रूप से हाई-रेज़ोल्यूशन छवियां कैप्चर करता है।",
    descTe: "ప్రభావిత ఆకు లేదా పంట నమూనాను స్కానింగ్ ట్రేలో ఉంచండి. బిల్ట్-ఇన్ కెమెరా స్వయంచాలకంగా అధిక-రిజల్యూషన్ చిత్రాలను క్యాప్చర్ చేస్తుంది.",
    icon: Scan,
    color: "#059669",
    mockUI: "scan",
  },
  {
    id: "voice",
    title: "Talk to AI Doctor",
    titleHi: "AI डॉक्टर से बात करें",
    titleTe: "AI డాక్టర్‌తో మాట్లాడండి",
    desc: "Speak naturally about your crop problem. The AI assistant listens, asks follow-up questions, and provides diagnosis through voice and text.",
    descHi: "अपनी फसल की समस्या के बारे में स्वाभाविक रूप से बात करें। AI सहायक सुनता है, फ़ॉलो-अप प्रश्न पूछता है, और आवाज़ और टेक्स्ट के माध्यम से निदान प्रदान करता है।",
    descTe: "మీ పంట సమస్య గురించి సహజంగా మాట్లాడండి. AI అసిస్టెంట్ వింటుంది, ఫాలో-అప్ ప్రశ్నలు అడుగుతుంది మరియు వాయిస్ మరియు టెక్స్ట్ ద్వారా రోగ నిర్ధారణ అందిస్తుంది.",
    icon: MessageSquare,
    color: "#7c3aed",
    mockUI: "voice",
  },
  {
    id: "report",
    title: "Get Printed Report",
    titleHi: "प्रिंटेड रिपोर्ट प्राप्त करें",
    titleTe: "ముద్రిత నివేదిక పొందండి",
    desc: "Receive a printed 7-day treatment plan with medicine names, dosages, and daily actions. Also sent to your phone via WhatsApp.",
    descHi: "दवाई के नाम, खुराक और दैनिक क्रियाओं के साथ प्रिंटेड 7-दिन की उपचार योजना प्राप्त करें। WhatsApp के माध्यम से भी आपके फ़ोन पर भेजा जाता है।",
    descTe: "మందుల పేర్లు, మోతాదులు మరియు రోజువారీ చర్యలతో ముద్రిత 7-రోజుల చికిత్స ప్రణాళికను పొందండి. WhatsApp ద్వారా మీ ఫోన్‌కు కూడా పంపబడుతుంది.",
    icon: FileText,
    color: "#964B00",
    mockUI: "report",
  },
];

const kioskFeatures = [
  { icon: Wifi, label: "Works Offline", desc: "No internet needed for basic diagnosis" },
  { icon: Shield, label: "Data Privacy", desc: "Farmer data stays local and secure" },
  { icon: Fingerprint, label: "No Login Needed", desc: "Walk up and use immediately" },
  { icon: Smartphone, label: "WhatsApp Sync", desc: "Reports sent to farmer's phone" },
];

function KioskMockScreen({ step }: { step: string }) {
  if (step === "welcome") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center" style={{ background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)" }}>
        <img src={logoImage} alt="KhetSaathi" className="w-16 h-16 rounded-2xl mb-4 shadow-md" />
        <h3 className="text-xl font-extrabold text-gray-900 mb-1">KhetSaathi</h3>
        <p className="text-sm text-gray-500 mb-6">AI Crop Doctor</p>
        <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg mb-4 border-3 border-white mx-auto" style={{ borderColor: "#6BC30D" }}>
          <img src={aiAvatarImage} alt="AI" className="w-full h-full object-cover" />
        </div>
        <div className="px-8 py-3 rounded-2xl text-white font-bold text-sm" style={{ backgroundColor: "#6BC30D" }}>
          Touch to Start
        </div>
      </div>
    );
  }

  if (step === "language") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white">
        <p className="text-lg font-bold text-gray-900 mb-5">Choose Language</p>
        <div className="space-y-2.5 w-full max-w-[180px]">
          {[
            { code: "EN", name: "English" },
            { code: "తె", name: "తెలుగు" },
            { code: "हि", name: "हिन्दी" },
          ].map((lang) => (
            <div key={lang.code} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: "#6BC30D" }}>
                {lang.code}
              </div>
              <span className="text-sm font-semibold text-gray-800">{lang.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6" style={{ background: "linear-gradient(180deg, #032B22 0%, #064e3b 100%)" }}>
        <div className="w-32 h-32 rounded-2xl border-2 border-dashed border-white/40 flex items-center justify-center mb-4 relative">
          <Camera className="w-10 h-10 text-white/60" />
          <motion.div
            className="absolute inset-0 rounded-2xl border-2"
            style={{ borderColor: "#6BC30D" }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </div>
        <p className="text-white font-bold text-sm mb-1">Place crop sample here</p>
        <p className="text-white/60 text-xs">Camera auto-captures</p>
      </div>
    );
  }

  if (step === "voice") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white">
        <div className="w-14 h-14 rounded-full overflow-hidden shadow-md mb-3 mx-auto" style={{ border: "2px solid #6BC30D" }}>
          <img src={aiAvatarImage} alt="AI" className="w-full h-full object-cover" />
        </div>
        <div className="flex gap-1 items-center mb-3">
          {[0, 0.15, 0.3, 0.45, 0.6].map((d, i) => (
            <motion.div key={i} animate={{ scaleY: [0.4, 1.2, 0.4] }} transition={{ repeat: Infinity, duration: 0.8, delay: d }}
              className="w-1 h-5 rounded-full" style={{ backgroundColor: "#6BC30D" }} />
          ))}
        </div>
        <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-700 font-medium mb-2 max-w-[180px] text-center">
          "My tomato leaves have yellow spots..."
        </div>
        <div className="rounded-xl px-3 py-2 text-xs text-white font-medium max-w-[180px] text-center" style={{ backgroundColor: "#032B22" }}>
          "It looks like early blight. Let me check..."
        </div>
      </div>
    );
  }

  if (step === "report") {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-5 bg-white">
        <div className="w-full max-w-[180px] rounded-xl border border-gray-200 p-3 mb-3 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#964B00" }}>
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900">7-Day Plan</p>
              <p className="text-[10px] text-gray-500">PDF • English</p>
            </div>
          </div>
          <div className="space-y-1">
            {["Day 1-2: Remove infected leaves", "Day 3-4: Apply fungicide", "Day 5-7: Monitor growth"].map((d, i) => (
              <p key={i} className="text-[10px] text-gray-600">{d}</p>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ backgroundColor: "#6BC30D" }}>
            Print Report
          </div>
          <div className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white bg-green-600">
            WhatsApp
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default function KioskPreview() {
  const [activeStep, setActiveStep] = useState(0);
  const [language, setLanguage] = useState<"en" | "hi" | "te">("en");

  const step = kioskSteps[activeStep];
  const getTitle = () => language === "hi" ? step.titleHi : language === "te" ? step.titleTe : step.title;
  const getDesc = () => language === "hi" ? step.descHi : language === "te" ? step.descTe : step.desc;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <button className="flex items-center gap-2 text-gray-600 active:opacity-70" data-testid="button-back-kiosk">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-sm font-semibold">Back</span>
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="KhetSaathi" className="w-6 h-6 rounded-lg" />
            <span className="text-sm font-bold text-gray-900">Kiosk Mode</span>
          </div>
          <div className="flex gap-1">
            {(["en", "hi", "te"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${language === l ? "text-white" : "text-gray-500 bg-gray-100"}`}
                style={language === l ? { backgroundColor: "#6BC30D" } : undefined}
                data-testid={`button-kiosk-lang-${l}`}
              >
                {l === "en" ? "EN" : l === "hi" ? "हि" : "తె"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
            <Monitor className="w-4 h-4" style={{ color: "#6BC30D" }} />
            <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#6BC30D" }}>Future Vision</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight" data-testid="text-kiosk-title">
            {language === "hi" ? "कियोस्क मोड" : language === "te" ? "కియోస్క్ మోడ్" : "KhetSaathi Kiosk"}
          </h1>
          <p className="text-sm text-gray-600 max-w-md mx-auto">
            {language === "hi" ? "गांव केंद्रों और सहकारी कार्यालयों के लिए स्टैंडअलोन AI फसल डॉक्टर" :
             language === "te" ? "గ్రామ కేంద్రాలు మరియు సహకార కార్యాలయాల కోసం స్టాండ్‌అలోన్ AI పంట డాక్టర్" :
             "Standalone AI crop doctor for village centers & cooperative offices"}
          </p>
        </div>

        <div className="relative">
          <div className="bg-gray-900 rounded-3xl p-3 shadow-2xl border-4 border-gray-800" data-testid="card-kiosk-frame">
            <div className="bg-gray-800 rounded-t-xl px-3 py-1.5 flex items-center gap-2 mb-1">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 bg-gray-700 rounded-md px-2 py-0.5 text-[9px] text-gray-400 text-center font-mono">
                kiosk.khetsaathi.com
              </div>
            </div>

            <div className="bg-white rounded-b-xl overflow-hidden" style={{ aspectRatio: "4/3" }}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full"
                >
                  <KioskMockScreen step={step.mockUI} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-center gap-1 mt-2 mb-1">
              <div className="w-8 h-1 rounded-full bg-gray-600" />
            </div>
          </div>

          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[60%] h-4 bg-gray-800 rounded-b-xl" />
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-[40%] h-3 bg-gray-700 rounded-b-lg" />
        </div>

        <div className="pt-4">
          <div className="flex items-center gap-3 mb-4">
            {kioskSteps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveStep(idx)}
                className="flex-1 h-1.5 rounded-full transition-all duration-300"
                style={{
                  backgroundColor: idx === activeStep ? "#6BC30D" : idx < activeStep ? "#6BC30D60" : "#e5e7eb",
                }}
                data-testid={`button-kiosk-step-${idx}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className="w-10 h-10 rounded-xl flex items-center justify-center bg-white border border-gray-200 shadow-sm disabled:opacity-30 active:scale-95 transition-transform"
              data-testid="button-kiosk-prev"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${step.color}15` }}>
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Step {activeStep + 1} of {kioskSteps.length}</p>
                <p className="text-base font-extrabold text-gray-900">{getTitle()}</p>
              </div>
            </div>

            <button
              onClick={() => setActiveStep(Math.min(kioskSteps.length - 1, activeStep + 1))}
              disabled={activeStep === kioskSteps.length - 1}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm disabled:opacity-30 active:scale-95 transition-transform"
              style={{ backgroundColor: "#6BC30D" }}
              data-testid="button-kiosk-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed text-center px-2" data-testid="text-kiosk-desc">
            {getDesc()}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          {kioskFeatures.map((feat) => (
            <div key={feat.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm" data-testid={`card-kiosk-feature-${feat.label.toLowerCase().replace(/\s/g, '-')}`}>
              <feat.icon className="w-5 h-5 mb-2" style={{ color: "#6BC30D" }} />
              <p className="text-[13px] font-bold text-gray-900">{feat.label}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{feat.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm text-center space-y-3">
          <h3 className="text-base font-extrabold text-gray-900">
            {language === "hi" ? "कियोस्क हार्डवेयर" : language === "te" ? "కియోస్క్ హార్డ్‌వేర్" : "Kiosk Hardware"}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "15\" Touch Screen", icon: Monitor },
              { label: "HD Camera", icon: Camera },
              { label: "Thermal Printer", icon: FileText },
            ].map((hw) => (
              <div key={hw.label} className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-gray-50">
                <hw.icon className="w-5 h-5 text-gray-600" />
                <span className="text-[10px] font-semibold text-gray-700">{hw.label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {language === "hi" ? "सौर ऊर्जा संचालित • ₹15,000-25,000 अनुमानित लागत" :
             language === "te" ? "సోలార్ పవర్డ్ • ₹15,000-25,000 అంచనా ధర" :
             "Solar powered • ₹15,000-25,000 estimated cost"}
          </p>
        </div>

        <div className="pb-6">
          <Link href="/">
            <Button className="w-full h-12 rounded-2xl text-white font-bold gap-2 shadow-md" style={{ backgroundColor: "#6BC30D" }} data-testid="button-kiosk-try-app">
              {language === "hi" ? "ऐप आज़माएं" : language === "te" ? "యాప్ ప్రయత్నించండి" : "Try the App Now"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
