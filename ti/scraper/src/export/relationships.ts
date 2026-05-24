import type {
  ExtractedEntity,
  ExtractionProvenance,
  GraphRelationshipReviewState,
  Indicator,
  IntelligenceGraphNode,
  IntelligenceRelationship,
  IntelligenceRelationshipType,
  PipelineResult,
  ProgressiveEvidenceStage,
  RelationshipGraph
} from "../types.ts";
import { clampScore, stableId } from "../utils.ts";

export type RelationshipConfidenceRule =
  | "incident-mentions-entity"
  | "indicator-indicates-incident"
  | "incident-attributed-to-actor"
  | "actor-targets-victim"
  | "actor-uses-ttp"
  | "actor-uses-malware"
  | "actor-exploits-cve";

export const RELATIONSHIP_CONFIDENCE_RULES: Record<RelationshipConfidenceRule, {
  weight: number;
  description: string;
}> = {
  "incident-mentions-entity": {
    weight: 0.72,
    description: "Mention edges are supporting context and inherit reduced incident/entity confidence."
  },
  "indicator-indicates-incident": {
    weight: 0.9,
    description: "Indicator-to-incident edges combine indicator confidence with incident confidence."
  },
  "incident-attributed-to-actor": {
    weight: 0.86,
    description: "Attribution stays below direct evidence confidence until corroborated."
  },
  "actor-targets-victim": {
    weight: 0.82,
    description: "Targeting requires both grounded actor and victim evidence."
  },
  "actor-uses-ttp": {
    weight: 0.78,
    description: "TTP use is conservative because ATT&CK extraction is often ambiguous."
  },
  "actor-uses-malware": {
    weight: 0.88,
    description: "Malware use is stronger than broad TTP use when malware evidence is explicit."
  },
  "actor-exploits-cve": {
    weight: 0.84,
    description: "Exploit edges require actor and CVE evidence and stay below raw CVE confidence."
  }
};

export function buildRelationshipGraph(result: PipelineResult): RelationshipGraph {
  const nodes = new Map<string, IntelligenceGraphNode>();
  const relationships = new Map<string, IntelligenceRelationship>();

  const incident = result.incident;
  if (!incident) return { nodes: [], relationships: [] };

  const captureProvenance: ExtractionProvenance[] = result.capture.provenance ? [{
    ...result.capture.provenance,
    extractorVersion: result.capture.provenance.extractorVersion ?? String(result.capture.metadata.extractorVersion ?? "unknown")
  }] : [];
  const incidentNode = addNode(nodes, {
    id: incident.id,
    type: "incident",
    value: incident.title,
    confidence: incident.confidence,
    provenance: captureProvenance,
    properties: { sourceId: incident.sourceId, captureId: incident.captureId, summary: incident.summary }
  });

  const actors = result.entities.filter((entity) => entity.type === "actor");
  const victims = result.entities.filter((entity) => entity.type === "victim");
  const sectors = result.entities.filter((entity) => entity.type === "sector");
  const countries = result.entities.filter((entity) => entity.type === "country");
  const ttps = result.entities.filter((entity) => entity.type === "ttp");
  const malware = result.entities.filter((entity) => entity.type === "malware" || entity.type === "ransomware_family");
  const cves = result.entities.filter((entity) => entity.type === "cve");

  for (const entity of result.entities) {
    const node = nodeFromEntity(entity);
    addNode(nodes, node);
    addRelationship(relationships, edge(incidentNode.id, node.id, "mentions", relationshipConfidence("incident-mentions-entity", incident.confidence, entity.confidence), incident.firstSeenAt, node.provenance, "incident-mentions-entity"));
  }

  for (const indicator of result.indicators) {
    const node = nodeFromIndicator(indicator);
    addNode(nodes, node);
    addRelationship(relationships, edge(node.id, incidentNode.id, "indicates", relationshipConfidence("indicator-indicates-incident", indicator.confidence, incident.confidence), incident.firstSeenAt, node.provenance, "indicator-indicates-incident"));
  }

  for (const actor of actors) {
    const actorNode = nodeFromEntity(actor);
    addRelationship(relationships, edge(incidentNode.id, actorNode.id, "attributed-to", relationshipConfidence("incident-attributed-to-actor", incident.confidence, actor.confidence), incident.firstSeenAt, actor.provenance ?? [], "incident-attributed-to-actor"));

    for (const victim of victims) {
      const victimNode = nodeFromEntity(victim);
      addRelationship(relationships, edge(actorNode.id, victimNode.id, "targets", relationshipConfidence("actor-targets-victim", actor.confidence, victim.confidence), incident.firstSeenAt, mergeProvenance(actor, victim), "actor-targets-victim"));

      for (const sector of sectors) {
        const sectorNode = nodeFromEntity(sector);
        addRelationship(relationships, edge(victimNode.id, sectorNode.id, "related-to", relationshipConfidence("incident-mentions-entity", victim.confidence, sector.confidence), incident.firstSeenAt, mergeProvenance(victim, sector), "incident-mentions-entity"));
      }

      for (const country of countries) {
        const countryNode = nodeFromEntity(country);
        addRelationship(relationships, edge(victimNode.id, countryNode.id, "located-in", relationshipConfidence("incident-mentions-entity", victim.confidence, country.confidence), incident.firstSeenAt, mergeProvenance(victim, country), "incident-mentions-entity"));
      }
    }

    for (const ttp of ttps) {
      const ttpNode = nodeFromEntity(ttp);
      addRelationship(relationships, edge(actorNode.id, ttpNode.id, "uses", relationshipConfidence("actor-uses-ttp", actor.confidence, ttp.confidence), incident.firstSeenAt, mergeProvenance(actor, ttp), "actor-uses-ttp"));
    }

    for (const used of malware) {
      const usedNode = nodeFromEntity(used);
      addRelationship(relationships, edge(actorNode.id, usedNode.id, "uses", relationshipConfidence("actor-uses-malware", actor.confidence, used.confidence), incident.firstSeenAt, mergeProvenance(actor, used), "actor-uses-malware"));
    }

    for (const cve of cves) {
      const cveNode = nodeFromEntity(cve);
      addRelationship(relationships, edge(actorNode.id, cveNode.id, "exploits", relationshipConfidence("actor-exploits-cve", actor.confidence, cve.confidence), incident.firstSeenAt, mergeProvenance(actor, cve), "actor-exploits-cve"));
    }
  }

  return {
    nodes: [...nodes.values()],
    relationships: [...relationships.values()].map((relationship) => applyCaptureReviewMetadata(relationship, result))
  };
}

function nodeFromEntity(entity: ExtractedEntity): IntelligenceGraphNode {
  const value = entity.normalizedValue ?? entity.value;
  const type = entity.type === "ttp"
    ? "attack-pattern"
    : entity.type === "cve"
      ? "vulnerability"
      : entity.type === "ransomware_family"
        ? "malware"
        : entity.type === "sector"
          ? "sector"
          : entity.type === "country"
            ? "country"
          : entity.type;

  return {
    id: stableId("node", `${type}:${value.toLowerCase()}`),
    type,
    value,
    confidence: entity.confidence,
    provenance: entity.provenance ?? [],
    properties: { rawValue: entity.rawValue, aliases: entity.aliases, reviewReasons: entity.reviewReasons }
  };
}

function nodeFromIndicator(indicator: Indicator): IntelligenceGraphNode {
  const value = indicator.normalizedValue ?? indicator.value;
  return {
    id: stableId("node", `indicator:${indicator.type}:${value}`),
    type: indicator.type === "cve" ? "vulnerability" : "indicator",
    value,
    confidence: indicator.confidence,
    provenance: indicator.provenance ?? [],
    properties: { indicatorType: indicator.type, rawValue: indicator.rawValue, reviewReasons: indicator.reviewReasons }
  };
}

function addNode(nodes: Map<string, IntelligenceGraphNode>, node: IntelligenceGraphNode): IntelligenceGraphNode {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
  return nodes.get(node.id) ?? node;
}

function addRelationship(relationships: Map<string, IntelligenceRelationship>, relationship: IntelligenceRelationship): void {
  if (relationship.provenance.length === 0) return;
  relationships.set(relationship.id, relationship);
}

function edge(
  sourceRef: string,
  targetRef: string,
  type: IntelligenceRelationshipType,
  confidence: number,
  seenAt: string,
  provenance: ExtractionProvenance[],
  confidenceRule: RelationshipConfidenceRule
): IntelligenceRelationship {
  return {
    id: stableId("rel", `${sourceRef}:${type}:${targetRef}`),
    sourceRef,
    targetRef,
    type,
    confidence: clampScore(confidence),
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    provenance,
    properties: {
      grounded: true,
      confidenceRule,
      confidenceRuleDescription: RELATIONSHIP_CONFIDENCE_RULES[confidenceRule].description
    }
  };
}

export function relationshipConfidence(rule: RelationshipConfidenceRule, left: number, right: number): number {
  const base = (clampScore(left) + clampScore(right)) / 2;
  return clampScore(base * RELATIONSHIP_CONFIDENCE_RULES[rule].weight);
}

function mergeProvenance(left: ExtractedEntity, right: ExtractedEntity): ExtractionProvenance[] {
  if (!left.provenance?.length || !right.provenance?.length) return [];
  const seen = new Set<string>();
  return [...(left.provenance ?? []), ...(right.provenance ?? [])].filter((provenance) => {
    const key = `${provenance.captureId}:${provenance.startOffset}:${provenance.endOffset}:${provenance.evidenceText}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyCaptureReviewMetadata(relationship: IntelligenceRelationship, result: PipelineResult): IntelligenceRelationship {
  const reviewState = graphReviewStateOrUndefined(result.capture.metadata.graphReviewState);
  return {
    ...relationship,
    properties: {
      ...relationship.properties,
      stage: progressiveStageForCapture(result),
      liveEvidenceStage: result.capture.metadata.evidenceStage,
      sourceFamily: sourceFamilyForCapture(result),
      publicChannelOnly: result.capture.metadata.adapter === "telegram_public" || result.capture.metadata.evidenceStage === "public_channel_message",
      restrictedHeld: result.capture.storageKind === "metadata_only" || result.capture.metadata.evidenceStage === "metadata_only_claim",
      reviewState: reviewState ?? relationship.properties?.reviewState,
      reviewReason: typeof result.capture.metadata.graphReviewReason === "string" ? result.capture.metadata.graphReviewReason : undefined,
      promoted: relationship.properties?.promoted === true || reviewState === "accepted",
      contradicted: relationship.properties?.contradicted === true || reviewState === "contradicted"
    }
  };
}

function graphReviewStateOrUndefined(value: unknown): GraphRelationshipReviewState | undefined {
  const allowed: GraphRelationshipReviewState[] = [
    "unreviewed",
    "needs_review",
    "accepted",
    "rejected",
    "superseded",
    "contradicted",
    "expired"
  ];
  return allowed.includes(value as GraphRelationshipReviewState) ? value as GraphRelationshipReviewState : undefined;
}

function progressiveStageForCapture(result: PipelineResult): ProgressiveEvidenceStage {
  if (result.capture.metadata.graphReviewState === "accepted") return "reviewed";
  const stage = result.capture.metadata.evidenceStage;
  if (stage === "reviewed_promoted") return "promoted";
  if (stage === "extracted_relationship") return "extracted";
  if (stage === "captured_page") return "captured";
  if (stage === "public_channel_message" || stage === "metadata_only_claim" || stage === "live_discovery" || stage === "seeded") return "discovery";
  if (result.capture.metadata.adapter === "telegram_public") return "discovery";
  return "captured";
}

function sourceFamilyForCapture(result: PipelineResult): "clear_web" | "public_channel" | "restricted_metadata" | "seeded" {
  if (result.capture.metadata.adapter === "telegram_public" || result.capture.metadata.evidenceStage === "public_channel_message") return "public_channel";
  if (result.capture.storageKind === "metadata_only" || result.capture.metadata.evidenceStage === "metadata_only_claim") return "restricted_metadata";
  if (result.capture.metadata.evidenceStage === "seeded") return "seeded";
  return "clear_web";
}
