export interface PolicyDecision {
  allowed: boolean;
  metadataOnly: boolean;
  reason: string;
}
