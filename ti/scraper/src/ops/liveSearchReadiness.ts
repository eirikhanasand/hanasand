// @ts-nocheck
import { check } from "./liveSearchCheck.ts";

export function verifyScraperNativeSearchReadiness(probe: any) {
  const checks = [
    check("scraper_health", probe.scraperHealth?.status === 200, "scraper health responds"),
    check("search", probe.search?.status === 200, "native search responds"),
    check("cursor_poll", probe.cursorPoll?.status === 200, "cursor poll responds")
  ];
  return {
    ok: checks.every((item) => item.ok),
    checks,
    rollback: { required: checks.some((item) => !item.ok), reasons: checks.filter((item) => !item.ok).map((item) => item.name) }
  };
}

export function assertScraperNativeSearchReadiness(result: any): void {
  if (!result.ok) throw new Error(`scraper native search not ready: ${result.rollback?.reasons?.join(", ")}`);
}
