#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    name: "live monitored term creates persisted alert and delivers Discord notification",
    cwd: "ti/scraper",
    command: "bun",
    args: ["run", "smoke:live-alert-discord"],
    requiredEnv: [
      "DWM_LIVE_API_BASE_URL",
      "DWM_LIVE_PROBE_TERM",
      "DWM_LIVE_DISCORD_WEBHOOK_URL"
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
    "  DWM_LIVE_API_BASE_URL=... DWM_LIVE_PROBE_TERM=... DWM_LIVE_DISCORD_WEBHOOK_URL=... \\",
    "  API_LIVE_BASE_URL=... API_LIVE_OWNER_ID=... API_LIVE_OWNER_TOKEN=... API_LIVE_OWNER_EMAIL=... \\",
    "  API_LIVE_MEMBER_ID=... API_LIVE_MEMBER_TOKEN=... API_LIVE_MEMBER_EMAIL=... \\",
    "  AUTH_LIVE_API_BASE_URL=... bun scripts/smoke-live-alert-auth-goal.mjs",
    "",
    "Optional variables are passed through to the underlying probes:",
    "  DWM_LIVE_AUTHORIZATION DWM_LIVE_ORGANIZATION_ID DWM_LIVE_ACTOR_ID DWM_LIVE_OWNER_EMAIL DWM_LIVE_CREATE_ORGANIZATION=false",
    "  API_LIVE_OUTSIDER_ID API_LIVE_OUTSIDER_TOKEN API_LIVE_ORGANIZATION_ID API_LIVE_CREATE_ORGANIZATION=false",
    "  AUTH_LIVE_FRONTEND_BASE_URL AUTH_LIVE_PASSKEY_USERNAME AUTH_LIVE_AUTHORIZATION AUTH_LIVE_ACTOR_ID",
    "",
    "This runner intentionally requires all live groups by default. It is the production proof that:",
    "  - a monitored term creates a persisted org alert from existing captures",
    "  - Discord delivery accepts the generated alert",
    "  - organization tenant roles and permissions work",
    "  - SSO and passkey auth edges are reachable"
  ].join("\n"));
  process.exit(0);
}

const missing = checks.flatMap(check => (
  check.requiredEnv
    .filter(name => !process.env[name]?.trim())
    .map(name => ({ check: check.name, variable: name }))
));

if (missing.length > 0) {
  console.error(JSON.stringify({
    event: "live_alert_auth_goal_smoke",
    ok: false,
    blocked: true,
    reason: "missing_live_environment",
    missing,
    message: "Live verification requires deployed API/scraper URLs, Discord webhook URL, and live owner/member credentials. No live mutations were attempted."
  }, null, 2));
  process.exit(1);
}

const startedAt = new Date().toISOString();
const results = [];

for (const check of checks) {
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
      results
    }, null, 2));
    process.exit(exitCode);
  }
}

console.log(JSON.stringify({
  event: "live_alert_auth_goal_smoke",
  ok: true,
  startedAt,
  finishedAt: new Date().toISOString(),
  checks: results
}, null, 2));
