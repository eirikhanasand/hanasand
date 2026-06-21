import type { MarketplaceRow, TiSearchResponse } from "./types.ts";
import { schedulerCore } from "./rowScheduler/core.ts";
import { sourceCoverageProductFields } from "./rowScheduler/sourceCoverage.ts";
export { sourceCoverageProductFields } from "./rowScheduler/sourceCoverage.ts";

export function schedulerFields(response: TiSearchResponse): Pick<MarketplaceRow,
  | "schedulerState"
  | "schedulerDecision"
  | "nextPollSeconds"
  | "retryAfterSeconds"
  | "duplicateRunReuse"
  | "attachedToActiveRun"
  | "queuedTaskCount"
  | "deferredBackgroundWorkloads"
  | "schedulerBadges"
  | "sourceCoverageState"
  | "sourceCoverageGapCount"
  | "sourceCoverageGaps"
  | "pollingHint"
> {
  return schedulerCore(response);
}
