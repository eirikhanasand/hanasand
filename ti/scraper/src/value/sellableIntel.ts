// @ts-nocheck
const TERM_RE = /\b(APT|ransomware|RaaS|breach|CVE-\d|malware|phishing|exploit|exploited|vulnerability|vulnerabilities|victim|leak|intrusion|campaign|credential|espionage|backdoor|botnet|supply-chain|zero-day|data leak|threat actor|attack|compromised|exposed|exfiltration|trojan|wiper|RAT|C2|command and control)\b/i;
const BAD_RE = /\b(test fixture|example\.test|proof-only|synthetic|webinar|newsletter|conference|product launch|press release)\b/i;

export function isSellableIntelText(input: { text: string; title?: string; sourceId?: string; publishedAt?: string; collectedAt?: string; now?: string }) {
  const text = clean(`${input.title ?? ""} ${input.text ?? ""}`);
  if (!input.sourceId) return false;
  if (text.length < 80 || BAD_RE.test(text)) return false;
  if (!TERM_RE.test(text) && !TERM_RE.test(input.sourceId ?? "")) return false;
  const age = ageDays(input.publishedAt || input.collectedAt, input.now);
  return age === undefined || age <= 30;
}

export function sellableReason(text: string) {
  const cleanText = clean(text);
  if (cleanText.length < 80) return "too_short";
  if (BAD_RE.test(cleanText)) return "generic_or_synthetic";
  if (!TERM_RE.test(cleanText)) return "missing_threat_intel_terms";
  return "sellable";
}

function clean(value: string) {
  return String(value ?? "").replace(/<[^>]+>/g, " ").replace(/&[#a-z0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function ageDays(value?: string, now = new Date().toISOString()) {
  const then = Date.parse(value ?? "");
  if (!Number.isFinite(then)) return undefined;
  return Math.max(0, Math.floor((Date.parse(now) - then) / 86_400_000));
}
