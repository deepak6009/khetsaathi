import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, FileText, CalendarDays, Sprout, Download, Leaf, Loader2 } from "lucide-react";
import type { Language } from "@shared/schema";
import logoImage from "@assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png";

const langSpace = (lang: Language) =>
  lang === "Telugu" || lang === "Hindi" ? "leading-relaxed tracking-wide" : "leading-normal";

const langSpaceTight = (lang: Language) =>
  lang === "Telugu" || lang === "Hindi" ? "leading-relaxed" : "leading-snug";

const i18n = {
  title: { English: "Crop Health History", Telugu: "పంట ఆరోగ్య చరిత్ర", Hindi: "फसल स्वास्थ्य इतिहास" } as Record<Language, string>,
  back: { English: "Back", Telugu: "వెనక్కి", Hindi: "वापस" } as Record<Language, string>,
  noHistory: { English: "No diagnosis history found", Telugu: "రోగ నిర్ధారణ చరిత్ర కనుగొనబడలేదు", Hindi: "कोई निदान इतिहास नहीं मिला" } as Record<Language, string>,
  noHistoryHint: { English: "Start a new diagnosis to see your history here", Telugu: "మీ చరిత్రను ఇక్కడ చూడటానికి కొత్త రోగ నిర్ధారణ ప్రారంభించండి", Hindi: "अपना इतिहास यहां देखने के लिए नया निदान शुरू करें" } as Record<Language, string>,
  loading: { English: "Loading history...", Telugu: "చరిత్ర లోడ్ అవుతోంది...", Hindi: "इतिहास लोड हो रहा है..." } as Record<Language, string>,
  viewPlan: { English: "View Plan", Telugu: "ప్లాన్ చూడండి", Hindi: "प्लान देखें" } as Record<Language, string>,
};

interface HistoryItem {
  phone: string;
  timestamp: string;
  conversationSummary: string;
  pdfUrl?: string;
  language?: string;
  diagnosis?: Record<string, any>;
  imageUrls?: string[];
}

export default function HistoryPage() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const phone = params.get("phone") || "";
  const lang = (params.get("lang") as Language) || "English";

  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone) {
      setLoading(false);
      return;
    }
    fetch(`/api/history/${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(data => {
        setItems(data.history || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [phone]);

  const getLabel = (key: keyof typeof i18n) => i18n[key][lang] || i18n[key].English;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <div className="w-24 flex items-center">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-0.5 text-gray-700 active:opacity-70 -ml-1"
              data-testid="button-back"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className={`text-[13px] font-medium ${langSpaceTight(lang)}`}>{getLabel("back")}</span>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center gap-2">
            <img src={logoImage} alt="KhetSaathi" className="w-7 h-7 rounded-lg object-contain" />
            <span className="text-[15px] font-bold tracking-tight text-gray-900">KhetSaathi</span>
          </div>
          <div className="w-24" />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        <div className="mb-5">
          <h1 className={`text-xl font-bold text-gray-900 tracking-tight ${langSpace(lang)}`}>{getLabel("title")}</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#6BC30D" }} />
            <p className={`text-[14px] text-gray-600 font-medium ${langSpace(lang)}`}>{getLabel("loading")}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 rounded-2xl bg-gray-50 border border-gray-100">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Leaf className="w-7 h-7 text-gray-400" />
            </div>
            <p className={`text-[15px] font-semibold text-gray-600 ${langSpace(lang)}`}>{getLabel("noHistory")}</p>
            <p className={`text-[13px] text-gray-500 mt-1 ${langSpace(lang)}`}>{getLabel("noHistoryHint")}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((item, idx) => (
              <div key={idx} className="rounded-2xl bg-white shadow-sm p-4 border border-gray-100" data-testid={`card-history-${idx}`}>
                <div className="flex items-start gap-3.5">
                  {item.imageUrls && item.imageUrls.length > 0 ? (
                    <img src={item.imageUrls[0]} alt="Crop" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <Sprout className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {item.diagnosis?.disease && (
                      <p className={`text-[14px] font-bold text-gray-900 truncate ${langSpaceTight(lang)}`}>{item.diagnosis.disease}</p>
                    )}
                    {item.diagnosis?.crop_identified && (
                      <p className={`text-[13px] text-gray-700 truncate mt-0.5 ${langSpaceTight(lang)}`}>{item.diagnosis.crop_identified}</p>
                    )}
                    <p className="text-[11px] text-gray-600 mt-1.5 flex items-center gap-1 font-medium">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {item.diagnosis?.severity && (
                    <Badge variant="secondary" className="text-[10px] font-bold rounded-full px-2.5 py-0.5">{item.diagnosis.severity}</Badge>
                  )}
                </div>
                {item.pdfUrl && item.pdfUrl !== "pdf_generation_failed" && (
                  <a
                    href={item.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-[13px] font-semibold"
                    style={{ color: "#6BC30D" }}
                    data-testid={`link-plan-pdf-${idx}`}
                  >
                    <FileText className="w-4 h-4" />
                    <span className={langSpaceTight(lang)}>{getLabel("viewPlan")}</span>
                    <Download className="w-3.5 h-3.5 ml-auto" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
