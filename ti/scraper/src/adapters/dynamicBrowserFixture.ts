import { hashContent } from "../utils.ts";
import { checksFor, firstFailure, statusFor, warningsFor } from "./dynamicBrowserChecks.ts";
import { hash, round } from "./dynamicBrowserUtils.ts";

export function fixtureResult(input: any, fixture: any) {
  const requestedUrlHash = `urlhash:${hash(fixture.requestedUrl)}`;
  const objectRefHash = fixture.objectRef ? `objectref:${hash(fixture.objectRef)}` : undefined;
  const checks = checksFor(input, fixture);
  const status = statusFor(input, checks);
  const failureCode = input.policy.killSwitchActive ? "kill_switch_active" : !input.approval.explicitlyApproved ? "approval_missing" : fixture.mode === "success" && status === "pass" ? undefined : fixture.mode === "success" ? firstFailure(checks) : fixture.mode;
  return {
    schemaVersion: "ti.dynamic_browser_fixture.v1", generatedAt: input.generatedAt,
    fixtureId: fixture.fixtureId, sourceId: fixture.sourceId, mode: fixture.mode, status,
    requestedUrlHash, finalUrlHash: fixture.finalUrl ? `urlhash:${hash(fixture.finalUrl)}` : undefined,
    objectRefHash, screenshotHash: fixture.screenshotHash, failureCode,
    provenance: { taskId: `dynamic_canary_${fixture.fixtureId}`, requestedUrlHash, finalUrlHash: fixture.finalUrl ? `urlhash:${hash(fixture.finalUrl)}` : undefined, canonicalUrlHash: `urlhash:${hash(fixture.finalUrl ?? fixture.requestedUrl)}`, contentHash: hashContent(`${fixture.sourceId}:${fixture.fixtureId}:${fixture.bytesRead}:${fixture.textLength}:${fixture.parserConfidence}`), screenshotHash: fixture.screenshotHash, objectRefHash, fetchedAt: input.generatedAt, robotsAllowed: input.policy.robotsAllowed, legalNotesPresent: input.policy.legalNotesPresent, parserConfidence: round(fixture.parserConfidence), extractionWarnings: warningsFor(checks), collectedItemCompatible: true },
    render: { durationMs: fixture.renderDurationMs, timeoutMs: input.pool.timeoutMs, redirectCount: fixture.redirectCount, contentType: fixture.contentType, bytesRead: fixture.bytesRead, textLength: fixture.textLength, parserConfidence: round(fixture.parserConfidence) },
    checks, handoffs: handoffsFor(input, fixture.mode, status, checks)
  };
}

function handoffsFor(input: any, mode: string, status: string, checks: any) {
  return {
    agent01SourceActivation: status === "pass" ? "allow_canary_after_approval" : "hold_activation",
    agent02SchedulerBudget: checks.queuePressure || checks.timeout || input.policy.killSwitchActive ? "pause_pool" : checks.redirectChain || checks.truncated ? "reduce_cadence" : "canary_cadence",
    agent04PublicSourceExpansion: status === "pass" ? "eligible_dynamic_gap" : status === "watch" ? "watch_dynamic_gap" : "exclude_until_repaired",
    agent06EvidenceChain: status === "pass" || status === "watch" ? "record_hash_only_capture" : "hold_evidence_replay",
    agent07QualityGate: status === "pass" ? "pass" : status === "watch" ? "review" : "hold",
    agent09ApiWarningField: warningCode(input, mode, checks),
    agent10ResourceGate: status === "pass" ? "none" : status === "watch" ? "watch" : "hold"
  };
}

function warningCode(input: any, mode: string, checks: any) {
  if (input.policy.killSwitchActive) return "dynamic_browser.kill_switch_active";
  if (!input.approval.explicitlyApproved) return "dynamic_browser.approval_missing";
  const failure = mode === "success" ? firstFailure(checks) : mode;
  return failure ? `dynamic_browser.${failure}` : "none";
}
