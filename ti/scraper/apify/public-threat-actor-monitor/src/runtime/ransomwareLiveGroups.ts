const SLUGS: Record<string, string> = {
  lockbit: "lockbit5", lockbit5: "lockbit5", lockbit3: "lockbit3", lockbit2: "lockbit2",
  qilin: "qilin", akira: "akira", play: "play", clop: "clop", cl0p: "clop",
  ransomhub: "ransomhub", inc: "incransom", incransom: "incransom", incransomware: "incransom",
  alphv: "alphv", blackcat: "alphv", dragonforce: "dragonforce",
  bianlian: "bianlian", blackbasta: "blackbasta", medusa: "medusa",
  thegentlemen: "thegentlemen", safepay: "safepay", eightbase: "8base",
  "8base": "8base", lynx: "lynx", everest: "everest", conti: "conti",
  dispossessor: "dispossessor", pysa: "pysa", hunters: "hunters",
  huntersinternational: "hunters", nightspire: "nightspire", killsec: "killsec",
  sinobi: "sinobi", rhysida: "rhysida", cactus: "cactus", royal: "royal",
  hive: "hive", ransomhouse: "ransomhouse", fog: "fog", vicesociety: "vicesociety",
  blacksuit: "blacksuit", devman: "devman", babuk: "babuk2", babuk2: "babuk2",
  stormous: "stormous", coinbasecartel: "coinbasecartel", handala: "handala",
  funksec: "funksec", malas: "malas", worldleaks: "worldleaks", cloak: "cloak",
  apt73: "apt73", blackbyte: "blackbyte", nova: "nova", avaddon: "avaddon",
  meow: "meow", snatch: "snatch", sarcoma: "sarcoma", spacebears: "spacebears",
  ragnarlocker: "ragnarlocker", shinyhunters: "shinyhunters", noescape: "noescape",
  raworld: "raworld", silentransomgroup: "SilentRansomGroup", toufan: "toufan",
  eldorado: "ElDorado", interlock: "interlock", monti: "monti", cuba: "cuba",
  payoutsking: "payoutsking", arcusmedia: "arcusmedia", pear: "pear", revil: "revil",
  abyss: "abyss", genesis: "genesis", kairos: "kairos", ransomexx: "ransomexx",
  anubis: "anubis", threeam: "threeam", "3am": "threeam", lorenz: "lorenz",
  warlock: "warlock", cicada3301: "cicada3301", direwolf: "direwolf",
  karakurt: "karakurt", avoslocker: "avoslocker", beast: "beast",
  quantum: "quantum", ransomed: "ransomed", medusalocker: "medusalocker",
  blacklock: "blacklock", lv: "lv", braincipher: "BrainCipher",
  flocker: "flocker", maze: "maze", chaos: "chaos", darkvault: "darkvault",
  krybit: "krybit", losttrust: "losttrust", mallox: "mallox", tengu: "tengu",
  trigona: "trigona", knight: "knight", nitrogen: "nitrogen", crypto24: "crypto24",
  termite: "termite", midas: "midas", blackshrantac: "blackshrantac",
  donutleaks: "donutleaks", gunra: "gunra", ailock: "AiLock",
  darkleakmarket: "darkleakmarket", dragon: "dragonransomware", dragonransomware: "dragonransomware",
  embargo: "embargo", securotrop: "securotrop", ciphbit: "ciphbit",
  helldown: "helldown", insomnia: "insomnia", nokoyawa: "nokoyawa",
  arvinclub: "arvinclub", spook: "spook", lamashtu: "lamashtu",
  dan0n: "dAn0n", obscura: "obscura", wannacry: "wannacry",
  blackmatter: "blackmatter", marketo: "marketo", suncrypt: "suncrypt",
  alphalocker: "alphalocker", blacknevas: "blacknevas",
  metaencryptor: "metaencryptor", frag: "frag", moneymessage: "moneymessage",
  payloadbin: "payloadbin", onyx: "onyx", kelvinsecurity: "kelvinsecurity",
  m3rx: "m3rx", netwalker: "netwalker", werewolves: "werewolves",
  doppelpaymer: "doppelpaymer", fulcrumsec: "fulcrumsec", kraken: "kraken",
  vect: "vect", lapsus: "lapsus$", radar: "radar"
};

export function ransomwareLiveGroupUrl(query: string): string | undefined {
  const slug = SLUGS[normalizeGroup(query)];
  if (slug) return `https://www.ransomware.live/group/${slug}`;
  const directSlug = directGroupSlug(query);
  return directSlug ? `https://www.ransomware.live/group/${directSlug}` : undefined;
}

function normalizeGroup(query: string): string {
  return query.toLowerCase().replace(/\b(ransomware|ransom|group|gang)\b/g, "").replace(/[^a-z0-9]/g, "");
}

function directGroupSlug(query: string): string | undefined {
  const direct = query.trim();
  if (!direct || direct.length > 80 || direct.includes("/") || direct.includes("?") || direct.includes("#")) return undefined;
  if (/^[A-Za-z0-9_$%.-]+$/.test(direct)) return direct;
  return encodeURIComponent(direct.replace(/\s+/g, " "));
}
