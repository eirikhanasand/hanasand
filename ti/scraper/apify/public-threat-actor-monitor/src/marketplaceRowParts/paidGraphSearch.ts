export interface PaidGraphSearchPack {
  schemaVersion: "ti.apify_paid_graph_search_pack.v1";
  queryType: QueryType;
  buyerIntent: string;
  primaryEntity: string;
  normalizedAliases: string[];
  usefulNextSearches: string[];
  sourceFamilyCorroboration: "corroborated" | "single_source" | "metadata_only" | "unverified";
  contradictionCaveatState: "none" | "caveated" | "contradicted" | "held";
  suppressedNoisyPivots: string[];
  exportEligibility: "eligible" | "review_required" | "not_exportable";
  whyWorthPayingForOrHeld: string;
  noLeak: true;
}

export type QueryType =
  | "actor"
  | "victim"
  | "sector"
  | "country"
  | "ttp"
  | "tool"
  | "campaign"
  | "ransomware_group"
  | "unknown"
  | "alias_collision";
