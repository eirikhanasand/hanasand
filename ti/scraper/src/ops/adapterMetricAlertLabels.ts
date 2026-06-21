export function thresholdSeverity(value: number, warn: number, critical: number): "warn" | "critical" | undefined {
  if (value >= critical) return "critical";
  if (value >= warn) return "warn";
  return undefined;
}

export function groupKey(labels: Record<string, string>): string {
  return JSON.stringify(Object.entries(baseLabels(labels)).sort());
}

export function baseLabels(labels: Record<string, string>): Record<string, string> {
  return { adapter: labels.adapter ?? "unknown", sourceType: labels.sourceType ?? "unknown" };
}
