import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
  summarizeAnalystHandoffConsumerBundle,
  validateAnalystHandoffConsumerBundle,
} from "../src/product/analystHandoffConsumer.ts";

const args = Bun.argv.slice(2);
const allowBlockers = args.includes("--allow-blockers");
const files = args.filter((arg) => arg !== "--allow-blockers");

if (!files.length) {
  console.error("Usage: bun scripts/validateAnalystHandoffBundles.ts [--allow-blockers] bundle.json [...bundle.json]");
  process.exit(1);
}

const results = files.map((file) => {
  const path = resolve(file);
  try {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    const bundle = payload.bundle || payload;
    const validation = validateAnalystHandoffConsumerBundle(bundle);
    const summary = summarizeAnalystHandoffConsumerBundle(bundle);
    return {
      file: path,
      ok: validation.ok,
      schemaVersion: validation.schemaVersion,
      blockerCount: validation.blockers.length,
      blockerCodes: [...new Set(validation.blockers.map((item) => item.code))].sort(),
      blockers: summary.blockers,
      contracts: validation.contracts,
      identity: validation.identity
    };
  } catch (error) {
    return {
      file: path,
      ok: false,
      schemaVersion: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
      blockerCount: 1,
      blockerCodes: ["invalid_request"],
      blockers: [{
        code: "invalid_request",
        stage: "bundle",
        field: "file",
        detail: error instanceof Error ? error.message : "Unable to read or parse handoff bundle.",
        recoverable: true
      }],
      contracts: null,
      identity: undefined
    };
  }
});

const report = {
  schemaVersion: "hanasand.analyst_handoff.validation_report.v1",
  checkedAt: new Date().toISOString(),
  ok: results.every((item) => item.ok),
  bundleCount: results.length,
  passedCount: results.filter((item) => item.ok).length,
  failedCount: results.filter((item) => !item.ok).length,
  blockerCodes: [...new Set(results.flatMap((item) => item.blockerCodes))].sort(),
  results
};

console.log(JSON.stringify(report, null, 2));

if (!allowBlockers && !report.ok) process.exit(1);
