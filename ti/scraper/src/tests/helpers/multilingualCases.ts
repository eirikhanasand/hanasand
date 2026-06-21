import type { AdapterObservatorySourceFamily } from "../../adapters/adapterFailureObservatory.ts";
import type { PublicReportLanguageCode } from "../../adapters/multilingualReportHandoff.ts";
import type { SourceType } from "../../types.ts";

export interface LanguageCase {
  label: string;
  type: SourceType;
  family: AdapterObservatorySourceFamily;
  language?: PublicReportLanguageCode;
  text: string;
  expected: PublicReportLanguageCode;
  translationNeeded: boolean;
  options?: { contentType?: string; requiresJavascript?: boolean; publicChannelHandoff?: boolean };
}

export const languageCases: LanguageCase[] = [
  { label: "English HTML", type: "static_web", family: "static_html", language: "en", text: "APT29 threat advisory describes vulnerability exploitation, malware staging, and indicators.", expected: "en", translationNeeded: false },
  { label: "Norwegian RSS", type: "rss", family: "rss_feed", language: "nb", text: "Nasjonal trusselaktør utnyttet sårbarhet mot offentlig sektor og delte indikatorer.", expected: "nb", translationNeeded: true },
  { label: "Russian dynamic page", type: "dynamic_web", family: "dynamic_page", language: "ru", text: "Группа описала атаку на инфраструктуру и новые индикаторы компрометации.", expected: "ru", translationNeeded: true, options: { requiresJavascript: true } },
  { label: "Chinese PDF", type: "pdf", family: "pdf_report", language: "zh", text: "报告描述了攻击活动、漏洞利用、基础设施和防御建议。", expected: "zh", translationNeeded: true, options: { contentType: "application/pdf" } },
  { label: "Persian advisory", type: "api", family: "advisory_signal", language: "fa", text: "گزارش درباره حمله، زیرساخت و شاخص‌های نفوذ توضیح می‌دهد.", expected: "fa", translationNeeded: true, options: { contentType: "application/json" } },
  { label: "Spanish public channel handoff", type: "telegram_public", family: "public_channel", language: "es", text: "La amenaza explotó una vulnerabilidad durante la campaña y publicó indicadores.", expected: "es", translationNeeded: true, options: { contentType: "application/json", publicChannelHandoff: true } },
  { label: "Mixed public report", type: "static_web", family: "static_html", text: "APT29 threat advisory includes инфраструктура and индикаторы from multiple sources.", expected: "mixed", translationNeeded: true }
];

export const benchmarkCases = [
  { id: "english_html", type: "static_web" as const, family: "static_html" as const, language: "en" as const, text: "Threat advisory describes malware indicators and mitigations." },
  { id: "spanish_channel", type: "telegram_public" as const, family: "public_channel" as const, language: "es" as const, text: "La amenaza explotó una vulnerabilidad durante la campaña y publicó indicadores.", options: { contentType: "application/json", publicChannelHandoff: true } },
  { id: "mixed_report", type: "static_web" as const, family: "static_html" as const, text: "Threat advisory includes индикаторы and shared infrastructure details." }
];
