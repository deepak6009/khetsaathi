import type { DiagnosisResult, Language } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stethoscope, Bug, Percent, Activity, Eye, FlaskConical, Droplets, Zap, Sprout } from "lucide-react";

interface DiagnosisCardProps {
  diagnosis: DiagnosisResult;
  language: Language;
}

const sectionLabels: Record<string, Record<Language, string>> = {
  diagnosisResults: { English: "Diagnosis Results", Telugu: "రోగ నిర్ధారణ ఫలితాలు", Hindi: "निदान परिणाम" },
  cropIdentified: { English: "Crop Identified", Telugu: "గుర్తించిన పంట", Hindi: "पहचानी गई फसल" },
  disease: { English: "Disease", Telugu: "వ్యాధి", Hindi: "रोग" },
  confidence: { English: "Confidence", Telugu: "నమ్మకం", Hindi: "विश्वास स्तर" },
  severity: { English: "Severity", Telugu: "తీవ్రత", Hindi: "गंभीरता" },
  symptomsObserved: { English: "Symptoms Observed", Telugu: "గమనించిన లక్షణాలు", Hindi: "देखे गए लक्षण" },
  recommendedPesticide: { English: "Recommended Pesticide", Telugu: "సిఫార్సు చేయబడిన పురుగుమందు", Hindi: "अनुशंसित कीटनाशक" },
  dosage: { English: "Dosage", Telugu: "మోతాదు", Hindi: "खुराक" },
  immediateAction: { English: "Immediate Action", Telugu: "తక్షణ చర్య", Hindi: "तत्काल कार्रवाई" },
};

function getLabel(key: string, lang: Language): string {
  return sectionLabels[key]?.[lang] || sectionLabels[key]?.English || key;
}

function getSeverityColor(severity?: string): string {
  if (!severity) return "bg-muted text-muted-foreground";
  const s = severity.toLowerCase();
  if (s.includes("high") || s.includes("severe")) return "bg-destructive text-destructive-foreground";
  if (s.includes("moderate") || s.includes("medium")) return "bg-chart-3 text-white";
  return "bg-primary text-primary-foreground";
}

function renderValue(value?: string | string[]): string {
  if (!value) return "N/A";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

export function DiagnosisCard({ diagnosis, language }: DiagnosisCardProps) {
  const items = [
    { icon: Sprout, label: getLabel("cropIdentified", language), value: diagnosis.crop_identified },
    { icon: Bug, label: getLabel("disease", language), value: diagnosis.disease, highlight: true },
    { icon: Percent, label: getLabel("confidence", language), value: diagnosis.confidence },
    { icon: Activity, label: getLabel("severity", language), value: diagnosis.severity, badge: true },
    { icon: Eye, label: getLabel("symptomsObserved", language), value: diagnosis.symptoms_observed },
    { icon: FlaskConical, label: getLabel("recommendedPesticide", language), value: diagnosis.recommended_pesticide },
    { icon: Droplets, label: getLabel("dosage", language), value: diagnosis.dosage },
    { icon: Zap, label: getLabel("immediateAction", language), value: diagnosis.immediate_action, important: true },
  ];

  return (
    <Card className="p-4 sm:p-6 border-primary/20" data-testid="card-diagnosis-results">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <Stethoscope className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-lg font-semibold" data-testid="text-diagnosis-title">
          {getLabel("diagnosisResults", language)}
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 rounded-md p-3 ${
              item.important ? "bg-destructive/5 sm:col-span-2" : "bg-muted/50"
            }`}
            data-testid={`diagnosis-field-${idx}`}
          >
            <item.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${item.important ? "text-destructive" : "text-muted-foreground"}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground font-medium mb-0.5">{item.label}</p>
              {item.badge ? (
                <Badge className={`${getSeverityColor(item.value as string | undefined)} text-xs`}>
                  {renderValue(item.value)}
                </Badge>
              ) : (
                <p className={`text-sm ${item.highlight ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                  {renderValue(item.value)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
