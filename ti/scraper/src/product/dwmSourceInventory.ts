import { hashContent, nowIso } from "../utils.ts";
import type { RawCapture, SourceRecord } from "../types.ts";
import { isExecutableSource } from "../policy/collectionPolicy.ts";

export type DwmInventoryFamily = "telegram_public" | "darkweb_metadata" | "public_advisory" | "clear_web";

export interface DwmSourcePackDefinition {
  id: string;
  label: string;
  family: DwmInventoryFamily;
  priority: "critical" | "high" | "medium";
  description: string;
  seedCount: number;
  safetyBoundary: string;
}

export interface DwmSourceReviewItem {
  id: string;
  candidateId: string;
  packId: string;
  family: DwmInventoryFamily;
  sourceName: string;
  reviewState: string;
  score: number;
  nextAction: string;
  duplicateOf?: string;
  safetyBoundary: string;
}

export interface DwmSourceInventorySnapshot {
  schemaVersion: "dwm.source_inventory.v1";
  generatedAt: string;
  tenantId: string;
  counts: {
    registeredTotal: number;
    registeredTelegramPublic: number;
    registeredDarkwebMetadata: number;
    registeredActiveOrCanary: number;
    catalogTotalCandidates: number;
    catalogTelegramPublic: number;
    catalogDarkwebMetadata: number;
    catalogPublicAdvisory: number;
    netNewCandidates: number;
    duplicateCandidates: number;
    reviewQueue: number;
  };
  packs: DwmSourcePackDefinition[];
  reviewQueue: DwmSourceReviewItem[];
  reportingHooks: {
    productSnapshotRoute: string;
    sourceInventoryRoute: string;
    sourceRequestRoute: string;
    webhookEvent: string;
    uiCounters: string[];
  };
}

export interface BuildDwmSourceInventoryInput {
  tenantId?: string;
  watchlist?: string[];
  sources?: SourceRecord[];
  captures?: RawCapture[];
  generatedAt?: string;
  includeCandidates?: boolean;
}

export function buildDwmSourceInventory(input: BuildDwmSourceInventoryInput = {}): DwmSourceInventorySnapshot {
  const sources = (input.sources ?? []).filter((source) => input.tenantId === undefined || !source.tenantId || source.tenantId === input.tenantId);
  return {
    schemaVersion: "dwm.source_inventory.v1",
    generatedAt: input.generatedAt ?? nowIso(),
    tenantId: input.tenantId ?? "default",
    counts: {
      registeredTotal: sources.length,
      registeredTelegramPublic: sources.filter((source) => familyForSource(source) === "telegram_public").length,
      registeredDarkwebMetadata: sources.filter((source) => familyForSource(source) === "darkweb_metadata").length,
      registeredActiveOrCanary: sources.filter(isExecutableSource).length,
      catalogTotalCandidates: 0,
      catalogTelegramPublic: 0,
      catalogDarkwebMetadata: 0,
      catalogPublicAdvisory: 0,
      netNewCandidates: 0,
      duplicateCandidates: 0,
      reviewQueue: 0
    },
    packs: [],
    reviewQueue: [],
    reportingHooks: {
      productSnapshotRoute: "/v1/dwm/product",
      sourceInventoryRoute: "/v1/dwm/source-inventory",
      sourceRequestRoute: "/v1/dwm/source-requests",
      webhookEvent: "darkweb.monitoring.match",
      uiCounters: ["registeredTelegramPublic", "registeredDarkwebMetadata", "registeredActiveOrCanary"]
    }
  };
}

export function familyForSource(source: SourceRecord): DwmInventoryFamily | "unknown" {
  const type = String(source.type ?? "").toLowerCase();
  const url = String(source.url ?? "").toLowerCase();
  if (type.includes("telegram") || /(?:^|\/\/)t\.me\//.test(url)) return "telegram_public";
  if (type.includes("darkweb") || type.includes("darknet") || type.includes("tor") || url.includes(".onion")) return "darkweb_metadata";
  if (type.includes("advisory") || type.includes("cert") || type.includes("cve")) return "public_advisory";
  if (url.startsWith("http://") || url.startsWith("https://")) return "clear_web";
  return "unknown";
}

export function sourceDedupeKey(source: SourceRecord): string {
  const family = familyForSource(source);
  const url = String(source.url ?? "").trim().toLowerCase().replace(/\/+$/, "");
  const telegram = url.match(/(?:https?:\/\/)?t\.me\/(?:s\/)?([a-z0-9_]+)/i)?.[1];
  return telegram ? `telegram_public:${telegram.toLowerCase()}` : `${family}:${url || String(source.id ?? source.name ?? "").toLowerCase()}`;
}

export function sourceInventoryDigest(snapshot: DwmSourceInventorySnapshot): string {
  return hashContent(JSON.stringify(snapshot.counts));
}
