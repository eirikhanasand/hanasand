import type {
  BuyerSearchCard,
  GraphQualityLiftEvidence,
  GraphSellableSupport,
  MarketplaceGraphSignals,
  MarketplaceRowSafety,
  PaidGraphSearchPack,
  PaidRowRemediationAction,
  ParserAdmissionRuntimeProof,
} from "./marketplaceRowParts.ts";

export type EvidenceSourceFamily = Exclude<MarketplaceRow["sourceType"], "system">;
export interface MarketplaceRow {
  query: string;
  rowType: "profile" | "activity" | "target" | "ttp" | "source" | "dataset" | "coverage_gap";
  actor: string;
  title: string;
  summary: string;
  sourceType: "clear_web" | "public_channel" | "darknet_metadata" | "system";
  sourceName?: string;
  sourceUrl?: string;
  victimName?: string;
  claimType?: string;
  claimedDate?: string;
  affectedSectors?: string[];
  countries?: string[];
  impact?: string;
  firstReportedAt?: string;
  lastReportedAt?: string;
  publisherCount?: number;
  corroboratingSourceIds?: string[];
  contradictingSourceIds?: string[];
  sector?: string;
  country?: string;
  regions?: string[];
  ttp?: string;
  attackId?: string;
  tactic?: string;
  sourceId?: string;
  provenance?: string;
  datasetName?: string;
  datasetType?: string;
  datasetStatus?: string;
  coverage?: string;
  generatedAt: string;
  collectionMode: string;
  sourceCount: number;
  sourceFamilyCount: number;
  sourceFamilies: string[];
  missingSourceFamilies: string[];
  coverageStatus: "sufficient" | "thin" | "stale" | "no_evidence";
  collectionPriority: "none" | "low" | "medium" | "high";
  recommendedCollectionAction: "none" | "monitor_public_channels" | "add_public_channel_sources" | "add_clear_web_sources" | "increase_polling" | "review_contradictions";
  coverageGapCodes: string[];
  activityCount: number;
  freshnessStatus: "current" | "recent" | "stale" | "unknown";
  schedulerState: string;
  schedulerDecision: string;
  nextPollSeconds: number;
  retryAfterSeconds: number;
  duplicateRunReuse: boolean;
  attachedToActiveRun: boolean;
  queuedTaskCount: number;
  deferredBackgroundWorkloads: string[];
  schedulerBadges: string[];
  sourceCoverageState: string;
  sourceCoverageGapCount: number;
  sourceCoverageGaps: string[];
  freshnessExpectation: string;
  highestValueMissingFamily: string;
  nextBestSourceAction: string;
  relationshipSummary: string;
  relationshipPivotTypes: string[];
  relationshipPivots: string[];
  whyActionable: string[];
  freshnessDelta: "new" | "current" | "recent" | "stale" | "unknown";
  confidenceDelta: "stronger" | "stable" | "weaker" | "unknown";
  contradictionHints: string[];
  corroborationState: "corroborated" | "single_source" | "unverified" | "contradicted";
  nextSearchPivots: string[];
  buyerCaveat: string;
  expectedTimeToUsefulSignal: string;
  pollingHint: string;
  buyerSummary?: string;
  recommendedBuyerAction?: string;
  keyPivots?: string[];
  buyerSearchCard?: BuyerSearchCard;
  paidRowDecision?: "sellable" | "included_with_caveat" | "coverage_gap_only" | "hold" | "suppress";
  paidRowReason?: string;
  paidRowReasonCodes?: string[];
  paidRowRemediationActions?: PaidRowRemediationAction[];
  whyWorthPayingFor?: string;
  buyerValueScore?: number;
  billingGuidance?: "charge" | "include_as_context" | "do_not_charge_if_metered";
  graphQualityLift?: "accepted_sellable_lift" | "rejected_hold" | "rejected_caveat" | "not_applicable";
  graphQualityLiftReasonCodes?: string[];
  graphQualityLiftEvidence?: GraphQualityLiftEvidence;
  marketplaceGraphSignals?: MarketplaceGraphSignals;
  paidGraphSearchPack?: PaidGraphSearchPack;
  graphSellableSupport?: GraphSellableSupport;
  parserAdmissionRuntimeProof?: ParserAdmissionRuntimeProof;
  evidenceGrade: "corroborated" | "single_source" | "unverified";
  isActionable: boolean;
  reviewReasons: string[];
  analysisFacets: string[];
  hasDarknetMetadata: boolean;
  hasPublicChannelCoverage: boolean;
  confidence: number;
  firstSeen: string;
  lastSeen: string;
  provenanceHash: string;
  rawContentIncluded: false;
  safety: MarketplaceRowSafety;
  runId?: string;
  status?: string;
  aliases?: string[];
  warningCodes: string[];
}
