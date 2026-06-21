export type ProofName =
  | "accepted_edge"
  | "rejected_edge"
  | "discovery_only_manual_review"
  | "block_export"
  | "invalid_relationship_id"
  | "no_export_ready_relationships";

export interface ProofResult {
  case: ProofName;
  ok: boolean;
  status: number;
  endpoint: "/v1/graph/review-plan" | "/v1/graph/cutover-report" | "/v1/exports/stix";
  expectedOutput: string;
  observed: Record<string, unknown>;
}

export async function get(baseUrl: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`Proof request failed: ${path} -> ${response.status}`);
  return await response.json() as Record<string, unknown>;
}

export function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}
