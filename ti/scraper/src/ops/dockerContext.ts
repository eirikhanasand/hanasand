import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

export interface DockerContextLimit {
  name: string;
  contextDir: string;
  maxBytes: number;
}

export interface DockerContextEstimate {
  name: string;
  contextDir: string;
  dockerignorePath?: string;
  totalBytes: number;
  includedFiles: number;
  ignoredEntries: number;
  maxBytes: number;
  status: "ok" | "warn" | "critical";
}

interface IgnoreRule {
  pattern: string;
  negated: boolean;
}

export function estimateDockerContext(limit: DockerContextLimit): DockerContextEstimate {
  const contextDir = resolve(limit.contextDir);
  const dockerignorePath = join(contextDir, ".dockerignore");
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
    { name: "ti-scraper", contextDir: join(repoRoot, "ti", "scraper"), maxBytes: 25 * mb }
  ];
}

export function parseDockerignore(text: string): IgnoreRule[] {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => ({
      pattern: normalizePattern(line.startsWith("!") ? line.slice(1) : line),
      negated: line.startsWith("!")
    }));
}

function walkContext(root: string, dir: string, rules: IgnoreRule[]): { totalBytes: number; includedFiles: number; ignoredEntries: number } {
  let totalBytes = 0;
  let includedFiles = 0;
  let ignoredEntries = 0;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolute = join(dir, entry.name);
    const rel = normalizePath(relative(root, absolute));
    const ignored = isIgnored(rel, entry.isDirectory(), rules);

    if (ignored) ignoredEntries += 1;
    if (entry.isDirectory()) {
      if (ignored && !hasNegatedDescendant(rel, rules)) continue;
      const child = walkContext(root, absolute, rules);
      totalBytes += child.totalBytes;
      includedFiles += child.includedFiles;
      ignoredEntries += child.ignoredEntries;
      continue;
    }

    if (ignored) continue;
    includedFiles += 1;
    totalBytes += statSync(absolute).size;
  }

  return { totalBytes, includedFiles, ignoredEntries };
}

function isIgnored(path: string, isDirectory: boolean, rules: IgnoreRule[]): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (!matchesRule(path, isDirectory, rule.pattern)) continue;
    ignored = !rule.negated;
  }
  return ignored;
}

function matchesRule(path: string, isDirectory: boolean, pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("/**")) {
    const base = pattern.slice(0, -3).replace(/\/$/, "");
    return path === base || path.startsWith(`${base}/`);
  }
  if (pattern.startsWith("**/")) {
    const suffix = pattern.slice(3);
    return path === suffix || path.endsWith(`/${suffix}`) || path.includes(`/${suffix}/`);
  }
  if (!pattern.includes("/")) {
    return path === pattern || path.startsWith(`${pattern}/`) || path.split("/").includes(pattern);
  }
  if (pattern.endsWith("/")) {
    const dirPattern = pattern.slice(0, -1);
    return isDirectory ? path === dirPattern || path.startsWith(`${dirPattern}/`) : path.startsWith(`${dirPattern}/`);
  }
  return path === pattern || path.startsWith(`${pattern}/`);
}

function hasNegatedDescendant(path: string, rules: IgnoreRule[]): boolean {
  return rules.some((rule) => rule.negated && (rule.pattern === path || rule.pattern.startsWith(`${path}/`)));
}

function normalizePattern(value: string): string {
  return normalizePath(value.replace(/^\/+/, ""));
}

function normalizePath(value: string): string {
  return value.split(sep).join("/");
}
