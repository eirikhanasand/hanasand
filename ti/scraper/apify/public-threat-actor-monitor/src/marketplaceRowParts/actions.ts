export interface PaidRowRemediationAction {
  owner: string;
  action: string;
  expectedEffect: string;
}

export interface MarketplaceRowSafety {
  metadataOnly: true;
  credentialsIncluded: false;
  stolenFilesIncluded: false;
  privateContentIncluded: false;
  actorInteraction: false;
}
