export interface GraphReviewRouteRequestDto {
  relationshipId?: string;
  includeExamples?: boolean;
  generatedAt?: string;
  dryRun?: boolean;
}

export type GraphReviewRouteResult<T> = {
  status: number;
  body: T | { error: { code: string; message: string; details?: Record<string, unknown> } };
};
