import { join, resolve } from "node:path";
import { check, readIfExists } from "./deployHygieneHelpers.ts";
export type { DeployHygieneCheck, DeployHygieneReport } from "./deployHygieneTypes.ts";
import type { DeployHygieneCheck, DeployHygieneReport } from "./deployHygieneTypes.ts";

export function checkDeployHygiene(repoRoot = resolve("../../..")): DeployHygieneReport {
  const root = resolve(repoRoot);
  const composePath = join(root, "docker-compose.yml");
  const scraperDockerfilePath = join(root, "ti", "scraper", "Dockerfile");
  const rootDockerignorePath = join(root, ".dockerignore");
  const scraperDockerignorePath = join(root, "ti", "scraper", ".dockerignore");
  const scraperDockerfileDockerignorePath = join(root, "ti", "scraper", "Dockerfile.dockerignore");
  const backupWrapperPath = join(root, "ops", "threat-intel-backup", "run-threat-intel-backup.sh");
  const backupScriptPath = join(root, "ti", "scraper", "scripts", "threat-intel-backup.sh");
  const backupPostgresPath = join(root, "ti", "scraper", "scripts", "threat-intel-postgres.sh");
  const restoreVerifierPath = join(root, "ti", "scraper", "scripts", "verify-restored-database.ts");
  const compose = readIfExists(composePath);
  const scraperDockerfile = readIfExists(scraperDockerfilePath);
  const rootDockerignore = readIfExists(rootDockerignorePath);
  const scraperDockerignore = readIfExists(scraperDockerignorePath);
  const scraperDockerfileDockerignore = readIfExists(scraperDockerfileDockerignorePath);
  const backupWrapper = readIfExists(backupWrapperPath);
  const backupScript = readIfExists(backupScriptPath);
  const allowedApiBuildIncludes = new Set([
    "!api/",
    "!api/src/",
    "!api/src/utils/",
    "!api/src/utils/dwm/",
    "!api/src/utils/dwm/customerOutputSafety.ts"
  ]);
  const backupPostgres = readIfExists(backupPostgresPath);
  const restoreVerifier = readIfExists(restoreVerifierPath);

  const checks: DeployHygieneCheck[] = [
    check("required.compose", Boolean(compose), "root docker-compose.yml exists"),
    check("required.scraper_dockerfile", Boolean(scraperDockerfile), "ti/scraper Dockerfile exists"),
    check("required.root_dockerignore", Boolean(rootDockerignore), "root .dockerignore exists"),
    check("required.scraper_dockerignore", Boolean(scraperDockerignore), "ti/scraper .dockerignore exists"),
    check("required.scraper_dockerfile_dockerignore", Boolean(scraperDockerfileDockerignore), "ti/scraper Dockerfile.dockerignore exists"),
    check("required.backup_scripts", Boolean(backupWrapper && backupScript && backupPostgres), "threat-intelligence backup scripts exist"),
    check("dockerfile.test_enforced", /FROM\s+test\s+AS\s+runtime/i.test(scraperDockerfile), "scraper runtime stage depends on test stage"),
    check("dockerfile.runs_tests", /RUN\s+bun\s+(?:run\s+)?test/.test(scraperDockerfile) && /RUN\s+bun\s+run\s+check/.test(scraperDockerfile), "scraper Docker build runs tests and type-check"),
    check("compose.scraper_service", /ti-scraper:\s*\n/.test(compose), "compose declares ti-scraper service"),
    check("compose.scraper_health", /ti-scraper:[\s\S]*healthcheck:[\s\S]*\/v1\/health/.test(compose), "ti-scraper healthcheck probes /v1/health"),
    check("compose.api_depends_on_scraper", /api:[\s\S]*depends_on:[\s\S]*ti-scraper:[\s\S]*condition:\s*service_healthy/.test(compose), "api waits for scraper service_healthy"),
    check("compose.internal_scraper_url", /TI_SCRAPER_API_BASE:\s*\$\{TI_SCRAPER_API_BASE:-http:\/\/ti-scraper:8097\}/.test(compose), "api uses internal scraper URL by default"),
    check("compose.scraper_memory_target", /SCRAPER_MEMORY_TARGET_MB:\s*8192/.test(compose), "scraper target memory is 8 GB"),
    check("compose.scraper_memory_ceiling", /SCRAPER_MEMORY_CEILING_MB:\s*14336/.test(compose), "scraper normal ceiling is 14 GB"),
    check("compose.scraper_mem_limit", /ti-scraper:[\s\S]*mem_limit:\s*16g/.test(compose), "scraper container mem_limit is 16g"),
    check("compose.scraper_stop_grace", /ti-scraper:[\s\S]*stop_grace_period:\s*10m/.test(compose), "scraper has enough bounded grace for in-flight collection and AI work"),
    check("compose.scraper_review_concurrency", /HANASAND_AI_REVIEW_CONCURRENCY:\s*\$\{HANASAND_AI_REVIEW_CONCURRENCY:-3\}/.test(compose), "automatic review has an explicit three-task concurrency ceiling"),
    check("compose.postgres_mem_limit", /postgres:[\s\S]*mem_limit:\s*2g/.test(compose), "PostgreSQL has a 2 GB cgroup budget"),
    check("compose.scraper_evidence_root", /TI_EVIDENCE_ROOT:\s*\/var\/lib\/ti-scraper\/evidence/.test(compose), "scraper uses durable production evidence root"),
    check("compose.scraper_evidence_volume", /ti-scraper:[\s\S]*volumes:[\s\S]*ti_scraper_evidence:\/var\/lib\/ti-scraper\/evidence/.test(compose) && /volumes:[\s\S]*ti_scraper_evidence:/.test(compose), "scraper mounts named durable evidence volume"),
    check("compose.scraper_canary_no_auto_activate", /TI_CANARY_AUTO_ACTIVATE:\s*"?false"?/.test(compose), "public canary does not auto-activate sources in production"),
    check("dockerignore.root_excludes_node_modules", /(^|\n)(frontend\/node_modules|node_modules)(\n|$)/.test(rootDockerignore), "root .dockerignore excludes node_modules"),
    check("dockerignore.scraper_excludes_node_modules", /(^|\n)node_modules(\n|$)/.test(scraperDockerignore), "scraper .dockerignore excludes node_modules"),
    check("dockerignore.root_excludes_env", /(^|\n)frontend\/\.env(\n|$)/.test(rootDockerignore) && /(^|\n)api\/\.env(\n|$)/.test(rootDockerignore), "root .dockerignore excludes frontend/api env files"),
    check("dockerignore.root_excludes_secret_material", /\*\*\/\*\.pem/.test(rootDockerignore) && /\*\*\/\*\.key/.test(rootDockerignore) && /\*\*\/\*secret\*/.test(rootDockerignore), "root .dockerignore excludes key and secret-like files"),
    check("dockerignore.root_includes_backup_wrapper", /!ops\/threat-intel-backup\/run-threat-intel-backup\.sh/.test(rootDockerignore), "root .dockerignore includes the backup wrapper required by build checks"),
    check("dockerignore.scraper_build_includes_backup_wrapper", /!ops\/threat-intel-backup\/run-threat-intel-backup\.sh/.test(scraperDockerfileDockerignore), "scraper Dockerfile.dockerignore includes the backup wrapper required by build checks"),
    check("dockerignore.scraper_build_excludes_unrelated_apps", /^\*$/m.test(scraperDockerfileDockerignore)
      && !/!frontend/.test(scraperDockerfileDockerignore)
      && scraperDockerfileDockerignore.split("\n").filter((line) => line.startsWith("!api")).every((line) => allowedApiBuildIncludes.has(line)),
    "scraper Dockerfile.dockerignore excludes unrelated application trees"),
    check("dockerignore.scraper_excludes_env", /(^|\n)\.env(\n|$)/.test(scraperDockerignore) && /(^|\n)\.env\.\*(\n|$)/.test(scraperDockerignore), "scraper .dockerignore excludes env files"),
    check("backup.private_permissions", /umask 077/.test(backupWrapper) && /chmod 700 "\$backup_root"/.test(backupWrapper) && /umask 077/.test(backupScript) && /chmod 700 "\$archive"/.test(backupScript), "backup archives use private permissions"),
    check("backup.atomic_completion", /partial="\$archive\.partial\.\$\$"/.test(backupWrapper) && /mv "\$partial" "\$archive"/.test(backupWrapper), "backup archives are published only after verification"),
    check("backup.complete_database_inventory", /--snapshot="\$snapshot"/.test(backupPostgres) && !/--schema=threat_intel/.test(backupPostgres), "backup uses one database snapshot and does not silently limit tables by schema"),
    check("backup.snapshot_object_references", /object_references_sql "\$snapshot"/.test(backupPostgres) && /OBJECT-REFERENCES\.tsv/.test(backupScript) && /OBJECT-LEDGER\.tsv/.test(backupScript), "backup reconciles snapshot-bound database object references against every archive"),
    check("backup.object_integrity", /O_NOFOLLOW/.test(restoreVerifier) && /createHash\("sha256"\)/.test(restoreVerifier) && /mediaType/.test(restoreVerifier) && /retentionClass/.test(restoreVerifier), "restore rejects linked-object path, byte hash, and recovery metadata mismatches"),
    check("backup.exact_restore_reconciliation", /cmp -s "\$database_inventory" "\$restored_inventory"/.test(backupScript) && /RESTORE-EVIDENCE-INVENTORY\.tsv/.test(backupScript) && /APPLICATION-READ-PROOF\.json/.test(backupScript), "restore drill reconciles database and evidence hashes before an application read"),
    check("backup.atomic_restore_receipt", /receipt_stage=\$\(mktemp -d "\$archive_parent/.test(backupScript) && /mv "\$receipt_stage" "\$receipt_target"/.test(backupScript) && /RESTORE-LAST-ATTEMPT/.test(backupScript), "restore proof is staged outside the archive and only the successful receipt is published"),
    check("backup.restore_provenance", /verifier_commit=\$\(git -C "\$repo_root" rev-parse HEAD\)/.test(backupScript)
      && /verifier_image=\$\(resolve_image "\$verifier_image_ref"\)/.test(backupScript)
      && /postgres_image=\$\(resolve_image "\$postgres_image_ref"\)/.test(backupScript)
      && /source_scraper_container=\$\(resolve_source_container ti-scraper\)/.test(backupScript)
      && /docker exec "\$source_scraper_container"/.test(backupScript)
      && /verifier_image_id=%s/.test(backupScript)
      && /postgres_image_id=%s/.test(backupScript),
    "backup and restore pin and receipt the source, verifier, and PostgreSQL execution identities"),
    check("backup.isolated_restore", /docker run/.test(backupScript) && /--tmpfs/.test(backupScript) && !/compose stop/.test(backupScript), "restore drill uses ephemeral PostgreSQL without stopping healthy services"),
    check("backup.signal_cleanup", /trap 'exit 130' INT/.test(backupPostgres) && /trap 'exit 143' TERM/.test(backupPostgres) && !/set \+e/.test(backupPostgres), "PostgreSQL backup helper exits nonzero after signal cleanup"),
    check("backup.failure_audit", /status=failed/.test(backupWrapper) && /LATEST-STATUS/.test(backupWrapper) && /exit_code=%s/.test(backupWrapper) && /phase=%s/.test(backupWrapper) && /reason=%s/.test(backupWrapper), "scheduled failures persist bounded phase, reason, and exit status"),
    check("backup.native_lock", /command -v flock/.test(backupWrapper) && /flock -n -E 75 9/.test(backupWrapper) && !/kill -0/.test(backupWrapper), "scheduled backups use a kernel-held lock instead of trusting a PID")
  ];

  return { ok: checks.every((item) => item.ok), repoRoot: root, checks };
}

export function assertDeployHygiene(report: DeployHygieneReport): void {
  const failures = report.checks.filter((item) => !item.ok);
  if (failures.length === 0) return;
  throw new Error(failures.map((item) => `${item.name}: ${item.message}`).join("; "));
}
