import {
  buildEvidenceAssessment,
  buildEvidenceTrustLedgerDto,
  EVIDENCE_SAFE_OUTPUT
} from "./evidenceTrustDtos.ts";

export {
  buildEvidenceClaimLedgerDto,
  buildEvidenceTrustLedgerDto,
  evidenceClaimLedgerApiContract,
  evidenceTrustLedgerApiContract
} from "./evidenceTrustDtos.ts";

export interface EvidenceReplayPlanDto {
  endpoint: string;
  method: "GET";
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  runId?: string;
  cursor: { since?: string; next?: string };
  replayable: boolean;
  stages: Array<Record<string, unknown>>;
  redaction: typeof EVIDENCE_SAFE_OUTPUT;
}

export interface EvidenceCutoverReportDto {
  endpoint: string;
  method: "GET";
  query: string;
  normalizedQuery: string;
  tenantId?: string;
  runId?: string;
  generatedAt: string;
  readiness: { agent09: string; agent10: string; graph: string; overall: string; reasons: string[] };
  counts: Record<string, number>;
  replayPlan: EvidenceReplayPlanDto;
  retention: Record<string, unknown>;
  redaction: Record<string, unknown>;
  trustLedger: Record<string, unknown>;
  promotionGate: {
    gate: string;
    blockers: string[];
    agent09Fields: Record<string, unknown>;
    agent10Fields: Record<string, unknown>;
  };
  exportBlockers: Array<{ id: string; reason: string }>;
  readModelCutover: Record<string, unknown>;
  apiExamples: Record<string, unknown>;
  safeOutput: typeof EVIDENCE_SAFE_OUTPUT;
}
export type EvidenceSearchReadModelCutoverDto = Record<string, unknown>;
export type EvidenceLedgerEnforcementDto = Record<string, unknown>;
export type EvidencePersistenceCertificationDto = Record<string, unknown>;
export type EvidenceTrustLedgerDto = Record<string, unknown>;
export type EvidenceCutoverApiExamples = Record<string, unknown>;

const normalize = (query: string) => query.trim().toLowerCase().replace(/\s+/g, " ");

export function buildEvidenceReplayPlanDto(store: any, query: string, options: any = {}): EvidenceReplayPlanDto {
  const assessment = buildEvidenceAssessment(store, undefined, query, options);
  const deltas = assessment.deltas
    .filter((delta) => !options.sinceCursor || String(delta.cursor ?? "") > options.sinceCursor)
    .sort((left, right) => String(left.cursor ?? "").localeCompare(String(right.cursor ?? "")));
  const stages = [
    ...assessment.captures.map((capture) => ({ stage: "capture", id: capture.id, ok: !capture.objectRef, detail: capture.objectRef ? "object integrity checked during cutover" : "capture available" })),
    ...assessment.incidents.map((incident) => ({ stage: "claim", id: incident.id, captureId: incident.captureId, ok: true, detail: "extraction linked" })),
    ...deltas.slice(-20).map((delta) => ({ stage: "delta", id: delta.id, cursor: delta.cursor, kind: delta.kind, ok: true, detail: delta.subjectType }))
  ];
  return {
    endpoint: "/v1/evidence/replay-plan",
    method: "GET",
    query,
    normalizedQuery: normalize(query),
    tenantId: options.tenantId,
    runId: options.runId,
    cursor: { since: options.sinceCursor, next: deltas.at(-1)?.cursor },
    replayable: assessment.captures.length > 0,
    stages,
    redaction: EVIDENCE_SAFE_OUTPUT
  };
}

export function buildEvidenceCutoverReportDto(store: any, objects: any, query: string, options: any = {}): EvidenceCutoverReportDto {
  const assessment = buildEvidenceAssessment(store, objects, query, options);
  const replayPlan = buildEvidenceReplayPlanDto(store, query, options) as any;
  const trustLedger = buildEvidenceTrustLedgerDto(store, objects, query, options);
  const cursorReplayReady = Boolean(replayPlan.replayable && replayPlan.cursor?.next);
  const blockers = [...assessment.blockers, ...(cursorReplayReady ? [] : ["cursor_replay_unavailable"])];
  const overall = assessment.overall === "ready" && !cursorReplayReady ? "hold" : assessment.overall;
  return {
    endpoint: "/v1/evidence/cutover-report",
    method: "GET",
    query,
    normalizedQuery: normalize(query),
    tenantId: options.tenantId,
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    readiness: {
      agent09: assessment.agent09,
      agent10: assessment.agent10,
      graph: assessment.graph,
      overall,
      reasons: blockers
    },
    counts: {
      captures: assessment.captures.length,
      incidents: assessment.incidents.length,
      snapshots: assessment.snapshots.length,
      deltas: assessment.deltas.length,
      staleSnapshots: assessment.staleSnapshotIds.length,
      missingObjects: assessment.missingObjectCaptureIds.length,
      metadataOnlyCaptures: assessment.metadataOnlyCaptureIds.length
    },
    replayPlan,
    retention: { retained: assessment.captures.length, metadataOnly: assessment.metadataOnlyCaptureIds.length, safeOutput: EVIDENCE_SAFE_OUTPUT },
    redaction: {
      metadataOnlyCaptureIds: assessment.metadataOnlyCaptureIds,
      restrictedCaptureIds: assessment.metadataOnlyCaptureIds,
      unsafeBodyCaptureIds: [],
      ...EVIDENCE_SAFE_OUTPUT
    },
    trustLedger,
    promotionGate: {
      gate: overall,
      blockers,
      agent09Fields: {
        cursorReplayReady,
        staleSnapshotCount: assessment.staleSnapshotIds.length,
        redactionReady: true,
        trustLedgerReady: (trustLedger as any).counts?.blocked === 0
      },
      agent10Fields: {
        objectIntegrityReady: assessment.missingObjectCaptureIds.length === 0,
        missingObjectCount: assessment.missingObjectCaptureIds.length
      }
    },
    exportBlockers: assessment.exportBlockers,
    readModelCutover: { status: overall === "ready" ? "ready" : "hold", documents: assessment.captures.length },
    apiExamples: evidenceCutoverReportApiContract(),
    safeOutput: EVIDENCE_SAFE_OUTPUT
  };
}

export const evidenceReplayPlanApiContract = () => ({
  endpoint: "/v1/evidence/replay-plan",
  method: "GET",
  query: ["q", "tenantId", "runId", "sinceCursor"],
  response: ["replayable", "cursor", "stages", "redaction"],
  safeOutput: EVIDENCE_SAFE_OUTPUT
});

export const evidenceCutoverReportApiContract = () => ({
  endpoint: "/v1/evidence/cutover-report",
  method: "GET",
  query: ["q", "tenantId", "runId", "generatedAt"],
  response: ["readiness", "promotionGate", "trustLedger", "exportBlockers", "safeOutput"],
  safeOutput: EVIDENCE_SAFE_OUTPUT
});
