import { canonicalFeedKey } from "../registry/sourceSeedUtils.ts";
import { seedDuplicateKey } from "../registry/sourceSeeds.ts";
import { stableId } from "../utils.ts";

const WEEK_MS = 7 * 86_400_000;

export type TorMetadataCandidate = {
  actorName: string;
  url: string;
  authorityCheckedAt: string;
  authoritySourceId: string;
};

export function torMetadataCandidates(groupsBody: string, retrievedAt: string, authoritySourceId: string): TorMetadataCandidate[] {
  let groups: unknown;
  try { groups = JSON.parse(groupsBody); } catch { return []; }
  if (!Array.isArray(groups)) return [];
  const now = Date.parse(retrievedAt);
  const candidates = new Map<string, TorMetadataCandidate>();
  for (const group of groups) {
    const actorName = text(group?.name).slice(0, 160);
    if (actorName.length < 2) continue;
    for (const location of Array.isArray(group?.locations) ? group.locations : []) {
      const checkedAt = text(location?.lastscrape || location?.http?.fetched_at || location?.updated);
      const checked = Date.parse(checkedAt);
      const status = Number(location?.http?.status);
      const host = onionHost(location?.fqdn || location?.slug);
      if (!host || location?.enabled !== true || location?.available !== true || status < 200 || status >= 400
        || !Number.isFinite(checked) || checked > now || now - checked > WEEK_MS) continue;
      const url = `http://${host}/`;
      if (!candidates.has(host)) candidates.set(host, { actorName, url, authorityCheckedAt: new Date(checked).toISOString(), authoritySourceId });
    }
  }
  return [...candidates.values()].sort((left, right) => left.actorName.localeCompare(right.actorName) || left.url.localeCompare(right.url));
}

export function admitTorMetadataCandidates(store: any, candidates: TorMetadataCandidate[], discoveredAt: string) {
  let imported = 0;
  const existingKeys = new Set(store.listSources().map((source: any) => seedDuplicateKey(source)));
  for (const candidate of candidates) {
    const key = canonicalFeedKey(candidate.url);
    if (existingKeys.has(key)) continue;
    store.saveSource({
      id: stableId("src", key),
      name: `${candidate.actorName} public Tor metadata`,
      type: "tor_metadata",
      url: candidate.url,
      accessMethod: "approved_proxy",
      status: "candidate",
      risk: "restricted",
      trustScore: 0.65,
      crawlFrequencySeconds: 3_600,
      countsAsCoverage: false,
      legalNotes: "Public actor publication metadata discovered through the Ransomware.live authority. Metadata only: no login, interaction, payment, payload, credential, or leaked-file access.",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: true,
        approvedAt: discoveredAt,
        approvedBy: "scheduled-ransomwarelive-metadata-discovery"
      },
      metadata: {
        sourceFamily: "lawful_dark_web",
        actorName: candidate.actorName,
        restrictedMetadataCandidate: true,
        productionCollection: false,
        countsAsCoverage: false,
        torMetadataAuthorityDiscovery: {
          authoritySourceId: candidate.authoritySourceId,
          checkedAt: candidate.authorityCheckedAt,
          discoveredAt
        }
      },
      createdAt: discoveredAt,
      updatedAt: discoveredAt
    });
    existingKeys.add(key);
    imported++;
  }
  return imported;
}

export function currentTorMetadataAuthorityDiscovery(source: any, generatedAt: string) {
  const proof = source.metadata?.torMetadataAuthorityDiscovery;
  const checked = Date.parse(String(proof?.checkedAt ?? ""));
  const now = Date.parse(generatedAt);
  return typeof proof?.authoritySourceId === "string" && proof.authoritySourceId.length > 0
    && Number.isFinite(checked) && Number.isFinite(now) && checked <= now && now - checked <= WEEK_MS;
}

function onionHost(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const host = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`).hostname.toLowerCase();
    return /^[a-z2-7]{56}\.onion$/.test(host) ? host : "";
  } catch {
    return "";
  }
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
