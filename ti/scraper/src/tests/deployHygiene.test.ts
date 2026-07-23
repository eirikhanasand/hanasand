import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    expect(report.checks.find((item) => item.name === "compose.scraper_stop_grace")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "compose.scraper_review_concurrency")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "compose.postgres_mem_limit")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "compose.scraper_evidence_volume")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "compose.scraper_canary_no_auto_activate")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "dockerignore.root_excludes_env")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.private_permissions")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.atomic_completion")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.complete_database_inventory")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.snapshot_object_references")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.object_integrity")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.exact_restore_reconciliation")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.atomic_restore_receipt")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.restore_provenance")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.isolated_restore")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.signal_cleanup")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.failure_audit")?.ok).toBe(true);
    expect(report.checks.find((item) => item.name === "backup.native_lock")?.ok).toBe(true);
    expect(() => assertDeployHygiene(report)).not.toThrow();
  });

  test("persists bounded status for validation failures after the backup root is writable", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-backup-status-"));
    try {
      const result = Bun.spawnSync({
        cmd: ["sh", resolve(import.meta.dir, "../../../../ops/threat-intel-backup/run-threat-intel-backup.sh")],
        env: { ...process.env, TI_BACKUP_ROOT: root, TI_BACKUP_RETENTION_DAYS: "0" },
      });

      expect(result.exitCode).toBe(2);
      expect(readFileSync(join(root, "LATEST-STATUS"), "utf8")).toContain([
        "status=failed",
        "exit_code=2",
        "phase=validation",
        "reason=invalid_configuration",
      ].join("\n"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("uses lock contention as a truthful skip without overwriting the last status", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-backup-lock-"));
    const bin = join(root, "bin");
    const status = "format=prior\nstatus=succeeded\n";
    try {
      mkdirSync(bin);
      writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 75\n");
      chmodSync(join(bin, "flock"), 0o755);
      writeFileSync(join(root, "LATEST-STATUS"), status);

      const result = Bun.spawnSync({
        cmd: ["sh", resolve(import.meta.dir, "../../../../ops/threat-intel-backup/run-threat-intel-backup.sh")],
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          HANASAND_REPO: root,
          TI_BACKUP_ROOT: root,
          TI_BACKUP_SCRIPT: join(root, "must-not-run"),
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.toString()).toContain("status=skipped phase=lock reason=already_running");
      expect(readFileSync(join(root, "LATEST-STATUS"), "utf8")).toBe(status);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("records a successful wrapper exit code", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-backup-success-"));
    const bin = join(root, "bin");
    const backup = join(root, "backup");
    try {
      mkdirSync(bin);
      writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n");
      writeFileSync(backup, "#!/bin/sh\nmkdir -p \"$2\"\n");
      chmodSync(join(bin, "flock"), 0o755);
      chmodSync(backup, 0o755);

      const result = Bun.spawnSync({
        cmd: ["sh", resolve(import.meta.dir, "../../../../ops/threat-intel-backup/run-threat-intel-backup.sh")],
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          HANASAND_REPO: root,
          TI_BACKUP_ROOT: root,
          TI_BACKUP_SCRIPT: backup,
          TI_BACKUP_DRILL_WEEKDAY: "0",
        },
      });

      expect(result.exitCode).toBe(0);
      expect(readFileSync(join(root, "LATEST-STATUS"), "utf8")).toContain([
        "status=succeeded",
        "exit_code=0",
        "phase=complete",
        "reason=none",
      ].join("\n"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("catches missing scraper health dependency and unused test stage", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-deploy-hygiene-"));
    mkdirSync(join(root, "ti", "scraper"), { recursive: true });
    writeFileSync(join(root, ".dockerignore"), "node_modules\n");
    writeFileSync(join(root, "ti", "scraper", ".dockerignore"), "node_modules\n");
    writeFileSync(join(root, "ti", "scraper", "Dockerfile.dockerignore"), "*\n!ti/scraper/**\n");
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
      "    mem_limit: 16g",
      "    environment:",
      "      SCRAPER_MEMORY_TARGET_MB: 8192",
      "      SCRAPER_MEMORY_CEILING_MB: 14336",
      "      TI_CANARY_AUTO_ACTIVATE: \"true\""
    ].join("\n"));

    const report = checkDeployHygiene(root);

    expect(report.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "dockerfile.test_enforced")?.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "compose.api_depends_on_scraper")?.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "compose.scraper_evidence_volume")?.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "compose.scraper_canary_no_auto_activate")?.ok).toBe(false);
    expect(report.checks.find((item) => item.name === "dockerignore.root_excludes_env")?.ok).toBe(false);
    expect(() => assertDeployHygiene(report)).toThrow("dockerfile.test_enforced");
  });
});
