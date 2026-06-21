import { sep } from "node:path";
import type { IgnoreRule } from "./dockerContextTypes.ts";

export function parseDockerignore(text: string): IgnoreRule[] {
  return text.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => ({
      pattern: normalizePattern(line.startsWith("!") ? line.slice(1) : line),
      negated: line.startsWith("!")
    }));
}

export function isIgnored(path: string, isDirectory: boolean, rules: IgnoreRule[]): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (!matchesRule(path, isDirectory, rule.pattern)) continue;
    ignored = !rule.negated;
  }
  return ignored;
}

export function hasNegatedDescendant(path: string, rules: IgnoreRule[]): boolean {
  return rules.some((rule) => rule.negated && (rule.pattern === path || rule.pattern.startsWith(`${path}/`)));
}

export function normalizePath(value: string): string {
  return value.split(sep).join("/");
}

function normalizePattern(value: string): string {
  return normalizePath(value.replace(/^\/+/, ""));
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
  if (!pattern.includes("/")) return path === pattern || path.startsWith(`${pattern}/`) || path.split("/").includes(pattern);
  if (pattern.endsWith("/")) {
    const dirPattern = pattern.slice(0, -1);
    return isDirectory ? path === dirPattern || path.startsWith(`${dirPattern}/`) : path.startsWith(`${dirPattern}/`);
  }
  return path === pattern || path.startsWith(`${pattern}/`);
}
