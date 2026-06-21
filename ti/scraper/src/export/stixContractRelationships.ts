export const STIX_CONTRACT_RELATIONSHIPS = [
  rel("alias-of", "alias-of"),
  rel("attributed-to", "attributed-to"),
  rel("targets", "targets"),
  rel("uses", "uses"),
  rel("indicates", "indicates"),
  rel("exploits", "exploits"),
  rel("communicates-with", "communicates-with"),
  rel("derived-from", "derived-from"),
  rel("mentions", "related-to", "accepted and provenance-backed; never for weak discovery-only co-mentions"),
  rel("located-in", "located-in"),
  rel("active-in", "located-at"),
  rel("observed-in", "based-on"),
  rel("sighted", "sighting", "future STIX sighting export; blocked from relationship facts today"),
  rel("related-to", "related-to", "accepted and provenance-backed; weak edges stay review metadata")
];

function rel(graphRelationship: string, stixRelationship: string, factGate = "accepted and provenance-backed") {
  return { graphRelationship, stixRelationship, factGate };
}
