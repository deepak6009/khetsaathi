import type { Language } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Calendar, Shield, Stethoscope, Sprout, IndianRupee, AlertTriangle, Clock } from "lucide-react";

interface TreatmentPlanProps {
  plan: string;
  language: Language;
}

const titles: Record<Language, string> = {
  English: "7-Day Treatment Plan",
  Telugu: "7-రోజుల చికిత్స ప్రణాళిక",
  Hindi: "7-दिन की उपचार योजना",
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const sectionIcons: Record<string, string> = {
  "diagnosis": "stethoscope",
  "immediate": "alert",
  "prescription": "shield",
  "calendar": "calendar",
  "action": "calendar",
  "budget": "rupee",
  "safety": "alert",
  "prevention": "sprout",
  "future": "sprout",
};

function getSectionIcon(heading: string): string {
  const lower = heading.toLowerCase();
  for (const [key, icon] of Object.entries(sectionIcons)) {
    if (lower.includes(key)) return icon;
  }
  return "calendar";
}

function formatPlan(plan: string): string {
  const escaped = escapeHtml(plan);

  let html = escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, (_m, p1) => {
      return `<h3 class="text-sm font-semibold mt-3 mb-1.5 text-foreground/90">${p1}</h3>`;
    })
    .replace(/^## (.*$)/gm, (_m, p1) => {
      const iconType = getSectionIcon(p1);
      return `<div class="section-header flex items-center gap-2 mt-5 mb-2 pb-1.5 border-b border-border" data-icon="${iconType}"><h2 class="text-base font-semibold text-foreground">${p1}</h2></div>`;
    })
    .replace(/^# (.*$)/gm, '<h1 class="text-lg font-bold mt-5 mb-3 text-foreground">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 pl-1 py-0.5 text-foreground/85 text-sm leading-relaxed">$1</li>')
    .replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 pl-1 py-0.5 list-decimal text-foreground/85 text-sm leading-relaxed">$1</li>');

  const lines = html.split("\n");
  const processed: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("<li")) {
      if (!inList) {
        processed.push("<ul class='space-y-0.5 my-1.5'>");
        inList = true;
      }
      processed.push(line);
    } else {
      if (inList) {
        processed.push("</ul>");
        inList = false;
      }
      if (line.trim() && !line.startsWith("<h") && !line.startsWith("<div")) {
        processed.push(`<p class="my-1 text-sm text-foreground/85 leading-relaxed">${line}</p>`);
      } else {
        processed.push(line);
      }
    }
  }
  if (inList) processed.push("</ul>");

  return processed.join("\n");
}

export function TreatmentPlan({ plan, language }: TreatmentPlanProps) {
  return (
    <Card className="p-4 sm:p-5 border-primary/20 max-h-[60vh] overflow-y-auto" data-testid="card-treatment-plan">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 flex-shrink-0">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-lg font-semibold" data-testid="text-plan-title">
          {titles[language]}
        </h2>
      </div>

      <div
        className="treatment-plan-content prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/85 prose-li:text-foreground/85 prose-strong:text-foreground"
        data-testid="text-plan-content"
        dangerouslySetInnerHTML={{ __html: formatPlan(plan) }}
      />
    </Card>
  );
}
