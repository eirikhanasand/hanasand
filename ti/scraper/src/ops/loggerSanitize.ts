import type { StructuredLogRecord } from "./loggerTypes.ts";

const SENSITIVE_KEYS = ["body", "html", "rawText", "content", "secret", "token", "password", "authorization"];
const RESERVED_KEYS = ["event", "tenantId", "requestId", "runId", "taskId", "sourceId", "adapter", "policyDecision", "workerId", "error"];

export function sanitizeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (RESERVED_KEYS.includes(key)) continue;
    if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
      clean[key] = "[redacted]";
      continue;
    }
    clean[key] = sanitizeValue(value);
  }
  return clean;
}

export function extractReserved(fields: Record<string, unknown>): Partial<StructuredLogRecord> {
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
    error: fields.error instanceof Error ? sanitizeLogText(fields.error.message) : stringField(fields.error)
  };
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === "string") return sanitizeLogText(value);
  if (!value || typeof value !== "object") return value;
  return sanitizeFields(value as Record<string, unknown>);
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" && value ? sanitizeLogText(value) : undefined;
}

function sanitizeLogText(value: string): string {
  return value
    .replace(/\bhttps?:\/\/\S+/gi, "[redacted-url]")
    .replace(/\b[a-z2-7]{56}\.onion\b/gi, "[restricted-host]")
    .replace(/\b(password|token|secret|credential|authorization|cookie|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, 500);
}
