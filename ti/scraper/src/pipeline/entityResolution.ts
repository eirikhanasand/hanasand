import type { ExtractedEntity, ExtractionProvenance, Indicator } from "../types.ts";
import { clampScore, normalizeWhitespace, stableId } from "../utils.ts";
import { ACTOR_ALIAS_RECORDS, actorAliasesFor } from "./actorAliases.ts";
import type { EvidenceStage, StagedEvidenceInput } from "./intelligenceProfiles.ts";

export type EntityResolutionKind =
  | "actor_alias"
  | "ransomware_rebrand"
  | "victim_company"
  | "country"
  | "sector"
  | "malware_tool"
  | "cve"
  | "infrastructure";

export type EntityResolutionReviewState = "accepted" | "proposed" | "review_required" | "held";

export type EntityResolutionCorrectionAction =
  | "accept_merge"
  | "split_entity"
  | "set_canonical"
  | "suppress_alias"
  | "request_more_evidence"
  | "send_to_graph_review";

export interface EntityResolutionProvenanceDto {
  evidenceId: string;
  sourceId: string;
  captureId: string;
  collectedAt: string;
  evidenceStage: EvidenceStage;
  extractorVersion?: string;
  confidence: number;
}

export interface EntityResolutionCandidateDto {
  id: string;
  kind: EntityResolutionKind;
  canonicalValue: string;
  observedValues: string[];
  normalizedKey: string;
  confidence: number;
  reviewState: EntityResolutionReviewState;
  confidenceReasons: string[];
  uncertaintyReasons: string[];
  correctionActions: EntityResolutionCorrectionAction[];
  evidenceIds: string[];
  sourceIds: string[];
  provenance: EntityResolutionProvenanceDto[];
}

export interface EntityResolutionWorkbenchDto {
  schemaVersion: "ti.entity_resolution_workbench.v1";
  query: string;
  generatedAt: string;
  summary: {
    candidateCount: number;
    acceptedCount: number;
    proposedCount: number;
    reviewRequiredCount: number;
    heldCount: number;
    sourceFamilyCount: number;
  };
  candidates: EntityResolutionCandidateDto[];
  reviewQueues: {
    aliasCollisions: string[];
    weakMerges: string[];
    victimClaims: string[];
    cveMentions: string[];
    infrastructure: string[];
    graphReview: string[];
  };
  safety: {
    rawEvidenceExposed: false;
    restrictedPayloadsExposed: false;
    preservesUncertainty: true;
  };
}

type CandidateDraft = Omit<EntityResolutionCandidateDto, "id" | "reviewState" | "confidenceReasons" | "uncertaintyReasons" | "correctionActions"> & {
  confidences: number[];
  reviewReasons: string[];
};

const RANSOMWARE_FAMILIES = new Set(["akira", "lockbit", "clop", "alphv", "blackcat", "black cat"]);
const MALWARE_CANONICAL: Record<string, string> = {
  "cobalt strike": "Cobalt Strike",
  emotet: "Emotet",
  trickbot: "TrickBot",
  qakbot: "QakBot",
  plugx: "PlugX",
  sliver: "Sliver",
  carbanak: "Carbanak",
  mimikatz: "Mimikatz",
  icedid: "IcedID",
  rclone: "Rclone",
  anydesk: "AnyDesk",
  snake: "Snake",
  powgoop: "POWGOOP",
  wellmess: "WellMess"
};

export function buildEntityResolutionWorkbenchDto(input: {
  query: string;
  evidence: StagedEvidenceInput[];
  generatedAt?: string;
}): EntityResolutionWorkbenchDto {
  const drafts = new Map<string, CandidateDraft>();

  for (const evidence of input.evidence) {
    for (const entity of evidence.result.entities) {
      addEntityDraft(drafts, evidence, entity);
    }
    for (const indicator of evidence.result.indicators) {
      addIndicatorDraft(drafts, evidence, indicator);
    }
  }

  const candidates = [...drafts.values()]
    .map(finalizeCandidate)
    .sort((a, b) => reviewRank(a.reviewState) - reviewRank(b.reviewState) || b.confidence - a.confidence || a.kind.localeCompare(b.kind))
    .slice(0, 80);

  return {
    schemaVersion: "ti.entity_resolution_workbench.v1",
    query: input.query,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    summary: {
      candidateCount: candidates.length,
      acceptedCount: candidates.filter((candidate) => candidate.reviewState === "accepted").length,
      proposedCount: candidates.filter((candidate) => candidate.reviewState === "proposed").length,
      reviewRequiredCount: candidates.filter((candidate) => candidate.reviewState === "review_required").length,
      heldCount: candidates.filter((candidate) => candidate.reviewState === "held").length,
      sourceFamilyCount: new Set(input.evidence.map((item) => item.result.capture.sourceId)).size
    },
    candidates,
    reviewQueues: {
      aliasCollisions: queue(candidates, /alias collision|ambiguous alias/i),
      weakMerges: queue(candidates, /single-source|weak|low confidence|needs corroboration/i),
      victimClaims: candidates.filter((candidate) => candidate.kind === "victim_company" && candidate.reviewState !== "accepted").map((candidate) => candidate.id),
      cveMentions: candidates.filter((candidate) => candidate.kind === "cve" && candidate.reviewState !== "accepted").map((candidate) => candidate.id),
      infrastructure: candidates.filter((candidate) => candidate.kind === "infrastructure" && candidate.reviewState !== "accepted").map((candidate) => candidate.id),
      graphReview: candidates.filter((candidate) => candidate.correctionActions.includes("send_to_graph_review")).map((candidate) => candidate.id)
    },
    safety: {
      rawEvidenceExposed: false,
      restrictedPayloadsExposed: false,
      preservesUncertainty: true
    }
  };
}

function addEntityDraft(drafts: Map<string, CandidateDraft>, evidence: StagedEvidenceInput, entity: ExtractedEntity): void {
  const kind = entityKind(entity);
  if (!kind) return;
  const canonicalValue = canonicalEntityValue(entity, kind);
  if (!canonicalValue) return;
  const observedValues = [entity.rawValue, entity.value, entity.normalizedValue, ...(entity.aliases ?? [])].filter((value): value is string => Boolean(value));
  addDraft(drafts, {
    kind,
    canonicalValue,
    observedValues,
    confidence: entity.confidence,
    reviewReasons: entity.reviewReasons ?? [],
    provenance: provenanceFor(evidence, entity.provenance, entity.confidence)
  });

  if (kind === "actor_alias" && isRansomwareActor(canonicalValue)) {
    addDraft(drafts, {
      kind: "ransomware_rebrand",
      canonicalValue,
      observedValues: mergeStrings([...observedValues, ...actorAliasesFor(canonicalValue)]),
      confidence: Math.min(entity.confidence, 0.78),
      reviewReasons: ["ransomware actor/rebrand requires alias review before merge"],
      provenance: provenanceFor(evidence, entity.provenance, entity.confidence)
    });
  }
}

function addIndicatorDraft(drafts: Map<string, CandidateDraft>, evidence: StagedEvidenceInput, indicator: Indicator): void {
  const kind: EntityResolutionKind = indicator.type === "cve" ? "cve" : "infrastructure";
  const canonicalValue = indicator.type === "cve" ? indicator.value.toUpperCase() : normalizeIndicatorValue(indicator);
  addDraft(drafts, {
    kind,
    canonicalValue,
    observedValues: [indicator.rawValue, indicator.value, indicator.normalizedValue].filter((value): value is string => Boolean(value)),
    confidence: indicator.confidence,
    reviewReasons: indicator.reviewReasons ?? [],
    provenance: provenanceFor(evidence, indicator.provenance, indicator.confidence)
  });
}

function addDraft(
  drafts: Map<string, CandidateDraft>,
  input: {
    kind: EntityResolutionKind;
    canonicalValue: string;
    observedValues: string[];
    confidence: number;
    reviewReasons: string[];
    provenance: EntityResolutionProvenanceDto[];
  }
): void {
  const normalizedKey = `${input.kind}:${normalizeKey(input.canonicalValue)}`;
  const existing = drafts.get(normalizedKey);
  if (!existing) {
    drafts.set(normalizedKey, {
      kind: input.kind,
      canonicalValue: input.canonicalValue,
      observedValues: mergeStrings(input.observedValues),
      normalizedKey,
      confidence: input.confidence,
      confidences: [input.confidence],
      reviewReasons: input.reviewReasons,
      evidenceIds: mergeStrings(input.provenance.map((item) => item.evidenceId)),
      sourceIds: mergeStrings(input.provenance.map((item) => item.sourceId)),
      provenance: input.provenance.slice(0, 12)
    });
    return;
  }
  existing.observedValues = mergeStrings([...existing.observedValues, ...input.observedValues]);
  existing.confidences.push(input.confidence);
  existing.confidence = clampScore(existing.confidences.reduce((sum, value) => sum + value, 0) / existing.confidences.length);
  existing.reviewReasons = mergeStrings([...existing.reviewReasons, ...input.reviewReasons]);
  existing.evidenceIds = mergeStrings([...existing.evidenceIds, ...input.provenance.map((item) => item.evidenceId)]);
  existing.sourceIds = mergeStrings([...existing.sourceIds, ...input.provenance.map((item) => item.sourceId)]);
  existing.provenance = mergeProvenance([...existing.provenance, ...input.provenance]).slice(0, 12);
}

function finalizeCandidate(draft: CandidateDraft): EntityResolutionCandidateDto {
  const confidence = clampScore(Math.max(...draft.confidences) * 0.7 + (draft.sourceIds.length > 1 ? 0.18 : 0) + (draft.evidenceIds.length > 1 ? 0.08 : 0));
  const uncertaintyReasons = mergeStrings([
    ...draft.reviewReasons,
    ...(draft.sourceIds.length < 2 && needsCorroboration(draft.kind) ? ["single-source merge needs corroboration"] : []),
    ...(confidence < 0.65 ? ["low confidence normalization"] : []),
    ...(hasAliasCollision(draft) ? ["alias collision with another entity family"] : []),
    ...(draft.provenance.some((item) => item.evidenceStage === "metadata_only_claim") ? ["metadata-only evidence requires human review"] : [])
  ]);
  const reviewState = reviewStateFor(draft.kind, confidence, uncertaintyReasons);
  return {
    id: stableId("entity-resolution", `${draft.normalizedKey}:${draft.evidenceIds.join(":")}`),
    kind: draft.kind,
    canonicalValue: draft.canonicalValue,
    observedValues: draft.observedValues,
    normalizedKey: draft.normalizedKey,
    confidence,
    reviewState,
    confidenceReasons: confidenceReasons(draft, confidence),
    uncertaintyReasons,
    correctionActions: correctionActions(draft.kind, reviewState, uncertaintyReasons),
    evidenceIds: draft.evidenceIds,
    sourceIds: draft.sourceIds,
    provenance: draft.provenance
  };
}

function entityKind(entity: ExtractedEntity): EntityResolutionKind | undefined {
  if (entity.type === "actor") return "actor_alias";
  if (entity.type === "victim") return "victim_company";
  if (entity.type === "country") return "country";
  if (entity.type === "sector") return "sector";
  if (entity.type === "malware" || entity.type === "ransomware_family") return "malware_tool";
  if (entity.type === "cve") return "cve";
  return undefined;
}

function canonicalEntityValue(entity: ExtractedEntity, kind: EntityResolutionKind): string {
  if (kind === "actor_alias") return entity.value;
  if (kind === "victim_company") return normalizeCompanyName(entity.value);
  if (kind === "country" || kind === "sector") return titleCase(entity.value);
  if (kind === "malware_tool") return MALWARE_CANONICAL[entity.value.toLowerCase()] ?? titleCase(entity.value);
  if (kind === "cve") return entity.value.toUpperCase();
  return entity.value;
}

function provenanceFor(evidence: StagedEvidenceInput, provenances: ExtractionProvenance[] | undefined, confidence: number): EntityResolutionProvenanceDto[] {
  const fallback: ExtractionProvenance = {
    sourceId: evidence.result.capture.sourceId,
    captureId: evidence.result.capture.id,
    url: evidence.result.capture.url,
    collectedAt: evidence.result.capture.collectedAt,
    contentHash: evidence.result.capture.contentHash,
    extractorVersion: String(evidence.result.capture.metadata.extractorVersion ?? "unknown")
  };
  return (provenances?.length ? provenances : [fallback]).map((provenance) => ({
    evidenceId: evidence.id,
    sourceId: provenance.sourceId,
    captureId: provenance.captureId,
    collectedAt: provenance.collectedAt,
    evidenceStage: evidence.stage,
    extractorVersion: provenance.extractorVersion,
    confidence
  }));
}

function normalizeCompanyName(value: string): string {
  return normalizeWhitespace(value)
    .replace(/[.,;:]+$/g, "")
    .replace(/\b(ltd|llc|plc|gmbh|asa|as|inc|corp|corporation)\b\.?$/i, (suffix) => suffix.toUpperCase())
    .trim();
}

function normalizeIndicatorValue(indicator: Indicator): string {
  if (indicator.type === "domain" || indicator.type === "url") return indicator.value.toLowerCase();
  if (indicator.type === "sha1" || indicator.type === "sha256" || indicator.type === "md5") return indicator.value.toLowerCase();
  return indicator.value;
}

function normalizeKey(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

function isRansomwareActor(value: string): boolean {
  const normalized = value.toLowerCase();
  return RANSOMWARE_FAMILIES.has(normalized) || actorAliasesFor(value).some((alias) => RANSOMWARE_FAMILIES.has(alias));
}

function needsCorroboration(kind: EntityResolutionKind): boolean {
  return kind === "actor_alias" || kind === "ransomware_rebrand" || kind === "victim_company" || kind === "cve" || kind === "infrastructure";
}

function hasAliasCollision(draft: CandidateDraft): boolean {
  if (draft.kind === "malware_tool" && draft.canonicalValue.toLowerCase() === "snake") return true;
  if (draft.kind !== "actor_alias") return false;
  const aliases = new Set(draft.observedValues.map((value) => value.toLowerCase()));
  return ACTOR_ALIAS_RECORDS.some((record) => record.canonical !== draft.canonicalValue && record.aliases.some((alias) => aliases.has(alias)));
}

function reviewStateFor(kind: EntityResolutionKind, confidence: number, uncertaintyReasons: string[]): EntityResolutionReviewState {
  if (uncertaintyReasons.some((reason) => /metadata-only|alias collision|private or reserved/i.test(reason))) return "review_required";
  if (kind === "infrastructure" && uncertaintyReasons.some((reason) => /private or reserved/i.test(reason))) return "held";
  if (confidence >= 0.82 && uncertaintyReasons.length === 0) return "accepted";
  if (confidence >= 0.72 && !uncertaintyReasons.some((reason) => /low confidence|weak/i.test(reason))) return "proposed";
  return "review_required";
}

function confidenceReasons(draft: CandidateDraft, confidence: number): string[] {
  return mergeStrings([
    `${draft.provenance.length} provenance reference(s)`,
    `${draft.sourceIds.length} source family/families`,
    `${draft.evidenceIds.length} evidence item(s)`,
    `max extractor confidence ${Math.round(Math.max(...draft.confidences) * 100)}%`,
    `resolved confidence ${Math.round(confidence * 100)}%`
  ]);
}

function correctionActions(kind: EntityResolutionKind, state: EntityResolutionReviewState, uncertaintyReasons: string[]): EntityResolutionCorrectionAction[] {
  return mergeStrings([
    state === "accepted" ? "accept_merge" : "request_more_evidence",
    ...(state !== "accepted" ? ["accept_merge", "set_canonical"] : []),
    ...(uncertaintyReasons.some((reason) => /alias collision|ambiguous/i.test(reason)) ? ["split_entity", "suppress_alias"] : []),
    ...(kind === "actor_alias" || kind === "ransomware_rebrand" || kind === "victim_company" || kind === "cve" ? ["send_to_graph_review"] : [])
  ]) as EntityResolutionCorrectionAction[];
}

function mergeProvenance(items: EntityResolutionProvenanceDto[]): EntityResolutionProvenanceDto[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.evidenceId}:${item.captureId}:${item.extractorVersion}:${item.evidenceStage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function queue(candidates: EntityResolutionCandidateDto[], pattern: RegExp): string[] {
  return candidates
    .filter((candidate) => candidate.uncertaintyReasons.some((reason) => pattern.test(reason)))
    .map((candidate) => candidate.id);
}

function reviewRank(state: EntityResolutionReviewState): number {
  if (state === "review_required") return 0;
  if (state === "held") return 1;
  if (state === "proposed") return 2;
  return 3;
}

function titleCase(value: string): string {
  return normalizeWhitespace(value).split(" ").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase()).join(" ");
}

function mergeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }
  return merged;
}
