import type { EvidenceStage, TiConfidenceCaveatCode } from "./intelligenceProfiles.ts";

export type ExtractionQualityNoteCode = "low_evidence_count" | "alias_collision" | "stale_source" | "contradicted_attribution" | "weak_victim_claim" | "extracted_ttp_needs_review" | "source_family_bias";
export type SearchQualityStatus = "ready" | "partial" | "weak-evidence" | "needs-review" | "contradicted" | "stale" | "source-biased" | "insufficient-capture";
export type GraphReviewState = "accepted" | "proposed" | "needs-human-review" | "contradiction" | "stale" | "rejected" | "downgraded" | "superseded";
export type SearchQualityApplyActionKind = "analyst_review" | "lower_confidence" | "request_more_capture_evidence" | "suppress_noisy_alias" | "mark_contradiction" | "expire_stale_claim" | "promote_quality_status";
export type SearchQualityPublicWarningCode = SearchQualityStatus | ExtractionQualityNoteCode | TiConfidenceCaveatCode | "alias_collision_warning";
export type SearchQualityDashboardField = "actor_summary" | "aliases" | "recent_activity" | "targets" | "sectors" | "countries" | "tools_malware" | "cves" | "ttps" | "campaigns" | "infrastructure" | "datasets" | "victim_company_claims" | "iocs" | "confidence" | "freshness" | "provenance";
export type SearchQualityDashboardGate = "pass" | "warn" | "hold" | "missing";

export interface AnalystCaveatPack { actor: string; summary: string; caveats: string[]; reviewFocus: string[]; }
export interface SearchQualityGateInput { dto: any; calibration?: any; graphReviewState?: GraphReviewState; }
export interface SearchQualityGateResult { status: SearchQualityStatus; supportingStatuses: SearchQualityStatus[]; score: number; reasons: string[]; caveatCodes: TiConfidenceCaveatCode[]; qualityNoteCodes: ExtractionQualityNoteCode[]; caveatPack: AnalystCaveatPack; apiWarnings: Array<{ code: SearchQualityPublicWarningCode; message: string; severity: "info" | "warning" | "critical" }>; }
export interface SearchQualityApplyActionDto { kind: SearchQualityApplyActionKind; label: string; prerequisites: string[]; evidenceIds: string[]; expectedApiEffect: string; graphEffect: string; rollback: string; manualOnly: boolean; }
export interface SearchQualityApplyPlanDto { query: string; currentStatus: SearchQualityStatus; targetStatus: SearchQualityStatus; canPromoteToReady: boolean; actions: SearchQualityApplyActionDto[]; }
export interface SearchQualityAnalystActionSummaryDto { kind: SearchQualityApplyActionKind; label: string; manualOnly: boolean; evidenceIds: string[]; }
export interface SearchQualityApiDto { status: SearchQualityStatus; score: number; caveatCodes: TiConfidenceCaveatCode[]; qualityNoteCodes: ExtractionQualityNoteCode[]; evidenceStageCounts: Record<EvidenceStage, number>; analystActions: SearchQualityAnalystActionSummaryDto[]; canPromoteToReady: boolean; publicWarningText: string[]; publicWarningCodes: SearchQualityPublicWarningCode[]; }
export interface SearchQualityFieldGateDto { field: SearchQualityDashboardField; gate: SearchQualityDashboardGate; confidence: number; evidenceCount: number; citationCount: number; freshnessScore: number; reasons: string[]; feedbackTargets: Array<"source_activation" | "parser_repair" | "graph_review" | "analyst_review" | "public_answer_hold">; }
export interface SearchQualityDashboardDto { schemaVersion: "ti.search_quality_dashboard.v1"; query: string; generatedAt: string; status: SearchQualityStatus; score: number; metrics: Record<string, number | string>; releaseGate: { decision: "promote" | "partial" | "hold"; reasons: string[] }; fields: SearchQualityFieldGateDto[]; reviewQueues: Record<string, string[]>; }
export interface SearchQualityApiExampleDto { name: string; query: string; quality: SearchQualityApiDto; dashboard: SearchQualityDashboardDto; }
