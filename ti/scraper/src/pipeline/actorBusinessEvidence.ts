import { normalizeWhitespace } from "../utils.ts";

export type ActorBusinessEvidence = {
  type: "extortion_model" | "advertised_product" | "advertised_data" | "pricing_claim" | "payment_claim" | "revenue_claim" | "revenue_share_claim" | "communication_channel" | "buyer_seller_communication" | "intermediary_communication" | "monetization_path" | "victim_pressure_tactic" | "profitability_signal";
  value: string;
  confidence: number;
  assertionKind: "third_party_report";
  reviewReasons: string[];
  startOffset: number;
  matchedLength: number;
  evidenceText: string;
};

type EvidenceRule = {
  type: ActorBusinessEvidence["type"];
  pattern: RegExp;
  value: (match: RegExpMatchArray) => string;
  confidence: number;
  reviewReason: string;
};

const RULES: EvidenceRule[] = [
  rule("extortion_model", /\bthree-phase\s+ransom\/sale\/leak\s+extortion\s+model\b/i, 0.9, "third-party characterization requires analyst review"),
  rule("extortion_model", /\b(?:double|multi-pronged|multi-method|cloud-based|data-broker)(?:-|\s+)extortion\b/i, 0.86, "third-party characterization requires analyst review"),
  rule("extortion_model", /\b(?:data(?:-|\s+)theft|data|leak(?:-|\s+)site(?:-|\s+)centric)(?:-|\s+)extortion\b/i, 0.84, "third-party characterization requires analyst review"),
  rule("extortion_model", /\b(?:ransomware(?:-|\s+)as(?:-|\s+)a(?:-|\s+)service|RaaS)\b/i, 0.88, "third-party characterization requires analyst review", () => "Ransomware-as-a-service"),
  rule("pricing_claim", /\bransom demands?\s+(?:ranges?\s+from\s+)?((?:US)?\$\s?[\d,.]+(?:\s+(?:to|-)\s+(?:US)?\$\s?[\d,.]+)?)/i, 0.82, "reported ransom amount is not independently verified", (match) => match[1].replace(/[.,]+$/, "")),
  rule("pricing_claim", /\brequiring\s+(?:a\s+)?((?:US)?\$\s?[\d,.]+\s+affiliate deposit)\b/i, 0.82, "reported affiliate price is not independently verified", (match) => match[1]),
  rule("pricing_claim", /\bdemand(?:ed|ing|s)?\s+(?:ransoms?\s+)?(?:up\s+to\s+)?((?:US)?\$\s?[\d,.]+(?:\s+(?:million|billion))?)(?:\s+ransoms?)?\b/i, 0.82, "reported ransom amount is not independently verified", (match) => match[1]),
  rule("pricing_claim", /\bdemanded\s+(?:a\s+)?([\d,.]+-euro)\b/i, 0.8, "reported ransom amount is not independently verified", (match) => match[1]),
  rule("payment_claim", /\bdemand(?:ed)?\s+to\s+be\s+paid\s+(?:with|in)\s+([^.!?;<]{2,80})/i, 0.82, "reported payment demand does not establish that payment occurred", (match) => match[1]),
  rule("payment_claim", /\bdemanding\s+(Bitcoin|Monero(?:\s+\(XMR\))?)\s+ransom\b/i, 0.8, "reported payment demand does not establish that payment occurred", (match) => match[1]),
  rule("payment_claim", /\b(Bitcoin|Monero(?:\s+\(XMR\))?)\s+payment demands?\b/i, 0.8, "reported payment demand does not establish that payment occurred", (match) => match[1]),
  rule("payment_claim", /\bransoms?\s+payable\s+in\s+(Bitcoin|Monero(?:\s+\(XMR\))?)\b/i, 0.82, "reported payment demand does not establish that payment occurred", (match) => match[1]),
  rule("payment_claim", /\bdemanded\s+(?:a\s+)?[\d,.]+-euro\s+([^.!?;<]{2,50}?\s+payment)\b/i, 0.8, "reported payment demand does not establish that payment occurred", (match) => match[1]),
  rule("payment_claim", /\bsecured\b[^.!?;<]{0,100}\bransom payment of\s+((?:US)?\$\s?[\d,.]+(?:\s+(?:million|billion))?)/i, 0.78, "reported completed payment requires independent verification", (match) => `Reported ${match[1]} ransom payment`),
  rule("revenue_claim", /\bearned\s+(?:over\s+)?((?:(?:US)?\$|€)\s?[\d,.]+(?:\s+(?:million|billion))?(?:\s+in\s+(?:Bitcoin|Monero))?)/i, 0.76, "reported proceeds are not supported by independently reviewed financial records", (match) => `Reported proceeds of ${match[1]}`),
  rule("revenue_claim", /\bsecured\b[^.!?;<]{0,100}\bransom payment of\s+((?:US)?\$\s?[\d,.]+(?:\s+(?:million|billion))?)/i, 0.76, "reported payment is not the same as independently verified revenue or profit", (match) => `Reported ${match[1]} ransom payment`),
  rule("communication_channel", /\b(?:new\s+)?negotiation\s+(portal|site|infrastructure)\b/i, 0.82, "reported negotiation channel; no conversation content was collected", (match) => `Negotiation ${match[1].toLowerCase()}`),
  rule("intermediary_communication", /\b(?:actively\s+)?recruit(?:s|ed|ing)? affiliates\b/i, 0.82, "reported affiliate recruitment; no private communication was collected", () => "Affiliate recruitment"),
  rule("intermediary_communication", /\bpromot(?:e|ing|ed)\s+(?:their\s+)?affiliate program\b/i, 0.8, "reported affiliate recruitment; no private communication was collected", () => "Affiliate program promotion"),
  rule("revenue_share_claim", /\b(?:flexible\s+)?revenue split(?: model)?\b/i, 0.78, "reported revenue-sharing terms are not independently verified"),
  rule("revenue_share_claim", /\b(?:\d{1,2}\/\d{1,2})\s+(?:revenue split|split of ransoms?)\b/i, 0.82, "reported revenue-sharing terms are not independently verified"),
  rule("revenue_share_claim", /\b\d{1,2}% commissions?\b/i, 0.82, "reported commission terms are not independently verified"),
  rule("advertised_product", /\bransomware-as-a-service product\b/i, 0.84, "third-party product description requires analyst review", () => "Ransomware-as-a-service product"),
  rule("advertised_product", /\bsells affiliates an admin panel, ransomware executable, and decryption key generator\b/i, 0.84, "reported product offering requires analyst review", () => "Admin panel, ransomware executable, and decryption-key generator"),
  rule("advertised_data", /\bselling public databases\b/i, 0.8, "reported data category only; no stolen data was collected", () => "Public databases"),
  rule("advertised_data", /\bsell stolen (?:information|data)\b/i, 0.8, "reported data category only; no stolen data was collected", (match) => match[0].replace(/^sell\s+/i, "")),
  rule("monetization_path", /\bthree-phase\s+ransom\/sale\/leak\s+extortion\s+model\b/i, 0.86, "reported monetization path does not establish realized revenue", () => "Ransom demand, data sale, then publication"),
  rule("monetization_path", /\bselling public databases\b/i, 0.78, "reported monetization path does not establish realized revenue", () => "Public database sales"),
  rule("monetization_path", /\bsells stolen data\b/i, 0.78, "reported monetization path does not establish realized revenue", () => "Stolen-data resale"),
  rule("victim_pressure_tactic", /\bthreatening regulatory reporting if ransoms are unpaid\b/i, 0.84, "third-party pressure-tactic report requires analyst review", () => "Threat of regulatory reporting"),
  rule("victim_pressure_tactic", /\b\d{1,3}-hour ransom deadlines?\b/i, 0.82, "reported deadline requires analyst review"),
  rule("profitability_signal", /\bfailing to make any profit from selling public databases\b/i, 0.76, "third-party profitability report is not supported by financial records", () => "Reported failure to profit from public database sales"),
];

export function extractActorBusinessEvidence(description: unknown): ActorBusinessEvidence[] {
  if (typeof description !== "string" || !description.trim()) return [];
  const findings = RULES.flatMap((entry) => {
    const match = description.match(entry.pattern);
    if (!match || match.index === undefined) return [];
    const value = normalizeWhitespace(entry.value(match)).slice(0, 160);
    if (!value) return [];
    return [{
      type: entry.type,
      value,
      confidence: entry.confidence,
      assertionKind: "third_party_report" as const,
      reviewReasons: [entry.reviewReason],
      startOffset: match.index,
      matchedLength: match[0].length,
      evidenceText: excerpt(description, match.index, match[0].length),
    }];
  });
  return [...new Map(findings.map((finding) => [`${finding.type}:${finding.value.toLowerCase()}`, finding])).values()];
}

function rule(type: EvidenceRule["type"], pattern: RegExp, confidence: number, reviewReason: string, value: EvidenceRule["value"] = (match) => match[0]): EvidenceRule {
  return { type, pattern, value, confidence, reviewReason };
}

function excerpt(text: string, offset: number, length: number): string {
  const start = Math.max(0, offset - 80), end = Math.min(text.length, offset + length + 120);
  return normalizeWhitespace(text.slice(start, end).replace(/<[^>]+>/g, " ")).slice(0, 240);
}
