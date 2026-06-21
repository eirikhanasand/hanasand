// @ts-nocheck
export function check(name: string, ok: boolean, message: string) {
  return { name, ok, message };
}

export function liveSearchAlerts(observation: any, slo: any) {
  const alerts = [];
  if ((observation.providerFailures ?? 0) > slo.providerFailureBudgetPercent) {
    alerts.push({
      name: "provider_failures",
      severity: "critical",
      message: "provider failure budget exceeded",
      value: observation.providerFailures
    });
  }
  if ((observation.resultCount ?? 1) === 0) {
    alerts.push({ name: "zero_results", severity: "warn", message: "query returned no results", value: 0 });
  }
  return alerts;
}
