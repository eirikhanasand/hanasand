export const STIX_CONTRACT_OBJECTS = [
  object("actor", "intrusion-set", "normalized actor name", ["name", "aliases", "confidence", "external_references", "x_ti_provenance"]),
  object("malware", "malware", "normalized malware or ransomware family name", ["name", "labels", "confidence", "external_references", "x_ti_provenance"]),
  object("tool", "malware", "normalized tool name", ["name", "labels", "confidence", "external_references", "x_ti_graph_node_type"]),
  object("attack-pattern", "attack-pattern", "MITRE ATT&CK technique id when present, otherwise normalized name", ["name", "confidence", "external_references", "x_ti_attack_tactic", "x_ti_provenance"]),
  object("indicator", "indicator", "indicator type and normalized value", ["name", "pattern", "pattern_type", "valid_from", "confidence", "external_references", "x_ti_provenance"]),
  object("vulnerability", "vulnerability", "CVE id or normalized vulnerability name", ["name", "confidence", "external_references", "x_ti_provenance"]),
  object("victim", "identity", "victim label and normalized organization name", ["name", "labels", "confidence", "external_references", "x_ti_provenance"]),
  object("sector", "identity", "sector label and normalized sector name", ["name", "labels", "confidence", "x_ti_graph_node_type"]),
  object("country", "identity", "country label and normalized country name", ["name", "labels", "confidence", "x_ti_graph_node_type"]),
  object("report", "report", "pipeline incident or report id", ["name", "description", "object_refs", "confidence", "external_references", "x_ti_provenance"]),
  object("relationship", "relationship", "graph relationship id", [
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
  ]),
  object("marking", "marking-definition", "fixed review-required marking name", ["name", "definition_type", "definition"])
];

function object(graphType: string, stixType: string, idBasis: string, fields: string[]) {
  return { graphType, stixType, idBasis, fields };
}
