import { marketplaceObservedFieldNames } from "./hostedApifyMarketplaceFieldNames.ts";
import {
  observedProofDatasetFields,
  observedProofIdentityFields,
  observedProofRuntimeFields,
  observedProofSafetyFields
} from "./hostedApifyObservedProofFieldGroups.ts";

export { marketplaceObservedFieldNames } from "./hostedApifyMarketplaceFieldNames.ts";

export const observedProofRequiredFields = [
  ...observedProofIdentityFields,
  ...observedProofDatasetFields,
  ...observedProofRuntimeFields,
  ...observedProofSafetyFields,
  ...marketplaceObservedFieldNames
] as const;

export const hostedProofGateRequiredFields = [
  ...observedProofIdentityFields,
  ...observedProofDatasetFields,
  ...observedProofRuntimeFields,
  ...observedProofSafetyFields,
  "publicListingStatus",
  "observedAt"
] as const;
