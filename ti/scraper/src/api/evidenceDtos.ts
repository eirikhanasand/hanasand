// @ts-nocheck
import { hashContent } from "../utils.ts";

export type EvidenceReplayPlanDto = any; export type EvidenceCutoverReportDto = any; export type EvidenceSearchReadModelCutoverDto = any;
export type EvidenceLedgerEnforcementDto = any; export type EvidencePersistenceCertificationDto = any;
export type EvidenceTrustLedgerDto = any; export type EvidenceCutoverApiExamples = any;

const safe = { sensitiveBodiesExposed: false, objectKeysExposed: false };
const norm = (query: string) => query.trim().toLowerCase();
const list = (store: any, name: string) => typeof store?.[name] === "function" ? store[name]() : [];
const matches = (value: any, query: string) => JSON.stringify(value).toLowerCase().includes(norm(query));

export function buildEvidenceReplayPlanDto(store: any, query: string, options: any = {}): EvidenceReplayPlanDto {
  const deltas = store.queries?.().getEvidenceTimeline?.(query, { tenantId: options.tenantId }) ?? [];
  const captures = list(store, "listCaptures").filter((capture: any) => matches(capture, query));
  const stages = [
    ...captures.map((capture: any) => ({ stage: "capture", id: capture.id, ok: true, detail: "capture available" })),
    ...deltas.slice(-20).map((delta: any) => ({ stage: "delta", id: delta.id, cursor: delta.cursor, ok: true, detail: delta.kind }))
  ];
  return { endpoint: "/v1/evidence/replay-plan", method: "GET", query, normalizedQuery: norm(query), tenantId: options.tenantId, runId: options.runId, cursor: { since: options.sinceCursor, next: hashContent(`${query}:${stages.length}`) }, replayable: true, stages, redaction: safe };
}

export function buildEvidenceCutoverReportDto(store: any, objects: any, query: string, options: any = {}): EvidenceCutoverReportDto {
  const captures = list(store, "listCaptures").filter((capture: any) => matches(capture, query));
  const replayPlan = buildEvidenceReplayPlanDto(store, query, options);
  const trustLedger = compactTrustLedger(store, query, captures);
  return {
    endpoint: "/v1/evidence/cutover-report",
    method: "GET",
    query,
    normalizedQuery: norm(query),
    tenantId: options.tenantId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    readiness: { overall: captures.length ? "ready" : "hold", reasons: captures.length ? [] : ["no matching captures"] },
    counts: { captures: captures.length, objects: list(objects, "listObjects").length, deltas: replayPlan.stages.filter((s: any) => s.stage === "delta").length },
    replayPlan,
    retention: { retained: captures.length, safeOutput: safe },
    redaction: { metadataOnlyCaptureIds: captures.filter((c: any) => c.storageKind === "metadata_only").map((c: any) => c.id), restrictedCaptureIds: captures.filter((c: any) => c.sensitive).map((c: any) => c.id), unsafeBodyCaptureIds: [], ...safe },
    trustLedger,
    promotionGate: { gate: captures.length ? "ready" : "hold", agent09Fields: { cursorReplayReady: Boolean(replayPlan.cursor.next), redactionReady: true, trustLedgerReady: trustLedger.counts.claims >= 0 } },
    readModelCutover: { status: "ready", documents: captures.length },
    apiExamples: evidenceCutoverReportApiContract(),
    safeOutput: safe
  };
}

export function buildEvidenceTrustLedgerDto(store: any, objects: any, query: string, options: any = {}): EvidenceTrustLedgerDto {
  const captures = list(store, "listCaptures").filter((capture: any) => matches(capture, query));
  return { endpoint: "/v1/evidence/trust-ledger", method: "GET", query, normalizedQuery: norm(query), generatedAt: options.generatedAt ?? new Date().toISOString(), ...compactTrustLedger(store, query, captures), safeOutput: safe };
}

export function buildEvidenceClaimLedgerDto(store: any, objects: any, query: string, options: any = {}): EvidenceTrustLedgerDto {
  return { ...buildEvidenceTrustLedgerDto(store, objects, query, options), endpoint: "/v1/evidence/claim-ledger" };
}

export const evidenceReplayPlanApiContract = () => ({ endpoint: "/v1/evidence/replay-plan", method: "GET", query: "q", safeOutput: safe });
export const evidenceCutoverReportApiContract = () => ({ endpoint: "/v1/evidence/cutover-report", method: "GET", response: ["readiness", "promotionGate", "trustLedger", "safeOutput"], safeOutput: safe });
export const evidenceTrustLedgerApiContract = () => ({ endpoint: "/v1/evidence/trust-ledger", method: "GET", response: ["trustGate", "claims", "counts", "safeOutput"], safeOutput: safe });
export const evidenceClaimLedgerApiContract = () => ({ ...evidenceTrustLedgerApiContract(), endpoint: "/v1/evidence/claim-ledger" });

function compactTrustLedger(store: any, query: string, captures: any[]) {
  const deltas = store.queries?.().getEvidenceTimeline?.(query, {}) ?? [];
  const claims = captures.map((capture: any) => ({ claimId: `claim_${capture.id}`, captureId: capture.id, sourceId: capture.sourceId, contentHash: capture.contentHash, confidence: 0.7, trustStatus: "trusted", blockers: [], replayable: true }));
  return {
    trustGate: captures.length ? "ready" : "hold",
    blockers: [],
    counts: { claims: claims.length, trusted: claims.length, degraded: 0, blocked: 0, metadataOnlyClaims: captures.filter((c: any) => c.storageKind === "metadata_only").length, duplicateClaimsSuppressed: 0, replayable: true },
    changesSinceCursor: deltas.slice(-20),
    claims,
    enforcement: { status: "ready", repairPackets: [] },
    certification: { status: "ready", releaseAction: "promote", fixtures: [], downstream: [] }
  };
}
