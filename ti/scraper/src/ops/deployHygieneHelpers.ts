import { existsSync, readFileSync } from "node:fs";
import type { DeployHygieneCheck } from "./deployHygieneTypes.ts";

export function check(name: string, ok: boolean, message: string): DeployHygieneCheck {
  return { name, ok, message };
}

export function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
