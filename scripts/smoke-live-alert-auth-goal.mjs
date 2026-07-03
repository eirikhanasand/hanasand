#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    name: "local realtime alert creates org alert and dispatches Discord payload",
    cwd: "ti/scraper",
    command: "bun",
    args: ["run", "smoke:realtime-alert-discord"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "local DWM persistence, webhook delivery, and organization workflow tests",
    cwd: "ti/scraper",
    command: "bun",
    args: ["test", "src/tests/dwmWorkflowPersistence.test.ts", "src/tests/dwmWebhookDelivery.test.ts", "src/tests/dwmOrganizationWorkflow.test.ts"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "local scraper TypeScript",
    cwd: "ti/scraper",
    command: "./node_modules/.bin/tsc",
    args: ["--noEmit", "--pretty", "false"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "local organization tenant/RBAC smoke",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-organizations-api.ts"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "local SSO OIDC contract smoke",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-sso-oidc-contract.ts"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "local passkey contract smoke",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-passkey-contract.ts"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "local api TypeScript",
    cwd: "api",
    command: "./node_modules/.bin/tsc",
    args: ["--noEmit", "--pretty", "false"],
    requiredEnv: [],
    localFallback: true
  },
  {
    name: "live monitored term creates persisted alert and delivers Discord notification",
    cwd: "ti/scraper",
    command: "bun",
    args: ["run", "smoke:live-alert-discord"],
    requiredEnv: [
      "DWM_LIVE_API_BASE_URL"
    ],
    requiredAnyEnv: [
      ["DWM_LIVE_DISCORD_WEBHOOK_URL", "DWM_LIVE_WEBHOOK_DESTINATION_ID"]
    ]
  },
  {
    name: "live organization tenant roles and member permissions",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-live-organization-auth.ts"],
    requiredEnv: [
      "API_LIVE_BASE_URL",
      "API_LIVE_OWNER_ID",
      "API_LIVE_OWNER_TOKEN",
      "API_LIVE_OWNER_EMAIL",
      "API_LIVE_MEMBER_ID",
      "API_LIVE_MEMBER_TOKEN",
      "API_LIVE_MEMBER_EMAIL"
    ]
  },
  {
    name: "live SSO start and passkey challenge edges",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-live-auth-edges.ts"],
    requiredEnv: [
      "AUTH_LIVE_API_BASE_URL"
    ]
  }
];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log([
    "Usage:",
    "  DWM_LIVE_API_BASE_URL=... DWM_LIVE_DISCORD_WEBHOOK_URL=... \\",
    "  API_LIVE_BASE_URL=... API_LIVE_OWNER_ID=... API_LIVE_OWNER_TOKEN=... API_LIVE_OWNER_EMAIL=... \\",
    "  API_LIVE_MEMBER_ID=... API_LIVE_MEMBER_TOKEN=... API_LIVE_MEMBER_EMAIL=... \\",
    "  AUTH_LIVE_API_BASE_URL=... bun scripts/smoke-live-alert-auth-goal.mjs",
    "",
    "Optional variables are passed through to the underlying probes:",
    "  DWM_LIVE_PROBE_TERM is optional; when omitted the live DWM probe discovers a source-matched term from alert generation readiness.",
    "  DWM_LIVE_WEBHOOK_DESTINATION_ID may be used instead of DWM_LIVE_DISCORD_WEBHOOK_URL when an org Discord destination already exists.",
    "  DWM_LIVE_AUTHORIZATION DWM_LIVE_ORGANIZATION_ID DWM_LIVE_ACTOR_ID DWM_LIVE_OWNER_EMAIL DWM_LIVE_CREATE_ORGANIZATION=false",
    "  API_LIVE_OUTSIDER_ID API_LIVE_OUTSIDER_TOKEN API_LIVE_ORGANIZATION_ID API_LIVE_CREATE_ORGANIZATION=false",
    "  AUTH_LIVE_FRONTEND_BASE_URL AUTH_LIVE_PASSKEY_USERNAME AUTH_LIVE_AUTHORIZATION AUTH_LIVE_ACTOR_ID",
    "",
    "This runner always runs backend local goal coverage, then runs each live group whose required env is present. Missing live groups are reported as skipped, not hidden.",
    "It verifies that:",
    "  - a monitored term creates a persisted org alert from existing captures",
    "  - Discord delivery accepts the generated alert",
    "  - organization tenant roles and permissions work",
    "  - SSO and passkey auth edges are reachable"
  ].join("\n"));
  process.exit(0);
}

const liveChecks = checks.filter(check => !check.localFallback);
const skipped = liveChecks.flatMap(check => {
  const missingRequired = check.requiredEnv
    .filter(name => !hasEnv(name))
    .map(variable => ({ check: check.name, variable }));
  const missingEither = (check.requiredAnyEnv ?? [])
    .filter(group => !group.some(hasEnv))
    .map(group => ({ check: check.name, variable: group.join("|") }));
  const missing = [...missingRequired, ...missingEither];
  return missing.length > 0 ? [{
    name: check.name,
    cwd: check.cwd,
    command: [check.command, ...check.args].join(" "),
    reason: "missing_live_environment",
    missing
  }] : [];
});

const startedAt = new Date().toISOString();
const results = [];

for (const check of checks.filter(check => (
  check.localFallback || (check.requiredEnv.every(hasEnv) && (check.requiredAnyEnv ?? []).every(group => group.some(hasEnv)))
))) {
  const result = spawnSync(check.command, check.args, {
    cwd: resolve(root, check.cwd),
    stdio: "inherit",
    env: process.env
  });
  const exitCode = typeof result.status === "number" ? result.status : 1;
  results.push({
    name: check.name,
    cwd: check.cwd,
    command: [check.command, ...check.args].join(" "),
    exitCode
  });
  if (exitCode !== 0) {
    console.error(JSON.stringify({
      event: "live_alert_auth_goal_smoke",
      ok: false,
      startedAt,
      failedCheck: check.name,
      skipped,
      results
    }, null, 2));
    process.exit(exitCode);
  }
}

const liveResults = results.filter(result => liveChecks.some(check => check.name === result.name));
const liveComplete = skipped.length === 0 && liveResults.length === liveChecks.length;

console.log(JSON.stringify({
  event: "live_alert_auth_goal_smoke",
  ok: true,
  liveComplete,
  status: liveComplete ? "complete" : "partial",
  startedAt,
  finishedAt: new Date().toISOString(),
  skipped,
  message: liveComplete
    ? "All configured live alert/auth goal checks ran successfully."
    : "Local goal coverage passed. Live groups without required env were skipped; provide those env vars to complete production verification.",
  checks: results
}, null, 2));

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}
