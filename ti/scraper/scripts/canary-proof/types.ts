export type JsonObject = Record<string, unknown>;

export function record(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}

export function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
