import { hashContent } from "../utils.ts";
import { ISOLATION } from "./dynamicBrowserConstants.ts";

export const hash = (value: string) => hashContent(value).slice(0, 16);
export const uniq = (values: any[]) => [...new Set(values.filter(Boolean))].sort((a: any, b: any) => String(a).localeCompare(String(b)));
export const round = (value: number) => Math.round(value * 1000) / 1000;
export const gate = (name: string, status: string) => ({ name, status, message: name });
export const count = (fixtures: any[], status: string) => fixtures.filter((fixture) => fixture.status === status).length;
export const hasIsolation = (checks: any) => isolationClasses(checks).length > 0;
export const isolationClasses = (checks: any) => ISOLATION.filter((mode) => checks[keyFor(mode)]);
export function keyFor(mode: string) {
  return mode.replace(/_([a-z])/g, (_, char) => char.toUpperCase())
    .replace("jsRenderTimeout", "timeout")
    .replace("captureTruncation", "truncated")
    .replace("parserEmptyExtraction", "emptyExtraction");
}
export function unsupportedMime(contentType: string) {
  return Boolean(contentType) && !["text/html", "application/xhtml+xml", "text/plain"].includes((contentType.split(";")[0] ?? "").trim().toLowerCase());
}
export function budget(pool: any) {
  const estimatedWorstCaseMemoryMb = Math.max(0, pool.maxWorkers) * Math.max(0, pool.memoryCapMb);
  return { processIsolation: "separate_worker_pool_required", sharedWithStaticRssPdf: false, maxWorkers: Math.max(0, pool.maxWorkers), memoryCapMb: Math.max(0, pool.memoryCapMb), renderTimeoutMs: Math.max(1000, pool.timeoutMs), maxBytes: Math.max(0, pool.maxBytes), queueMaxDepth: Math.max(0, pool.queueMaxDepth), estimatedWorstCaseMemoryMb, memoryBudgetStatus: pool.memoryCapMb > 2048 || estimatedWorstCaseMemoryMb > 4096 ? "hold" : pool.memoryCapMb > 1536 ? "watch" : "pass", timeoutBudgetStatus: pool.timeoutMs > 30_000 ? "watch" : "pass", byteBudgetStatus: pool.maxBytes > 5_000_000 ? "watch" : "pass" };
}
export function numbers(pool: any) {
  return { maxWorkers: Math.max(0, pool.maxWorkers), memoryCapMb: Math.max(0, pool.memoryCapMb), timeoutMs: Math.max(1000, pool.timeoutMs), maxBytes: Math.max(0, pool.maxBytes), queueMaxDepth: Math.max(0, pool.queueMaxDepth), currentQueueDepth: Math.max(0, pool.currentQueueDepth) };
}
