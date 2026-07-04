// @ts-nocheck
import type { PersistedGraphSnapshot } from "../types.ts";
import { compactContract } from "./graphViewsCore.ts";

export const buildGraphRuntimeApiDto = (snapshot: PersistedGraphSnapshot) => ({ nodes: snapshot.nodes.length, relationships: snapshot.relationships.length, generatedAt: snapshot.generatedAt });
export const buildGraphBackendRepositoryContractDto = () => compactContract("graph_backend_repository");
export const buildGraphBackendCutoverRehearsalDto = () => compactContract("graph_backend_cutover");
export const buildGraphBackendPerformanceSoakDto = () => compactContract("graph_backend_soak");
export const buildGraphNeo4jMigrationAdapterBenchmarkDto = () => compactContract("graph_neo4j_benchmark");
export const buildGraphBackendAdapterCutoverContractDto = () => compactContract("graph_backend_adapter_cutover");
export const buildGraphBackendMigrationCertificationDto = () => compactContract("graph_backend_migration");
export const buildGraphQueryCostControlsDto = () => ({ maxDepth: 2, maxRelationships: 500, defaultLimit: 50 });
export const buildGraphRelationshipDriftMonitorDto = (snapshot: PersistedGraphSnapshot) => ({ driftSignals: [], relationshipCount: snapshot.relationships.length });
export const buildGraphRelationshipExplainabilityDto = (_snapshot: PersistedGraphSnapshot, relationshipId?: string) => ({ relationshipId, explanation: "relationship can export when source detail and review state permit export" });
export const downgradeAndExpireStaleRelationships = (snapshot: PersistedGraphSnapshot) => ({ ...snapshot, relationships: snapshot.relationships.map((rel: any) => ({ ...rel, reviewState: rel.reviewState ?? "proposed" })) });
