export interface ActorInput {
  query?: string;
  queries?: string[];
  maxRowsPerQuery?: number;
  includeActivity?: boolean;
  includeTargets?: boolean;
  includeTtps?: boolean;
  includeSources?: boolean;
  includeDatasets?: boolean;
  includeCoverageGaps?: boolean;
  includeHeldRows?: boolean;
}

export interface TiSearchResponse {
  query: string;
  generatedAt: string;
  mode: string;
  status?: string;
  runId?: string;
  refreshAfterSeconds?: number;
  summary: string;
  confidence: number;
  lastSeen: string;
  aliases: string[];
  recentActivity: Array<{
    date: string;
    title: string;
    detail: string;
    confidence: number;
    sourceIds: string[];
    url?: string;
    claimType?: "campaign" | "victim_claim" | "malware_activity" | "vulnerability_exploitation" | "infrastructure_activity" | "general_activity";
    victimName?: string;
    affectedSectors?: string[];
    countries?: string[];
    impact?: string;
    firstReportedAt?: string;
    lastReportedAt?: string;
    publisherCount?: number;
    corroboratingSourceIds?: string[];
    contradictingSourceIds?: string[];
  }>;
  targets: Array<{
    sector: string;
    regions: string[];
    rationale: string;
    confidence: number;
  }>;
  ttps: Array<{
    name: string;
    attackId?: string;
    tactic: string;
    detail: string;
    confidence: number;
  }>;
  datasets: Array<{
    name: string;
    type: string;
    coverage: string;
    status: string;
    url?: string;
  }>;
  sources: Array<{
    id: string;
    name: string;
    type: string;
    provenance: string;
    url?: string;
  }>;
  scheduler?: Record<string, unknown>;
  sourceCoverage?: Record<string, unknown>;
  publicChannel?: Record<string, unknown>;
  notes: string[];
}
