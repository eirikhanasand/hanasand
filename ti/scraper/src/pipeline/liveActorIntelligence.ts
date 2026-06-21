// @ts-nocheck
import { buildLiveTiSearchSummary } from "./intelligenceProfiles.ts";
import type { FuseActorProfileInput, LiveActorIntelligenceDto } from "./actorProfileFusionTypes.ts";
import { fuseActorProfile } from "./actorProfileFusionCore.ts";
import { avg, campaignsFrom, compactSummary, earliest, latest, ledgerIds, mergeCaveats, publicDeltas, readinessFor, rowsFor, stageCounts, uniq } from "./actorProfileFusionUtils.ts";

export function buildLiveActorIntelligenceDto(input: FuseActorProfileInput): LiveActorIntelligenceDto {
  const fused = fuseActorProfile(input);
  const rows = rowsFor(input);
  const accepted = rows.filter((r) => !r.dto.caveats?.some((c) => ["historical_context", "live_snippet_only"].includes(c.code))) || rows;
  const temporal = accepted.map((r) => r.profile.temporal);
  const indicators = accepted.flatMap((r) => r.result.indicators ?? []);
  const entities = accepted.flatMap((r) => r.result.entities ?? []);
  const infrastructure = uniq(indicators.filter((i) => i.type !== "cve").map((i) => i.value));
  const vulnerabilities = uniq([...entities.filter((e) => e.type === "cve").map((e) => e.value), ...indicators.filter((i) => i.type === "cve").map((i) => i.value)]);
  const malwareTools = uniq(accepted.flatMap((r) => r.profile.malwareAndTooling?.map((e) => e.value) ?? []));
  const provenance = rows.map((r) => ({
    evidenceId: r.evidence.id, ledgerIds: ledgerIds(r.evidence), sourceId: r.result.capture.sourceId, captureId: r.result.capture.id,
    url: r.result.capture.url, collectedAt: r.result.capture.collectedAt, evidenceStage: r.evidence.stage,
    grounding: r.dto.caveats?.flatMap((c) => c.grounding ?? []).slice(0, 8) ?? [], confidence: r.dto.confidence
  }));
  const recentActivity = { firstSeen: earliest(temporal.map((t) => t.firstSeenAt)), lastSeen: latest(temporal.map((t) => t.lastSeenAt)), reportPublishedAt: latest(temporal.map((t) => t.reportPublishedAt)), freshnessScore: avg(temporal.map((t) => t.freshnessScore)), notes: uniq(temporal.flatMap((t) => t.notes ?? [])) };
  const datasets = {
    coverage: uniq([...rows.flatMap((r) => r.dto.datasets?.coverage ?? []), infrastructure.length && "infrastructure-observations", malwareTools.length && "malware-tool-observations", vulnerabilities.length && "vulnerability-observations"].filter(Boolean)),
    sourceCount: new Set(rows.map((r) => r.result.capture.sourceId)).size,
    indicatorCount: input.evidence.reduce((n, e) => n + (e.result.indicators?.length ?? 0), 0),
    entityCount: input.evidence.reduce((n, e) => n + (e.result.entities?.length ?? 0), 0),
    evidenceStageCounts: stageCounts(input.evidence)
  };
  const caveats = mergeCaveats(rows.flatMap((r) => r.dto.caveats ?? []));
  const summary = compactSummary(buildLiveTiSearchSummary(input.query, input.evidence)?.summaryBullets ?? [`Searching ${input.query}.`], { malwareTools, vulnerabilities, infrastructure, evidence: input.evidence });
  const readiness = readinessFor({ dto: { ...fused.profile, summaryBullets: summary, infrastructure, malwareTools, vulnerabilities, datasets, caveats, provenance, recentActivity }, rows });
  return {
    query: input.query, actor: fused.profile.actor, summaryBullets: summary, aliases: fused.profile.aliases, recentActivity,
    targets: fused.profile.targets, campaigns: campaignsFrom(rows), ttps: fused.profile.ttps, infrastructure, malwareTools, vulnerabilities,
    datasets, caveats, confidence: fused.profile.confidence, provenance, profileDeltas: publicDeltas(fused.deltas.changes),
    falsePositiveControls: uniq(caveats.map((c) => c.message ?? c.code)).slice(0, 8), readiness,
    needsAnalystReview: fused.profile.needsAnalystReview || readiness.overall === "needs_review"
  };
}
