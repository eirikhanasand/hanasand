import { termRegex } from "./searchTerm.ts";

const TAGS = [
  "ransomware", "breach", "malware", "phishing", "exploit", "cve", "apt", "leak",
  "victim", "botnet", "ddos", "supply-chain", "zero-day", "infrastructure", "c2",
  "credential", "intrusion", "extortion", "loader", "mobile", "identity", "detection",
  "advisory", "exposed", "webshell"
];

const PHRASES: Array<[RegExp, string]> = [
  [/\bsupply chain\b/i, "supply-chain"],
  [/\bzero day\b/i, "zero-day"],
  [/\bcommand and control\b/i, "c2"],
  [/\bremote access trojan\b/i, "malware"],
  [/\b[A-Z0-9._-]*RAT\b/i, "malware"],
  [/\bactive(?:ly)? exploit/i, "exploit"],
  [/\bcredential(?:s)?\b/i, "credential"],
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
