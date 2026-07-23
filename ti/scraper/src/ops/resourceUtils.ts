import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CgroupResourceSnapshot } from "./resourceTypes.ts";

export function bytesToMb(value: number): number {
  return Math.round(value / 1024 / 1024);
}

export function readCgroupResourceSnapshot(root = "/sys/fs/cgroup"): CgroupResourceSnapshot {
  const memoryCurrentBytes = readFinite(join(root, "memory.current"));
  const memoryMaxBytes = readFinite(join(root, "memory.max"));
  const [quota, period] = readText(join(root, "cpu.max"))?.split(/\s+/, 2) ?? [];
  return {
    memoryCurrentBytes,
    memoryMaxBytes,
    cpuQuotaMicros: finite(quota),
    cpuPeriodMicros: finite(period)
  };
}

function readFinite(path: string) {
  return finite(readText(path));
}

function readText(path: string) {
  try { return readFileSync(path, "utf8").trim(); }
  catch { return undefined; }
}

function finite(value?: string) {
  if (!value || value === "max") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
