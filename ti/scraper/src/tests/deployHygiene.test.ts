import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, test } from "bun:test";
import { assertDeployHygiene, checkDeployHygiene } from "../ops/deployHygiene.ts";

describe("deploy hygiene", () => {
  test("accepts the live compose and scraper Dockerfile contracts", () => {
    const report = checkDeployHygiene(resolve(import.meta.dir, "../../../.."));

    expect(report.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "dockerfile.test_enforced")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "compose.api_depends_on_scraper")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "compose.scraper_memory_target")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "dockerignore.root_excludes_env")?.ok).toBe(true);
    expect(() => assertDeployHygiene(report)).not.toThrow();
  });

  test("catches missing scraper health dependency and unused test stage", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-deploy-hygiene-"));
    mkdirSync(join(root, "ti", "scraper"), { recursive: true });
    writeFileSync(join(root, ".dockerignore"), "node_modules\n");
    writeFileSync(join(root, "ti", "scraper", ".dockerignore"), "node_modules\n");
    writeFileSync(join(root, "ti", "scraper", "Dockerfile"), [
      "FROM oven/bun:1.3.11-alpine AS test",
      "RUN bun test",
      "RUN bun run check",
      "FROM oven/bun:1.3.11-alpine"
    ].join("\n"));
    writeFileSync(join(root, "docker-compose.yml"), [
      "services:",
      "  api:",
      "    environment:",
      "      TI_SCRAPER_API_BASE: ${TI_SCRAPER_API_BASE:-http://ti-scraper:8097}",
      "  ti-scraper:",
      "    mem_limit: 96g",
      "    environment:",
      "      SCRAPER_MEMORY_TARGET_MB: 98304",
      "      SCRAPER_MEMORY_CEILING_MB: 163840"
    ].join("\n"));

    const report = checkDeployHygiene(root);

    expect(report.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "dockerfile.test_enforced")?.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "compose.api_depends_on_scraper")?.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "dockerignore.root_excludes_env")?.ok).toBe(false);
    expect(() => assertDeployHygiene(report)).toThrow("dockerfile.test_enforced");
  });
});
