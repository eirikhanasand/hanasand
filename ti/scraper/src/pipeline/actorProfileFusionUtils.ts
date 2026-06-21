// @ts-nocheck
import { clampScore } from "../utils.ts";
import { buildActorQueryExtractionProfile, buildTiSearchResultDto } from "./intelligenceProfiles.ts";
import { READINESS_FIELDS } from "./actorProfileFusionTypes.ts";

export const rowsFor = (input: any) => input.evidence.map((e) => ({ evidence: e, result: e.result, dto: buildTiSearchResultDto(input.query, e.result), profile: buildActorQueryExtractionProfile(input.query, e.result) }));
export const uniq = (items: any[]) => [...new Set(items.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];
export const latest = (dates: any[]) => dates.filter(Boolean).sort().at(-1);
export const earliest = (dates: any[]) => dates.filter(Boolean).sort()[0];
export const avg = (nums: number[]) => nums.length ? clampScore(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;
export const ledgerIds = (e: any) => uniq([e.result.capture.metadata?.evidenceLedgerId, e.result.capture.metadata?.captureLedgerId, e.result.capture.metadata?.ledgerId]);
export const uncertainty = (r: any) => ({ sourceId: r.result.capture.sourceId, evidenceId: r.evidence.id, evidenceStage: r.evidence.stage, confidence: r.dto.confidence, caveatCodes: r.dto.caveats?.map((c) => c.code) ?? [], caveats: r.dto.caveats ?? [] });
export const stageCounts = (ev: any[]) => ev.reduce((a, e) => ({ ...a, [e.stage]: (a[e.stage] ?? 0) + 1 }), {});
export const mergeCaveats = (caveats: any[]) => [...new Map(caveats.map((c) => [c.code, c])).values()];
export const campaignsFrom = (rows: any[]) => uniq(rows.flatMap((r) => (r.result.capture.body ?? "").match(/\b(?:Operation|Campaign)\s+[A-Z][\w-]+/g) ?? [])).slice(0, 8);
export const publicDeltas = (changes: any[]) => changes.map((c) => ({ kind: c.kind === "confidence_changed" ? "changed_confidence" : c.kind === "stale_field_removed" ? "stale_field_removed" : c.kind === "contradiction_detected" ? "contradiction" : "new_evidence", label: c.message, values: Array.isArray(c.after) ? c.after : [], evidenceIds: c.evidenceIds, confidenceBefore: c.confidenceBefore, confidenceAfter: c.confidenceAfter, needsReview: c.needsReview }));

export function compactSummary(summary: string[], extras: any) {
  return uniq([...summary, ...restrictedBullets(extras.evidence), extras.malwareTools.length && `Observed tooling includes ${extras.malwareTools.slice(0, 4).join(", ")}.`, extras.vulnerabilities.length && `Referenced CVEs include ${extras.vulnerabilities.slice(0, 4).join(", ")}.`, extras.infrastructure.length && `Infrastructure observations include ${extras.infrastructure.slice(0, 4).join(", ")}.`]).slice(0, 6);
}

function restrictedBullets(evidence: any[]) {
  return evidence.flatMap((e) => { const m = e.result.capture.metadata?.leakSite; if (!m) return []; const facts = [m.victimName && `victim ${m.victimName}`, m.actorName && `actor ${m.actorName}`, m.claimDate && `claimed ${m.claimDate}`, m.claimedSector && `sector ${m.claimedSector}`, m.claimedCountry && `country ${m.claimedCountry}`, m.claimedDataCategory && `data ${m.claimedDataCategory}`].filter(Boolean); return facts.length ? [`Restricted metadata claim: ${facts.join("; ")}.`] : []; });
}

export function deltaSummary(baseline: any, profile: any, evidence: any[]) {
  const changes = [{ kind: "evidence_added", message: `${evidence.length} evidence rows support ${profile.actor}.`, evidenceIds: evidence.map((e) => e.id), needsReview: profile.needsAnalystReview }];
  if (baseline && Math.abs((baseline.confidence ?? 0) - profile.confidence) > 0.05) changes.push({ kind: "confidence_changed", message: "Profile confidence changed.", evidenceIds: profile.evidenceIds, confidenceBefore: baseline.confidence, confidenceAfter: profile.confidence, needsReview: false });
  return { profileChanged: true, evidenceAdded: evidence.length > 0, confidenceChanged: changes.some((c) => c.kind === "confidence_changed"), needsReview: profile.needsAnalystReview, staleFieldRemoved: false, contradictionDetected: false, changes };
}

export function readinessFor({ dto, rows }: any) {
  const evidenceIds = rows.map((r) => r.evidence.id);
  const mk = (field: string, values: any[], confidence = dto.confidence) => ({ field, status: values.length ? confidence >= 0.65 ? "fact" : "partial_evidence" : "needs_review", confidence, evidenceIds: values.length ? evidenceIds : [], provenance: rows.map((r) => ({ evidenceId: r.evidence.id, sourceId: r.result.capture.sourceId, evidenceStage: r.evidence.stage, confidence: r.dto.confidence })), caveatCodes: dto.caveats.map((c) => c.code), reasons: values.length ? [] : [`missing ${field}`] });
  const built = Object.fromEntries(READINESS_FIELDS.map((f) => [f, mk(f, valuesForField(f, dto))]));
  const overall = Object.values(built).some((f: any) => f.status === "needs_review") ? "needs_review" : Object.values(built).some((f: any) => f.status === "partial_evidence") ? "partial_evidence" : "fact";
  return { overall, fields: built, downgradeReasons: uniq(Object.values(built).flatMap((f: any) => f.reasons)), sourceFamilyCount: dto.datasets.sourceCount, evidenceStageCounts: dto.datasets.evidenceStageCounts };
}

const valuesForField = (f: string, d: any) => f === "summary" ? d.summaryBullets : f === "aliases" ? d.aliases : f === "recent_activity" ? [d.recentActivity.lastSeen] : f === "victims" ? d.targets.victims : f === "sectors" ? d.targets.sectors : f === "regions" ? d.targets.regions : f === "targets" ? [...d.targets.victims, ...d.targets.sectors, ...d.targets.regions] : f === "ttps" ? d.ttps : f === "malware_tools" ? d.malwareTools : f === "vulnerabilities" ? d.vulnerabilities : f === "infrastructure" ? d.infrastructure : f === "datasets" ? d.datasets.coverage : [];
