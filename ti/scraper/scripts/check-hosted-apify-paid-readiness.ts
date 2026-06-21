import {
  buildHostedApifyPaidReadinessProof,
  type HostedApifyObservedProofImport,
  type HostedApifyProofObservation
} from "../src/contracts/hostedApifyPaidReadiness.ts";

type HostedProofMode = "plan" | "run" | "verify";
type JsonRecord = Record<string, unknown>;
type ObservedProofSource = "none" | "env" | "file";

interface LoadedObservedProofImport {
  source: ObservedProofSource;
  proof: HostedApifyObservedProofImport;
  validationErrors: string[];
}

interface HostedObservationResult {
  status: "hosted_proof_missing" | "verified_hold" | "paid_floor_hosted_proof";
  observation: HostedApifyProofObservation;
  run?: JsonRecord;
  output?: JsonRecord;
  itemSample: JsonRecord[];
}

const token = process.env.APIFY_TOKEN ?? "";
const baseProof = buildHostedApifyPaidReadinessProof({ hasToken: Boolean(token) });
const actorId = process.env.TI_APIFY_ACTOR_ID ?? baseProof.actorId;
const runId = process.env.TI_APIFY_HOSTED_RUN_ID ?? "";
const datasetId = process.env.TI_APIFY_HOSTED_DATASET_ID ?? "";
const mode = parseMode(process.env.TI_APIFY_HOSTED_PROOF_MODE);

try {
  const observedProofImport = await loadObservedProofImport();
  const hostedObservation = observedProofImport
    ? hostedObservationFromImportedProof(observedProofImport.proof)
    : token
      ? await loadHostedObservation({ token, actorId, runId, datasetId, mode })
      : undefined;
  const proof = buildHostedApifyPaidReadinessProof({
    hasToken: Boolean(token),
    hostedImport: hostedObservation?.observation,
    observedProof: observedProofImport?.proof,
    status: hostedObservation?.status
  });
  const payload = buildPayload(proof, actorId, runId, datasetId, mode, hostedObservation, undefined, observedProofImport);

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
    `observedProofImport=${payload.observedProofImport.source}`,
    `externalBlocker=${payload.hostedProofImportPath.externalBlocker ?? "external_marketplace_payout_pricing_not_observed"}`,
    "paidRowIntegrityGate=hold_until_hosted500_second_batch_audit_observed",
    "This is expected when APIFY_TOKEN, hosted 100/300/500 metrics, payout, pricing, or Store analytics are unavailable; do not promote paid traffic from local proof alone."
  ].join("\n"));
  process.exit(0);
} catch (error) {
  const message = errorMessage(error);
  const proof = buildHostedApifyPaidReadinessProof({
    hasToken: Boolean(token),
    status: token ? "hosted_proof_missing" : "external_token_missing",
    readObservedProofFromEnvironment: false
  });
  const payload = buildPayload(proof, actorId, runId, datasetId, mode, undefined, message);
  assertPaidRowIntegrityGate(payload.paidRowIntegrityGate);
  console.log(JSON.stringify(payload, null, 2));
  console.warn([
    "Hosted Apify paid readiness could not verify the hosted 100/300/500 proof ladder.",
    `status=${payload.status}`,
    `mode=${mode}`,
    `apiError=${payload.apiError ?? "none"}`,
    "Use the commandExamples in hostedProofImportPath and keep paid traffic blocked until observed hosted metrics are present."
  ].join("\n"));
  process.exit(message.startsWith("observed_proof_import_rejected:") ? 1 : 0);
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
}): Promise<HostedObservationResult> {
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

async function loadObservedProofImport(): Promise<LoadedObservedProofImport | undefined> {
  const rawFromEnv = process.env.TI_APIFY_OBSERVED_PROOF_JSON;
  const path = process.env.TI_APIFY_OBSERVED_PROOF_PATH;
  if (rawFromEnv && path) {
    throw new Error("observed_proof_import_rejected: provide only one of TI_APIFY_OBSERVED_PROOF_JSON or TI_APIFY_OBSERVED_PROOF_PATH");
  }
  const source: ObservedProofSource = rawFromEnv ? "env" : path ? "file" : "none";
  if (source === "none") return undefined;
  const raw = rawFromEnv ?? await Bun.file(path as string).text();
  const parsed: unknown = JSON.parse(raw);
  const validationErrors = validateObservedProofImport(parsed);
  if (validationErrors.length > 0) {
    throw new Error(`observed_proof_import_rejected: ${validationErrors.join(", ")}`);
  }
  return {
    source,
    proof: parsed as HostedApifyObservedProofImport,
    validationErrors
  };
}

function hostedObservationFromImportedProof(proof: HostedApifyObservedProofImport): HostedObservationResult {
  return {
    status: proof.sampleOnly === true ? "hosted_proof_missing" : "paid_floor_hosted_proof",
    observation: proof,
    itemSample: []
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
  const payload: unknown = await response.json();
  if (isRecord(payload) && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }
  return payload;
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
    buildId: stringValue(run?.buildId) ?? stringValue(run?.buildNumber) ?? null,
    runStatus: runStatus(run),
    failureState: failureState(run),
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
    chargedEventCount: chargedEventCount(output, items),
    chargedDatasetItemEvents: chargedDatasetItemEvents(output, items),
    chargedActorStartEvents: chargedActorStartEvents(output),
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
  hostedObservation?: HostedObservationResult,
  apiError?: string,
  observedProofImport?: LoadedObservedProofImport
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
    observedProofImport: {
      source: observedProofImport?.source ?? "none",
      sampleOnly: observedProofImport?.proof.sampleOnly === true,
      validationErrors: observedProofImport?.validationErrors ?? [],
      observedAt: observedProofImport?.proof.observedAt ?? null
    },
    apiError: apiError ?? null
  };
}

function observedRunNote(status: string, runId: string, datasetId: string, mode: HostedProofMode): string {
  if (status === "paid_floor_hosted_proof") {
    return "Hosted 100-name run metrics and marketplace state were imported from observed proof JSON; release audit still evaluates promotion gates separately.";
  }
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
    && payload.hostedProofOperatorChecklist.gateEffects.hosted500.unlocks === true
    && payload.conversionPayoutTruth.hosted500.state === "observed"
    && payload.paidProofAcceptance.minimumSellableRows === 100
    && payload.paidProofAcceptance.minimumSellableFindingRows >= 52
    && payload.paidProofAcceptance.sourceProvenanceRowsCountTowardFindingFloor === false
    && payload.paidProofAcceptance.falsePositiveInflationFailures === 0
    && payload.hostedProofImportPath.observedFields.noLeakFailures === 0
    && payload.hostedProofImportPath.observedFields.secondBatchAuditObserved === true;
}

function validateObservedProofImport(value: unknown): string[] {
  const errors: string[] = [];
  if (!isRecord(value)) return ["proof must be a JSON object"];
  requireEqual(value, "schemaVersion", "ti.hosted_apify_observed_proof_import.v1", errors);
  requireString(value, "runId", errors);
  requireString(value, "buildId", errors);
  requireOneOf(value, "runStatus", ["succeeded", "failed", "timed_out", "aborted"], errors);
  requireOneOf(value, "failureState", ["none", "failed", "timed_out", "aborted"], errors);
  requireString(value, "datasetId", errors);
  requireEqual(value, "proofPreset", "100_name_paid_preset", errors);
  requireMinimumNumber(value, "defaultQueryCount", 100, errors);
  requireEqual(value, "maxRowsPerQuery", 25, errors);
  requireEqual(value, "includeCoverageGaps", false, errors);
  requireEqual(value, "includeHeldRows", false, errors);
  requireEqual(value, "includeDatasets", false, errors);
  requireMinimumNumber(value, "datasetItemCount", 100, errors);
  requireMinimumNumber(value, "sellableRows", 100, errors);
  requireMinimumNumber(value, "sellableFindingCount", 52, errors);
  requireMinimumNumber(value, "caveatedRows", 0, errors);
  requireMinimumNumber(value, "averageBuyerValueScore", 0, errors);
  requireMinimumNumber(value, "runtimeSeconds", 0, errors);
  requireMinimumNumber(value, "memoryMbytes", 0, errors);
  requireMinimumNumber(value, "usageUsd", 0, errors);
  requireMinimumNumber(value, "costUsd", 0, errors);
  requireMinimumNumber(value, "chargedEventCount", 1, errors);
  requireMinimumNumber(value, "chargedDatasetItemEvents", 0, errors);
  requireMinimumNumber(value, "chargedActorStartEvents", 1, errors);
  requireEqual(value, "noLeakFailures", 0, errors);
  requireEqual(value, "secondBatchAuditObserved", true, errors);
  requireEqual(value, "falsePositiveInflationFailures", 0, errors);
  requireMinimumNumber(value, "storeViews", 0, errors);
  requireMinimumNumber(value, "runs", 0, errors);
  requireMinimumNumber(value, "uniqueUsers", 0, errors);
  requireMinimumNumber(value, "paidUsers", 0, errors);
  requireMinimumNumber(value, "refunds", 0, errors);
  requireString(value, "pricingModel", errors);
  requireEqual(value, "payoutEnabled", true, errors);
  requireEqual(value, "payoutState", "enabled", errors);
  requireEqual(value, "analyticsVisible", true, errors);
  requireMinimumNumber(value, "conversionRate", 0, errors);
  requireOneOf(value, "listingVisibility", ["private", "public"], errors);
  requireOneOf(value, "publicListingStatus", ["draft_copy_ready_not_promoted", "public_listed_not_promoted", "public_promoted"], errors);
  requireDateString(value, "observedAt", errors);

  const sellableRows = numberValue(value.sellableRows);
  const sellableFindings = numberValue(value.sellableFindingCount);
  const datasetRows = numberValue(value.datasetItemCount);
  const caveatedRows = numberValue(value.caveatedRows);
  const runs = numberValue(value.runs);
  const uniqueUsers = numberValue(value.uniqueUsers);
  const paidUsers = numberValue(value.paidUsers);
  const refunds = numberValue(value.refunds);
  const chargedEventTotal = numberValue(value.chargedEventCount);
  const chargedDatasetItemEventsValue = numberValue(value.chargedDatasetItemEvents);
  const chargedActorStartEventsValue = numberValue(value.chargedActorStartEvents);
  const conversionRate = numberValue(value.conversionRate);
  if (sellableRows !== null && datasetRows !== null && sellableRows > datasetRows) errors.push("sellableRows cannot exceed datasetItemCount");
  if (sellableFindings !== null && sellableRows !== null && sellableFindings > sellableRows) errors.push("sellableFindingCount cannot exceed sellableRows");
  if (caveatedRows !== null && sellableRows !== null && datasetRows !== null && sellableRows + caveatedRows > datasetRows) errors.push("sellableRows plus caveatedRows cannot exceed datasetItemCount");
  if (paidUsers !== null && uniqueUsers !== null && paidUsers > uniqueUsers) errors.push("paidUsers cannot exceed uniqueUsers");
  if (paidUsers !== null && runs !== null && paidUsers > runs) errors.push("paidUsers cannot exceed runs");
  if (refunds !== null && paidUsers !== null && refunds > paidUsers) errors.push("refunds cannot exceed paidUsers");
  if (chargedEventTotal !== null && chargedDatasetItemEventsValue !== null && chargedActorStartEventsValue !== null && chargedEventTotal < chargedDatasetItemEventsValue + chargedActorStartEventsValue) errors.push("chargedEventCount must cover chargedDatasetItemEvents plus chargedActorStartEvents");
  if (paidUsers !== null && uniqueUsers !== null && conversionRate !== null && conversionRate > 0 && uniqueUsers === 0) errors.push("conversionRate cannot be positive when uniqueUsers is 0");
  if (value.runStatus === "succeeded" && value.failureState !== "none") errors.push("failureState must be none when runStatus is succeeded");
  if (value.runStatus !== "succeeded" && value.failureState === "none") errors.push("failureState must identify the failure when runStatus is not succeeded");
  if (value.sampleOnly !== undefined && typeof value.sampleOnly !== "boolean") errors.push("sampleOnly must be a boolean when supplied");
  return errors;
}

function requireString(record: JsonRecord, field: string, errors: string[]): void {
  if (typeof record[field] !== "string" || String(record[field]).trim().length === 0) errors.push(`${field} must be a non-empty string`);
}

function requireDateString(record: JsonRecord, field: string, errors: string[]): void {
  requireString(record, field, errors);
  if (typeof record[field] === "string" && !Number.isFinite(Date.parse(record[field] as string))) errors.push(`${field} must be an ISO timestamp`);
}

function requireMinimumNumber(record: JsonRecord, field: string, minimum: number, errors: string[]): void {
  const value = numberValue(record[field]);
  if (value === null || value < minimum) errors.push(`${field} must be a number >= ${minimum}`);
}

function requireEqual(record: JsonRecord, field: string, expected: unknown, errors: string[]): void {
  if (record[field] !== expected) errors.push(`${field} must equal ${JSON.stringify(expected)}`);
}

function requireOneOf(record: JsonRecord, field: string, allowed: string[], errors: string[]): void {
  if (typeof record[field] !== "string" || !allowed.includes(record[field] as string)) errors.push(`${field} must be one of ${allowed.join("|")}`);
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

function runStatus(run: JsonRecord | undefined): HostedApifyProofObservation["runStatus"] {
  const status = String(run?.status ?? "").toUpperCase();
  if (status === "SUCCEEDED" || status === "SUCCESS") return "succeeded";
  if (status === "FAILED") return "failed";
  if (status === "TIMED-OUT" || status === "TIMED_OUT" || status === "TIMEOUT") return "timed_out";
  if (status === "ABORTED") return "aborted";
  return run ? "external_unknown" : null;
}

function failureState(run: JsonRecord | undefined): HostedApifyProofObservation["failureState"] {
  const status = runStatus(run);
  if (status === "succeeded") return "none";
  if (status === "failed" || status === "timed_out" || status === "aborted") return status;
  return run ? "external_unknown" : null;
}

function chargedEventCount(output: JsonRecord | undefined, items: JsonRecord[]): number | null {
  return firstNumberAt(output, ["chargedEventCount", "billingEventCount", "chargeEventCount"])
    ?? numberAtPath(output, ["billing", "chargedEventCount"])
    ?? (items.length ? chargedDatasetItemEvents(output, items) ?? null : null);
}

function chargedDatasetItemEvents(output: JsonRecord | undefined, items: JsonRecord[]): number | null {
  return firstNumberAt(output, ["chargedDatasetItemEvents", "datasetItemChargeEvents"])
    ?? numberAtPath(output, ["billing", "chargedDatasetItemEvents"])
    ?? (items.length ? items.length : null);
}

function chargedActorStartEvents(output: JsonRecord | undefined): number | null {
  return firstNumberAt(output, ["chargedActorStartEvents", "actorStartChargeEvents"])
    ?? numberAtPath(output, ["billing", "chargedActorStartEvents"])
    ?? actorStartEventObserved(output)
    ?? null;
}

function actorStartEventObserved(output: JsonRecord | undefined): number | null {
  const monetization = isRecord(output?.monetization) ? output.monetization : undefined;
  const eventNames = Array.isArray(monetization?.eventNames) ? monetization.eventNames : undefined;
  if (monetization?.actorStartEvent === "apify-actor-start") return 1;
  if (eventNames?.includes("apify-actor-start")) return 1;
  return null;
}

function firstNumberAt(record: JsonRecord | undefined, fields: string[]): number | null {
  if (!record) return null;
  for (const field of fields) {
    const value = numberValue(record[field]);
    if (value !== null) return value;
  }
  return null;
}

function numberAtPath(root: JsonRecord | undefined, path: string[]): number | null {
  let current: unknown = root;
  for (const segment of path) {
    if (!isRecord(current)) return null;
    current = current[segment];
  }
  return numberValue(current);
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
