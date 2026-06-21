export interface MonetizationSummary {
  enabled: boolean;
  eventNames: string[];
  pricingModel: "pay_per_event";
  billingMode: "apify_synthetic_events";
  actorStartEvent: string;
  datasetItemEvent: string;
  datasetItemCount: number;
  sellableRowCount: number;
  caveatedRowCount: number;
  coverageGapOnlyRowCount: number;
  holdRowCount: number;
  suppressedRowCount: number;
  chargeRecommendedRowCount: number;
  liveDataRealRowCount: number;
  sellableLiveDataRealRowCount: number;
  distinctHostedSourceFindingCount: number;
  fixtureBackedRowCount: number;
  defaultWatchlistBackedRowCount: number;
  skippedReason?: string;
}
