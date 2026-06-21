import { buildHostedApifyPaidReadinessProof, type HostedApifyProofObservation } from "../src/contracts/hostedApifyPaidReadiness.ts";

type HostedProofMode = "plan" | "run" | "verify";
type JsonRecord = Record<string, unknown>;

const token = process.env.APIFY_TOKEN ?? "";
const baseProof = buildHostedApifyPaidReadinessProof({ hasToken: Boolean(token) });
const actorId = process.env.TI_APIFY_ACTOR_ID ?? baseProof.actorId;
const runId = process.env.TI_APIFY_HOSTED_RUN_ID ?? "";
const datasetId = process.env.TI_APIFY_HOSTED_DATASET_ID ?? "";
const mode = parseMode(process.env.TI_APIFY_HOSTED_PROOF_MODE);

try {
  const hostedObservation = token ? await loadHostedObservation({ token, actorId, runId, datasetId, mode }) : undefined;
  const proof = buildHostedApifyPaidReadinessProof({
    hasToken: Boolean(token),
    hostedImport: hostedObservation?.observation,
    status: hostedObservation?.status
  });
  const payload = buildPayload(proof, actorId, runId, datasetId, mode, hostedObservation);

  assertPaidRowIntegrityGate(payload.paidRowIntegrityGate);
  console.log(JSON.stringify(payload, null, 2));

  if (isOkForPaidPromotion(payload)) {
    process.exit(0);
  }

  console.warn([
    "Hosted Apify paid readiness is not complete.",
    `status=${payload.status}`,
    `tokenState=${payload.tokenState}`,
    `mode=${mode}`,
    `externalBlocker=${payload.hostedProofImportPath.externalBlocker ?? "external_marketplace_payout_pricing_not_observed"}`,
    "paidRowIntegrityGate=hold_until_hosted_second_batch_audit_observed",
    "This is expected when APIFY_TOKEN, hosted 100-name run metrics, payout, pricing, or Store analytics are unavailable; do not promote paid traffic from local proof alone."
  ].join("\n"));
  process.exit(0);
} catch (error) {
  const proof = buildHostedApifyPaidReadinessProof({
    hasToken: Boolean(token),
    status: token ? "hosted_proof_missing" : "external_token_missing"
  });
  const payload = buildPayload(proof, actorId, runId, datasetId, mode, undefined, errorMessage(error));
  assertPaidRowIntegrityGate(payload.paidRowIntegrityGate);
  console.log(JSON.stringify(payload, null, 2));
  console.warn([
    "Hosted Apify paid readiness could not verify a hosted 100-name run.",
    `status=${payload.status}`,
    `mode=${mode}`,
    `apiError=${payload.apiError ?? "none"}`,
    "Use the commandExamples in hostedProofImportPath and keep paid traffic blocked until observed hosted metrics are present."
  ].join("\n"));
  process.exit(0);
}

function parseMode(value: string | undefined): HostedProofMode {
  if (value === "run" || value === "verify") return value;
  return "plan";
}

async function loadHostedObservation(input: {
  token: string;
  actorId: string;
  runId: string;
  datasetId: string;
  mode: HostedProofMode;
}): Promise<{
  status: "hosted_proof_missing" | "verified_hold";
  observation: HostedApifyProofObservation;
  run?: JsonRecord;
  output?: JsonRecord;
  itemSample: JsonRecord[];
}> {
  if (input.mode === "plan") {
    return {
      status: "hosted_proof_missing",
      observation: {},
      itemSample: []
    };
  }

  const run = input.mode === "run"
    ? await startHostedRun(input.token, input.actorId)
    : input.runId
      ? await fetchApifyRecord(input.token, `https://api.apify.com/v2/actor-runs/${encodeURIComponent(input.runId)}`)
      : undefined;
  const resolvedDatasetId = stringValue(run?.defaultDatasetId) ?? input.datasetId;
  const items = resolvedDatasetId ? await fetchDatasetItems(input.token, resolvedDatasetId) : [];
  const output = await fetchOutputRecord(input.token, run);
  const observation = summarizeHostedObservation(run, output, items, resolvedDatasetId, input.runId);
  const hostedProofPresent = Boolean(
    observation.runId
    && observation.datasetId
    && observation.datasetItemCount !== null
    && observation.sellableRows !== null
    && observation.sellableFindingCount !== null
    && observation.caveatedRows !== null
    && observation.averageBuyerValueScore !== null
    && observation.noLeakFailures === 0
    && observation.secondBatchAuditObserved === true
  );

  return {
    status: hostedProofPresent ? "verified_hold" : "hosted_proof_missing",
    observation,
    run,
    output,
    itemSample: items.slice(0, 3)
  };
}

async function startHostedRun(token: string, actorId: string): Promise<JsonRecord> {
  const encodedActorId = actorId.replace("/", "~");
  const waitSecs = Number(process.env.TI_APIFY_HOSTED_WAIT_SECS ?? "300");
  return await fetchApifyRecord(token, `https://api.apify.com/v2/acts/${encodeURIComponent(encodedActorId)}/runs?waitForFinish=${Number.isFinite(waitSecs) ? waitSecs : 300}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      maxRowsPerQuery: 25,
      includeCoverageGaps: false,
      includeHeldRows: false,
      includeDatasets: false
    })
  });
}

async function fetchDatasetItems(token: string, datasetId: string): Promise<JsonRecord[]> {
  const value = await fetchApifyRecord(token, `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=100000`);
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

async function fetchOutputRecord(token: string, run: JsonRecord | undefined): Promise<JsonRecord | undefined> {
  const storeId = stringValue(run?.defaultKeyValueStoreId);
  if (!storeId) return undefined;
  const output = await fetchApifyRecord(token, `https://api.apify.com/v2/key-value-stores/${encodeURIComponent(storeId)}/records/OUTPUT`);
  return isRecord(output) ? output : undefined;
}

async function fetchApifyRecord(token: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Apify API ${response.status} ${response.statusText} for ${url}`);
  }
  return await response.json();
}

function summarizeHostedObservation(
  run: JsonRecord | undefined,
  output: JsonRecord | undefined,
  items: JsonRecord[],
  datasetId: string,
  suppliedRunId: string
): HostedApifyProofObservation {
  const sellableRows = items.filter((item) => item.paidRowDecision === "sellable");
  const sellableFindingRows = sellableRows.filter((item) => ["activity", "target", "ttp"].includes(String(item.rowType ?? "")));
  const caveatedRows = items.filter((item) => item.paidRowDecision === "included_with_caveat");
  const buyerScores = items.map((item) => numberValue(item.buyerValueScore)).filter((value): value is number => value !== null);
  const secondBatchAudit = recordAtPath(output, ["falsePositiveSuppressionGate", "programCpHardening", "secondBatchAudit"]);
  const noLeakFailures = countNoLeakFailures(items, output);

  return {
    runId: stringValue(run?.id) ?? (suppliedRunId || null),
    datasetId: datasetId || null,
    datasetItemCount: items.length || null,
    sellableRows: items.length ? sellableRows.length : null,
    sellableFindingCount: items.length ? sellableFindingRows.length : null,
    caveatedRows: items.length ? caveatedRows.length : null,
    averageBuyerValueScore: buyerScores.length ? roundToThree(buyerScores.reduce((sum, value) => sum + value, 0) / buyerScores.length) : null,
    runtimeSeconds: runtimeSeconds(run),
    memoryMbytes: memoryMbytes(run),
    usageUsd: firstNumberAt(run, ["usageTotalUsd", "usageUsd"]),
    costUsd: firstNumberAt(run, ["usageTotalUsd", "costUsd"]),
    noLeakFailures,
    secondBatchAuditObserved: Boolean(secondBatchAudit),
    falsePositiveInflationFailures: secondBatchAudit ? countFalsePositiveInflationFailures(secondBatchAudit) : null,
    lastVerifiedAt: new Date().toISOString()
  };
}

function buildPayload(
  proof: ReturnType<typeof buildHostedApifyPaidReadinessProof>,
  actorId: string,
  runId: string,
  datasetId: string,
  mode: HostedProofMode,
  hostedObservation?: Awaited<ReturnType<typeof loadHostedObservation>>,
  apiError?: string
) {
  return {
    ...proof,
    actorId,
    paidPromotionReady: false,
    proofMode: mode,
    observedHostedRun: {
      runId: proof.hostedProofImportPath.observedFields.runId ?? (runId || null),
      datasetId: proof.hostedProofImportPath.observedFields.datasetId ?? (datasetId || null),
      suppliedViaEnvironment: Boolean(runId || datasetId),
      observedViaApifyApi: Boolean(hostedObservation?.observation.lastVerifiedAt),
      itemSample: hostedObservation?.itemSample ?? [],
      note: observedRunNote(proof.status, runId, datasetId, mode)
    },
    apiError: apiError ?? null
  };
}

function observedRunNote(status: string, runId: string, datasetId: string, mode: HostedProofMode): string {
  if (status === "verified_hold") {
    return "Hosted 100-name run metrics were observed, but paid promotion still waits for external marketplace, payout, and pricing proof.";
  }
  if (mode === "plan") {
    return "No hosted API call was attempted; set TI_APIFY_HOSTED_PROOF_MODE=run or verify with APIFY_TOKEN.";
  }
  if (runId || datasetId) {
    return "Run or dataset ids were supplied, but hosted proof metrics are incomplete or unverifiable.";
  }
  return "No hosted 100-name run id or dataset id supplied.";
}

function assertPaidRowIntegrityGate(paidRowIntegrityGate: ReturnType<typeof buildHostedApifyPaidReadinessProof>["paidRowIntegrityGate"]): void {
  const requiredZeroCountsPass = Object.values(paidRowIntegrityGate.requiredZeroCounts).every((value) => value === 0);
  const integrityGatePass = paidRowIntegrityGate.schemaVersion === "ti.program_cp_hosted_paid_row_integrity_gate.v1"
    && paidRowIntegrityGate.sourceProofField === "falsePositiveSuppressionGate.programCpHardening.secondBatchAudit"
    && paidRowIntegrityGate.requiredForPaidPromotion === true
    && paidRowIntegrityGate.hostedProofCountsTowardPaidPromotion === false
    && paidRowIntegrityGate.sourceProvenanceRowsCountTowardFindingFloor === false
    && paidRowIntegrityGate.caveatedRowsCountTowardChargeable === false
    && requiredZeroCountsPass
    && paidRowIntegrityGate.requiredSignals.includes("current_public_support")
    && paidRowIntegrityGate.requiredSignals.includes("actor_specific")
    && paidRowIntegrityGate.requiredSignals.includes("finding_context")
    && paidRowIntegrityGate.requiredSignals.includes("freshness_not_stale")
    && paidRowIntegrityGate.requiredSignals.includes("provenance_hash")
    && paidRowIntegrityGate.requiredSignals.includes("no_leak")
    && paidRowIntegrityGate.requiredSignals.includes("buyer_action")
    && paidRowIntegrityGate.blockers.includes("hosted_100_name_cp_second_batch_audit_not_yet_observed")
    && paidRowIntegrityGate.blockers.includes("source_provenance_rows_do_not_count_as_findings")
    && paidRowIntegrityGate.blockers.includes("stale_alias_generic_graph_restricted_rows_must_be_zero");

  if (!integrityGatePass) {
    console.error("Hosted Apify paid readiness proof is missing Program CP paid-row integrity gates.");
    process.exit(1);
  }
}

function isOkForPaidPromotion(payload: ReturnType<typeof buildPayload>): boolean {
  return payload.status === "paid_floor_hosted_proof"
    && payload.marketplaceConversionInputs.payoutEnabled !== "external_unknown"
    && payload.marketplaceConversionInputs.pricingModel !== "external_unknown"
    && payload.paidProofAcceptance.minimumSellableRows === 100
    && payload.paidProofAcceptance.minimumSellableFindingRows >= 52
    && payload.paidProofAcceptance.sourceProvenanceRowsCountTowardFindingFloor === false
    && payload.paidProofAcceptance.falsePositiveInflationFailures === 0
    && payload.hostedProofImportPath.observedFields.noLeakFailures === 0
    && payload.hostedProofImportPath.observedFields.secondBatchAuditObserved === true;
}

function countFalsePositiveInflationFailures(secondBatchAudit: JsonRecord): number {
  let failures = 0;
  for (const field of [
    "staleLatestActivitySellableRows",
    "aliasOrWrongActorSellableRows",
    "genericSourcePageSellableRows",
    "graphOnlySellableRows",
    "restrictedOnlySellableRows"
  ]) {
    if ((numberValue(secondBatchAudit[field]) ?? 0) !== 0) failures += 1;
  }
  if (secondBatchAudit.sourceProvenanceRowsCountTowardFindingFloor !== false) failures += 1;
  if (secondBatchAudit.caveatedRowsCountTowardChargeable !== false) failures += 1;
  return failures;
}

function countNoLeakFailures(items: JsonRecord[], output: JsonRecord | undefined): number {
  const candidates = [...items, ...(output ? [output] : [])];
  return candidates.filter((record) => hasLeakSignal(record)).length;
}

function hasLeakSignal(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasLeakSignal(entry));
  if (!isRecord(value)) return false;
  for (const [key, nested] of Object.entries(value)) {
    if (["rawEvidenceExposed", "unsafeUrlsExposed", "restrictedPayloadsExposed", "objectKeysExposed", "privateMaterialExposed", "actorInteractionContentExposed"].includes(key) && nested === true) {
      return true;
    }
    if (["rawEvidenceBody", "rawEvidenceBodies", "rawBody", "rawContent", "rawHtml", "restrictedPayload", "objectKey", "privateContent", "credential", "actorInteractionContent"].includes(key) && hasValue(nested)) {
      return true;
    }
    if (hasLeakSignal(nested)) return true;
  }
  return false;
}

function hasValue(value: unknown): boolean {
  if (value === null || value === undefined || value === false) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function runtimeSeconds(run: JsonRecord | undefined): number | null {
  const stats = isRecord(run?.stats) ? run.stats : {};
  const fromStats = firstNumberAt(stats, ["runTimeSecs", "runtimeSecs", "durationSecs"]);
  if (fromStats !== null) return fromStats;
  const startedAt = dateMillis(run?.startedAt);
  const finishedAt = dateMillis(run?.finishedAt);
  return startedAt !== null && finishedAt !== null && finishedAt >= startedAt ? roundToThree((finishedAt - startedAt) / 1000) : null;
}

function memoryMbytes(run: JsonRecord | undefined): number | null {
  const stats = isRecord(run?.stats) ? run.stats : {};
  const memBytes = firstNumberAt(stats, ["memAvgBytes", "memMaxBytes"]);
  if (memBytes !== null) return roundToThree(memBytes / 1024 / 1024);
  return firstNumberAt(run, ["memoryMbytes"]);
}

function firstNumberAt(record: JsonRecord | undefined, fields: string[]): number | null {
  if (!record) return null;
  for (const field of fields) {
    const value = numberValue(record[field]);
    if (value !== null) return value;
  }
  return null;
}

function recordAtPath(root: JsonRecord | undefined, path: string[]): JsonRecord | undefined {
  let current: unknown = root;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return isRecord(current) ? current : undefined;
}

function dateMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function roundToThree(value: number): number {
  return Number(value.toFixed(3));
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
