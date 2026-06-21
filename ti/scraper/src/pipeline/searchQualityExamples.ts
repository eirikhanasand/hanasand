// @ts-nocheck
import type { EvidenceStage } from "./intelligenceProfiles.ts";
import type { SearchQualityApiExampleDto, SearchQualityGateResult, SearchQualityStatus } from "./searchQualityTypes.ts";
import { analystCaveatPackFor } from "./searchQualityPacks.ts";
import { buildSearchQualityApiDto } from "./searchQualityGate.ts";
import { buildSearchQualityDashboardDto } from "./searchQualityDashboard.ts";
import { reason } from "./searchQualityReasons.ts";

export function searchQualityApiExamples(): SearchQualityApiExampleDto[] {
  return ["ready", "partial", "weak-evidence", "contradicted", "stale", "source-biased", "insufficient-capture", "needs-review"].map((status) => example(status as SearchQualityStatus));
}

function example(status: SearchQualityStatus): SearchQualityApiExampleDto {
  const counts = zeroCounts(); counts[status === "ready" ? "captured_page" : "live_discovery"] = 1;
  const dto = { query: status, actor: status, summaryBullets: ["example"], aliases: [], recentActivity: { freshnessScore: 0.7, notes: ["example"] }, targets: { victims: [], sectors: [], regions: [] }, campaigns: [], ttps: [], infrastructure: [], malwareTools: [], vulnerabilities: [], datasets: { coverage: ["example"], sourceCount: 1, indicatorCount: 1, entityCount: 1, evidenceStageCounts: counts }, caveats: [], confidence: status === "ready" ? 0.86 : 0.46, provenance: [{ evidenceId: `example-${status}`, ledgerIds: ["ledger"], sourceId: "example_source", captureId: "cap", evidenceStage: "captured_page", grounding: [], confidence: 0.7 }], profileDeltas: [], falsePositiveControls: [], readiness: { fields: {}, sourceFamilyCount: 1, evidenceStageCounts: counts }, needsAnalystReview: status === "needs-review" };
  const gate: SearchQualityGateResult = { status, supportingStatuses: [status], score: dto.confidence, reasons: [reason(status)], caveatCodes: [], qualityNoteCodes: [], caveatPack: analystCaveatPackFor(status), apiWarnings: status === "ready" ? [] : [{ code: status, message: reason(status), severity: status === "contradicted" ? "critical" : "warning" }] };
  return { name: `${status} example`, query: status, quality: buildSearchQualityApiDto(dto, gate), dashboard: buildSearchQualityDashboardDto(dto, gate, "2026-05-24T00:00:00.000Z") };
}

function zeroCounts(): Record<EvidenceStage, number> {
  return { seeded: 0, live_discovery: 0, public_channel_message: 0, metadata_only_claim: 0, captured_page: 0, extracted_relationship: 0, reviewed_promoted: 0 };
}
