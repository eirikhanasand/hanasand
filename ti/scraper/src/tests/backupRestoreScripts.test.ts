import { createHash } from "node:crypto";
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, test } from "bun:test";

const backupScript = resolve(import.meta.dir, "../../scripts/threat-intel-backup.sh");
const postgresScript = resolve(import.meta.dir, "../../scripts/threat-intel-postgres.sh");

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeSums(root: string, output: string, names: string[]): void {
  writeFileSync(join(root, output), names.map((name) => `${sha256(join(root, name))}  ${name}\n`).join(""));
}

function makeArchive(root: string): { archive: string; priorReceipt: string } {
  const archive = join(root, "archive");
  const evidence = join(root, "evidence");
  mkdirSync(archive);
  mkdirSync(evidence);
  writeFileSync(join(archive, "database.dump"), "fake custom dump");
  writeFileSync(join(archive, "DATABASE-INVENTORY.tsv"), [
    "schema\ttable\trows\tcontent_md5",
    "threat_intel\tschema_migrations\t0\td41d8cd98f00b204e9800998ecf8427e",
    "",
  ].join("\n"));
  writeFileSync(join(archive, "OBJECT-REFERENCES.tsv"), [
    "capture_id\ttenant_id\tsource_id\tmedia_type\tretention_class\tcontent_hash\tbucket\tobject_key\tversion_id\tref_content_hash\tsize_bytes",
    "",
  ].join("\n"));
  writeFileSync(join(archive, "OBJECT-LEDGER.tsv"), [
    "capture_id\ttenant_id\tsource_id\tmedia_type\tretention_class\tcontent_hash\tbucket\tobject_key\tversion_id\tref_content_hash\tsize_bytes\tmetadata_tenant_id\tmetadata_media_type\tmetadata_retention_class\tobject_sha256\tmetadata_sha256",
    "",
  ].join("\n"));
  const tar = Bun.spawnSync({ cmd: ["tar", "-C", evidence, "-czf", join(archive, "evidence.tar.gz"), "."] });
  expect(tar.exitCode).toBe(0);
  writeFileSync(join(archive, "EVIDENCE-INVENTORY.tsv"), "path\tsha256\n");
  writeFileSync(join(archive, "BACKUP-MANIFEST"), "format=hanasand.threat_intel_backup.v3\n");
  writeSums(archive, "SHA256SUMS", [
    "database.dump",
    "DATABASE-INVENTORY.tsv",
    "OBJECT-REFERENCES.tsv",
    "OBJECT-LEDGER.tsv",
    "evidence.tar.gz",
    "EVIDENCE-INVENTORY.tsv",
    "BACKUP-MANIFEST",
  ]);

  const priorReceipt = "RESTORE-RECEIPT-20260723T000000Z-1";
  const receipt = join(archive, priorReceipt);
  mkdirSync(receipt);
  writeFileSync(join(receipt, "RESTORE-INVENTORY.tsv"), readFileSync(join(archive, "DATABASE-INVENTORY.tsv")));
  writeFileSync(join(receipt, "RESTORE-EVIDENCE-INVENTORY.tsv"), "path\tsha256\n");
  writeFileSync(join(receipt, "RESTORE-OBJECT-LEDGER.tsv"), readFileSync(join(archive, "OBJECT-LEDGER.tsv")));
  writeFileSync(join(receipt, "APPLICATION-READ-PROOF.json"), "{}\n");
  writeFileSync(join(receipt, "RESTORE-REPORT"), "prior-good-receipt\n");
  writeSums(receipt, "RESTORE-SHA256SUMS", [
    "RESTORE-INVENTORY.tsv",
    "RESTORE-EVIDENCE-INVENTORY.tsv",
    "RESTORE-OBJECT-LEDGER.tsv",
    "APPLICATION-READ-PROOF.json",
    "RESTORE-REPORT",
  ]);
  writeFileSync(join(archive, "RESTORE-LATEST"), `${priorReceipt}\n`);
  return { archive, priorReceipt };
}

function makeFakeDocker(root: string, archive: string): { bin: string; failMarker: string; log: string } {
  const bin = join(root, "bin");
  const failMarker = join(root, "fail-application-read");
  const log = join(root, "docker.log");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), `#!/bin/sh
printf '%s\\n' "$*" >> "$FAKE_DOCKER_LOG"
case " $* " in
  *" image inspect "*)
    if [ -n "\${FAKE_RETAG_MARKER:-}" ] && [ -e "$FAKE_RETAG_MARKER" ]; then
      printf '%s\\n' 'sha256:retagged-scraper-image'
    else
      [ -z "\${FAKE_RETAG_MARKER:-}" ] || : > "$FAKE_RETAG_MARKER"
      printf '%s\\n' 'sha256:fake-scraper-image'
    fi
    ;;
  *" pg_restore --list "*) printf '%s\\n' '1; 0 0 TABLE threat_intel schema_migrations owner' ;;
  *"verify-restored-database.ts ledger "*) cat "$FAKE_OBJECT_LEDGER" ;;
  *" sh -s -- inventory "*) cat "$FAKE_DATABASE_INVENTORY" ;;
  *" tar -C /var/lib/ti-scraper/evidence -czf - . "*) cat "$FAKE_EVIDENCE_ARCHIVE" ;;
  *"verify-restored-database.ts "*)
    [ ! -e "$FAKE_FAIL_MARKER" ] || exit 41
    printf '%s\\n' '{"schemaVersion":"hanasand.ti_restore_application_read.v2"}'
    ;;
  *" container inspect "*|*" network inspect "*|*" volume inspect "*) exit 1 ;;
  *) exit 0 ;;
esac
`);
  chmodSync(join(bin, "docker"), 0o755);
  writeFileSync(join(bin, "git"), "#!/bin/sh\nprintf '%s\\n' '0123456789abcdef0123456789abcdef01234567'\n");
  chmodSync(join(bin, "git"), 0o755);
  writeFileSync(join(bin, "shasum"), `#!/bin/sh
[ "$1" = -a ] && shift 2
if command -v sha256sum >/dev/null 2>&1; then
  exec sha256sum "$@"
fi
exec /usr/bin/shasum -a 256 "$@"
`);
  chmodSync(join(bin, "shasum"), 0o755);
  writeFileSync(failMarker, "fail");
  return { bin, failMarker, log };
}

describe("backup and restore scripts", () => {
  test.each(["SIGINT", "SIGTERM"] as const)("PostgreSQL helper cleans up and exits nonzero on %s", async (signal) => {
    const root = mkdtempSync(join(tmpdir(), "ti-postgres-signal-"));
    const bin = join(root, "bin");
    try {
      mkdirSync(bin);
      writeFileSync(join(bin, "psql"), "#!/bin/sh\ncat >/dev/null\n");
      chmodSync(join(bin, "psql"), 0o755);
      const process = Bun.spawn({
        cmd: ["sh", postgresScript, "backup"],
        env: {
          ...globalThis.process.env,
          PATH: `${bin}:${globalThis.process.env.PATH}`,
          POSTGRES_USER: "test",
          POSTGRES_DB: "test",
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      await Bun.sleep(100);
      process.kill(signal);
      expect(await process.exited).toBe(signal === "SIGINT" ? 130 : 143);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a failed drill preserves the last good receipt and a rerun publishes atomically", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-restore-receipt-"));
    try {
      const { archive, priorReceipt } = makeArchive(root);
      const { bin, failMarker, log } = makeFakeDocker(root, archive);
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_DATABASE_INVENTORY: join(archive, "DATABASE-INVENTORY.tsv"),
        FAKE_OBJECT_LEDGER: join(archive, "OBJECT-LEDGER.tsv"),
        FAKE_EVIDENCE_ARCHIVE: join(archive, "evidence.tar.gz"),
        FAKE_FAIL_MARKER: failMarker,
        FAKE_DOCKER_LOG: log,
      };

      const failed = Bun.spawnSync({ cmd: ["sh", backupScript, "drill", archive], env });
      if (failed.exitCode !== 41) throw new Error(failed.stderr.toString());
      expect(failed.exitCode).toBe(41);
      expect(readFileSync(join(archive, "RESTORE-LATEST"), "utf8")).toBe(`${priorReceipt}\n`);
      expect(readFileSync(join(archive, priorReceipt, "RESTORE-REPORT"), "utf8")).toBe("prior-good-receipt\n");
      const failedAttempt = readFileSync(join(archive, "RESTORE-LAST-ATTEMPT"), "utf8");
      expect(failedAttempt).toContain("status=failed\n");
      expect(failedAttempt).toContain("exit_code=41\n");
      expect(failedAttempt).toContain("phase=application_read\n");
      expect(failedAttempt).toContain("reason=command_failed\n");

      unlinkSync(failMarker);
      const succeeded = Bun.spawnSync({ cmd: ["sh", backupScript, "drill", archive], env });
      expect(succeeded.exitCode).toBe(0);
      const latest = readFileSync(join(archive, "RESTORE-LATEST"), "utf8").trim();
      expect(latest).not.toBe(priorReceipt);
      const report = readFileSync(join(archive, latest, "RESTORE-REPORT"), "utf8");
      expect(report).toContain("status=succeeded\n");
      expect(report).toMatch(/verifier_commit=[a-f0-9]{40}\n/);
      expect(report).toContain("scraper_image_id=sha256:fake-scraper-image\n");
      expect(readFileSync(join(archive, "RESTORE-LAST-ATTEMPT"), "utf8")).toContain("status=succeeded\n");
      const verifierRuns = readFileSync(log, "utf8").split("\n").filter((line) => line.includes("verify-restored-database.ts"));
      expect(verifierRuns.length).toBeGreaterThan(0);
      expect(verifierRuns.every((line) => line.includes("sha256:fake-scraper-image"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a concurrent tag change cannot change drill execution or receipt provenance", () => {
    const root = mkdtempSync(join(tmpdir(), "ti-restore-retag-"));
    try {
      const { archive } = makeArchive(root);
      const { bin, failMarker, log } = makeFakeDocker(root, archive);
      const retagMarker = join(root, "scraper-retagged");
      unlinkSync(failMarker);
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_DATABASE_INVENTORY: join(archive, "DATABASE-INVENTORY.tsv"),
        FAKE_OBJECT_LEDGER: join(archive, "OBJECT-LEDGER.tsv"),
        FAKE_EVIDENCE_ARCHIVE: join(archive, "evidence.tar.gz"),
        FAKE_FAIL_MARKER: failMarker,
        FAKE_DOCKER_LOG: log,
        FAKE_RETAG_MARKER: retagMarker,
      };

      const drill = Bun.spawnSync({ cmd: ["sh", backupScript, "drill", archive], env });
      if (drill.exitCode !== 0) throw new Error(drill.stderr.toString());
      const latest = readFileSync(join(archive, "RESTORE-LATEST"), "utf8").trim();
      const report = readFileSync(join(archive, latest, "RESTORE-REPORT"), "utf8");
      expect(report).toContain("scraper_image_id=sha256:fake-scraper-image\n");

      const dockerRuns = readFileSync(log, "utf8").trim().split("\n");
      expect(dockerRuns.filter((line) => line.startsWith("image inspect "))).toHaveLength(1);
      expect(dockerRuns.filter((line) => line.startsWith("run ") && line.includes("hanasand_ti_scraper"))).toHaveLength(0);
      const scraperRuns = dockerRuns.filter((line) =>
        line.includes("verify-restored-database.ts") || line.includes("/var/lib/ti-scraper/evidence"),
      );
      expect(scraperRuns.length).toBeGreaterThan(0);
      expect(scraperRuns.every((line) => line.includes("sha256:fake-scraper-image"))).toBe(true);

      const retagged = Bun.spawnSync({ cmd: ["docker", "image", "inspect", "hanasand_ti_scraper"], env });
      expect(retagged.stdout.toString().trim()).toBe("sha256:retagged-scraper-image");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
