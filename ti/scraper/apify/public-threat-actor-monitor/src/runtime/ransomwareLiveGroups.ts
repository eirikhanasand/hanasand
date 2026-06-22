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
  quantum: "quantum", ransomed: "ransomed"
};

export function ransomwareLiveGroupUrl(query: string): string | undefined {
  const slug = SLUGS[normalizeGroup(query)];
  return slug ? `https://www.ransomware.live/group/${slug}` : undefined;
}

function normalizeGroup(query: string): string {
  return query.toLowerCase().replace(/\b(ransomware|ransom|group|gang)\b/g, "").replace(/[^a-z0-9]/g, "");
}
