export interface StructuredLogRecord {
  level: "debug" | "info" | "warn" | "error";
  msg: string;
  at: string;
  service: "ti-scraper";
  event?: string;
  tenantId?: string;
  requestId?: string;
  runId?: string;
  taskId?: string;
  sourceId?: string;
  adapter?: string;
  policyDecision?: string;
  workerId?: string;
  error?: string;
  fields?: Record<string, unknown>;
}

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}
