import type { Stix21MappingContractDto } from "../types.ts";

export const STIX_21_GRAPH_MAPPING_CONTRACT: Stix21MappingContractDto = {
  specVersion: "2.1",
  objects: [
    {
      graphType: "actor",
      stixType: "intrusion-set",
      idBasis: "normalized actor name",
      fields: ["name", "aliases", "confidence", "external_references", "x_ti_provenance"]
    },
    {
      graphType: "malware",
      stixType: "malware",
      idBasis: "normalized malware or ransomware family name",
      fields: ["name", "labels", "confidence", "external_references", "x_ti_provenance"]
    },
    {
      graphType: "tool",
      stixType: "malware",
      idBasis: "normalized tool name",
      fields: ["name", "labels", "confidence", "external_references", "x_ti_graph_node_type"]
    },
    {
      graphType: "attack-pattern",
      stixType: "attack-pattern",
      idBasis: "MITRE ATT&CK technique id when present, otherwise normalized name",
      fields: ["name", "confidence", "external_references", "x_ti_attack_tactic", "x_ti_provenance"]
    },
    {
      graphType: "indicator",
      stixType: "indicator",
      idBasis: "indicator type and normalized value",
      fields: ["name", "pattern", "pattern_type", "valid_from", "confidence", "external_references", "x_ti_provenance"]
    },
    {
      graphType: "vulnerability",
      stixType: "vulnerability",
      idBasis: "CVE id or normalized vulnerability name",
      fields: ["name", "confidence", "external_references", "x_ti_provenance"]
    },
    {
      graphType: "victim",
      stixType: "identity",
      idBasis: "victim label and normalized organization name",
      fields: ["name", "labels", "confidence", "external_references", "x_ti_provenance"]
    },
    {
      graphType: "sector",
      stixType: "identity",
      idBasis: "sector label and normalized sector name",
      fields: ["name", "labels", "confidence", "x_ti_graph_node_type"]
    },
    {
      graphType: "country",
      stixType: "identity",
      idBasis: "country label and normalized country name",
      fields: ["name", "labels", "confidence", "x_ti_graph_node_type"]
    },
    {
      graphType: "report",
      stixType: "report",
      idBasis: "pipeline incident or report id",
      fields: ["name", "description", "object_refs", "confidence", "external_references", "x_ti_provenance"]
    },
    {
      graphType: "relationship",
      stixType: "relationship",
      idBasis: "graph relationship id",
      fields: [
        "relationship_type",
        "source_ref",
        "target_ref",
        "confidence",
        "first_seen",
        "last_seen",
        "external_references",
        "object_marking_refs",
        "x_ti_provenance",
        "x_ti_review_state",
        "x_ti_evidence_support_ids"
      ]
    },
    {
      graphType: "marking",
      stixType: "marking-definition",
      idBasis: "fixed review-required marking name",
      fields: ["name", "definition_type", "definition"]
    }
  ],
  relationships: [
    { graphRelationship: "alias-of", stixRelationship: "alias-of", factGate: "accepted and provenance-backed" },
    { graphRelationship: "attributed-to", stixRelationship: "attributed-to", factGate: "accepted and provenance-backed" },
    { graphRelationship: "targets", stixRelationship: "targets", factGate: "accepted and provenance-backed" },
    { graphRelationship: "uses", stixRelationship: "uses", factGate: "accepted and provenance-backed" },
    { graphRelationship: "indicates", stixRelationship: "indicates", factGate: "accepted and provenance-backed" },
    { graphRelationship: "exploits", stixRelationship: "exploits", factGate: "accepted and provenance-backed" },
    { graphRelationship: "communicates-with", stixRelationship: "communicates-with", factGate: "accepted and provenance-backed" },
    { graphRelationship: "derived-from", stixRelationship: "derived-from", factGate: "accepted and provenance-backed" },
    { graphRelationship: "mentions", stixRelationship: "related-to", factGate: "accepted and provenance-backed; never for weak discovery-only co-mentions" },
    { graphRelationship: "located-in", stixRelationship: "located-in", factGate: "accepted and provenance-backed" },
    { graphRelationship: "active-in", stixRelationship: "located-at", factGate: "accepted and provenance-backed" },
    { graphRelationship: "observed-in", stixRelationship: "based-on", factGate: "accepted and provenance-backed" },
    { graphRelationship: "sighted", stixRelationship: "sighting", factGate: "future STIX sighting export; blocked from relationship facts today" },
    { graphRelationship: "related-to", stixRelationship: "related-to", factGate: "accepted and provenance-backed; weak edges stay review metadata" }
  ],
  markings: [
    {
      name: "TI Scraper Review Required",
      usage: "Attached to exported graph relationship facts and used by blocked metadata to explain why weak edges were withheld."
    }
  ],
  externalReferences: [
    "MITRE ATT&CK external_id on attack-pattern objects",
    "source URL, capture id, source id, and content hash for evidence-backed objects and relationships",
    "CVE identifiers remain vulnerability names and can be mirrored as external ids by downstream enrichers"
  ],
  customProvenanceFields: [
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
  ],
  weakEdgePolicy: "Only relationships that pass STIX export readiness become STIX relationship facts. Rejected, contradicted, stale, discovery-only, missing-provenance, unsupported, and below-threshold edges are withheld as x_ti_blocked_relationships metadata.",
  confidenceMapping: {
    inputRange: "0_to_1_graph_confidence",
    stixRange: "0_to_100_integer",
    rounding: "nearest_integer_clamped",
    reviewHoldThreshold: 0.5
  },
  attackTechniqueHandling: {
    mitreExternalIdPattern: "T####_optional_subtechnique",
    revokedOrDeprecatedPolicy: "export_only_as_review_metadata_until_replaced",
    requiredExternalReferenceFields: ["source_name", "external_id", "url"]
  },
  hardeningFixtures: [
    { name: "actor_uses_tool", graphRelationship: "uses", sourceObject: "intrusion-set", targetObject: "malware/tool", expectedStixRelationship: "uses", exportGate: "accepted and provenance-backed" },
    { name: "actor_uses_malware", graphRelationship: "uses", sourceObject: "intrusion-set", targetObject: "malware", expectedStixRelationship: "uses", exportGate: "accepted and provenance-backed" },
    { name: "actor_exploits_cve", graphRelationship: "exploits", sourceObject: "intrusion-set", targetObject: "vulnerability", expectedStixRelationship: "exploits", exportGate: "accepted and provenance-backed" },
    { name: "actor_targets_victim", graphRelationship: "targets", sourceObject: "intrusion-set", targetObject: "identity/victim", expectedStixRelationship: "targets", exportGate: "accepted and provenance-backed" },
    { name: "campaign_uses_ttp", graphRelationship: "uses", sourceObject: "report/campaign", targetObject: "attack-pattern", expectedStixRelationship: "uses", exportGate: "ATT&CK id current or reviewed replacement" },
    { name: "revoked_deprecated_attack_id", graphRelationship: "uses", sourceObject: "intrusion-set", targetObject: "attack-pattern", expectedStixRelationship: "uses", exportGate: "blocked as review metadata until replacement technique is selected" }
  ],
  taxiiBoundary: "descriptor_only_no_server"
};
