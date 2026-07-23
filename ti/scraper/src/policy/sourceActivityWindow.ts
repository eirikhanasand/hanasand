const DAY_SECONDS = 86_400;

export function sourceActivityWindowSeconds(source: any): number {
  const monitoring = sourceMonitoringWindowSeconds(source);
  return source?.metadata?.queryClass === "threat-intel" ? Math.max(monitoring, 365 * DAY_SECONDS) : monitoring;
}

export function sourceMonitoringWindowSeconds(source: any): number {
  const cadence = positive(source?.crawlFrequencySeconds, DAY_SECONDS);
  const declared = positive(source?.metadata?.activityWindowSeconds, 30 * DAY_SECONDS);
  return Math.max(DAY_SECONDS, cadence * 3, declared);
}

export function sourceActivityWindowDays(source: any): number {
  return Math.ceil(sourceActivityWindowSeconds(source) / DAY_SECONDS);
}

function positive(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
