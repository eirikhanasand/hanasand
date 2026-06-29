import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAnalystHandoffValidationReport } from "../src/product/analystHandoffConsumer.ts";

const args = Bun.argv.slice(2);
const allowBlockers = args.includes("--allow-blockers");
const files = args.filter((arg) => arg !== "--allow-blockers" && arg !== "--json");

if (!files.length) {
  console.error("Usage: bun scripts/validateAnalystHandoffBundles.ts [--json] [--allow-blockers] bundle.json [...bundle.json]");
  process.exit(1);
}

const report = buildAnalystHandoffValidationReport({
  results: files.map((file) => {
  const path = resolve(file);
  try {
    const payload = JSON.parse(readFileSync(path, "utf8"));
    return { file: path, bundle: payload.bundle || payload };
  } catch (error) {
    return { file: path, error };
  }
  })
});

console.log(JSON.stringify(report, null, 2));

if (!allowBlockers && !report.ok) process.exit(1);
