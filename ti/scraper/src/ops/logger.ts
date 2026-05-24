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

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
const SENSITIVE_KEYS = ["body", "html", "rawText", "content", "secret", "token", "password", "authorization"];

export function createLogger(minLevel: keyof typeof LEVELS = "info"): Logger {
  const min = LEVELS[minLevel];
  const write = (level: keyof typeof LEVELS, msg: string, fields: Record<string, unknown> = {}) => {
    if (LEVELS[level] < min) return;
    const record: StructuredLogRecord = {
      level,
      msg,
      at: new Date().toISOString(),
      service: "ti-scraper",
      ...extractReserved(fields),
      fields: sanitizeFields(fields)
    };
    if (Object.keys(record.fields ?? {}).length === 0) delete record.fields;
    console[level === "error" ? "error" : "log"](JSON.stringify(record));
  };

  return {
    debug: (msg, fields) => write("debug", msg, fields),
    info: (msg, fields) => write("info", msg, fields),
    warn: (msg, fields) => write("warn", msg, fields),
    error: (msg, fields) => write("error", msg, fields)
  };
}

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (isReservedKey(key)) continue;
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      clean[key] = "[redacted]";
      continue;
    }
    clean[key] = sanitizeValue(value);
  }
  return clean;
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;
  return sanitizeFields(value as Record<string, unknown>);
}

function extractReserved(fields: Record<string, unknown>): Partial<StructuredLogRecord> {
  return {
    event: stringField(fields.event),
    tenantId: stringField(fields.tenantId),
    requestId: stringField(fields.requestId),
    runId: stringField(fields.runId),
    taskId: stringField(fields.taskId),
    sourceId: stringField(fields.sourceId),
    adapter: stringField(fields.adapter),
    policyDecision: stringField(fields.policyDecision),
    workerId: stringField(fields.workerId),
    error: fields.error instanceof Error ? fields.error.message : stringField(fields.error)
  };
}

function isReservedKey(key: string): boolean {
  return key === "event" ||
    key === "tenantId" ||
    key === "requestId" ||
    key === "runId" ||
    key === "taskId" ||
    key === "sourceId" ||
    key === "adapter" ||
    key === "policyDecision" ||
    key === "workerId" ||
    key === "error";
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
