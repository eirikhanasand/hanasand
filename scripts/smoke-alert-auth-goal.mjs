#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    name: "realtime alert creates org alert and dispatches Discord payload",
    cwd: "ti/scraper",
    command: "bun",
    args: ["run", "smoke:realtime-alert-discord"]
  },
  {
    name: "DWM persistence, webhook delivery, and organization workflow tests",
    cwd: "ti/scraper",
    command: "bun",
    args: ["test", "src/tests/dwmWorkflowPersistence.test.ts", "src/tests/dwmWebhookDelivery.test.ts", "src/tests/dwmOrganizationWorkflow.test.ts"]
  },
  {
    name: "scraper TypeScript",
    cwd: "ti/scraper",
    command: "./node_modules/.bin/tsc",
    args: ["--noEmit", "--pretty", "false"]
  },
  {
    name: "organization tenant/RBAC smoke",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-organizations-api.ts"]
  },
  {
    name: "SSO OIDC contract smoke",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-sso-oidc-contract.ts"]
  },
  {
    name: "passkey contract smoke",
    cwd: "api",
    command: "bun",
    args: ["scripts/smoke-passkey-contract.ts"]
  },
  {
    name: "api TypeScript",
    cwd: "api",
    command: "./node_modules/.bin/tsc",
    args: ["--noEmit", "--pretty", "false"]
  },
  {
    name: "frontend auth/org tenant tests",
    cwd: "frontend",
    command: "bun",
    args: ["test", "tests/passkey-auth-ui.test.ts", "tests/organization-workspace-tenant-switching.test.ts", "tests/organization-watchlist-dwm-bridge.test.ts"]
  },
  {
    name: "frontend TypeScript",
    cwd: "frontend",
    command: "./node_modules/.bin/tsc",
    args: ["--noEmit", "--pretty", "false"]
  }
];

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
      event: "alert_auth_goal_smoke",
      ok: false,
      startedAt,
      failedCheck: check.name,
      results
    }, null, 2));
    process.exit(exitCode);
  }
}

console.log(JSON.stringify({
  event: "alert_auth_goal_smoke",
  ok: true,
  startedAt,
  finishedAt: new Date().toISOString(),
  coverage: [
    "monitored term creates persisted org DWM alert",
    "Discord webhook payload dispatch is exercised with mocked fetch",
    "organization tenant/RBAC and outsider isolation smoke passes",
    "frontend tenant switching and org watchlist bridge tests pass",
    "SSO OIDC and passkey contracts pass"
  ],
  checks: results
}, null, 2));
