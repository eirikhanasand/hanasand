import type { PersistedGraphSnapshot } from "../types.ts";
import type { GraphReviewRouteRequestDto, GraphReviewRouteResult } from "./graphReviewTypes.ts";

export function validateGraphReviewRequest(
  snapshot: PersistedGraphSnapshot,
  request: GraphReviewRouteRequestDto = {}
): GraphReviewRouteResult<never> | undefined {
  if (request.dryRun === false) {
    return { status: 409, body: { error: { code: "dry_run_required", message: "Graph review routes do not mutate state" } } };
  }
  const exists = request.relationshipId && snapshot.relationships.some((relationship) => relationship.id === request.relationshipId);
  if (request.relationshipId && !exists) {
    return {
      status: 404,
      body: {
        error: {
          code: "relationship_not_found",
          message: "Relationship id was not found",
          details: { relationshipId: request.relationshipId }
        }
      }
    };
  }
  return undefined;
}
