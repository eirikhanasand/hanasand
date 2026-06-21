import type { buildHostedDefaultParserLift } from "./hostedDefaultParserLift.ts";
import type { MarketplaceRow } from "./marketplaceRow.ts";

export type HostedDefaultParserLiftContract = ReturnType<typeof buildHostedDefaultParserLift>;
export type PaidRowDecision = NonNullable<MarketplaceRow["paidRowDecision"]>;
export type RemediationOwner = NonNullable<MarketplaceRow["paidRowRemediationActions"]>[number]["owner"];
