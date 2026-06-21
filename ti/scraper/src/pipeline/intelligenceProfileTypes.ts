export type ExtractionProfileKind = "actor_intelligence" | "ransomware_victim_intelligence" | "vulnerability_exploitation" | "malware_tooling" | "infrastructure_ioc" | "attack_ttp";
export type EvidenceStage = "seeded" | "live_discovery" | "captured_page" | "public_channel_message" | "metadata_only_claim" | "extracted_relationship" | "reviewed_promoted";
export type EvidenceChangeKind = "added" | "promoted" | "downgraded" | "blocked";
export type TiConfidenceCaveatCode = "direct_attribution" | "vendor_reported_attribution" | "unverified_claim" | "live_snippet_only" | "public_channel_mention" | "metadata_only_leak_claim" | "historical_context" | "contradicted" | "stale" | "needs_review";
export type AttributionSignal = "direct_attribution" | "suspected_attribution" | "historical_background" | "vendor_disagreement" | "weak_co_mention" | "machine_translation_uncertainty" | "extracted_not_actionable";
export type GroundingReference = any; export type TiConfidenceCaveat = any; export type TemporalExtraction = any;
export type ActorQueryExtractionProfile = any; export type TiSearchResultDto = any;
export type StagedEvidenceInput = any; export type EvidenceDeltaSummary = any;
