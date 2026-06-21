import type { MarketplaceRow } from "./marketplaceRow.ts";

export interface PaidGraphSearchPackGate {
  schemaVersion: "ti.apify_paid_graph_search_pack_gate.v1";
  baselineRunId: "OThlfd0uzSCNnedAO";
  baselineDatasetId: "LSen2fYtwFTtOr7vK";
  dryRun: true;
  willMutateSources: false;
  willStartCollection: false;
  packCount: number;
  usefulNextSearchCount: number;
  unsupportedPivotsSuppressed: number;
  rowsPromotedFromGenericToUseful: number;
  marketplaceSampleRowsImproved: number;
  averageBuyerValueDelta: number;
  examples: Array<{
    query: string;
    queryType: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["queryType"];
    buyerIntent: string;
    primaryEntity: string;
    normalizedAliases: string[];
    usefulNextSearches: string[];
    sourceFamilyCorroboration: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["sourceFamilyCorroboration"];
    contradictionCaveatState: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["contradictionCaveatState"];
    suppressedNoisyPivots: string[];
    exportEligibility: NonNullable<MarketplaceRow["paidGraphSearchPack"]>["exportEligibility"];
    whyWorthPayingForOrHeld: string;
    noLeak: true;
  }>;
  rejectionGates: Array<{
    id: string;
    blockedReason: "stale_only_evidence" | "generic_relationship" | "missing_provenance" | "no_buyer_action" | "unsafe_raw_content" | "unsupported_alias_expansion" | "single_source_without_caveat" | "unrelated_pivot";
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08";
    proofNote: string;
    noLeak: true;
  }>;
  ownerHandoffs: Array<{
    owner: "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_09" | "agent_10";
    blocker: string;
    expectedEffect: string;
  }>;
}
