import { termRegex } from "./searchTerm.ts";

const TAGS = [
  "ransomware", "breach", "malware", "phishing", "exploit", "cve", "apt", "leak",
  "victim", "botnet", "ddos", "supply-chain", "zero-day", "infrastructure", "c2",
  "credential", "infostealer", "intrusion", "extortion", "loader", "mobile", "identity", "detection",
  "advisory", "exposed", "webshell", "fraud", "smishing"
];

const PHRASES: Array<[RegExp, string]> = [
  [/\bsupply chain\b/i, "supply-chain"],
  [/\bzero day\b/i, "zero-day"],
  [/\bcommand and control\b/i, "c2"],
  [/\bremote access trojan\b/i, "malware"],
  [/\b[A-Z0-9._-]*RAT\b/i, "malware"],
  [/\b(APT\d+|Volt Typhoon|Salt Typhoon|Flax Typhoon|Sandworm|Gamaredon|Lazarus|Kimsuky|Turla|UAC-\d+|Scattered Spider)\b/i, "apt"],
  [/\b(initial access|lateral movement|persistence|hands-on-keyboard|backdoor|remote access trojan)\b/i, "intrusion"],
  [/\b(info.?stealer|stealer|stolen session|session cookie|working login|credential log)\b/i, "infostealer"],
  [/\b([a-z0-9._-]*loader|dropper|postinstall payload)\b/i, "loader"],
  [/\bactive(?:ly)? exploit/i, "exploit"],
  [/\bcredential(?:s)?\b/i, "credential"],
  [/\bcard fraud|payment fraud|account takeover|ATO\b/i, "fraud"],
  [/\bexpos(?:ed|ure|ing)\b/i, "exposed"],
  [/\bweb shell|webshell\b/i, "webshell"]
];

export function tagsFor(text: string) {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const tag of TAGS) if (termRegex(tag).test(lower)) found.add(tag);
  for (const [re, tag] of PHRASES) if (re.test(text)) found.add(tag);
  return [...found];
}
