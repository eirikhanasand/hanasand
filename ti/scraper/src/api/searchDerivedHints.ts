const MATCHERS = [
  [/\b(APT\d+|Volt Typhoon|Salt Typhoon|Flax Typhoon|Sandworm|Gamaredon|Lazarus|Kimsuky|Turla|UAC-\d+|Scattered Spider)\b/i, "apt intrusion espionage"],
  [/\b(npm|pypi|package|dependency|dependencies|sbom|slsa|open source|trojanized|plugin|registry)\b/i, "supply-chain"],
  [/\b(infrastructure|domain|dns|c2|command and control|bulletproof|hosting|ip address)\b/i, "infrastructure c2"],
  [/\b(info.?stealer|stealer|stolen session|session cookie|working login|credential log)\b/i, "infostealer credential identity"],
  [/\b(initial access|lateral movement|persistence|hands-on-keyboard|backdoor|remote access trojan)\b/i, "intrusion"],
  [/\b([a-z0-9._-]*loader|dropper|postinstall payload)\b/i, "loader malware"],
  [/\b(published a new victim|new victim|victim\s*:|ransomware\.live)\b/i, "ransomware extortion victim leak"],
  [/\bzero.day|0.day|actively exploited|exploited in the wild\b/i, "zero-day"]
] as const;

export function derivedHints(text: string) {
  return MATCHERS.map(([regex, hint]) => regex.test(text) ? hint : "").filter(Boolean).join(" ");
}
