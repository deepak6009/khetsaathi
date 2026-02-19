import type { Language } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Calendar } from "lucide-react";

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

function formatPlan(plan: string): string {
  const escaped = escapeHtml(plan);

  let html = escaped
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mt-5 mb-2">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mt-5 mb-3">$1</h1>')
    .replace(/^- (.*$)/gm, '<li class="ml-4">$1</li>')
    .replace(/^\d+\.\s+(.*$)/gm, '<li class="ml-4 list-decimal">$1</li>');

  const lines = html.split("\n");
  const processed: string[] = [];
  let inList = false;

  for (const line of lines) {
    if (line.startsWith("<li")) {
      if (!inList) {
        processed.push("<ul class='space-y-1 my-2'>");
        inList = true;
      }
      processed.push(line);
    } else {
      if (inList) {
        processed.push("</ul>");
        inList = false;
      }
      if (line.trim() && !line.startsWith("<h")) {
        processed.push(`<p class="my-1">${line}</p>`);
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
    <Card className="p-4 sm:p-6 border-primary/20" data-testid="card-treatment-plan">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
          <Calendar className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-lg font-semibold" data-testid="text-plan-title">
          {titles[language]}
        </h2>
      </div>

      <div
        className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-foreground prose-p:text-foreground/85 prose-li:text-foreground/85 prose-strong:text-foreground"
        data-testid="text-plan-content"
        dangerouslySetInnerHTML={{ __html: formatPlan(plan) }}
      />
    </Card>
  );
}
