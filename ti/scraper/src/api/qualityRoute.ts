export function qualityPayload(query: string, store: any, tenantId?: string, generatedAt = new Date().toISOString()) {
  const normalizedQuery = query.trim().toLowerCase();
  const scoped = (method: string) => records(store, method).filter((record) => (record.tenantId || undefined) === tenantId);
  const captures = scoped("listCaptures").filter((capture) => matches(capture, normalizedQuery));
  const claims = scoped("listIntelligenceClaims").filter((claim) => matchesClaim(claim, normalizedQuery));
  const captureIds = new Set([...captures.map((capture) => capture.id), ...claims.flatMap((claim) => claim.captureIds ?? [])]);
  const entities = scoped("listExtractedEntities").filter((entity) => captureIds.has(entity.captureId) || normalized(entity.value) === normalizedQuery);
  const labels = scoped("listEvaluationLabels").filter((label) => captureIds.has(label.captureId) || entities.some((entity) => entity.id === label.entityId));
  const sources = new Set([...captures.map((capture) => capture.sourceId), ...claims.flatMap((claim) => claim.sourceIds ?? [])].filter(Boolean));
  const evidenceIds = [...new Set([...captures.map((capture) => capture.id), ...claims.map((claim) => claim.id)])];
  const aliasConflicts = aliasConflictIds(scoped("listActorAliases"), normalizedQuery);
  const contradicted = claims.some((claim) => claim.reviewState === "contradicted" || claim.corroborationState === "contradicted") || captures.some((capture) => capture.metadata?.graphReviewState === "contradiction");
  const stale = evidenceIds.length > 0 && [...claims.map((claim) => claim.lastSeenAt), ...captures.map((capture) => capture.publishedAt ?? capture.collectedAt)].filter(Boolean).every((date) => Date.parse(generatedAt) - Date.parse(date) > 180 * 86_400_000) || captures.some((capture) => capture.metadata?.graphReviewState === "stale");
  const reviewed = claims.some((claim) => claim.reviewState === "confirmed" && claim.corroborationState !== "contradicted") || captures.some((capture) => capture.metadata?.evidenceStage === "reviewed_promoted" || capture.metadata?.graphReviewState === "accepted");
  const status = contradicted ? "contradicted" : stale ? "stale" : reviewed ? "ready" : evidenceIds.length ? "partial" : "unmeasured";
  const scores = [...claims.map((claim) => score(claim.confidence)), ...entities.map((entity) => score(entity.confidence))].filter((value): value is number => value !== undefined);
  const qualityScore = scores.length ? round(scores.reduce((total, value) => total + value, 0) / scores.length) : null;
  const warnings = warningCodes({ status, aliasConflicts, sources, labels, claims });

  return {
    query,
    quality: {
      query,
      status,
      score: qualityScore,
      measured: qualityScore !== null,
      canPromoteToReady: status === "ready",
      publicWarningCodes: warnings,
      publicWarningText: warnings.map(warningText),
      evidence: { evidenceCount: evidenceIds.length, captureCount: captures.length, claimCount: claims.length, sourceCount: sources.size, evaluatedLabelCount: labels.length },
      analystActions: actions(status, aliasConflicts.length > 0, evidenceIds)
    },
    dashboard: { useful: evidenceIds.length > 0, measured: qualityScore !== null, evidenceCount: evidenceIds.length, sourceCount: sources.size },
    entityResolutionWorkbench: { query, aliasCollisionWarning: aliasConflicts.length > 0, conflictingActorProfileIds: aliasConflicts },
    examples: [],
    routeContract: { syntheticExamplesIncluded: false, rawEvidenceExposed: false, restrictedLocatorsExposed: false }
  };
}

function warningCodes(input: { status: string; aliasConflicts: string[]; sources: Set<string>; labels: any[]; claims: any[] }): string[] {
  return [...new Set([
    input.status === "unmeasured" && "no_evidence",
    input.status === "partial" && "partial",
    input.status === "contradicted" && "contradicted",
    input.status === "stale" && "stale",
    input.aliasConflicts.length && "alias_collision_warning",
    input.sources.size === 1 && "single_source",
    input.claims.some((claim) => ["unreviewed", "needs_review"].includes(claim.reviewState)) && "needs_review",
    input.labels.length === 0 && "evaluation_unmeasured"
  ].filter(Boolean) as string[])];
}

function warningText(code: string): string {
  const messages: Record<string, string> = {
    no_evidence: "No evidence is available in the requested scope.",
    partial: "Available evidence is not yet sufficient for reviewed promotion.",
    contradicted: "Stored evidence or analyst review records a contradiction.",
    stale: "The latest matching evidence is stale.",
    alias_collision_warning: "The queried alias resolves to multiple actor profiles and requires review.",
    single_source: "The claim is supported by one source only.",
    needs_review: "At least one matching claim requires analyst review.",
    evaluation_unmeasured: "No ground-truth label covers the matching evidence."
  };
  return messages[code] ?? code;
}

function actions(status: string, aliasCollision: boolean, evidenceIds: string[]) {
  if (aliasCollision) return [{ kind: "review_alias_resolution", label: "Review alias resolution", manualOnly: true, evidenceIds }];
  if (status === "contradicted") return [{ kind: "review_contradiction", label: "Review contradiction", manualOnly: true, evidenceIds }];
  if (status === "stale") return [{ kind: "request_fresh_evidence", label: "Request fresh evidence", manualOnly: false, evidenceIds }];
  if (status === "unmeasured") return [{ kind: "request_capture_evidence", label: "Request capture evidence", manualOnly: false, evidenceIds: [] }];
  if (status === "partial") return [{ kind: "review_claims", label: "Review matching claims", manualOnly: true, evidenceIds }];
  return [];
}

function aliasConflictIds(aliases: any[], query: string): string[] {
  if (!query) return [];
  return [...new Set(aliases.filter((alias) => normalized(alias.normalizedAlias ?? alias.alias) === query).map((alias) => alias.actorProfileId).filter(Boolean))].sort();
}

function matches(capture: any, query: string): boolean { return !query || [capture.title, capture.body, capture.metadata?.safeExcerpt].some((value) => normalized(value).includes(query)); }
function matchesClaim(claim: any, query: string): boolean { return !query || [claim.summary, claim.value?.value, claim.value?.title, claim.value?.normalizedValue].some((value) => normalized(value).includes(query)); }
function records(store: any, method: string): any[] { return typeof store?.[method] === "function" ? store[method]() : []; }
function normalized(value: unknown): string { return typeof value === "string" ? value.trim().toLowerCase() : ""; }
function score(value: unknown): number | undefined { const number = Number(value); if (!Number.isFinite(number)) return undefined; return Math.max(0, Math.min(1, number > 1 ? number / 100 : number)); }
function round(value: number): number { return Number(value.toFixed(3)); }
