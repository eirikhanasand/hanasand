import { ISOLATION } from "./dynamicBrowserConstants.ts";
import { hasIsolation, keyFor, unsupportedMime } from "./dynamicBrowserUtils.ts";

export function checksFor(input: any, fixture: any) {
  const iso = fixture.isolation ?? {};
  return {
    timeout: fixture.mode === "js_render_timeout" || fixture.renderDurationMs > input.pool.timeoutMs,
    redirectChain: fixture.mode === "redirect_chain" || fixture.redirectCount > 5,
    unsupportedMime: fixture.mode === "unsupported_mime" || unsupportedMime(fixture.contentType),
    robotsLegalHold: fixture.mode === "robots_legal_hold" || !input.policy.robotsAllowed || !input.policy.legalNotesPresent,
    truncated: fixture.mode === "capture_truncation" || fixture.bytesRead >= input.pool.maxBytes,
    blankPage: fixture.mode === "blank_page" || fixture.bytesRead === 0,
    emptyExtraction: fixture.mode === "parser_empty_extraction" || fixture.textLength === 0 || fixture.parserConfidence < 0.45,
    screenshotHashMismatch: fixture.mode === "screenshot_hash_mismatch" || Boolean(fixture.expectedScreenshotHash && fixture.screenshotHash && fixture.expectedScreenshotHash !== fixture.screenshotHash),
    queuePressure: fixture.mode === "queue_pressure" || input.pool.currentQueueDepth > input.pool.queueMaxDepth,
    privateNetworkTarget: fixture.mode === "private_network_target" || Boolean(iso.privateNetworkTarget),
    credentialPrompt: fixture.mode === "credential_prompt" || Boolean(iso.credentialPromptDetected),
    captchaChallenge: fixture.mode === "captcha_challenge" || Boolean(iso.captchaDetected),
    downloadAttempt: fixture.mode === "download_attempt" || Boolean(iso.downloadAttempted),
    onionRedirect: fixture.mode === "onion_redirect" || Boolean(iso.onionRedirect),
    thirdPartyRequestLeak: fixture.mode === "third_party_request_leak" || (iso.thirdPartyRequestCount ?? 0) > (iso.blockedThirdPartyRequestCount ?? 0)
  };
}

export function firstFailure(checks: any) {
  return ["js_render_timeout", "unsupported_mime", "robots_legal_hold", "blank_page", "parser_empty_extraction", "screenshot_hash_mismatch", "queue_pressure", ...ISOLATION, "redirect_chain", "capture_truncation"].find((mode) => checks[keyFor(mode)]);
}

export const warningsFor = (checks: any) => ["js_render_timeout", "redirect_chain", "unsupported_mime", "robots_legal_hold", "capture_truncation", "blank_page", "parser_empty_extraction", "screenshot_hash_mismatch", "queue_pressure", ...ISOLATION].filter((mode) => checks[keyFor(mode)]);

export function statusFor(input: any, checks: any) {
  return input.policy.killSwitchActive || !input.approval.explicitlyApproved || checks.timeout || checks.unsupportedMime || checks.robotsLegalHold || checks.blankPage || checks.emptyExtraction || checks.screenshotHashMismatch || checks.queuePressure || hasIsolation(checks) ? "hold" : checks.redirectChain || checks.truncated ? "watch" : "pass";
}
