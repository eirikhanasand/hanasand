const MATCHERS = [
  [/\b(npm|pypi|package|dependency|dependencies|sbom|slsa|open source|trojanized|plugin|registry)\b/i, "supply-chain"],
  [/\b(infrastructure|domain|dns|c2|command and control|bulletproof|hosting|ip address)\b/i, "infrastructure c2"],
  [/\bzero.day|0.day|actively exploited|exploited in the wild\b/i, "zero-day"]
] as const;

export function derivedHints(text: string) {
  return MATCHERS.map(([regex, hint]) => regex.test(text) ? hint : "").filter(Boolean).join(" ");
}
