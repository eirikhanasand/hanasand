import type { CaptureMetadataStore } from "../storage/evidenceStoreTypes.ts";

const ACTORS = [
  { id: "apt42", name: "APT42" },
  { id: "apt29", name: "APT29" },
  { id: "sandworm", name: "Sandworm" },
  { id: "lazarus", name: "Lazarus Group" },
  { id: "volt-typhoon", name: "Volt Typhoon" },
  { id: "lockbit", name: "LockBit" },
  { id: "akira", name: "Akira" },
  { id: "clop", name: "Clop" },
  { id: "black-basta", name: "Black Basta" }
] as const;

const DIMENSIONS = ["aliases", "sourceReferences", "recentActivity", "countries", "sectors", "malwareTools", "attackTechniques", "victims", "sourceFreshness"] as const;
const ACTOR_TYPES = new Set(["actor", "threat_actor", "ransomware_family"]);
const FIELD_TYPES: Record<string, Set<string>> = {
  countries: new Set(["country", "region", "geography"]),
  sectors: new Set(["sector", "industry"]),
  malwareTools: new Set(["malware", "malware_tool", "tool", "ransomware_family"]),
  attackTechniques: new Set(["ttp", "attack_technique", "technique"]),
  victims: new Set(["victim", "organization", "company"])
};

export function buildActorCoverageReport(store: CaptureMetadataStore, input: { tenantId?: string; recentDays?: number; generatedAt?: string } = {}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const recentDays = Math.max(1, input.recentDays ?? 30);
  const cutoff = Date.parse(generatedAt) - recentDays * 86_400_000;
  const inScope = (record: any) => input.tenantId ? record?.tenantId == null || record?.tenantId === input.tenantId : true;
  const captures = store.listCaptures().filter(inScope);
  const entities = store.listExtractedEntities().filter(inScope);
  const sources = store.listSources().filter(inScope);
  const profiles = store.listActorProfiles().filter(inScope);
  const aliases = ((store as any).listActorAliases?.() ?? []).filter(inScope);
  const rows = ACTORS.map((actor) => actorCoverage(actor, captures, entities, sources, profiles, aliases, cutoff, generatedAt));
  return { schemaVersion: "ti.actor_coverage.v1", generatedAt, recentDays, dimensions: [...DIMENSIONS], actorCount: rows.length, rows };
}

function actorCoverage(actor: { id: string; name: string }, captures: any[], entities: any[], sources: any[], profiles: any[], aliases: any[], cutoff: number, generatedAt: string) {
  const terms = new Set([actor.name, ...aliasesFor(actor, profiles, aliases)]);
  const actorEntities = entities.filter((entity) => ACTOR_TYPES.has(String(entity.type).toLowerCase()) && containsTerm(entity.value ?? entity.normalizedValue, terms));
  const captureIds = new Set(actorEntities.map((entity) => entity.captureId).filter(Boolean).map(String));
  const actorProfiles = profiles.filter((profile) => containsTerm(profile.name ?? profile.canonicalName ?? profile.value ?? profile.actorName, terms) || JSON.stringify(profile).toLowerCase().includes(actor.name.toLowerCase()));
  for (const profile of actorProfiles) for (const captureId of profile.captureIds ?? []) captureIds.add(String(captureId));
  const matchingCaptures = captures.filter((capture) => captureIds.has(String(capture.id)) || containsTerm(`${capture.title ?? ""} ${capture.body ?? ""} ${capture.rawText ?? ""}`, terms));
  const matchingEntities = entities.filter((entity) => entity.captureId && captureIds.has(String(entity.captureId)));
  const sourceIds = new Set(matchingCaptures.map((capture) => capture.sourceId).filter(Boolean).map(String));
  const sourceReferences = [...sourceIds].map((sourceId) => { const source = sources.find((candidate) => candidate.id === sourceId); return { sourceId, name: source?.name ?? sourceId, url: source?.url }; });
  const values = (dimension: string) => unique(matchingEntities.filter((entity) => FIELD_TYPES[dimension]?.has(String(entity.type).toLowerCase())).map((entity) => String(entity.value ?? entity.normalizedValue ?? "").trim()).filter(Boolean));
  const latestCapture = matchingCaptures.filter((capture) => validDate(capture.collectedAt)).sort((left, right) => Date.parse(right.collectedAt) - Date.parse(left.collectedAt))[0];
  const recentCaptures = matchingCaptures.filter((capture) => validDate(capture.collectedAt) && Date.parse(capture.collectedAt) >= cutoff);
  const observed: Record<string, unknown> = {
    aliases: [...terms].filter((term) => term.toLowerCase() !== actor.name.toLowerCase()),
    sourceReferences,
    recentActivity: recentCaptures.length > 0,
    countries: values("countries"),
    sectors: values("sectors"),
    malwareTools: values("malwareTools"),
    attackTechniques: values("attackTechniques"),
    victims: values("victims"),
    sourceFreshness: latestCapture ? { lastCollectedAt: latestCapture.collectedAt, ageSeconds: Math.max(0, (Date.parse(generatedAt) - Date.parse(latestCapture.collectedAt)) / 1000) } : null
  };
  const coverage = Object.fromEntries(DIMENSIONS.map((dimension) => [dimension, dimensionCovered(dimension, observed[dimension])]));
  return { actorId: actor.id, name: actor.name, expectedDimensions: [...DIMENSIONS], coverage, observed, evidence: { captureCount: matchingCaptures.length, recentCaptureCount: recentCaptures.length, sourceCount: sourceIds.size, profileCount: actorProfiles.length, entityCount: matchingEntities.length } };
}

function aliasesFor(actor: { name: string }, profiles: any[], aliases: any[]) {
  return unique([
    ...profiles.filter((profile) => containsTerm(profile.name ?? profile.canonicalName ?? profile.value, new Set([actor.name]))).flatMap((profile) => Array.isArray(profile.aliases) ? profile.aliases : []),
    ...aliases.filter((alias) => containsTerm(JSON.stringify(alias), new Set([actor.name]))).flatMap((alias) => [alias.alias, alias.name, alias.value]).filter(Boolean).map(String)
  ]);
}

function dimensionCovered(dimension: string, value: unknown) {
  if (dimension === "recentActivity") return value === true;
  if (dimension === "sourceFreshness") return value !== null;
  return Array.isArray(value) && value.length > 0;
}
function containsTerm(value: unknown, terms: Set<string>) { const text = String(value ?? "").toLowerCase(); return [...terms].some((term) => term.trim().length > 1 && text.includes(term.toLowerCase())); }
function unique(values: string[]) { return [...new Set(values)]; }
function validDate(value: unknown) { return Number.isFinite(Date.parse(String(value ?? ""))); }
