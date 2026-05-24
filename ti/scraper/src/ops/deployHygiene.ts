import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export interface DeployHygieneCheck {
  name: string;
  ok: boolean;
  message: string;
}

export interface DeployHygieneReport {
  ok: boolean;
  repoRoot: string;
  checks: DeployHygieneCheck[];
}

export function checkDeployHygiene(repoRoot = resolve("../../..")): DeployHygieneReport {
  const root = resolve(repoRoot);
  const composePath = join(root, "docker-compose.yml");
  const scraperDockerfilePath = join(root, "ti", "scraper", "Dockerfile");
  const rootDockerignorePath = join(root, ".dockerignore");
  const scraperDockerignorePath = join(root, "ti", "scraper", ".dockerignore");
  const compose = readIfExists(composePath);
  const scraperDockerfile = readIfExists(scraperDockerfilePath);
  const rootDockerignore = readIfExists(rootDockerignorePath);
  const scraperDockerignore = readIfExists(scraperDockerignorePath);

  const checks: DeployHygieneCheck[] = [
    check("required.compose", Boolean(compose), "root docker-compose.yml exists"),
    check("required.scraper_dockerfile", Boolean(scraperDockerfile), "ti/scraper Dockerfile exists"),
    check("required.root_dockerignore", Boolean(rootDockerignore), "root .dockerignore exists"),
    check("required.scraper_dockerignore", Boolean(scraperDockerignore), "ti/scraper .dockerignore exists"),
    check("dockerfile.test_enforced", /FROM\s+test\s+AS\s+runtime/i.test(scraperDockerfile), "scraper runtime stage depends on test stage"),
    check("dockerfile.runs_tests", /RUN\s+bun\s+test/.test(scraperDockerfile) && /RUN\s+bun\s+run\s+check/.test(scraperDockerfile), "scraper Docker build runs tests and type-check"),
    check("compose.scraper_service", /ti-scraper:\s*\n/.test(compose), "compose declares ti-scraper service"),
    check("compose.scraper_health", /ti-scraper:[\s\S]*healthcheck:[\s\S]*\/v1\/health/.test(compose), "ti-scraper healthcheck probes /v1/health"),
    check("compose.api_depends_on_scraper", /api:[\s\S]*depends_on:[\s\S]*ti-scraper:[\s\S]*condition:\s*service_healthy/.test(compose), "api waits for scraper service_healthy"),
    check("compose.internal_scraper_url", /TI_SCRAPER_API_BASE:\s*\$\{TI_SCRAPER_API_BASE:-http:\/\/ti-scraper:8097\}/.test(compose), "api uses internal scraper URL by default"),
    check("compose.scraper_memory_target", /SCRAPER_MEMORY_TARGET_MB:\s*98304/.test(compose), "scraper target memory is 96 GB"),
    check("compose.scraper_memory_ceiling", /SCRAPER_MEMORY_CEILING_MB:\s*163840/.test(compose), "scraper normal ceiling is 160 GB"),
    check("compose.scraper_mem_limit", /ti-scraper:[\s\S]*mem_limit:\s*96g/.test(compose), "scraper container mem_limit is 96g"),
    check("compose.scraper_evidence_root", /TI_EVIDENCE_ROOT:\s*\/var\/lib\/ti-scraper\/evidence/.test(compose), "scraper uses durable production evidence root"),
    check("compose.scraper_evidence_volume", /ti-scraper:[\s\S]*volumes:[\s\S]*ti_scraper_evidence:\/var\/lib\/ti-scraper\/evidence/.test(compose) && /volumes:[\s\S]*ti_scraper_evidence:/.test(compose), "scraper mounts named durable evidence volume"),
    check("compose.scraper_canary_no_auto_activate", /TI_CANARY_AUTO_ACTIVATE:\s*"?false"?/.test(compose), "public canary does not auto-activate sources in production"),
    check("dockerignore.root_excludes_node_modules", /(^|\n)(frontend\/node_modules|node_modules)(\n|$)/.test(rootDockerignore), "root .dockerignore excludes node_modules"),
    check("dockerignore.scraper_excludes_node_modules", /(^|\n)node_modules(\n|$)/.test(scraperDockerignore), "scraper .dockerignore excludes node_modules"),
    check("dockerignore.root_excludes_env", /(^|\n)frontend\/\.env(\n|$)/.test(rootDockerignore) && /(^|\n)api\/\.env(\n|$)/.test(rootDockerignore), "root .dockerignore excludes frontend/api env files"),
    check("dockerignore.root_excludes_secret_material", /\*\*\/\*\.pem/.test(rootDockerignore) && /\*\*\/\*\.key/.test(rootDockerignore) && /\*\*\/\*secret\*/.test(rootDockerignore), "root .dockerignore excludes key and secret-like files"),
    check("dockerignore.scraper_excludes_env", /(^|\n)\.env(\n|$)/.test(scraperDockerignore) && /(^|\n)\.env\.\*(\n|$)/.test(scraperDockerignore), "scraper .dockerignore excludes env files")
  ];

  return { ok: checks.every((item) => item.ok), repoRoot: root, checks };
}

export function assertDeployHygiene(report: DeployHygieneReport): void {
  const failures = report.checks.filter((item) => !item.ok);
  if (failures.length === 0) return;
  throw new Error(failures.map((item) => `${item.name}: ${item.message}`).join("; "));
}

function check(name: string, ok: boolean, message: string): DeployHygieneCheck {
  return { name, ok, message };
}

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}
