import { APT_QUERIES } from "./watchlist/apt.ts";
import { ALIAS_LIFT_QUERIES, ALIAS_MARGIN_QUERIES } from "./watchlist/aliasLift.ts";
import { COMMERCIAL_LIFT_QUERIES } from "./watchlist/commercialLift.ts";
import { MALWARE_TOOL_QUERIES } from "./watchlist/malwareTools.ts";
import { MEASURED_LIFT_QUERIES } from "./watchlist/measuredLift.ts";
import { RANSOMWARE_QUERIES } from "./watchlist/ransomware.ts";
import { THREAT_CLUSTER_QUERIES } from "./watchlist/threatClusters.ts";

export const DEFAULT_API_BASE = "https://api.hanasand.com/api/ti/search";
export const ACTOR_START_EVENT = "apify-actor-start";
export const DATASET_ITEM_EVENT = "apify-default-dataset-item";
export const MAX_QUERIES_PER_RUN = 400;

export const DEFAULT_QUERIES = [
  ...APT_QUERIES,
  ...RANSOMWARE_QUERIES,
  ...THREAT_CLUSTER_QUERIES,
  ...MALWARE_TOOL_QUERIES,
  ...MEASURED_LIFT_QUERIES,
  ...COMMERCIAL_LIFT_QUERIES,
  ...ALIAS_LIFT_QUERIES,
  ...ALIAS_MARGIN_QUERIES
];
