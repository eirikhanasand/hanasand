export function sumBy<T>(items: T[], selector: (item: T) => number): number {
  return items.reduce((sum, item) => sum + selector(item), 0);
}

export function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}

export function round(value: number, digits = 3): number {
  return Number(value.toFixed(digits));
}

export function roundRatio(numerator: number, denominator: number): number {
  return Number((denominator > 0 ? numerator / denominator : 0).toFixed(3));
}

export function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(value as number)));
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
