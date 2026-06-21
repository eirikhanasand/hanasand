import { CONFIGS, FORBIDDEN, safety } from "./adapterSlaConfig.ts";
import { breachesFor, metricsFor } from "./adapterSlaMetrics.ts";

export function buildContracts(input: any, thresholds: any) {
  return CONFIGS.map((config) => contractFor(config, input, thresholds));
}

export const routeContract = () => ({
  safeForPublicApi: true,
  stableFields: ["schemaVersion", "generatedAt", "readyForPromotion", "contracts", "repairs", "summary", "routeContract", "safety"],
  forbiddenFields: FORBIDDEN,
  compactApiProof: { noRawUrls: true, noRawText: true, noHtml: true, noPrivateAccess: true, dynamicBrowserDisabledByDefault: true, repairPacketsAreDryRun: true }
});

function contractFor([adapter, sourceFamily, parserProfile, enabledByDefault, canaryOnly]: any[], input: any, thresholds: any) {
  const observations = (input.observations ?? []).filter((o: any) => o.sourceFamily === sourceFamily);
  const translations = adapter === "multilingual_handoff" ? input.translationHandoffs ?? [] : [];
  const metrics = metricsFor(observations, translations, thresholds);
  const breaches = breachesFor(metrics, thresholds);
  const status = breaches.some((b) => b.severity === "hold") ? "hold" : breaches.length ? "warn" : "pass";
  return { schemaVersion: "ti.adapter_sla_contract.v1", generatedAt: input.generatedAt, adapter, sourceFamily, parserProfile, enabledByDefault: enabledByDefault && status !== "hold", canaryOnly: canaryOnly || status !== "pass", browserWorkersEnabled: false, metrics, thresholds, status, breaches, handoffs: contractHandoffs(status, breaches, adapter) };
}

function contractHandoffs(status: string, breaches: any[], adapter: string) {
  const has = (codes: string[]) => breaches.some((b) => codes.includes(b.code));
  return {
    agent01SourceGovernance: status === "hold" ? "hold_activation" : status === "warn" ? "review_source" : "none",
    agent02Scheduler: has(["rate_limited", "timeout", "stale_dates"]) ? status === "hold" ? "pause_or_reduce" : "backoff" : "normal",
    agent04CorrelationConfidence: status === "hold" ? "hold_correlation" : status === "warn" ? "lower_confidence" : "none",
    agent06EvidenceReplay: has(["duplicate_canonical"]) ? "suppress_duplicates" : has(["parser_confidence_low", "unsupported_mime", "extraction_warnings_high", "language_detection_drift"]) ? "replay_after_parser_repair" : "none",
    agent07ExtractionQuality: has(["parser_confidence_low", "unsupported_mime", "extraction_warnings_high", "language_detection_drift"]) ? status === "hold" ? "hold_extraction" : "repair_parser" : "accept",
    agent09ApiFields: status === "hold" ? "show_hold_codes" : status === "warn" ? "show_warning_codes" : "stable",
    agent10Runbooks: status === "hold" || adapter === "dynamic_public_browser" && has(["parser_confidence_low", "unsupported_mime", "extraction_warnings_high", "language_detection_drift"]) ? "release_hold" : status === "warn" ? "watch" : "green"
  };
}

export { safety };
