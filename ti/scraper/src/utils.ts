export function nowIso(): string {
  return new Date().toISOString();
}

export function clampScore(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function stableId(prefix: string, value: string): string {
  return `${prefix}_${Bun.hash(value).toString(16)}`;
}

export function hashContent(value: string): string {
  return Bun.hash(value).toString(16);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}
