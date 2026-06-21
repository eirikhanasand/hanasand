import type {
  HostedApifyObservedProofImport,
  HostedApifyProofObservation
} from "./hostedApifyPaidReadinessTypes.ts";

export type HostedApifySupportInput = {
  observedProof: HostedApifyObservedProofImport | undefined;
  observedFields: Required<HostedApifyProofObservation>;
  commandExamples: string[];
  marketplaceValuesObserved: boolean;
  hasToken?: boolean;
  hasRunOrDatasetId?: boolean;
  hasObservedProofImportSource?: boolean;
};

export const hostedReadinessRequirements = {
  hosted100: {
    defaultQueryCount: 100,
    sellableRows: 100,
    sellableFindingRows: 52,
    noLeakFailures: 0,
    falsePositiveInflationFailures: 0
  },
  hosted300: {
    sellableRows: 300,
    sellableFindingRows: 150,
    noLeakFailures: 0,
    falsePositiveInflationFailures: 0
  },
  hosted500: {
    sellableRows: 500,
    sellableFindingRows: 275,
    noLeakFailures: 0,
    falsePositiveInflationFailures: 0
  }
};
