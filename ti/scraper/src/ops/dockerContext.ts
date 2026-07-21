import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseDockerignore } from "./dockerIgnoreRules.ts";
import { walkContext } from "./dockerContextWalk.ts";
export type { DockerContextEstimate, DockerContextLimit, IgnoreRule } from "./dockerContextTypes.ts";
import type { DockerContextEstimate, DockerContextLimit } from "./dockerContextTypes.ts";

export function estimateDockerContext(limit: DockerContextLimit): DockerContextEstimate {
  const contextDir = resolve(limit.contextDir);
  const dockerignorePath = resolve(limit.dockerignorePath ?? join(contextDir, ".dockerignore"));
  const rules = existsSync(dockerignorePath) ? parseDockerignore(readFileSync(dockerignorePath, "utf8")) : [];
  const totals = walkContext(contextDir, contextDir, rules);
  const ratio = totals.totalBytes / limit.maxBytes;

  return {
    name: limit.name,
    contextDir,
    dockerignorePath: existsSync(dockerignorePath) ? dockerignorePath : undefined,
    totalBytes: totals.totalBytes,
    includedFiles: totals.includedFiles,
    ignoredEntries: totals.ignoredEntries,
    maxBytes: limit.maxBytes,
    status: ratio >= 1 ? "critical" : ratio >= 0.8 ? "warn" : "ok"
  };
}

export function assertDockerContextsWithinLimits(estimates: DockerContextEstimate[]): void {
  const critical = estimates.filter((estimate) => estimate.status === "critical");
  if (critical.length === 0) return;
  throw new Error(critical.map((estimate) =>
    `${estimate.name} Docker context ${estimate.totalBytes} bytes exceeds ${estimate.maxBytes} bytes`
  ).join("; "));
}

export function defaultDockerContextLimits(repoRoot = resolve("../../..")): DockerContextLimit[] {
  const mb = 1024 * 1024;
  return [
    { name: "root-deploy", contextDir: repoRoot, maxBytes: 40 * mb },
    { name: "frontend", contextDir: join(repoRoot, "frontend"), maxBytes: 25 * mb },
    { name: "api", contextDir: join(repoRoot, "api"), maxBytes: 25 * mb },
    {
      name: "ti-scraper",
      contextDir: repoRoot,
      dockerignorePath: join(repoRoot, "ti", "scraper", "Dockerfile.dockerignore"),
      maxBytes: 25 * mb
    }
  ];
}
