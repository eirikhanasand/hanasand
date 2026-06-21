import type { ProgramDdCurrentSellable750Lift } from "./programDdCurrentSellable750Lift.ts";

export type ProgramFgCurrentSellable1000Lift = Omit<ProgramDdCurrentSellable750Lift, "schemaVersion" | "sourcePackets" | "baseline" | "acceptedRows" | "targetProgress"> & {
  schemaVersion: "ti.program_fg_current_sellable_1000_lift.v1";
  sourcePackets: Array<"darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1000" | "darkMetadataPublicSupportLift4000.publicSupportSellable500.currentChargeable1250" | "graphPublicCorroborationPivotPacket.paidRowUnlockQueue.parserAdmissionHandoff" | "agent04_high_value_public_source_replacements" | "existing_public_source_rows">;
  baseline: { sellableRows: 750; sellableFindings: 693; sellableSourceProvenanceRows: 57; sourceProvenanceShare: 0.076 };
  acceptedRows: Array<Omit<ProgramDdCurrentSellable750Lift["acceptedRows"][number], "sourcePacket"> & {
    sourcePacket: "agent05_current_chargeable1000" | "agent08_parser_ready_public_proof" | "agent04_high_value_public_source_replacement" | "existing_public_source_row";
    confidenceReason: string;
  }>;
  targetProgress: {
    targetCurrentSellableRows: 1000;
    remainingGapTo1000: number;
    minimumTrueFindingShare: 0.55;
    remainingFindingGapTo55Percent: number;
    maximumSourceProvenanceShare: 0.4;
    nextTargetCurrentSellableRows: 1500;
    remainingGapTo1500: number;
    next1500Plan: {
      targetCurrentSellableRows: 1500;
      additionalRowsNeeded: number;
      minimumTrueFindingsAt1500: number;
      maximumSourceProvenanceRowsAt1500: number;
      sourcePackets: string[];
      projectedRowsCountTowardCurrent: false;
    };
  };
};
