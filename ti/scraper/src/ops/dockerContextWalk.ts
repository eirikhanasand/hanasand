import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { IgnoreRule } from "./dockerContextTypes.ts";
import { hasNegatedDescendant, isIgnored, normalizePath } from "./dockerIgnoreRules.ts";

export function walkContext(
  root: string,
  dir: string,
  rules: IgnoreRule[]
): { totalBytes: number; includedFiles: number; ignoredEntries: number } {
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
