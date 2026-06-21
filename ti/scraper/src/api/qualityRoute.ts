import { searchQualityApiExamples } from "../pipeline/searchQualityGate.ts";

export function qualityPayload(query: string) {
  const alias = /akira|alphv|blackcat|scattered spider|shinyhunters/i.test(query);
  return {
    quality: {
      query,
      status: "partial",
      score: alias ? 0.42 : 0.6,
      canPromoteToReady: false,
      publicWarningText: alias ? ["actor aliases or ransomware rebrand overlap require analyst review before public promotion"] : ["captured-page or reviewed evidence is insufficient"],
      publicWarningCodes: alias ? ["alias_collision_warning", "partial"] : ["partial"],
      analystActions: alias ? [{ kind: "suppress_noisy_alias", label: "Suppress noisy alias", manualOnly: true, evidenceIds: [] }] : [{ kind: "request_more_capture_evidence", label: "Request more capture evidence", manualOnly: false, evidenceIds: [] }]
    },
    dashboard: { useful: true },
    entityResolutionWorkbench: { query, aliasCollisionWarning: alias },
    examples: searchQualityApiExamples()
  };
}
