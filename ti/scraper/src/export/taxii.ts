import type { StixBundle, TaxiiCollectionDescriptor, TaxiiExportPage, TaxiiExportRequest } from "../types.ts";

export const STIX_21_MEDIA_TYPE = "application/stix+json;version=2.1";

export interface TaxiiExportProvider {
  listCollections(): Promise<TaxiiCollectionDescriptor[]>;
  getObjects(request: TaxiiExportRequest): Promise<TaxiiExportPage>;
}

export function taxiiCollectionDescriptor(input: Omit<TaxiiCollectionDescriptor, "mediaTypes"> & {
  mediaTypes?: string[];
}): TaxiiCollectionDescriptor {
  return {
    ...input,
    mediaTypes: input.mediaTypes ?? [STIX_21_MEDIA_TYPE]
  };
}

export function pageBundleForTaxii(collectionId: string, bundle: StixBundle): TaxiiExportPage {
  return {
    collectionId,
    objects: bundle.objects,
    more: false
  };
}
