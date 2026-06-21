import { handleApiRequest } from "../src/api/server.ts";
import { FocusedFrontier } from "../src/frontier/frontier.ts";
import { InMemoryScraperStore } from "../src/storage/memoryStore.ts";
import { readFileSync } from "node:fs";

type AuditStatus = "pass" | "hold" | "fail";

interface AuditCheck {
  name: string;
  status: AuditStatus;
  message: string;
  remediation: string[];
  details?: Record<string, unknown>;
}

const command = "bun run check:paid-actor-release-audit";
const generatedAt = process.env.TI_PAID_ACTOR_RELEASE_AUDIT_GENERATED_AT ?? new Date().toISOString();
const checks: AuditCheck[] = [];

checks.push(checkGitCleanState());
checks.push(checkBranchPushed());
checks.push(checkRunbookDocs());

const contracts = await localJson("/v1/contracts");
const productSlo = await localJson("/v1/ops/product-slo?proofMode=local");
const apifyStoreReadiness = record(contracts.apifyStoreReadiness);
const paidReleaseTruthBoard = record(apifyStoreReadiness.paidReleaseTruthBoard);
const sloPaidReleaseTruthBoard = record(productSlo.paidReleaseTruthBoard);

checks.push(checkNoStalePaidPresetCopy(productSlo, contracts));
checks.push(checkLocalActorProof(apifyStoreReadiness));
checks.push(checkHostedActorProof(apifyStoreReadiness));
checks.push(checkPaidFloorGate(apifyStoreReadiness, productSlo));
checks.push(checkPayoutPricingListing(apifyStoreReadiness, paidReleaseTruthBoard));
checks.push(checkNoLeakProof(paidReleaseTruthBoard, sloPaidReleaseTruthBoard));
checks.push(checkStaleLatestActivityProof(productSlo, paidReleaseTruthBoard));
checks.push(checkObservedTelemetry(paidReleaseTruthBoard));

const failingChecks = checks.filter((check) => check.status === "fail");
const holdingChecks = checks.filter((check) => check.status === "hold");
const releaseDecision = failingChecks.length > 0
  ? "fail_release_hygiene"
  : holdingChecks.length > 0
    ? "hold_paid_release"
    : "ready_for_paid_release";

const packet = {
  ok: failingChecks.length === 0,
  command,
  generatedAt,
  releaseDecision,
  safeToPromotePaidTraffic: releaseDecision === "ready_for_paid_release",
  summary: {
    pass: checks.filter((check) => check.status === "pass").length,
    hold: holdingChecks.length,
    fail: failingChecks.length
  },
  checks
};

console.log(JSON.stringify(packet, null, 2));
if (failingChecks.length > 0) process.exit(1);

async function localJson(path: string): Promise<Record<string, unknown>> {
  const response = await handleApiRequest(new Request(`http://127.0.0.1${path}`), {
    store: new InMemoryScraperStore(),
    frontier: new FocusedFrontier()
  });
  return record(await response.json());
}

function checkGitCleanState(): AuditCheck {
  const status = runGit(["status", "--porcelain=v1", "--untracked-files=all"]);
  const dirtyFiles = status.stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  return {
    name: "git_clean_state",
    status: dirtyFiles.length === 0 ? "pass" : "fail",
    message: dirtyFiles.length === 0
      ? "worktree is clean; no uncommitted or generated files are blocking release audit"
      : "worktree has uncommitted or generated files and cannot be used for a release decision",
    remediation: dirtyFiles.length === 0 ? [] : [
      "Run git status --short and assign each dirty file to the owning worker.",
      "Commit and push coherent green changes, or remove generated files that should not be tracked.",
      "Do not mark an agent ready while generated output, staged code, or unstaged coordination changes remain."
    ],
    details: { dirtyFiles }
  };
}

function checkBranchPushed(): AuditCheck {
  const branch = runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  if (!branch.ok || !upstream.ok) {
    return {
      name: "branch_pushed",
      status: "fail",
      message: "current branch has no readable upstream, so pushed release state cannot be proven",
      remediation: ["Set an upstream with git push -u origin HEAD, then rerun the audit."],
      details: { branch: branch.stdout, upstreamError: upstream.stderr || upstream.stdout }
    };
  }
  const counts = runGit(["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  const [behind = 0, ahead = 0] = counts.stdout.split(/\s+/).map((value) => Number(value));
  const clean = counts.ok && ahead === 0 && behind === 0;
  return {
    name: "branch_pushed",
    status: clean ? "pass" : "fail",
    message: clean
      ? `branch ${branch.stdout} is even with ${upstream.stdout}`
      : `branch ${branch.stdout} is not synchronized with ${upstream.stdout}`,
    remediation: clean ? [] : [
      ahead > 0 ? "Push local commits before release audit can pass." : "",
      behind > 0 ? "Pull/rebase remote commits and rerun checks before release audit can pass." : ""
    ].filter(Boolean),
    details: { branch: branch.stdout, upstream: upstream.stdout, ahead, behind }
  };
}

function checkRunbookDocs(): AuditCheck {
  const coordination = safeRead("coordination.md");
  const agent10 = safeRead("coordination_agent_10.md");
  const changelog = safeRead("apify/public-threat-actor-monitor/CHANGELOG.md");
  const required = [
    { label: "commit and push", ok: coordination.includes("commit/push coherent green changes") || agent10.includes("commit/push coherent green changes") },
    { label: "no generated files", ok: coordination.includes("do not leave generated files") || agent10.includes("do not leave generated files") },
    { label: "no projected paid rows", ok: coordination.includes("do not count projections as paid rows") || agent10.includes("do not count projections as paid rows") },
    { label: "continue next batch", ok: coordination.includes("continue into the next monetization batch") || agent10.includes("continue into the next monetization batch") },
    { label: "100 to 1,000 row runbook", ok: changelog.includes("100 to 1,000") && changelog.includes("without bloat") }
  ];
  const missing = required.filter((item) => !item.ok).map((item) => item.label);
  return {
    name: "worker_handoff_runbook",
    status: missing.length === 0 ? "pass" : "fail",
    message: missing.length === 0
      ? "coordination and changelog explain clean handoff, observed paid rows, and the 100 to 1,000 row path"
      : "worker handoff/runbook documentation is missing required release-hygiene language",
    remediation: missing.length === 0 ? [] : missing.map((label) => `Add explicit documentation for: ${label}.`),
    details: { missing }
  };
}

function checkNoStalePaidPresetCopy(productSlo: Record<string, unknown>, contracts: Record<string, unknown>): AuditCheck {
  const text = JSON.stringify({ productSlo: productSlo.paidReleaseTruthBoard, contracts: record(contracts.apifyStoreReadiness).paidReleaseTruthBoard, apifyLaunchExperiment: productSlo.apifyLaunchExperiment });
  const staleMentions = [
    "20 default queries",
    "20 default actor/ransomware queries",
    "includeCoverageGaps=true"
  ].filter((term) => text.includes(term));
  return {
    name: "paid_preset_copy",
    status: staleMentions.length === 0 ? "pass" : "fail",
    message: staleMentions.length === 0
      ? "paid-release surfaces use the 100-name paid preset and separate local proof from hosted proof"
      : "paid-release surfaces still mention stale 20-query paid defaults",
    remediation: staleMentions.length === 0 ? [] : [
      "Replace paid release copy with the 100-name preset, diagnostics disabled by default, and hosted proof required before promotion.",
      "Keep old 20-query runs labeled only as historical baselines."
    ],
    details: { staleMentions }
  };
}

function checkLocalActorProof(apifyStoreReadiness: Record<string, unknown>): AuditCheck {
  const localProof = record(record(apifyStoreReadiness.storeReadiness).localPaidPresetProof);
  const sellableRows = numberValue(localProof.sellableRows);
  const defaultQueryCount = numberValue(localProof.defaultQueryCount);
  const ok = defaultQueryCount === 100 && sellableRows >= 100 && localProof.proofDecision === "local_paid_floor_pass_hosted_proof_required";
  return {
    name: "actor_local_100_name_proof",
    status: ok ? "pass" : "fail",
    message: ok
      ? "local 100-name buyer preset passes the paid row floor but remains labeled as hosted-proof-required"
      : "local 100-name paid floor proof is missing, too small, or not separated from hosted proof",
    remediation: ok ? [] : [
      "Run the 100-name local Actor proof and update apifyStoreReadiness.storeReadiness.localPaidPresetProof.",
      "Keep local proofDecision as local_paid_floor_pass_hosted_proof_required until a hosted 100-name run passes."
    ],
    details: { defaultQueryCount, sellableRows, proofDecision: localProof.proofDecision }
  };
}

function checkHostedActorProof(apifyStoreReadiness: Record<string, unknown>): AuditCheck {
  const latestProofRun = record(record(apifyStoreReadiness.storeReadiness).latestProofRun);
  const sellableRows = numberValue(latestProofRun.sellableRows);
  const querySet = Array.isArray(latestProofRun.querySet) ? latestProofRun.querySet : [];
  const hostedReady = sellableRows >= 100 && querySet.length >= 100 && latestProofRun.proofDecision === "paid_floor_hosted_proof";
  return {
    name: "hosted_actor_100_name_proof",
    status: hostedReady ? "pass" : "hold",
    message: hostedReady
      ? "hosted Apify proof passes the 100-name paid floor"
      : "hosted Apify proof is still an older shape/safety run or below the 100-name paid floor",
    remediation: hostedReady ? [] : [
      "Publish/rebuild the current Actor and run the hosted 100-name default without custom queries.",
      "Record run id, dataset id, 100-name query proof, sellable finding count, no-leak proof, usage cost, and failed-run count.",
      "Do not buy paid traffic or claim conversion until hosted proof and marketplace telemetry are observed."
    ],
    details: { runId: latestProofRun.runId, datasetId: latestProofRun.datasetId, querySetCount: querySet.length, sellableRows, proofDecision: latestProofRun.proofDecision }
  };
}

function checkPaidFloorGate(apifyStoreReadiness: Record<string, unknown>, productSlo: Record<string, unknown>): AuditCheck {
  const readinessBoard = record(apifyStoreReadiness.paidReleaseTruthBoard);
  const sloBoard = record(productSlo.paidReleaseTruthBoard);
  const readinessAllowed = readinessBoard.paidTrafficAllowed === true;
  const sloAllowed = sloBoard.paidTrafficAllowed === true;
  const verdict = record(readinessBoard.buyerPaidReleaseVerdict);
  const currentSellableRows = numberValue(verdict.currentSellableRows);
  const blockers = Array.isArray(verdict.releaseBlockers) ? verdict.releaseBlockers.filter(isRecord) : [];
  const unsafePromotion = (readinessAllowed || sloAllowed || verdict.decision !== "hold_paid_traffic") && blockers.length > 0;
  return {
    name: "paid_floor_release_gate",
    status: unsafePromotion ? "fail" : currentSellableRows >= 100 ? "pass" : "hold",
    message: unsafePromotion
      ? "paid traffic is marked allowed while release blockers still exist"
      : currentSellableRows >= 100
        ? "paid floor is represented as observed current rows"
        : "paid traffic remains safely held below the observed 100-row floor",
    remediation: unsafePromotion ? [
      "Set paidTrafficAllowed=false and decision=hold_paid_traffic until all release blockers pass.",
      "Do not count projections, graph-only pivots, caveated rows, source counts, or worker claims as current sellable rows."
    ] : currentSellableRows >= 100 ? [] : [
      "Convert live output rows until observed current sellable rows reach at least 100.",
      "Keep projections and local-only proofs out of paid promotion."
    ],
    details: { currentSellableRows, blockerCount: blockers.length, readinessAllowed, sloAllowed, verdictDecision: verdict.decision }
  };
}

function checkPayoutPricingListing(apifyStoreReadiness: Record<string, unknown>, paidReleaseTruthBoard: Record<string, unknown>): AuditCheck {
  const payout = record(apifyStoreReadiness.payoutReadiness);
  const pricing = record(apifyStoreReadiness.pricingHooks);
  const verdict = record(paidReleaseTruthBoard.buyerPaidReleaseVerdict);
  const telemetry = record(record(paidReleaseTruthBoard.observedMarketplaceTelemetry).currentValues);
  const listingState = String(verdict.publicListingState ?? "");
  const pricingState = telemetry.pricingState;
  const payoutState = telemetry.payoutState;
  const pricingShapeReady = pricing.model === "pay_per_dataset_row" && numberValue(pricing.rowPriceUsdPerThousand) > 0;
  const payoutExternallyVerified = payout.externallyVerified === true || payoutState === "ready";
  const listingPromotedTooEarly = listingState !== "draft_copy_ready_not_promoted" && (!payoutExternallyVerified || pricingState === "external_unknown");
  return {
    name: "payout_pricing_listing_state",
    status: listingPromotedTooEarly ? "fail" : payoutExternallyVerified && pricingState !== "external_unknown" ? "pass" : "hold",
    message: listingPromotedTooEarly
      ? "listing is not in draft/hold state while payout or pricing remains unverified"
      : payoutExternallyVerified && pricingState !== "external_unknown"
        ? "payout, pricing, and listing state are ready for promotion"
        : "pricing shape is documented but payout/pricing marketplace state still requires external Apify verification",
    remediation: listingPromotedTooEarly ? [
      "Reset publicListingState to draft_copy_ready_not_promoted.",
      "Verify payout beneficiary, payout method, withdrawal readiness, and marketplace pricing state in Apify before promotion."
    ] : payoutExternallyVerified && pricingState !== "external_unknown" ? [] : [
      "Open Apify billing/payouts and Store pricing, then copy observed states into the telemetry import path.",
      "Keep public listing in draft_copy_ready_not_promoted until those fields are known."
    ],
    details: { listingState, pricingShapeReady, pricingState, payoutState, payoutExternallyVerified }
  };
}

function checkNoLeakProof(...boards: Record<string, unknown>[]): AuditCheck {
  const leaks = boards.flatMap((board, index) => {
    const proof = record(record(board.buyerPaidReleaseVerdict).noLeakProof);
    return Object.entries(proof)
      .filter(([, value]) => value !== false)
      .map(([field, value]) => ({ board: index, field, value }));
  });
  return {
    name: "no_leak_proof",
    status: leaks.length === 0 ? "pass" : "fail",
    message: leaks.length === 0
      ? "paid-release boards show no raw evidence, unsafe URLs, credentials, restricted payloads, or private content"
      : "paid-release no-leak proof has one or more unsafe fields",
    remediation: leaks.length === 0 ? [] : [
      "Stop promotion and remove any raw evidence bodies, unsafe URLs, credentials, restricted payloads, or private content from release surfaces.",
      "Rerun Apify smoke and publication checks after repair."
    ],
    details: { leaks }
  };
}

function checkStaleLatestActivityProof(productSlo: Record<string, unknown>, paidReleaseTruthBoard: Record<string, unknown>): AuditCheck {
  const falsePositiveGate = record(productSlo.falsePositiveSuppressionGate);
  const programCp = record(falsePositiveGate.programCpHardening);
  const secondBatch = record(programCp.secondBatchAudit);
  const runbook = record(paidReleaseTruthBoard.paidReleaseRunbook);
  const gates = Array.isArray(runbook.gates) ? runbook.gates.filter(isRecord) : [];
  const staleGate = gates.find((gate) => gate.gate === "stale_latest_activity_errors");
  const admittedInflation = numberValue(secondBatch.staleLatestActivitySellableFindingInflation);
  const ok = staleGate?.state === "pass" && staleGate.observed === 0 && admittedInflation === 0;
  return {
    name: "stale_latest_activity_proof",
    status: ok ? "pass" : "fail",
    message: ok
      ? "stale/latest-activity errors are blocked from paid release"
      : "stale/latest-activity proof is missing or admits stale rows as sellable findings",
    remediation: ok ? [] : [
      "Repair falsePositiveSuppressionGate.programCpHardening.secondBatchAudit so stale latest-activity inflation is zero.",
      "Keep stale rows held/suppressed until fresh public evidence exists."
    ],
    details: { runbookGate: staleGate, staleLatestActivitySellableFindingInflation: secondBatch.staleLatestActivitySellableFindingInflation }
  };
}

function checkObservedTelemetry(paidReleaseTruthBoard: Record<string, unknown>): AuditCheck {
  const telemetry = record(paidReleaseTruthBoard.observedMarketplaceTelemetry);
  const values = record(telemetry.currentValues);
  const unknownValues = ["storeViews", "uniqueUsers", "trialRuns", "paidRuns", "actorStarts", "actorRuns", "datasetRows", "failedRuns", "repeatUsers", "refunds", "platformUsageCostUsd", "estimatedCreatorRevenueUsd"]
    .filter((field) => values[field] !== null);
  const unknownStatesOk = values.payoutState === "external_unknown" && values.pricingState === "external_unknown";
  const ok = telemetry.noSyntheticFallback === true && telemetry.unknownMeansNoClaim === true && unknownValues.length === 0 && unknownStatesOk;
  return {
    name: "observed_marketplace_telemetry",
    status: ok ? "pass" : "fail",
    message: ok
      ? "external marketplace telemetry remains observed-only with null/unknown defaults"
      : "marketplace telemetry contains non-null or non-unknown values without observed import proof",
    remediation: ok ? [] : [
      "Reset unavailable Apify analytics/billing fields to null or external_unknown.",
      "Only import values copied from Apify Store analytics, Actor runs, datasets, billing, or payouts."
    ],
    details: { unknownValues, payoutState: values.payoutState, pricingState: values.pricingState }
  };
}

function runGit(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  return {
    ok: result.exitCode === 0,
    stdout: new TextDecoder().decode(result.stdout).trim(),
    stderr: new TextDecoder().decode(result.stderr).trim()
  };
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function record(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}
