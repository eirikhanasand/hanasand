export interface QuerySample {
  query: string;
  ok: boolean;
  runId?: string;
  cursor?: string;
  status: "searching" | "partial" | "ready" | "degraded" | "blocked" | "unknown";
  previousStatus?: QuerySample["status"];
  pollDelta: "none" | "partial_to_ready" | "ready_to_partial" | "changed" | "new";
  sourceCoveragePercent: number;
  queueAgeP95Seconds: number;
  memoryRssGb: number;
  cpuPercent: number;
  rejectedUnsafeActions: number;
  restrictedKillSwitchActive: boolean;
  publicApiOk: boolean;
  rollbackTriggers: string[];
  latencyMs: number;
}
