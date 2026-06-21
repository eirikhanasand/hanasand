export interface PaidRowRemediationAction {
  owner: "agent_01" | "agent_03" | "agent_04" | "agent_05" | "agent_07" | "agent_08" | "agent_09" | "agent_10";
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
