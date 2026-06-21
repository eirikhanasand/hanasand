const outputPath = "apify/public-threat-actor-monitor/output.json";
const tokenReady = Boolean(process.env.APIFY_TOKEN);
const observedProof = process.env.TI_APIFY_OBSERVED_PROOF_JSON
  ? JSON.parse(process.env.TI_APIFY_OBSERVED_PROOF_JSON)
  : process.env.TI_APIFY_OBSERVED_PROOF_PATH
    ? JSON.parse(await Bun.file(process.env.TI_APIFY_OBSERVED_PROOF_PATH).text())
    : undefined;

const output = await readJson(outputPath);
const rows = Array.isArray(output?.rows) ? output.rows : Array.isArray(output) ? output : [];
const sellableRows = rows.filter((row: any) => Number(row.buyerValueScore ?? row.confidence ?? 0) >= 0.6 && !row.noLeakFailure && !row.rawContentIncluded).length;
const hostedRows = Number(observedProof?.sellableRows ?? observedProof?.datasetItemCount ?? 0);
const paidReady = tokenReady && hostedRows >= 100 && sellableRows >= 100;

console.log(JSON.stringify({
  ok: paidReady,
  command: "bun run check:hosted-apify-paid-readiness",
  tokenReady,
  local: { rowCount: rows.length, sellableRows },
  hosted: { observed: Boolean(observedProof), sellableRows: hostedRows },
  blocker: paidReady ? undefined : "need APIFY_TOKEN, hosted observed proof >=100 sellable rows, and local Actor output >=100 sellable rows"
}, null, 2));

if (process.env.TI_REQUIRE_HOSTED_APIFY_PAID_READY === "true" && !paidReady) process.exit(1);

async function readJson(path: string) {
  try { return JSON.parse(await Bun.file(path).text()); } catch { return {}; }
}
