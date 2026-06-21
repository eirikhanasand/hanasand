import type { MarketplaceRow } from "../marketplaceRow.ts";

type FreshnessStatus = MarketplaceRow["freshnessStatus"];

export interface BuyerSearchCard {
  schemaVersion: "ti.apify_buyer_search_card.v1";
  status: "sellable" | "lead" | "coverage_gap" | "held";
  actor: string;
  summary: string;
  recentActivity: string[];
  victimsTargets: string[];
  ttpTools: string[];
  sourcePivots: string[];
  freshness: {
    status: FreshnessStatus;
    observedAt?: string;
    firstReportedAt?: string;
    lastReportedAt?: string;
  };
  confidence: {
    score: number;
    label: "high" | "medium" | "low";
    reason: string;
  };
  nextSearches: string[];
  safety: {
    noRawLeakData: true;
    noUnsafeUrls: true;
    noCredentials: true;
    restrictedMaterial: "metadata_only_or_suppressed";
  };
}
