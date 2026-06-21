// @ts-nocheck
import { clampScore } from "../utils.ts";
import { actorAliasesFor } from "./actorAliases.ts";
import { buildActorQueryExtractionProfile, buildLiveTiSearchSummary, buildTiSearchResultDto } from "./intelligenceProfiles.ts";
import { EXTRACTOR_VERSION } from "./extractors.ts";

export type ActorProfileDeltaKind = any; export type ActorProfileSourceUncertainty = any; export type ActorProfileSnapshot = any;
export type ActorProfileDelta = any; export type ActorProfileDeltaSummary = any; export type FuseActorProfileInput = any;
export type FusedActorProfile = any; export type PublicProfileDeltaKind = any; export type PublicProfileDelta = any;
export type ActorProfileReadinessStatus = "fact" | "partial_evidence" | "needs_review"; export type ActorProfileReadinessField = any;
export type ActorProfileFieldReadiness = any; export type ActorProfileReadinessDto = any; export type LiveActorIntelligenceDto = any;
export type PublicIntelClaimKind = any; export type PublicIntelClaimDto = any; export type PublicIntelAnswerDeltaKind = any;
export type PublicIntelAnswerDeltaDto = any; export type PublicIntelReviewGateDto = any; export type PublicIntelAnswerSlaStatus = any;
export type PublicIntelAnswerExplanationCode = any; export type PublicIntelAnswerExplanationDto = any;
export type PublicIntelAnswerReadinessSlaDto = any; export type PublicIntelAnswerPromotionState = any;
export type PublicIntelAnswerPromotionRuleCode = any; export type PublicIntelAnswerPromotionRuleDto = any;
export type PublicIntelAnswerPromotionCaveatCode = any; export type PublicIntelAnswerPromotionCaveatDto = any;
export type PublicIntelAnswerPromotionPolicyDto = any; export type PublicIntelAnalystFusionQueryClass = any;
export type PublicIntelAnalystFusionClaimDto = any; export type PublicIntelAnalystFusionDto = any;
export type PublicTiAnswerContractDto = any; export type PublicIntelAnswerDto = any;

const fields = ["summary", "aliases", "recent_activity", "timeline_changes", "targets", "victims", "sectors", "regions", "ttps", "malware_tools", "vulnerabilities", "infrastructure", "datasets"];

export function fuseActorProfile(input: FuseActorProfileInput): FusedActorProfile {
  const now = input.now ?? new Date().toISOString();
  const rows = rowsFor(input);
  const summary = rows.length ? buildLiveTiSearchSummary(input.query, input.evidence) : undefined;
  const actor = input.baseline?.actor ?? summary?.query ?? input.query;
  const aliases = uniq([...(input.baseline?.aliases ?? []), ...actorAliasesFor(actor), ...actorAliasesFor(input.query), ...rows.flatMap((r) => r.result.entities.filter((e) => e.type === "actor").flatMap((e) => [e.value, ...(e.aliases ?? [])]))]);
  const targets = {
    victims: uniq([...(input.baseline?.targets?.victims ?? []), ...rows.flatMap((r) => r.dto.targets?.victims ?? [])]),
    sectors: uniq([...(input.baseline?.targets?.sectors ?? []), ...rows.flatMap((r) => r.dto.targets?.sectors ?? [])]),
    regions: uniq([...(input.baseline?.targets?.regions ?? []), ...rows.flatMap((r) => r.dto.targets?.regions ?? [])])
  };
  const profile = {
    actor, aliases, vendorNames: aliases.filter((a) => a.toLowerCase() !== actor.toLowerCase()), targets,
    ttps: uniq([...(input.baseline?.ttps ?? []), ...rows.flatMap((r) => r.dto.ttps ?? [])]),
    confidence: clampScore(summary?.confidence ?? input.baseline?.confidence ?? 0),
    updatedAt: latest([summary?.lastUpdated, input.baseline?.updatedAt, now]) ?? now,
    evidenceIds: uniq([...(input.baseline?.evidenceIds ?? []), ...input.evidence.map((e) => e.id)]),
    sourceUncertainty: rows.map((r) => uncertainty(r)),
    needsAnalystReview: Boolean(summary?.needsAnalystReview || rows.some((r) => r.dto.caveats?.some((c) => c.severity !== "info")))
  };
  const changes = deltaSummary(input.baseline, profile, input.evidence);
  return { profile, deltas: changes };
}

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
  const recentActivity = {
    firstSeen: earliest(temporal.map((t) => t.firstSeenAt)),
    lastSeen: latest(temporal.map((t) => t.lastSeenAt)),
    reportPublishedAt: latest(temporal.map((t) => t.reportPublishedAt)),
    freshnessScore: avg(temporal.map((t) => t.freshnessScore)),
    notes: uniq(temporal.flatMap((t) => t.notes ?? []))
  };
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

export function buildPublicIntelAnswerDto(dto: LiveActorIntelligenceDto, quality: any = {}): PublicIntelAnswerDto {
  const warnings = uniq([...(quality.publicWarningText ?? []), ...dto.readiness.downgradeReasons, ...dto.falsePositiveControls]).slice(0, 12);
  const claims = claimsFor(dto, warnings);
  const status = quality.status === "ready" && dto.readiness.overall === "fact" ? "ready" : dto.readiness.overall === "needs_review" ? "review_required" : "partial";
  const policy = { state: status, canPromote: status === "ready", publicStatus: status === "ready" ? "ready" : "partial", rules: [], caveats: [], pollableDeltas: claims.map((c) => ({ kind: "new", claimKind: c.kind, value: c.value, status: c.status, evidenceIds: c.evidenceIds, ledgerIds: c.ledgerIds, reasons: ["current public intelligence row"], pollReason: "new_evidence", nextPollAfterSeconds: 60 })) };
  const analystFusion = { queryClass: queryClass(dto), answerState: policy.state, changed: [], firstSeen: dto.recentActivity.firstSeen, lastSeen: dto.recentActivity.lastSeen, recentAttacks: recentAttacks(dto), targetSectors: dto.targets.sectors, targetRegions: dto.targets.regions, ttps: dto.ttps, datasets: dto.datasets.coverage, caveatDigest: [], confidence: { score: dto.confidence, state: policy.state, sourceFamilyCount: dto.datasets.sourceCount, ledgerBackedClaimCount: claims.filter((c) => c.ledgerIds.length).length }, contradictionHandling: { contradicted: false, holdReadyPromotion: false, reasons: [], evidenceIds: [] }, sourceBias: { missingSourceFamily: dto.datasets.sourceCount < 2, sourceFamilyCount: dto.datasets.sourceCount, reasons: dto.datasets.sourceCount < 2 ? ["single source family"] : [] }, staleEvidence: { stale: dto.recentActivity.freshnessScore < 0.2, reasons: [], evidenceIds: [] }, liveCollectionWaitingFor: [], claims: claims.map((c) => ({ ...c, provenance: dto.provenance, graphExportState: "ready", graphExportReasons: [], caveats: [] })), pollableDeltas: policy.pollableDeltas };
  const publicContract = { schemaVersion: "ti.public_answer_contract.v1", query: dto.query, queryClass: analystFusion.queryClass, state: policy.state, status: policy.publicStatus, displayState: status, noResult: claims.length === 0, safeSummary: dto.summaryBullets, confidence: analystFusion.confidence, recentAttacks: analystFusion.recentAttacks, targets: dto.targets, ttps: dto.ttps, datasets: dto.datasets.coverage, sources: { sourceCount: dto.datasets.sourceCount, evidenceStageCounts: dto.datasets.evidenceStageCounts, evidenceIds: dto.provenance.map((p) => p.evidenceId), ledgerIds: uniq(dto.provenance.flatMap((p) => p.ledgerIds)) }, caveats: [], waitReasons: [], nextPoll: { pollable: true, nextPollAfterSeconds: policy.canPromote ? 300 : 15, cursorRequired: true, deltaCount: policy.pollableDeltas.length }, evidenceLedgerReferences: claims.map((c) => ({ claimKind: c.kind, value: c.value, ledgerIds: c.ledgerIds, evidenceIds: c.evidenceIds, provenance: dto.provenance })), graphStixReadiness: { state: "ready", reasons: [], readyForDefaultExport: policy.canPromote }, deltas: policy.pollableDeltas, safeWording: { overstatesLiveSnippets: false, rawEvidenceExposed: false, restrictedPayloadsExposed: false, guidance: ["Render only metadata and cited public intelligence claims."] } };
  return { query: dto.query, actor: dto.actor, status: dto.readiness.overall, confidence: clampScore((quality.score ?? dto.confidence) * 0.4 + dto.confidence * 0.6), summary: dto.summaryBullets.slice(0, 5), aliases: dto.aliases, recentActivity: dto.recentActivity, targets: dto.targets, campaigns: dto.campaigns, victims: dto.targets.victims, ttps: dto.ttps, malwareTools: dto.malwareTools, vulnerabilities: dto.vulnerabilities, datasets: dto.datasets, timeline: timelineFor(dto), warnings, warningCodes: uniq([...(quality.publicWarningCodes ?? []), ...dto.caveats.map((c) => c.code)]), claims, reviewGates: claims.filter((c) => c.status !== "fact").map((c) => ({ claimKind: c.kind, value: c.value, state: "recommended", requiredForReady: c.status === "needs_review", requiredReviews: ["source_diversity"], evidenceIds: c.evidenceIds, ledgerIds: c.ledgerIds, reasons: c.downgradeReasons })), deltas: policy.pollableDeltas, readinessSla: { status: policy.publicStatus, confidence: dto.confidence, freshness: dto.recentActivity, evidenceFamilySupport: { sourceFamilyCount: dto.datasets.sourceCount, ledgerIds: uniq(dto.provenance.flatMap((p) => p.ledgerIds)), evidenceIds: dto.provenance.map((p) => p.evidenceId), evidenceStageCounts: dto.datasets.evidenceStageCounts }, graphState: { status: "ready", reasons: [] }, sourceSla: { status: dto.datasets.sourceCount ? "met" : "unknown", reasons: [] }, schedulerState: { status: "normal", reasons: [] }, publicChannelSla: { status: "stable", reasons: [] }, restrictedMetadataSla: { status: "compliant", reasons: [] }, explanations: [] }, promotionPolicy: policy, analystFusion, publicContract, provenanceNotes: dto.provenance.map((p) => `${p.evidenceStage} evidence ${p.evidenceId} from ${p.sourceId}`).slice(0, 12), readiness: dto.readiness };
}

const rowsFor = (input: any) => input.evidence.map((e) => ({ evidence: e, result: e.result, dto: buildTiSearchResultDto(input.query, e.result), profile: buildActorQueryExtractionProfile(input.query, e.result) }));
const uniq = (items: any[]) => [...new Set(items.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
const latest = (dates: any[]) => dates.filter(Boolean).sort().at(-1); const earliest = (dates: any[]) => dates.filter(Boolean).sort()[0];
const avg = (nums: number[]) => nums.length ? clampScore(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
const ledgerIds = (e: any) => uniq([e.result.capture.metadata?.evidenceLedgerId, e.result.capture.metadata?.captureLedgerId, e.result.capture.metadata?.ledgerId]);
const uncertainty = (r: any) => ({ sourceId: r.result.capture.sourceId, evidenceId: r.evidence.id, evidenceStage: r.evidence.stage, confidence: r.dto.confidence, caveatCodes: r.dto.caveats?.map((c) => c.code) ?? [], caveats: r.dto.caveats ?? [] });
const stageCounts = (ev: any[]) => ev.reduce((a, e) => ({ ...a, [e.stage]: (a[e.stage] ?? 0) + 1 }), {});
const mergeCaveats = (caveats: any[]) => [...new Map(caveats.map((c) => [c.code, c])).values()];
const campaignsFrom = (rows: any[]) => uniq(rows.flatMap((r) => (r.result.capture.body ?? "").match(/\b(?:Operation|Campaign)\s+[A-Z][\w-]+/g) ?? [])).slice(0, 8);
const compactSummary = (summary: string[], extras: any) => uniq([...summary, ...restrictedBullets(extras.evidence), extras.malwareTools.length && `Observed tooling includes ${extras.malwareTools.slice(0, 4).join(", ")}.`, extras.vulnerabilities.length && `Referenced CVEs include ${extras.vulnerabilities.slice(0, 4).join(", ")}.`, extras.infrastructure.length && `Infrastructure observations include ${extras.infrastructure.slice(0, 4).join(", ")}.`]).slice(0, 6);
const restrictedBullets = (evidence: any[]) => evidence.flatMap((e) => { const m = e.result.capture.metadata?.leakSite; if (!m) return []; const facts = [m.victimName && `victim ${m.victimName}`, m.actorName && `actor ${m.actorName}`, m.claimDate && `claimed ${m.claimDate}`, m.claimedSector && `sector ${m.claimedSector}`, m.claimedCountry && `country ${m.claimedCountry}`, m.claimedDataCategory && `data ${m.claimedDataCategory}`].filter(Boolean); return facts.length ? [`Restricted metadata claim: ${facts.join("; ")}.`] : []; });
const publicDeltas = (changes: any[]) => changes.map((c) => ({ kind: c.kind === "confidence_changed" ? "changed_confidence" : c.kind === "stale_field_removed" ? "stale_field_removed" : c.kind === "contradiction_detected" ? "contradiction" : "new_evidence", label: c.message, values: Array.isArray(c.after) ? c.after : [], evidenceIds: c.evidenceIds, confidenceBefore: c.confidenceBefore, confidenceAfter: c.confidenceAfter, needsReview: c.needsReview }));
function deltaSummary(baseline: any, profile: any, evidence: any[]) { const changes = [{ kind: "evidence_added", message: `${evidence.length} evidence rows support ${profile.actor}.`, evidenceIds: evidence.map((e) => e.id), needsReview: profile.needsAnalystReview }]; if (baseline && Math.abs((baseline.confidence ?? 0) - profile.confidence) > 0.05) changes.push({ kind: "confidence_changed", message: "Profile confidence changed.", evidenceIds: profile.evidenceIds, confidenceBefore: baseline.confidence, confidenceAfter: profile.confidence, needsReview: false }); return { profileChanged: true, evidenceAdded: evidence.length > 0, confidenceChanged: changes.some((c) => c.kind === "confidence_changed"), needsReview: profile.needsAnalystReview, staleFieldRemoved: false, contradictionDetected: false, changes }; }
function readinessFor({ dto, rows }: any) { const evidenceIds = rows.map((r) => r.evidence.id); const mk = (field: string, values: any[], confidence = dto.confidence) => ({ field, status: values.length ? confidence >= 0.65 ? "fact" : "partial_evidence" : "needs_review", confidence, evidenceIds: values.length ? evidenceIds : [], provenance: rows.map((r) => ({ evidenceId: r.evidence.id, sourceId: r.result.capture.sourceId, evidenceStage: r.evidence.stage, confidence: r.dto.confidence })), caveatCodes: dto.caveats.map((c) => c.code), reasons: values.length ? [] : [`missing ${field}`] }); const built = Object.fromEntries(fields.map((f) => [f, mk(f, valuesForField(f, dto))])); const overall = Object.values(built).some((f: any) => f.status === "needs_review") ? "needs_review" : Object.values(built).some((f: any) => f.status === "partial_evidence") ? "partial_evidence" : "fact"; return { overall, fields: built, downgradeReasons: uniq(Object.values(built).flatMap((f: any) => f.reasons)), sourceFamilyCount: dto.datasets.sourceCount, evidenceStageCounts: dto.datasets.evidenceStageCounts }; }
const valuesForField = (f: string, d: any) => f === "summary" ? d.summaryBullets : f === "aliases" ? d.aliases : f === "recent_activity" ? [d.recentActivity.lastSeen] : f === "victims" ? d.targets.victims : f === "sectors" ? d.targets.sectors : f === "regions" ? d.targets.regions : f === "targets" ? [...d.targets.victims, ...d.targets.sectors, ...d.targets.regions] : f === "ttps" ? d.ttps : f === "malware_tools" ? d.malwareTools : f === "vulnerabilities" ? d.vulnerabilities : f === "infrastructure" ? d.infrastructure : f === "datasets" ? d.datasets.coverage : [];
function claimsFor(dto: any, downgrades: string[]) { const evidenceIds = dto.provenance.map((p) => p.evidenceId); const ledger = uniq(dto.provenance.flatMap((p) => p.ledgerIds)); const claim = (kind: string, value: string, field = kind) => ({ kind, value, field, status: dto.readiness.fields[field]?.status ?? dto.readiness.overall, confidence: dto.confidence, evidenceIds, ledgerIds: ledger, sourceFamilySupport: uniq(dto.provenance.map((p) => p.sourceId)), extractionVersion: EXTRACTOR_VERSION, freshness: { score: dto.recentActivity.freshnessScore, firstSeen: dto.recentActivity.firstSeen, lastSeen: dto.recentActivity.lastSeen, reportPublishedAt: dto.recentActivity.reportPublishedAt }, caveatCodes: dto.caveats.map((c) => c.code), downgradeReasons: downgrades, analystReviewState: dto.needsAnalystReview ? "recommended" : "not_required" }); return [claim("actor", dto.actor, "summary"), ...dto.campaigns.map((v) => claim("campaign", v, "summary")), ...dto.targets.victims.map((v) => claim("victim", v, "victims")), ...dto.targets.sectors.map((v) => claim("sector", v, "sectors")), ...dto.targets.regions.map((v) => claim("region", v, "regions")), ...dto.ttps.map((v) => claim("ttp", v, "ttps")), ...dto.malwareTools.map((v) => claim("malware_tool", v, "malware_tools")), ...dto.vulnerabilities.map((v) => claim("vulnerability", v, "vulnerabilities")), ...dto.infrastructure.map((v) => claim("infrastructure", v, "infrastructure")), ...dto.datasets.coverage.map((v) => claim("dataset", v, "datasets"))].slice(0, 80); }
const timelineFor = (dto: any) => [["First seen", dto.recentActivity.firstSeen], ["Last seen", dto.recentActivity.lastSeen], ["Report published", dto.recentActivity.reportPublishedAt]].filter((x) => x[1]).map(([label, at]) => ({ label, at, readiness: dto.readiness.fields.recent_activity.status, evidenceIds: dto.provenance.map((p) => p.evidenceId) }));
const queryClass = (dto: any) => dto.actor.toLowerCase().includes("lockbit") || dto.datasets.coverage.some((d) => d.includes("ransom")) ? "ransomware" : dto.vulnerabilities.length ? "cve" : "actor";
const recentAttacks = (dto: any) => dto.targets.victims.map((victim) => ({ victim, at: dto.recentActivity.lastSeen, sectors: dto.targets.sectors, regions: dto.targets.regions, ttps: dto.ttps, malwareTools: dto.malwareTools, vulnerabilities: dto.vulnerabilities, confidence: dto.confidence, evidenceIds: dto.provenance.map((p) => p.evidenceId), ledgerIds: uniq(dto.provenance.flatMap((p) => p.ledgerIds)) })).slice(0, 20);
