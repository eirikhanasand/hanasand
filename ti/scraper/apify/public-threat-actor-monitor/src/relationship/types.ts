import type { EvidenceSourceFamily, MarketplaceRow } from "../types.ts";

export interface RelationshipInsightContext {
  claimType?: string;
  victimName?: string;
  affectedSectors?: string[];
  countries?: string[];
  ttp?: string;
  attackId?: string;
  tactic?: string;
  title?: string;
  sourceFamilies?: EvidenceSourceFamily[];
  sourceIds?: string[];
  contradictingSourceIds?: string[];
  coverageGapCode?: string;
  confidence?: number;
  observedAt?: string;
}

export type RelationshipInsightFields = Pick<MarketplaceRow,
  | "relationshipSummary"
  | "relationshipPivotTypes"
  | "relationshipPivots"
  | "whyActionable"
  | "freshnessDelta"
  | "confidenceDelta"
  | "contradictionHints"
  | "corroborationState"
  | "nextSearchPivots"
>;
