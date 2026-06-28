#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const scoreboardPath = path.join(process.cwd(), "docs/product/cti-xdr-scoreboard.json");
const requiredRows = [
  "ORG",
  "INV",
  "RBAC",
  "WATCH",
  "TELE",
  "ONION",
  "ALERTS",
  "DELIVERY",
  "CASES",
  "HELP",
  "AUDIT",
  "DEPLOY",
];
const requiredFields = [
  "id",
  "pillar",
  "ownerThread",
  "currentStatus",
  "lastCommitOrHandoff",
  "nextCodeSlice",
  "measurableKpi",
  "blocker",
];
const workflowKpiPrefixes = [
  "organizations.",
  "watchlists.",
  "sources.",
  "collection.",
  "alerts.",
  "delivery.",
  "cases.",
  "admin.",
];

function fail(message) {
  console.error(`scoreboard invalid: ${message}`);
  process.exit(1);
}

const scoreboard = JSON.parse(fs.readFileSync(scoreboardPath, "utf8"));

if (!Array.isArray(scoreboard.rows)) {
  fail("rows must be an array");
}

const rowsById = new Map();
for (const row of scoreboard.rows) {
  for (const field of requiredFields) {
    if (!(field in row)) {
      fail(`${row.id || "unknown row"} missing ${field}`);
    }
  }
  if (rowsById.has(row.id)) {
    fail(`duplicate row id ${row.id}`);
  }
  if (!Array.isArray(row.measurableKpi) || row.measurableKpi.length === 0) {
    fail(`${row.id} needs at least one measurableKpi`);
  }
  const statusText = `${row.currentStatus} ${row.nextCodeSlice} ${row.blocker}`.toLowerCase();
  const claimsComplete = /\b(complete|completed|ready)\b/.test(statusText);
  const hasCustomerWorkflowKpi = row.measurableKpi.some((kpi) =>
    workflowKpiPrefixes.some((prefix) => kpi.startsWith(prefix)),
  );
  if (claimsComplete && !hasCustomerWorkflowKpi) {
    fail(`${row.id} claims complete/ready without a measurable customer workflow KPI`);
  }
  rowsById.set(row.id, row);
}

for (const id of requiredRows) {
  if (!rowsById.has(id)) {
    fail(`missing required row ${id}`);
  }
}

const compact = (value, maxLength = 92) => {
  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
};

console.log(`CTI/XDR scoreboard ${scoreboard.updatedAt}`);
console.log(`rows=${scoreboard.rows.length} required=${requiredRows.length} source=${scoreboard.sourceDoc}`);
console.log("");

for (const id of requiredRows) {
  const row = rowsById.get(id);
  const status = compact(row.currentStatus, 68);
  const handoff = compact(row.lastCommitOrHandoff, 72);
  console.log(`${id.padEnd(8)} ${row.pillar.padEnd(28)} | ${status}`);
  console.log(`${"".padEnd(37)} | handoff: ${handoff}`);
  console.log(`${"".padEnd(37)} | kpi: ${row.measurableKpi.join(", ")}`);
}

if (scoreboard.coordinatorInstructions) {
  console.log("");
  console.log("progress:");
  for (const item of scoreboard.coordinatorInstructions.countsAsImprovement || []) {
    console.log(`+ ${item}`);
  }
  console.log("circular:");
  for (const item of scoreboard.coordinatorInstructions.countsAsCircularWork || []) {
    console.log(`- ${item}`);
  }
  if (Array.isArray(scoreboard.coordinatorInstructions.deployCriteria)) {
    console.log("deploy:");
    for (const item of scoreboard.coordinatorInstructions.deployCriteria) {
      console.log(`* ${item}`);
    }
  }
}
