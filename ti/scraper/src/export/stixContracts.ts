import type { Stix21MappingContractDto } from "../types.ts";
import { STIX_CONTRACT_OBJECTS } from "./stixContractObjects.ts";
import { STIX_CONTRACT_RELATIONSHIPS } from "./stixContractRelationships.ts";
import {
  STIX_ATTACK_TECHNIQUE_HANDLING,
  STIX_CONFIDENCE_MAPPING,
  STIX_CUSTOM_PROVENANCE_FIELDS,
  STIX_EXTERNAL_REFERENCES,
  STIX_HARDENING_FIXTURES,
  STIX_MARKINGS,
  STIX_WEAK_EDGE_POLICY
} from "./stixContractPolicy.ts";

export const STIX_21_GRAPH_MAPPING_CONTRACT: Stix21MappingContractDto = {
  specVersion: "2.1",
  objects: STIX_CONTRACT_OBJECTS,
  relationships: STIX_CONTRACT_RELATIONSHIPS,
  markings: STIX_MARKINGS,
  externalReferences: STIX_EXTERNAL_REFERENCES,
  customProvenanceFields: STIX_CUSTOM_PROVENANCE_FIELDS,
  weakEdgePolicy: STIX_WEAK_EDGE_POLICY,
  confidenceMapping: STIX_CONFIDENCE_MAPPING,
  attackTechniqueHandling: STIX_ATTACK_TECHNIQUE_HANDLING,
  hardeningFixtures: STIX_HARDENING_FIXTURES,
  taxiiBoundary: "descriptor_only_no_server"
};
