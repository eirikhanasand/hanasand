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
const releaseLadder = buildReleaseLadder(productSlo, apifyStoreReadiness, paidReleaseTruthBoard);

checks.push(checkNoStalePaidPresetCopy(productSlo, contracts));
checks.push(checkLocalActorProof(apifyStoreReadiness));
checks.push(checkHostedActorProof(apifyStoreReadiness));
checks.push(checkHostedPaidReadinessProof(apifyStoreReadiness, paidReleaseTruthBoard, sloPaidReleaseTruthBoard));
checks.push(checkReleaseLadder(releaseLadder));
checks.push(checkObservedHostedProofImport(releaseLadder));
checks.push(checkPaidCountIntegrity(productSlo, paidReleaseTruthBoard, releaseLadder));
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
  releaseLadder,
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

function checkHostedPaidReadinessProof(
  apifyStoreReadiness: Record<string, unknown>,
  paidReleaseTruthBoard: Record<string, unknown>,
  sloPaidReleaseTruthBoard: Record<string, unknown>
): AuditCheck {
  const storeProof = record(record(apifyStoreReadiness.storeReadiness).hostedPaidReadinessProof);
  const contractProof = record(paidReleaseTruthBoard.hostedPaidReadinessProof);
  const sloProof = record(sloPaidReleaseTruthBoard.hostedPaidReadinessProof);
  const routeCopies = [storeProof, contractProof, sloProof];
  const commandOk = routeCopies.every((proof) => proof.command === "bun run check:hosted-apify-paid-readiness");
  const statusOk = routeCopies.every((proof) => ["external_token_missing", "hosted_proof_missing", "verified_hold", "paid_floor_hosted_proof"].includes(String(proof.status)));
  const localCountsOut = routeCopies.every((proof) => record(proof.localProof).countsTowardPaidPromotion === false);
  const hostedCountsOut = routeCopies.every((proof) => record(proof.latestHostedProof).countsTowardPaidPromotion === false);
  const marketplace = routeCopies.map((proof) => record(proof.marketplaceConversionInputs));
  const importPaths = routeCopies.map((proof) => record(proof.hostedProofImportPath));
  const observedProofImports = importPaths.map((path) => record(path.observedProofImport));
  const emptyMarketplaceHold = marketplace.every((values) =>
    values.storeViews === null
    && values.runs === null
    && values.uniqueUsers === null
    && values.paidUsers === null
    && values.refunds === null
    && values.payoutEnabled === "external_unknown"
    && values.pricingModel === "external_unknown"
    && values.publicListingStatus === "draft_copy_ready_not_promoted"
    && values.unknownMeansNoClaim === true
  );
  const importedMarketplaceObserved = marketplace.every((values) =>
    numberValue(values.storeViews) !== null
    && numberValue(values.runs) !== null
    && numberValue(values.uniqueUsers) !== null
    && numberValue(values.paidUsers) !== null
    && numberValue(values.refunds) !== null
    && values.payoutEnabled === true
    && typeof values.pricingModel === "string"
    && values.pricingModel !== "external_unknown"
    && typeof values.lastVerifiedAt === "string"
    && values.unknownMeansNoClaim === true
  ) && observedProofImports.every((entry) => entry.schemaVersion === "ti.hosted_apify_observed_proof_import_path.v1" && entry.validationState === "accepted" && entry.sampleOnly === false);
  const observedOnly = emptyMarketplaceHold || importedMarketplaceObserved;
  const hasManualSteps = routeCopies.every((proof) => Array.isArray(proof.manualVerificationSteps) && proof.manualVerificationSteps.length >= 4);
  const paidReady = routeCopies.some((proof) => proof.status === "paid_floor_hosted_proof");
  const ok = commandOk && statusOk && localCountsOut && hostedCountsOut && observedOnly && hasManualSteps;
  return {
    name: "hosted_paid_readiness_proof",
    status: ok && paidReady ? "pass" : ok ? "hold" : "fail",
    message: ok && paidReady
      ? "hosted paid-readiness proof is verified and marketplace state is observed"
      : ok
        ? "hosted paid-readiness proof is explicit and truthfully held until token, 100-name hosted run, payout, pricing, and conversion telemetry are observed"
        : "hosted paid-readiness proof is missing or mixes local/shape proof with paid promotion",
    remediation: ok ? [
      "Run bun run check:hosted-apify-paid-readiness with Apify access, then record the hosted 100-name run id, dataset id, counts, usage cost, payout, pricing, and conversion telemetry."
    ] : [
      "Expose hostedPaidReadinessProof on /v1/contracts#apifyStoreReadiness.storeReadiness, /v1/contracts#apifyStoreReadiness.paidReleaseTruthBoard, and /v1/ops/product-slo.paidReleaseTruthBoard.",
      "Keep local proof and old hosted shape/safety proof marked countsTowardPaidPromotion=false.",
      "Keep marketplace conversion inputs null/external_unknown until copied from Apify."
    ],
    details: {
      statuses: routeCopies.map((proof) => proof.status),
      commandOk,
      localCountsOut,
      hostedCountsOut,
      observedOnly,
      emptyMarketplaceHold,
      importedMarketplaceObserved,
      hasManualSteps
    }
  };
}

function buildReleaseLadder(
  productSlo: Record<string, unknown>,
  apifyStoreReadiness: Record<string, unknown>,
  paidReleaseTruthBoard: Record<string, unknown>
): Record<string, unknown> {
  const storeReadiness = record(apifyStoreReadiness.storeReadiness);
  const localProof = record(storeReadiness.localPaidPresetProof);
  const latestProofRun = record(storeReadiness.latestProofRun);
  const hostedProof = record(record(paidReleaseTruthBoard.hostedPaidReadinessProof));
  const hostedImportPath = record(hostedProof.hostedProofImportPath);
  const hostedObservedFields = record(hostedImportPath.observedFields);
  const hostedAcceptance = record(hostedProof.paidProofAcceptance);
  const marketplace = record(hostedProof.marketplaceConversionInputs);
  const telemetry = record(record(paidReleaseTruthBoard.observedMarketplaceTelemetry).currentValues);
  const parserLedger = record(record(productSlo.parserRealSellableLift).findingAdmissionLedger);
  const deterministicProof = record(parserLedger.deterministic100NameProof);
  const tier1000Gate = record(parserLedger.tier1000Gate);
  const publicSupportAdmission = record(parserLedger.publicSupportCandidateAdmission);
  const projected300Effect = record(publicSupportAdmission.projected300RowTierEffect);
  const currentSellableAdmissionLift = record(parserLedger.currentSellableAdmissionLift);
  const darkSupportLift = record(productSlo.darkMetadataPublicSupportLift4000);
  const darkSellable250 = record(darkSupportLift.publicSupportSellable250);
  const darkSellable500 = record(darkSupportLift.publicSupportSellable500);
  const darkChargeable100 = record(darkSellable500.currentChargeable100);
  const graphQueue = record(record(productSlo.graphPublicCorroborationPivotPacket).paidRowUnlockQueue);
  const graphCounts = record(graphQueue.counts);

  const currentSellableRows = firstFiniteNumber(currentSellableAdmissionLift.currentSellableRowsAfterAdmission, localProof.sellableRows, deterministicProof.sellableRowsPreserved, parserLedger.baselineSellableRows);
  const trueFindingCount = firstFiniteNumber(currentSellableAdmissionLift.currentSellableFindingsAfterAdmission, localProof.sellableFindings, deterministicProof.sellableFindingsBaseline, parserLedger.baselineSellableFindingRows);
  const sellableSourceProvenanceRows = firstFiniteNumber(currentSellableAdmissionLift.currentSellableSourceProvenanceRowsAfterAdmission, localProof.sellableSourceProvenanceRows, deterministicProof.sellableSourceProvenanceRows, parserLedger.baselineSellableSourceProvenanceRows);
  const sourceProvenanceShare = Number.isFinite(numberValue(currentSellableAdmissionLift.sourceProvenanceShareAfterAdmission))
    ? numberValue(currentSellableAdmissionLift.sourceProvenanceShareAfterAdmission)
    : Number.isFinite(numberValue(parserLedger.sourceProvenanceShareOfSellable))
      ? numberValue(parserLedger.sourceProvenanceShareOfSellable)
    : roundRatio(sellableSourceProvenanceRows, currentSellableRows);
  const darkCurrentChargeableRows = firstFiniteNumber(darkChargeable100.currentChargeableCount, darkSellable500.currentChargeableRows, darkSellable250.currentChargeableRows);
  const darkProjectedRows = firstFiniteNumber(darkChargeable100.projectedAfterPublicSupportCount, darkSellable500.projectedAfterPublicSupportRows, darkSellable250.projectedAfterPublicSupportRows);
  const graphRowsCountTowardFloorNow = numberValue(graphCounts.rowsCountTowardFloorNow);
  const graphRowsReadyAfterParserAdmission = numberValue(graphCounts.rowsReadyAfterParserAdmission);
  const hostedStatus = String(hostedProof.status ?? latestProofRun.proofDecision ?? "unknown");
  const hostedSellableRows = firstFiniteNumber(record(hostedProof.latestHostedProof).sellableRows, latestProofRun.sellableRows);
  const hostedQuerySetCount = firstFiniteNumber(record(hostedProof.latestHostedProof).querySetCount, Array.isArray(latestProofRun.querySet) ? latestProofRun.querySet.length : Number.NaN);
  const hostedObservedSellableRows = numberValue(hostedObservedFields.sellableRows);
  const hostedObservedFindingRows = numberValue(hostedObservedFields.sellableFindingCount);
  const hostedObservedDatasetRows = numberValue(hostedObservedFields.datasetItemCount);
  const hostedObservedNoLeakFailures = numberValue(hostedObservedFields.noLeakFailures);
  const hostedObservedFalsePositiveFailures = numberValue(hostedObservedFields.falsePositiveInflationFailures);
  const hostedObservedProofPresent = Boolean(hostedObservedFields.runId && hostedObservedFields.datasetId);
  const hostedObservedImportSafe = hostedImportPath.schemaVersion === "ti.hosted_apify_proof_import_path.v1"
    && hostedImportPath.observedOnly === true
    && hostedImportPath.noSyntheticFallback === true
    && hostedImportPath.oldProofTreatment === "historical_shape_safety_only";
  const hostedObservedIntegrityFailed = hostedObservedProofPresent
    && (
      !hostedObservedImportSafe
      || hostedObservedNoLeakFailures !== 0
      || hostedObservedFields.secondBatchAuditObserved !== true
      || hostedObservedFalsePositiveFailures !== 0
    );
  const requiredHostedQueryCount = firstFiniteNumber(record(hostedProof.requiredHostedPreset).defaultQueryCount, hostedAcceptance.minimumDefaultQueryCount, 100);
  const requiredHosted100Rows = firstFiniteNumber(hostedAcceptance.minimumSellableRows, 100);
  const requiredHosted100Findings = firstFiniteNumber(hostedAcceptance.minimumSellableFindingRows, 52);
  const pricingState = String(marketplace.pricingModel ?? telemetry.pricingState ?? "external_unknown");
  const payoutState = String(marketplace.payoutEnabled ?? telemetry.payoutState ?? "external_unknown");
  const analyticsObserved = ["storeViews", "runs", "uniqueUsers", "paidUsers", "refunds"].every((field) => marketplace[field] !== null && marketplace[field] !== undefined);
  const observedProofImport = record(hostedImportPath.observedProofImport);
  const marketplaceEmptyHold = ["storeViews", "runs", "uniqueUsers", "paidUsers", "refunds"].every((field) => marketplace[field] === null)
    && marketplace.unknownMeansNoClaim === true;
  const marketplaceImportedSafely = observedProofImport.validationState === "accepted"
    && observedProofImport.sampleOnly === false
    && analyticsObserved
    && pricingState !== "external_unknown"
    && payoutState !== "external_unknown";

  const tier1000MinimumSellableRows = firstFiniteNumber(tier1000Gate.minimumSellableRows, 300);
  const tier1000MinimumRows = firstFiniteNumber(tier1000Gate.minimumRows, 1000);
  const hosted100State = hostedObservedIntegrityFailed
    ? "fail"
    : hostedObservedProofPresent
      && hostedObservedSellableRows >= requiredHosted100Rows
      && hostedObservedFindingRows >= requiredHosted100Findings
      && hostedObservedDatasetRows >= requiredHosted100Rows
        ? "pass"
        : "hold";
  const hosted300State = hostedObservedIntegrityFailed
    ? "fail"
    : hostedObservedProofPresent
      && hostedObservedSellableRows >= 300
      && hostedObservedFindingRows >= 120
      && hostedObservedDatasetRows >= 300
        ? "pass"
        : "hold";
  const marketplacePromotionState = !(marketplaceEmptyHold || marketplaceImportedSafely)
    ? "fail"
    : hosted100State === "pass" && hosted300State === "pass" && pricingState !== "external_unknown" && payoutState !== "external_unknown" && analyticsObserved
      ? "pass"
      : "hold";
  return {
    schemaVersion: "ti.paid_actor_release_ladder_audit.v1",
    status: "hold_paid_release",
    current100LocalFloor: {
      state: currentSellableRows >= 100 ? "pass" : "hold",
      currentSellableRows,
      trueFindingCount,
      sellableSourceProvenanceRows,
      sourceProvenanceShare,
      currentSellableAdmissionLift: {
        schemaVersion: currentSellableAdmissionLift.schemaVersion,
        acceptedCurrentRowsCount: numberValue(currentSellableAdmissionLift.acceptedCurrentRowsCount),
        sourceProvenanceRowsConvertedToFindings: numberValue(currentSellableAdmissionLift.sourceProvenanceRowsConvertedToFindings),
        countsTowardLocalCurrentPaidPreset: currentSellableAdmissionLift.countsTowardLocalCurrentPaidPreset,
        countsTowardHostedPaidProof: currentSellableAdmissionLift.countsTowardHostedPaidProof
      },
      sourceProvenanceRowsCountTowardFindingFloor: deterministicProof.sourceProvenanceRowsCountTowardFindingFloor === false ? false : parserLedger.sourceProvenanceRowsCountTowardFindingFloor,
      proofDecision: localProof.proofDecision
    },
    current250Gate: {
      state: currentSellableRows >= 250 ? "pass" : "hold",
      requiredSellableRows: 250,
      currentSellableRows,
      gap: Math.max(0, 250 - currentSellableRows),
      trueFindingCount,
      sellableSourceProvenanceRows,
      sourceProvenanceShare,
      maximumSourceProvenanceShare: 0.45,
      sourceProvenanceRowsCountTowardFindingFloor: false,
      projectedRowsCountTowardCurrent: false,
      parserAdmissionProjection: {
        acceptedCount: publicSupportAdmission.acceptedCount,
        projectedSellableRowsAfterAdmission: projected300Effect.projectedSellableRowsAfterAdmission,
        projectedSellableFindingsAfterAdmission: projected300Effect.projectedSellableFindingsAfterAdmission,
        sourceProvenanceShareAfterAdmission: projected300Effect.sourceProvenanceShareAfterAdmission,
        countsProjectedRowsAsPaid: projected300Effect.countsProjectedRowsAsPaid
      }
    },
    current300Gate: {
      state: currentSellableRows >= 300 ? "pass" : "hold",
      requiredSellableRows: 300,
      currentSellableRows,
      gap: Math.max(0, 300 - currentSellableRows),
      trueFindingCount,
      requiredTrueFindings: 120,
      trueFindingGap: Math.max(0, 120 - trueFindingCount),
      sellableSourceProvenanceRows,
      sourceProvenanceShare,
      maximumSourceProvenanceShare: 0.45,
      sourceProvenanceRowsCountTowardFindingFloor: false,
      projectedRowsCountTowardCurrent: false
    },
    hosted100Proof: {
      state: hostedStatus === "paid_floor_hosted_proof" && hostedSellableRows >= 100 && hostedQuerySetCount >= 100 ? "pass" : "hold",
      status: hostedStatus,
      hostedSellableRows,
      hostedQuerySetCount,
      countsTowardPaidPromotion: hostedProof.countsTowardPaidPromotion,
      latestHostedProofDecision: record(hostedProof.latestHostedProof).proofDecision ?? latestProofRun.proofDecision
    },
    hosted100Gate: {
      state: hosted100State,
      source: "hostedProofImportPath.observedFields",
      observedProofPresent: hostedObservedProofPresent,
      requiredDefaultQueryCount: requiredHostedQueryCount,
      requiredSellableRows: requiredHosted100Rows,
      requiredSellableFindingRows: requiredHosted100Findings,
      observedDatasetRows: hostedObservedDatasetRows,
      observedSellableRows: hostedObservedSellableRows,
      observedSellableFindingRows: hostedObservedFindingRows,
      noLeakFailures: hostedObservedFields.noLeakFailures,
      secondBatchAuditObserved: hostedObservedFields.secondBatchAuditObserved,
      falsePositiveInflationFailures: hostedObservedFields.falsePositiveInflationFailures,
      externalBlocker: hostedImportPath.externalBlocker,
      countsTowardPaidPromotion: hostedProof.countsTowardPaidPromotion
    },
    hosted300Gate: {
      state: hosted300State,
      source: "hostedProofImportPath.observedFields",
      observedProofPresent: hostedObservedProofPresent,
      requiredSellableRows: 300,
      requiredSellableFindingRows: 120,
      observedDatasetRows: hostedObservedDatasetRows,
      observedSellableRows: hostedObservedSellableRows,
      observedSellableFindingRows: hostedObservedFindingRows,
      noLeakFailures: hostedObservedFields.noLeakFailures,
      secondBatchAuditObserved: hostedObservedFields.secondBatchAuditObserved,
      falsePositiveInflationFailures: hostedObservedFields.falsePositiveInflationFailures,
      countsTowardPaidPromotion: hostedProof.countsTowardPaidPromotion
    },
    next300SellableTarget: {
      state: currentSellableRows >= 300 ? "pass" : "hold",
      requiredSellableRows: 300,
      currentSellableRows,
      gap: Math.max(0, 300 - currentSellableRows),
      trueFindingCount,
      sourceProvenanceShare,
      maximumSourceProvenanceShare: 0.45
    },
    tier1000Gate: {
      state: currentSellableRows >= tier1000MinimumSellableRows && firstFiniteNumber(deterministicProof.proofRows, parserLedger.baseline100NameRows) >= tier1000MinimumRows ? "pass" : "hold",
      minimumRows: tier1000MinimumRows,
      minimumSellableRows: tier1000MinimumSellableRows,
      minimumSellableFindingRate: tier1000Gate.minimumSellableFindingRate,
      maximumSourceProvenanceShareOfSellable: tier1000Gate.maximumSourceProvenanceShareOfSellable,
      countsProjectedRowsAsPaid: tier1000Gate.countsProjectedRowsAsPaid,
      proofRows: firstFiniteNumber(deterministicProof.proofRows, parserLedger.baseline100NameRows)
    },
    darkMetadataCurrentChargeable: {
      state: darkCurrentChargeableRows >= 100 ? "pass" : "hold",
      currentChargeableRows: darkCurrentChargeableRows,
      targetSellableRows: firstFiniteNumber(darkSellable500.targetSellableRows, darkSellable250.targetSellableRows, 100),
      remainingGapTo100Now: firstFiniteNumber(darkChargeable100.currentGapTo100, darkSellable250.remainingGapTo100Now),
      remainingGapTo250Now: firstFiniteNumber(darkChargeable100.currentGapTo250, 250 - darkCurrentChargeableRows),
      projectedAfterPublicSupportRows: darkProjectedRows,
      projectedRowsCountTowardFloorNow: darkChargeable100.countsProjectedRowsAsCurrent === false ? false : false
    },
    graphParserHandoff: {
      state: graphRowsCountTowardFloorNow === 0 ? "hold" : "fail",
      readyForParser: graphCounts.ready_for_parser,
      rowsReadyAfterParserAdmission: graphRowsReadyAfterParserAdmission,
      rowsCountTowardFloorNow: graphRowsCountTowardFloorNow,
      graphOnlyCountsTowardPaidFloorNow: graphQueue.graphOnlyCountsTowardPaidFloorNow
    },
    observedHostedProofImport: {
      state: hostedObservedIntegrityFailed ? "fail" : hostedObservedProofPresent ? hosted100State : "hold",
      importPathSafe: hostedObservedImportSafe,
      observedProofPresent: hostedObservedProofPresent,
      observedSellableRows: hostedObservedSellableRows,
      observedFindingRows: hostedObservedFindingRows,
      observedDatasetRows: hostedObservedDatasetRows,
      observedNoLeakFailures: hostedObservedNoLeakFailures,
      observedFalsePositiveFailures: hostedObservedFalsePositiveFailures,
      secondBatchAuditObserved: hostedObservedFields.secondBatchAuditObserved === true,
      oldProofTreatment: hostedImportPath.oldProofTreatment,
      observedOnly: hostedImportPath.observedOnly,
      noSyntheticFallback: hostedImportPath.noSyntheticFallback
    },
    publicProofParserReadyRows: {
      state: graphRowsCountTowardFloorNow === 0 && publicSupportAdmission.acceptedCount !== undefined ? "hold" : "fail",
      parserReadyRows: graphCounts.ready_for_parser,
      publicSupportAdmissionAcceptedRows: publicSupportAdmission.acceptedCount,
      countsTowardCurrentSellableRowsNow: false,
      countsAfterParserAdmission: true,
      projected300RowTierEffect: {
        projectedSellableRowsAfterAdmission: projected300Effect.projectedSellableRowsAfterAdmission,
        projectedSellableFindingsAfterAdmission: projected300Effect.projectedSellableFindingsAfterAdmission,
        sourceProvenanceShareAfterAdmission: projected300Effect.sourceProvenanceShareAfterAdmission,
        countsProjectedRowsAsPaid: projected300Effect.countsProjectedRowsAsPaid
      }
    },
    observedMarketplaceState: {
      state: pricingState !== "external_unknown" && payoutState !== "external_unknown" && analyticsObserved ? "pass" : "hold",
      pricingState,
      payoutState,
      analyticsObserved,
      storeViews: marketplace.storeViews ?? telemetry.storeViews,
      runs: marketplace.runs ?? telemetry.actorRuns,
      uniqueUsers: marketplace.uniqueUsers ?? telemetry.uniqueUsers,
      paidUsers: marketplace.paidUsers ?? telemetry.paidRuns,
      refunds: marketplace.refunds ?? telemetry.refunds
    },
    marketplacePromotionGate: {
      state: marketplacePromotionState,
      pricingState,
      payoutState,
      analyticsObserved,
      observedOnly: marketplaceEmptyHold || marketplaceImportedSafely,
      observedProofImportState: observedProofImport.validationState ?? "missing",
      hosted100GateRequired: true,
      hosted300GateRequired: true,
      publicListingStatus: marketplace.publicListingStatus,
      storeViews: marketplace.storeViews,
      runs: marketplace.runs,
      uniqueUsers: marketplace.uniqueUsers,
      paidUsers: marketplace.paidUsers,
      refunds: marketplace.refunds
    },
    nextBuyerVisibleBlockers: [
      `Agent 03: current local sellable rows are ${currentSellableRows}; close ${Math.max(0, 250 - currentSellableRows)} rows to the 250 gate and ${Math.max(0, 300 - currentSellableRows)} rows to the 300 gate while keeping source-provenance-only rows out of the finding floor.`,
      `Agent 05: dark metadata has ${darkCurrentChargeableRows} current chargeable rows, ${Math.max(0, 250 - darkCurrentChargeableRows)} rows still needed for a 250-current dark lane, and ${darkProjectedRows} projected rows that must remain excluded until public support is current.`,
      `Agent 08: public/graph proof has ${graphCounts.ready_for_parser} parser-ready rows and ${graphRowsCountTowardFloorNow} current paid-floor credit; grow parser-ready proof toward 100 but keep graph-only rows out until parser admission.`,
      `Agent 09: imported hosted Apify proof is ${hostedObservedProofPresent ? "present" : "missing"}; run or verify the hosted 100-name proof, then import observed Store analytics, payout, pricing, refunds, and listing state before paid promotion.`
    ]
  };
}

function checkObservedHostedProofImport(releaseLadder: Record<string, unknown>): AuditCheck {
  const observed = record(releaseLadder.observedHostedProofImport);
  const safeImport = observed.importPathSafe === true
    && observed.observedOnly === true
    && observed.noSyntheticFallback === true
    && observed.oldProofTreatment === "historical_shape_safety_only";
  const proofPresent = observed.observedProofPresent === true;
  const cleanObservedProof = proofPresent
    && numberValue(observed.observedSellableRows) >= 100
    && numberValue(observed.observedFindingRows) >= 52
    && numberValue(observed.observedDatasetRows) >= 100
    && numberValue(observed.observedNoLeakFailures) === 0
    && numberValue(observed.observedFalsePositiveFailures) === 0
    && observed.secondBatchAuditObserved === true;
  return {
    name: "observed_hosted_proof_import",
    status: !safeImport ? "fail" : cleanObservedProof ? "pass" : "hold",
    message: !safeImport
      ? "hosted proof import path is not observed-only or still treats old shape proof as promotion evidence"
      : cleanObservedProof
        ? "observed hosted proof import passes the 100-name floor and integrity checks"
        : "hosted proof import path is safe but no clean observed hosted 100-name proof has been imported yet",
    remediation: !safeImport ? [
      "Keep hostedProofImportPath observedOnly=true, noSyntheticFallback=true, and oldProofTreatment=historical_shape_safety_only.",
      "Do not infer hosted proof from local or historical shape-safety runs."
    ] : cleanObservedProof ? [] : [
      "Run the hosted 100-name Actor proof with Apify credentials and import run id, dataset id, row counts, no-leak failures, false-positive audit state, and usage cost.",
      "Keep paid traffic held until that observed hosted proof and marketplace telemetry pass."
    ],
    details: observed
  };
}

function checkReleaseLadder(releaseLadder: Record<string, unknown>): AuditCheck {
  const local = record(releaseLadder.current100LocalFloor);
  const current250 = record(releaseLadder.current250Gate);
  const current300 = record(releaseLadder.current300Gate);
  const hosted100 = record(releaseLadder.hosted100Gate);
  const hosted300 = record(releaseLadder.hosted300Gate);
  const tier1000 = record(releaseLadder.tier1000Gate);
  const marketplacePromotion = record(releaseLadder.marketplacePromotionGate);
  const localPassed = local.state === "pass";
  const current250Passed = current250.state === "pass";
  const current300Passed = current300.state === "pass";
  const hosted100Passed = hosted100.state === "pass";
  const hosted300Passed = hosted300.state === "pass";
  const tier1000Passed = tier1000.state === "pass";
  const marketplacePromotionPassed = marketplacePromotion.state === "pass";
  const failedGates = [
    local,
    current250,
    current300,
    hosted100,
    hosted300,
    tier1000,
    marketplacePromotion
  ].filter((gate) => gate.state === "fail");
  return {
    name: "monetization_release_ladder",
    status: failedGates.length > 0 ? "fail" : localPassed && current250Passed && current300Passed && hosted100Passed && hosted300Passed && tier1000Passed && marketplacePromotionPassed ? "pass" : localPassed ? "hold" : "fail",
    message: localPassed && failedGates.length === 0
      ? "local 100-row floor is passed; current 250/300 local gates, hosted 100/300 proof, 1,000-row gate, and marketplace promotion remain explicit ladder steps"
      : "local 100-row paid floor is not passed, so higher release gates cannot be evaluated",
    remediation: localPassed ? [
      ...((Array.isArray(releaseLadder.nextBuyerVisibleBlockers) ? releaseLadder.nextBuyerVisibleBlockers : []) as string[]),
      "Keep paid traffic held until every explicit gate is pass; holds are acceptable for missing observed hosted proof, but fail any synthetic or inflated count."
    ] : [
      "Restore the local 100-name paid preset proof with at least 100 current sellable rows before evaluating hosted or 300-row gates."
    ],
    details: releaseLadder
  };
}

function checkPaidCountIntegrity(
  productSlo: Record<string, unknown>,
  paidReleaseTruthBoard: Record<string, unknown>,
  releaseLadder: Record<string, unknown>
): AuditCheck {
  const parserLedger = record(record(productSlo.parserRealSellableLift).findingAdmissionLedger);
  const deterministicProof = record(parserLedger.deterministic100NameProof);
  const tier1000Gate = record(parserLedger.tier1000Gate);
  const currentSellableAdmissionLift = record(parserLedger.currentSellableAdmissionLift);
  const graphQueue = record(record(productSlo.graphPublicCorroborationPivotPacket).paidRowUnlockQueue);
  const graphCounts = record(graphQueue.counts);
  const darkSupportLift = record(productSlo.darkMetadataPublicSupportLift4000);
  const darkSellable250 = record(darkSupportLift.publicSupportSellable250);
  const darkSellable500 = record(darkSupportLift.publicSupportSellable500);
  const darkSampleRows = [
    ...(Array.isArray(darkSellable250.sampleRows) ? darkSellable250.sampleRows.filter(isRecord) : []),
    ...(Array.isArray(darkSellable500.sampleRows) ? darkSellable500.sampleRows.filter(isRecord) : [])
  ];
  const hostedProof = record(paidReleaseTruthBoard.hostedPaidReadinessProof);
  const paidRowIntegrityGate = record(hostedProof.paidRowIntegrityGate);
  const requiredZeroCounts = record(paidRowIntegrityGate.requiredZeroCounts);
  const marketplace = record(hostedProof.marketplaceConversionInputs);
  const rejectionReasonCounts = Array.isArray(parserLedger.rejectionReasonCounts) ? parserLedger.rejectionReasonCounts.filter(isRecord) : [];
  const publicSupportAdmission = record(parserLedger.publicSupportCandidateAdmission);
  const publicSupportAcceptedRows = Array.isArray(publicSupportAdmission.acceptedRows) ? publicSupportAdmission.acceptedRows.filter(isRecord) : [];
  const projected300Effect = record(publicSupportAdmission.projected300RowTierEffect);
  const currentAcceptedRows = Array.isArray(currentSellableAdmissionLift.acceptedRows) ? currentSellableAdmissionLift.acceptedRows.filter(isRecord) : [];
  const currentConvertedRows = Array.isArray(currentSellableAdmissionLift.convertedSourceProvenanceRows) ? currentSellableAdmissionLift.convertedSourceProvenanceRows.filter(isRecord) : [];
  const currentRejectedRows = Array.isArray(currentSellableAdmissionLift.rejectedRows) ? currentSellableAdmissionLift.rejectedRows.filter(isRecord) : [];
  const hasCurrentSellableAdmissionLift = currentSellableAdmissionLift.schemaVersion === "ti.program_da_current_sellable_admission_lift.v1";

  const failures: string[] = [];
  if (deterministicProof.sourceProvenanceRowsCountTowardFindingFloor !== false) failures.push("source_provenance_rows_count_toward_finding_floor");
  if (tier1000Gate.countsProjectedRowsAsPaid !== false) failures.push("tier1000_counts_projected_rows_as_paid");
  if (hasCurrentSellableAdmissionLift) {
    if (numberValue(currentSellableAdmissionLift.currentSellableRowsAfterAdmission) < 250) failures.push("current_sellable_lift_below_250");
    if (numberValue(currentSellableAdmissionLift.currentSellableFindingsAfterAdmission) < 95) failures.push("current_sellable_findings_below_95");
    if (numberValue(currentSellableAdmissionLift.sourceProvenanceShareAfterAdmission) > 0.45) failures.push("current_sellable_source_provenance_share_above_45");
    if (currentSellableAdmissionLift.countsTowardLocalCurrentPaidPreset !== true) failures.push("current_sellable_lift_not_local_countable");
    if (currentSellableAdmissionLift.countsTowardHostedPaidProof !== false) failures.push("current_sellable_lift_counts_as_hosted_proof");
    if (currentAcceptedRows.length < 63) failures.push("current_sellable_lift_too_few_accepted_rows");
    if (currentConvertedRows.length < 23) failures.push("current_sellable_lift_too_few_source_rows_converted");
  }
  if (projected300Effect.countsProjectedRowsAsPaid !== false) failures.push("public_support_admission_counts_projected_rows_as_paid");
  for (const row of publicSupportAcceptedRows) {
    if (row.countsTowardSellableRowsNow !== false) failures.push("public_support_admission_row_counts_now");
    if (row.countsAfterParserAdmission !== true) failures.push("public_support_admission_row_not_parser_gated");
  }
  for (const row of currentAcceptedRows) {
    if (row.countsTowardCurrentSellableRows !== true) failures.push("current_accepted_row_not_current_countable");
    if (row.countsTowardHostedPaidProof !== false) failures.push("current_accepted_row_counts_as_hosted_proof");
    if (row.noLeak !== true) failures.push("current_accepted_row_missing_no_leak");
  }
  for (const row of currentConvertedRows) {
    if (row.countsTowardSellableFindingFloor !== true) failures.push("converted_source_row_not_finding_countable");
    if (row.noLeak !== true) failures.push("converted_source_row_missing_no_leak");
  }
  for (const row of currentRejectedRows) {
    if (row.countsTowardCurrentSellableRows !== false) failures.push(`current_rejected_${row.reason}_counts_now`);
  }
  for (const row of rejectionReasonCounts) {
    if (["source_provenance_only", "graph_only", "restricted_without_public_support"].includes(String(row.reason)) && row.countsTowardSellableFindingFloor !== false) {
      failures.push(`${row.reason}_counts_toward_sellable_finding_floor`);
    }
  }
  if (numberValue(graphCounts.rowsCountTowardFloorNow) !== 0) failures.push("graph_rows_count_toward_floor_now");
  if (graphQueue.graphOnlyCountsTowardPaidFloorNow !== false) failures.push("graph_only_counts_toward_paid_floor_now");
  for (const row of darkSampleRows) {
    if (row.rowDecision === "projected_after_public_support" && row.countsTowardSellableFloorNow !== false) failures.push("projected_dark_row_counts_now");
    if (row.rowDecision === "blocked_not_chargeable" && row.countsTowardSellableFloorNow !== false) failures.push("blocked_dark_row_counts_now");
  }
  if (paidRowIntegrityGate.sourceProvenanceRowsCountTowardFindingFloor !== false) failures.push("hosted_integrity_source_provenance_counts_as_finding");
  if (paidRowIntegrityGate.caveatedRowsCountTowardChargeable !== false) failures.push("hosted_integrity_caveated_rows_count_as_chargeable");
  for (const [field, value] of Object.entries(requiredZeroCounts)) {
    if (value !== 0) failures.push(`hosted_integrity_${field}_not_zero`);
  }
  const observedOnlyFields = ["storeViews", "runs", "uniqueUsers", "paidUsers", "refunds"];
  for (const field of observedOnlyFields) {
    if (marketplace[field] !== null) failures.push(`marketplace_${field}_not_observed_only_null`);
  }
  if (marketplace.unknownMeansNoClaim !== true) failures.push("marketplace_unknown_does_not_mean_no_claim");

  return {
    name: "paid_count_integrity",
    status: failures.length === 0 ? "pass" : "fail",
    message: failures.length === 0
      ? "paid counts exclude synthetic, source-provenance-only, graph-only, projected dark metadata, caveated, stale, restricted, and unobserved traction fields"
      : "one or more non-current or non-observed buckets is being allowed into paid counts",
    remediation: failures.length === 0 ? [] : [
      "Remove any synthetic, projected, graph-only, source-provenance-only, caveated, stale, or restricted-only rows from paid floor counts.",
      "Keep dark metadata projected_after_public_support rows and blocked_not_chargeable rows out of current sellable rows.",
      "Keep marketplace traction/revenue fields null or external_unknown until copied from observed Apify analytics."
    ],
    details: {
      failures,
      current100LocalFloor: releaseLadder.current100LocalFloor,
      graphParserHandoff: releaseLadder.graphParserHandoff,
      darkMetadataCurrentChargeable: releaseLadder.darkMetadataCurrentChargeable,
      requiredZeroCounts
    }
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
  const staleSellableRows = numberValue(secondBatch.staleLatestActivitySellableRows);
  const staleProofCount = Number.isFinite(admittedInflation) ? admittedInflation : staleSellableRows;
  const ok = staleGate?.state === "pass" && staleGate.observed === 0 && staleProofCount === 0;
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
    details: {
      runbookGate: staleGate,
      staleLatestActivitySellableFindingInflation: secondBatch.staleLatestActivitySellableFindingInflation,
      staleLatestActivitySellableRows: secondBatch.staleLatestActivitySellableRows
    }
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

function firstFiniteNumber(...values: unknown[]): number {
  for (const value of values) {
    const number = numberValue(value);
    if (Number.isFinite(number)) return number;
  }
  return Number.NaN;
}

function roundRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return Number.NaN;
  return Math.round((numerator / denominator) * 1_000) / 1_000;
}
