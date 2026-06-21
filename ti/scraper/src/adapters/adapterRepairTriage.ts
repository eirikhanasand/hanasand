// @ts-nocheck
import { hashContent } from "../utils.ts";
export type AdapterRepairTriageAction = "certify_adapter" | "fix_parser" | "disable_or_pause_source" | "reduce_cadence" | "suppress_duplicate" | "escalate_release_hold";
export type AdapterRepairTriageDecision = "certify" | "repair" | "disable" | "escalate";
export type AdapterRepairTriagePriority = "p0" | "p1" | "p2" | "p3";
export type AdapterRepairTriageImpactInput = any;
export type AdapterRepairTriageInput = any;
export type AdapterRepairRecommendationDto = any;
export type AdapterRepairTriagePacketDto = any;
export type AdapterRepairAdapterSummaryDto = any;

const ADAPTERS = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
const MODE_ORDER = ["success", "parser_drift", "stale_dates", "language_mismatch", "unsupported_mime", "timeout", "rate_limit", "duplicate_canonical", "truncated_capture", "empty_extraction"];

export function buildAdapterRepairTriagePacket(input: AdapterRepairTriageInput): AdapterRepairTriagePacketDto {
  const candidates = dedupe([
    ...input.slaRepairPacket.repairs.map((repair) => fromRepair(repair, input)),
    ...input.certificationPacket.adapterGates.flatMap((gate) => fromGate(gate, input)),
    ...input.slaRepairPacket.contracts.flatMap((contract) => fromContract(contract, input))
  ]);
  const recommendations = candidates.map((candidate) => recommendation(input, candidate)).sort((a, b) => b.score - a.score || pOrder(a.priority) - pOrder(b.priority) || a.adapter.localeCompare(b.adapter)).map((item, index) => ({ ...item, rank: index + 1 }));
  const decision = decisionFor(recommendations);
  return {
    schemaVersion: "ti.adapter_repair_triage_packet.v1", generatedAt: input.generatedAt,
    decision, readyForCertification: decision === "certify", browserWorkersEnabled: false,
    recommendations, adapterSummaries: ADAPTERS.map((adapter) => summary(adapter, input, recommendations)),
    summary: packetSummary(recommendations),
    sandboxFixtureReplay: { requiredAdapters: orderedAdapters(recommendations.filter((r) => r.sandboxFixtureReplay.required).map((r) => r.adapter)), hashOnly: true, rawMaterialRequired: false, dynamicBrowserDisabledByDefault: true, dynamicRequiresExplicitApproval: true, expectedModesByAdapter: ADAPTERS.map((adapter) => ({ adapter, modes: expectedModesForAdapter(adapter, input) })).filter((x) => x.modes.length) },
    routeContract: { safeForPublicApi: true, stableFields: ["schemaVersion", "generatedAt", "decision", "readyForCertification", "browserWorkersEnabled", "recommendations", "adapterSummaries", "summary", "sandboxFixtureReplay", "routeContract", "safety"], forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl", "objectRef"], compactApiProof: { noRawUrls: true, noRawText: true, noHtml: true, noScreenshots: true, noCredentials: true, noPrivateInvites: true, noOnionLinks: true, noRestrictedMaterial: true, dryRunOnly: true } },
    safety: { publicOnly: true, dryRunOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false }
  };
}

function fromRepair(repair, input) {
  return { adapter: repair.adapter, sourceId: repair.sourceId, sourceFamily: repair.sourceFamily, action: actionForRepair(repair), repair, contract: contract(input, repair.adapter), gate: gate(input, repair.adapter), rationale: [repair.reason, `repair_category:${repair.category}`, `repair_priority:${repair.priority}`] };
}
function fromGate(gateInfo, input) {
  if (gateInfo.status === "certified") return [{ adapter: gateInfo.adapter, sourceFamily: family(gateInfo.adapter), action: "certify_adapter", contract: contract(input, gateInfo.adapter), gate: gateInfo, rationale: ["adapter fixture replay and SLA gates are green"] }];
  if (!gateInfo.missingModes.length && gateInfo.status !== "hold") return [];
  return [{ adapter: gateInfo.adapter, sourceFamily: family(gateInfo.adapter), action: gateInfo.status === "hold" ? "escalate_release_hold" : "fix_parser", contract: contract(input, gateInfo.adapter), gate: gateInfo, rationale: [...gateInfo.missingModes.map((m) => `missing_fixture_modes:${m}`), ...gateInfo.holdReasons] }];
}
function fromContract(contractInfo, input) {
  if (contractInfo.status === "pass") return [];
  return [{ adapter: contractInfo.adapter, sourceFamily: contractInfo.sourceFamily, action: contractInfo.status === "hold" ? "escalate_release_hold" : "fix_parser", contract: contractInfo, gate: gate(input, contractInfo.adapter), rationale: contractInfo.breaches.map((b) => `${b.code}:${b.message}`) }];
}
function recommendation(input, candidate) {
  const impact = impactFor(candidate, input.impacts ?? []), c = candidate.contract, g = candidate.gate, missingModes = g?.missingModes ?? [];
  const signals = { parserConfidence: c?.metrics.minParserConfidenceObserved, freshnessDebtHours: impact.freshnessDebtHours ?? (c?.metrics.staleCount ? 24 * c.metrics.staleCount : 0), duplicateRate: impact.duplicateRate ?? (c?.metrics.duplicateCanonicalCount ? 1 : 0), unsupportedMimeCount: c?.metrics.unsupportedMimeCount ?? 0, timeoutCount: c?.metrics.timeoutCount ?? 0, rateLimitedCount: c?.metrics.rateLimitedCount ?? 0, certificationGap: missingModes.length, languageDriftCount: c?.metrics.languageDriftCount ?? 0, releaseHold: candidate.action === "escalate_release_hold" || g?.status === "hold" || c?.status === "hold" || candidate.repair?.priority === "high" };
  const score = scoreFor(candidate, impact, signals), priority = priorityFor(score, signals.releaseHold, candidate.repair?.priority), modes = expectedModes(candidate, missingModes);
  return { schemaVersion: "ti.adapter_repair_recommendation.v1", generatedAt: input.generatedAt, recommendationId: `triage:${hash(`${candidate.adapter}:${candidate.sourceId ?? "adapter"}:${candidate.action}:${candidate.rationale.join("|")}`)}`, rank: 0, adapter: candidate.adapter, sourceId: candidate.sourceId, sourceFamily: candidate.sourceFamily, action: candidate.action, priority, score, rationale: uniq(candidate.rationale), customerImpact: { searchImpact: round(impact.customerVisibleSearchImpact), sourceFamilyCoverage: round(impact.sourceFamilyCoverage), queryClasses: uniq(impact.queryClasses ?? []) }, repairSignals: signals, sandboxFixtureReplay: { required: (candidate.action !== "reduce_cadence" && candidate.action !== "suppress_duplicate" && candidate.action !== "certify_adapter") || modes.length > 0, expectedModes: modes, hashOnly: true, rawMaterialRequired: false, dynamicBrowserDisabledByDefault: true, dynamicRequiresExplicitApproval: candidate.adapter === "dynamic_public_browser" }, handoffs: handoffs(candidate, signals.releaseHold) };
}
function packetSummary(recommendations) {
  return { recommendations: recommendations.length, p0: count(recommendations, "priority", "p0"), p1: count(recommendations, "priority", "p1"), p2: count(recommendations, "priority", "p2"), p3: count(recommendations, "priority", "p3"), actions: countBy(recommendations.map((r) => r.action)), sourceIds: uniq(recommendations.flatMap((r) => r.sourceId ? [r.sourceId] : [])), adapters: orderedAdapters(recommendations.map((r) => r.adapter)), warningCodes: uniq(recommendations.map((r) => r.handoffs.agent09WarningField).filter((c) => c !== "none")), agentHandoffs: { agent01: uniq(recommendations.map((r) => r.handoffs.agent01Activation)), agent02: uniq(recommendations.map((r) => r.handoffs.agent02Cadence)), agent04: uniq(recommendations.map((r) => r.handoffs.agent04Coverage)), agent06: uniq(recommendations.map((r) => r.handoffs.agent06EvidenceReplay)), agent07: uniq(recommendations.map((r) => r.handoffs.agent07QualityGate)), agent09: uniq(recommendations.map((r) => r.handoffs.agent09WarningField).filter((c) => c !== "none")), agent10: uniq(recommendations.map((r) => r.handoffs.agent10ReleaseGate)) } };
}
function summary(adapter, input, recommendations) {
  const g = gate(input, adapter), c = contract(input, adapter), list = recommendations.filter((r) => r.adapter === adapter);
  return { adapter, status: g?.status ?? "not_observed", slaStatus: c?.status ?? "missing", recommendationCount: list.length, topAction: list[0]?.action, releaseHold: list.some((r) => r.handoffs.agent10ReleaseGate === "hold") || g?.status === "hold" || c?.status === "hold", missingCertificationModes: g?.missingModes ?? [] };
}
function scoreFor(candidate, impact, signals) {
  const actionWeight = { escalate_release_hold: 34, disable_or_pause_source: 30, fix_parser: 24, reduce_cadence: 14, suppress_duplicate: 12, certify_adapter: -20 }[candidate.action] ?? 0;
  const repairWeight = candidate.repair?.priority === "high" ? 30 : candidate.repair?.priority === "medium" ? 18 : candidate.repair ? 8 : 0;
  return round(actionWeight + repairWeight + impact.customerVisibleSearchImpact * 24 + impact.sourceFamilyCoverage * 18 + signals.certificationGap * 4 + Math.min(10, signals.freshnessDebtHours / 24) + signals.duplicateRate * 8 + signals.unsupportedMimeCount * 6 + signals.timeoutCount * 5 + signals.rateLimitedCount * 3 + signals.languageDriftCount * 4);
}
function actionForRepair(repair) { return repair.category === "scheduler_backoff" ? "reduce_cadence" : repair.category === "evidence_duplicate_suppression" ? "suppress_duplicate" : ["unsupported_mime_repair", "dynamic_render_failure"].includes(repair.category) ? "disable_or_pause_source" : "fix_parser"; }
function handoffs(candidate, hold) { return { agent01Activation: candidate.action === "certify_adapter" ? "allow_certification" : hold ? "hold_activation" : "disable_or_review_source", agent02Cadence: candidate.action === "reduce_cadence" ? "backoff" : candidate.action === "suppress_duplicate" ? "reduce_duplicate_pressure" : candidate.action === "disable_or_pause_source" || hold ? "pause" : "normal", agent04Coverage: candidate.action === "certify_adapter" ? "count_as_covered" : candidate.action === "suppress_duplicate" ? "deprioritize_duplicate" : "mark_gap", agent06EvidenceReplay: candidate.action === "suppress_duplicate" ? "suppress_duplicate" : hold ? "hold_replay" : candidate.action === "certify_adapter" ? "none" : "hash_only_replay", agent07QualityGate: candidate.action === "certify_adapter" ? "pass" : hold ? "hold" : "repair", agent09WarningField: candidate.action === "certify_adapter" ? "none" : `adapter_triage.${candidate.action}`, agent10ReleaseGate: hold ? "hold" : candidate.action === "certify_adapter" ? "none" : "watch" }; }
function priorityFor(score, hold, repairPriority) { return hold && score >= 70 || repairPriority === "high" && score >= 62 ? "p0" : score >= 52 || hold ? "p1" : score >= 28 ? "p2" : "p3"; }
function expectedModes(candidate, missingModes) { if (missingModes.length) return orderedModes(missingModes); const c = candidate.repair?.category; if (c === "dynamic_render_failure") return ["success", "timeout", "empty_extraction"]; if (c === "pdf_extraction_failure") return ["success", "truncated_capture", "empty_extraction"]; if (c === "unsupported_mime_repair") return ["success", "unsupported_mime"]; if (c === "language_detection_drift") return ["success", "language_mismatch"]; if (c === "scheduler_backoff") return ["timeout", "rate_limit"]; if (c === "evidence_duplicate_suppression") return ["duplicate_canonical"]; if (candidate.action === "fix_parser") return ["success", "parser_drift", "empty_extraction"]; return []; }
function expectedModesForAdapter(adapter, input) { const g = gate(input, adapter), repairs = input.slaRepairPacket.repairs.filter((r) => r.adapter === adapter); return orderedModes([...(g?.missingModes ?? []), ...repairs.flatMap((repair) => expectedModes({ adapter, sourceFamily: family(adapter), action: actionForRepair(repair), repair, rationale: [] }, []))]); }
function decisionFor(recommendations) { return recommendations.some((r) => r.action === "escalate_release_hold" && r.priority === "p0") ? "escalate" : recommendations.some((r) => r.action === "disable_or_pause_source" && ["p0", "p1"].includes(r.priority)) ? "disable" : recommendations.some((r) => r.action !== "certify_adapter") ? "repair" : "certify"; }
function impactFor(candidate, impacts) { return impacts.find((i) => i.sourceId === candidate.sourceId && i.adapter === candidate.adapter) ?? impacts.find((i) => i.adapter === candidate.adapter) ?? { sourceId: candidate.sourceId ?? `adapter:${candidate.adapter}`, adapter: candidate.adapter, customerVisibleSearchImpact: ["static_html", "rss_feed", "advisory_signal"].includes(candidate.adapter) ? 0.78 : ["pdf_report", "dynamic_public_browser"].includes(candidate.adapter) ? 0.66 : 0.52, sourceFamilyCoverage: ["advisory_signal", "rss_feed"].includes(candidate.adapter) ? 0.72 : ["static_html", "pdf_report"].includes(candidate.adapter) ? 0.64 : 0.5, freshnessDebtHours: candidate.contract?.metrics.staleCount ? 24 * candidate.contract.metrics.staleCount : 0, duplicateRate: candidate.contract?.metrics.duplicateCanonicalCount ? 1 : 0, queryClasses: [] }; }
function dedupe(candidates) { const seen = new Set(); return candidates.filter((c) => { const key = `${c.adapter}:${c.sourceId ?? "adapter"}:${c.action}:${c.repair?.category ?? c.gate?.status ?? c.contract?.status ?? ""}`; if (seen.has(key)) return false; seen.add(key); return true; }); }
function contract(input, adapter) { return input.slaRepairPacket.contracts.find((x) => x.adapter === adapter); }
function gate(input, adapter) { return input.certificationPacket.adapterGates.find((x) => x.adapter === adapter); }
function family(adapter) { return { static_html: "static_html", rss_feed: "rss_feed", dynamic_public_browser: "dynamic_page", pdf_report: "pdf_report", public_channel_handoff: "public_channel", advisory_signal: "advisory_signal", multilingual_handoff: "multilingual_handoff" }[adapter]; }
function orderedModes(values) { return [...new Set(values)].sort((a, b) => MODE_ORDER.indexOf(a) - MODE_ORDER.indexOf(b)); }
function orderedAdapters(values) { return [...new Set(values)].sort((a, b) => ADAPTERS.indexOf(a) - ADAPTERS.indexOf(b)); }
function pOrder(priority) { return { p0: 0, p1: 1, p2: 2, p3: 3 }[priority]; }
function count(items, key, value) { return items.filter((item) => item[key] === value).length; }
function countBy(values) { return values.reduce((out, value) => ({ ...out, [value]: (out[value] ?? 0) + 1 }), {}); }
function uniq(values) { return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b))); }
function round(value) { return Math.round(value * 1000) / 1000; }
function hash(value) { return hashContent(value).slice(0, 16); }
