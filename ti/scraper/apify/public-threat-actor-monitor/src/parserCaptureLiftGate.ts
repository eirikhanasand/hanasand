import type { ParserCaptureLiftExample } from "./parserCaptureLiftExample.ts";

export interface ParserCaptureLiftGate {
  schemaVersion: "ti.apify_parser_capture_lift_gate.v1";
  owner: "agent_03";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  baselineRows: {
    total: 10;
    sellable: 4;
    caveated: 2;
    held: 4;
    averageBuyerValueScore: 0.577;
  };
  routeVisibleOn: Array<"Apify OUTPUT" | "/v1/sources/atlas" | "/v1/ops/product-slo" | "evidence_actor_dataset_promotion_preview">;
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  acceptedExamples: ParserCaptureLiftExample[];
  rejectedExamples: ParserCaptureLiftExample[];
  measurableLift: {
    rowsLifted: number;
    sellableRowsAdded: number;
    usefulRowsAdded: number;
    freshRowsAdded: number;
    caveatedRowsAdded: number;
    estimatedAverageBuyerValueDelta: number;
    sourceFamiliesImproved: string[];
    blockerCodesRemoved: string[];
  };
  rejectedRepairsDoNotCount: true;
  noLeakBoundary: {
    rawUrlExposed: false;
    rawBodyExposed: false;
    credentialPayloadMaterialExposed: false;
    privateAuthCaptchaRequired: false;
    restrictedRawMaterialExposed: false;
  };
}
