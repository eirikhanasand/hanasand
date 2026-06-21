import type { HostedDefaultParserLiftContract } from "./commonActorTypes.ts";
import type { ProgramDdCurrentSellable750Lift } from "./programDdCurrentSellable750Lift.ts";
import type { ProgramFgCurrentSellable1000Lift } from "./programFgCurrentSellable1000Lift.ts";

export interface ParserRealSellableLift {
  schemaVersion: "ti.apify_parser_real_sellable_lift.v1";
  owner: "agent_03";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: false;
  willMutateSources: false;
  willStartCollection: false;
  productionSellableClaimed: false;
  repairedRowCount: number;
  promotedSellableRows: number;
  movedToUsefulCaveatedRows: number;
  liveSourceAdmissionPacket: any;
  hostedDefaultParserLift: HostedDefaultParserLiftContract;
  currentAdmissionLedger: any;
  findingAdmissionLedger: {
    currentSellable750Lift: ProgramDdCurrentSellable750Lift;
    currentSellable1000Lift: ProgramFgCurrentSellable1000Lift;
    [key: string]: any;
  };
  staleRowsSuppressed: number;
  aliasOrUnrelatedRowsSuppressed: number;
  rowsStillOneRepairAway: number;
  averageConfidence: number;
  parserFieldsRequired: string[];
  repairedRows: any[];
  rejectionRows: any[];
  ownerHandoffs: any[];
  noLeakBoundary: any;
}
