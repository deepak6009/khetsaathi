import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Calendar, Bug, Sprout, Download, MapPin } from "lucide-react";
import type { Language } from "@shared/schema";
import logoImage from "@assets/Blue_and_Green_Farmers_Instagram_Post_(2)_1771525392133.png";

const i18n = {
  title: { English: "Crop Health History", Telugu: "పంట ఆరోగ్య చరిత్ర", Hindi: "फसल स्वास्थ्य इतिहास" } as Record<Language, string>,
  back: { English: "Back", Telugu: "వెనక్కి", Hindi: "वापस" } as Record<Language, string>,
  noHistory: { English: "No diagnosis history found", Telugu: "రోగ నిర్ధారణ చరిత్ర కనుగొనబడలేదు", Hindi: "कोई निदान इतिहास नहीं मिला" } as Record<Language, string>,
  noHistoryHint: { English: "Start a new diagnosis to see your history here", Telugu: "మీ చరిత్రను ఇక్కడ చూడటానికి కొత్త రోగ నిర్ధారణ ప్రారంభించండి", Hindi: "अपना इतिहास यहां देखने के लिए नया निदान शुरू करें" } as Record<Language, string>,
  loading: { English: "Loading history...", Telugu: "చరిత్ర లోడ్ అవుతోంది...", Hindi: "इतिहास लोड हो रहा है..." } as Record<Language, string>,
  disease: { English: "Disease", Telugu: "వ్యాధి", Hindi: "रोग" } as Record<Language, string>,
  crop: { English: "Crop", Telugu: "పంట", Hindi: "फसल" } as Record<Language, string>,
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
      <header className="bg-primary text-primary-foreground">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center gap-2.5">
            <img
              src={logoImage}
              alt="KhetSathi"
              className="w-10 h-10 rounded-md object-contain bg-white/10 p-0.5"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-tight">{getLabel("appTitle")}</h1>
              <p className="text-[11px] text-primary-foreground/75 leading-tight">{getLabel("title")}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto w-full px-4 py-4">
        <Button variant="ghost" size="sm" className="gap-1.5 mb-4" onClick={() => navigate("/")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
          {getLabel("back")}
        </Button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{getLabel("loading")}</p>
          </div>
        ) : items.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">{getLabel("noHistory")}</p>
            <p className="text-sm text-muted-foreground">{getLabel("noHistoryHint")}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).map((item, idx) => (
              <Card key={idx} className="p-4" data-testid={`card-history-${idx}`}>
                <div className="flex items-start gap-3">
                  {item.imageUrls && item.imageUrls.length > 0 ? (
                    <img src={item.imageUrls[0]} alt="Crop" className="w-16 h-16 rounded-md object-cover flex-shrink-0 border border-border" />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Sprout className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {item.diagnosis?.disease && (
                        <div className="flex items-center gap-1">
                          <Bug className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground truncate">{item.diagnosis.disease}</span>
                        </div>
                      )}
                      {item.diagnosis?.severity && (
                        <Badge variant="secondary" className="text-[10px]">{item.diagnosis.severity}</Badge>
                      )}
                    </div>
                    {item.diagnosis?.crop_identified && (
                      <p className="text-xs text-muted-foreground mb-1">
                        <Sprout className="w-3 h-3 inline mr-1" />{item.diagnosis.crop_identified}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {new Date(item.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                </div>
                {item.pdfUrl && item.pdfUrl !== "pdf_generation_failed" && (
                  <a
                    href={item.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"
                    data-testid={`link-plan-pdf-${idx}`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {getLabel("viewPlan")}
                    <Download className="w-3 h-3 ml-auto" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
