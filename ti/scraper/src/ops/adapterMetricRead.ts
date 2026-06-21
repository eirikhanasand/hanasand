export function safeLabel(value: string): string {
  return value.replace(/[^a-zA-Z0-9_.:-]/g, "_").slice(0, 80) || "unknown";
}

export function readRecord(
  record: Record<string, unknown> | undefined,
  key: string
): Record<string, unknown> | undefined {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

export function readString(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function readNumber(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
