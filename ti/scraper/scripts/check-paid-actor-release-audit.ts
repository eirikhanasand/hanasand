import { existsSync, readFileSync } from "node:fs";

const outputPath = "apify/public-threat-actor-monitor/output.json";
const minRows = Number(process.env.TI_MIN_SELLABLE_ROWS ?? "100");
const minFindings = Number(process.env.TI_MIN_SELLABLE_FINDINGS ?? "52");
const rows = loadRows(outputPath);
const sellable = rows.filter((row) => row.paidRowDecision === "sellable");
const findings = sellable.filter((row) => ["activity", "target", "ttp"].includes(String(row.rowType ?? "")));
const avgBuyerValue = average(sellable.map((row) => Number(row.buyerValueScore)).filter(Number.isFinite));
const lowValue = sellable.filter((row) => Number(row.buyerValueScore ?? 0) < 0.5).slice(0, 10);
const ok = sellable.length >= minRows && findings.length >= minFindings && lowValue.length === 0;

const packet = {
  ok,
  checkedAt: new Date().toISOString(),
  source: existsSync(outputPath) ? outputPath : "missing",
  metric: "buyer-visible Apify output rows",
  rows: rows.length,
  sellableRows: sellable.length,
  sellableFindings: findings.length,
  averageBuyerValueScore: round(avgBuyerValue),
  required: { sellableRows: minRows, sellableFindings: minFindings, minimumBuyerValueScore: 0.5 },
  blockers: [
    sellable.length < minRows && `need ${minRows - sellable.length} more sellable rows`,
    findings.length < minFindings && `need ${minFindings - findings.length} more sellable findings`,
    lowValue.length > 0 && `${lowValue.length} sellable rows have buyerValueScore < 0.5`
  ].filter(Boolean),
  nextAction: "add fresh distinct public-intelligence rows or improve extraction until this gate passes"
};

console.log(JSON.stringify(packet, null, 2));
if (!ok) process.exit(1);

function loadRows(path: string): any[] {
  if (!existsSync(path)) return [];
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.rows)) return parsed.rows;
  return [];
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
