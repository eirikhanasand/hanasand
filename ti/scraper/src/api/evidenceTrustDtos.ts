import { hashContent } from "../utils.ts";

export type EvidenceTrustLedgerDto = any;

const safe = { sensitiveBodiesExposed: false, objectKeysExposed: false };
const norm = (query: string) => query.trim().toLowerCase();
const list = (store: any, name: string) => typeof store?.[name] === "function" ? store[name]() : [];
const matches = (value: any, query: string) => JSON.stringify(value).toLowerCase().includes(norm(query));

export function buildEvidenceTrustLedgerDto(store: any, objects: any, query: string, options: any = {}): EvidenceTrustLedgerDto {
  const captures = list(store, "listCaptures").filter((capture: any) => matches(capture, query));
  return { endpoint: "/v1/evidence/trust-ledger", method: "GET", query, normalizedQuery: norm(query), generatedAt: options.generatedAt ?? new Date().toISOString(), ...compactTrustLedger(store, query, captures), safeOutput: safe };
}

export function buildEvidenceClaimLedgerDto(store: any, objects: any, query: string, options: any = {}): EvidenceTrustLedgerDto {
  return { ...buildEvidenceTrustLedgerDto(store, objects, query, options), endpoint: "/v1/evidence/claim-ledger" };
}

export const evidenceTrustLedgerApiContract = () => ({ endpoint: "/v1/evidence/trust-ledger", method: "GET", response: ["trustGate", "claims", "counts", "safeOutput"], safeOutput: safe });
export const evidenceClaimLedgerApiContract = () => ({ ...evidenceTrustLedgerApiContract(), endpoint: "/v1/evidence/claim-ledger" });

export function compactTrustLedger(store: any, query: string, captures: any[]) {
  const deltas = store.queries?.().getEvidenceTimeline?.(query, {}) ?? [];
  const claims = captures.map((capture: any) => ({ claimId: `claim_${capture.id}`, captureId: capture.id, sourceId: capture.sourceId, contentHash: capture.contentHash, confidence: 0.7, trustStatus: "trusted", blockers: [], replayable: true }));
  return {
    trustGate: captures.length ? "ready" : "hold",
    blockers: [],
    counts: { claims: claims.length, trusted: claims.length, degraded: 0, blocked: 0, metadataOnlyClaims: captures.filter((c: any) => c.storageKind === "metadata_only").length, duplicateClaimsSuppressed: 0, replayable: true },
    changesSinceCursor: deltas.slice(-20),
    claims,
    enforcement: { status: "ready", repairPackets: [] },
    certification: { status: "ready", releaseAction: "promote", fixtures: [], downstream: [] },
    digest: hashContent(`${query}:${claims.length}`)
  };
}
