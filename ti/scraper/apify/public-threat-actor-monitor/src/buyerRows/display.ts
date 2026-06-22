export function displayValue(value: string): string {
  const trimmed = value.trim();
  const branded = ACTOR_DISPLAY_NAMES[normalizeActorName(trimmed)];
  if (branded) return branded;
  if (!trimmed || /[A-Z]/.test(trimmed.slice(1))) return trimmed;
  return trimmed.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function sentenceCase(value: string): string {
  const trimmed = value.trim();
  return trimmed ? `${trimmed[0]?.toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

const ACTOR_DISPLAY_NAMES: Record<string, string> = {
  "8base": "8Base",
  "alphv": "ALPHV",
  "apt73": "APT73",
  "bianlian": "BianLian",
  "blackbasta": "Black Basta",
  "blackbyte": "BlackByte",
  "blacklock": "BlackLock",
  "blackmatter": "BlackMatter",
  "blacksuit": "BlackSuit",
  "braincipher": "BrainCipher",
  "clop": "Clop",
  "dragonforce": "DragonForce",
  "hellokitty": "HelloKitty",
  "incransom": "INC Ransom",
  "lockbit": "LockBit",
  "lockbit2": "LockBit2",
  "lockbit3": "LockBit3",
  "lockbit5": "LockBit5",
  "medusalocker": "MedusaLocker",
  "noescape": "NoEscape",
  "ransomexx": "RansomEXX",
  "ransomhouse": "RansomHouse",
  "ransomhub": "RansomHub",
  "safepay": "SafePay",
  "shinyhunters": "ShinyHunters",
  "silentransomgroup": "SilentRansomGroup"
};

function normalizeActorName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
