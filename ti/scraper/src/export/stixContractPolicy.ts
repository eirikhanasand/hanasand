export const STIX_MARKINGS = [
  {
    name: "TI Scraper Review Required",
    usage: "Attached to exported graph relationship facts and used by blocked metadata to explain why weak edges were withheld."
  }
];

export const STIX_EXTERNAL_REFERENCES = [
  "MITRE ATT&CK external_id on attack-pattern objects",
  "source URL, capture id, source id, and content hash for exported objects and relationships",
  "CVE identifiers remain vulnerability names and can be mirrored as external ids by downstream enrichers"
];

export const STIX_CUSTOM_PROVENANCE_FIELDS = [
  "x_ti_provenance",
  "x_ti_review_state",
  "x_ti_workflow_state",
  "x_ti_evidence_support_ids",
  "x_ti_blocked_relationships",
  "x_ti_graph_node_id",
  "x_ti_graph_node_type",
  "x_ti_first_seen",
  "x_ti_last_seen",
  "x_ti_tenant_id"
];

export const STIX_WEAK_EDGE_POLICY = "Only relationships that pass STIX export readiness become STIX relationship facts. Rejected, contradicted, stale, discovery-only, missing-provenance, unsupported, and below-threshold edges are withheld as x_ti_blocked_relationships metadata.";
export const STIX_CONFIDENCE_MAPPING = { inputRange: "0_to_1_graph_confidence", stixRange: "0_to_100_integer", rounding: "nearest_integer_clamped", reviewHoldThreshold: 0.5 };
export const STIX_ATTACK_TECHNIQUE_HANDLING = { mitreExternalIdPattern: "T####_optional_subtechnique", revokedOrDeprecatedPolicy: "export_only_as_review_metadata_until_replaced", requiredExternalReferenceFields: ["source_name", "external_id", "url"] };
export const STIX_HARDENING_FIXTURES = [
  fixture("actor_uses_tool", "uses", "intrusion-set", "malware/tool", "uses"),
  fixture("actor_uses_malware", "uses", "intrusion-set", "malware", "uses"),
  fixture("actor_exploits_cve", "exploits", "intrusion-set", "vulnerability", "exploits"),
  fixture("actor_targets_victim", "targets", "intrusion-set", "identity/victim", "targets"),
  fixture("campaign_uses_ttp", "uses", "report/campaign", "attack-pattern", "uses", "ATT&CK id current or reviewed replacement"),
  fixture("revoked_deprecated_attack_id", "uses", "intrusion-set", "attack-pattern", "uses", "blocked as review metadata until replacement technique is selected")
];

function fixture(name: string, graphRelationship: string, sourceObject: string, targetObject: string, expectedStixRelationship: string, exportGate = "accepted and provenance-backed") {
  return { name, graphRelationship, sourceObject, targetObject, expectedStixRelationship, exportGate };
}
