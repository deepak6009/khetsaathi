import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, FileText, CalendarDays, Sprout, Download, Leaf, Loader2 } from "lucide-react";
import type { Language } from "@shared/schema";
import logoImage from "@assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png";

const i18n = {
  title: { English: "Crop Health History", Telugu: "పంట ఆరోగ్య చరిత్ర", Hindi: "फसल स्वास्थ्य इतिहास" } as Record<Language, string>,
  back: { English: "Back", Telugu: "వెనక్కి", Hindi: "वापस" } as Record<Language, string>,
  noHistory: { English: "No diagnosis history found", Telugu: "రోగ నిర్ధారణ చరిత్ర కనుగొనబడలేదు", Hindi: "कोई निदान इतिहास नहीं मिला" } as Record<Language, string>,
  noHistoryHint: { English: "Start a new diagnosis to see your history here", Telugu: "మీ చరిత్రను ఇక్కడ చూడటానికి కొత్త రోగ నిర్ధారణ ప్రారంభించండి", Hindi: "अपना इतिहास यहां देखने के लिए नया निदान शुरू करें" } as Record<Language, string>,
  loading: { English: "Loading history...", Telugu: "చరిత్ర లోడ్ అవుతోంది...", Hindi: "इतिहास लोड हो रहा है..." } as Record<Language, string>,
  viewPlan: { English: "View Plan", Telugu: "ప్లాన్ చూడండి", Hindi: "प्लान देखें" } as Record<Language, string>,
  appTitle: { English: "KhetSathi", Telugu: "ఖేత్ సాథీ", Hindi: "खेतसाथी" } as Record<Language, string>,
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/60">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-muted-foreground text-sm active:opacity-70 rounded-lg px-1 py-1"
            data-testid="button-back"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-xs font-medium">{getLabel("back")}</span>
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <img src={logoImage} alt="KhetSathi" className="w-8 h-8 rounded-lg object-contain" />
          </div>
          <div />
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-5">
        <div className="mb-5">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">{getLabel("title")}</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">{getLabel("loading")}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-14 rounded-xl bg-card shadow-xs">
            <Leaf className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2.5" />
            <p className="text-sm font-medium text-muted-foreground">{getLabel("noHistory")}</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">{getLabel("noHistoryHint")}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((item, idx) => (
              <div key={idx} className="rounded-xl bg-card shadow-xs p-3.5" data-testid={`card-history-${idx}`}>
                <div className="flex items-start gap-3">
                  {item.imageUrls && item.imageUrls.length > 0 ? (
                    <img src={item.imageUrls[0]} alt="Crop" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
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
                      {new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  {item.diagnosis?.severity && (
                    <Badge variant="secondary" className="text-[10px] font-medium rounded-full px-2">{item.diagnosis.severity}</Badge>
                  )}
                </div>
                {item.pdfUrl && item.pdfUrl !== "pdf_generation_failed" && (
                  <a
                    href={item.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 pt-2.5 border-t border-border/60 flex items-center gap-2 text-xs font-medium text-primary"
                    data-testid={`link-plan-pdf-${idx}`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {getLabel("viewPlan")}
                    <Download className="w-3 h-3 ml-auto" />
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
