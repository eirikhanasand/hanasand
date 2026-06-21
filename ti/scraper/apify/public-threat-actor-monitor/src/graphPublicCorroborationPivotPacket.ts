import type { ProgramFhHostedPublicCorroborationLift } from "./programFhHostedPublicCorroborationLift.ts";

export interface GraphPublicCorroborationPivotPacket {
  schemaVersion: "ti.apify_graph_public_corroboration_pivot_packet.v1";
  routeVisibleOn: Array<"Apify OUTPUT" | "Apify dataset rows" | "/v1/ops/product-slo" | "/v1/intel/search" | "/v1/contracts#apifyStoreReadiness">;
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  productionSellableFloor: 100;
  candidateCount: number;
  rowUnlockingCandidateCount: number;
  contradictionOrAliasHoldCount: number;
  graphOnlyRowsExcludedFromFloor: number;
  projectedSellableRowsAfterPublicCorroboration: number;
  publicProofMetrics: any;
  hostedDefaultPublicCorroborationLift: ProgramFhHostedPublicCorroborationLift;
  paidRowUnlockQueue: any;
  averageProjectedConfidenceLift: number;
  candidates: any[];
  integrationHandoffs?: any[];
  ownerHandoffs: any[];
  noLeakBoundary: any;
}
