import { hashContent } from "../utils.ts";
import type { BrowserWorkerIsolationPlan } from "./browserWorkerIsolationPlan.ts";
import type { BrowserWorkerCaptureContract, BrowserWorkerCaptureInput, BrowserWorkerIsolationConfig } from "./browserWorkerIsolationTypes.ts";
export type { BrowserWorkerIsolationPlan } from "./browserWorkerIsolationPlan.ts";
export type { BrowserWorkerCaptureContract, BrowserWorkerCaptureInput, BrowserWorkerIsolationConfig } from "./browserWorkerIsolationTypes.ts";

export function browserWorkerIsolationPlan(config: BrowserWorkerIsolationConfig): BrowserWorkerIsolationPlan {
  return {
    enabled: false,
    workerPool: "dynamic_public_browser",
    networkIsolation: {
      publicOnly: true,
      hostAllowlist: config.allowedHosts,
      blockPrivateNetworks: true,
      blockCredentials: true,
      blockCaptchaSolving: true,
      blockDownloads: true
    },
    resourceCaps: {
      maxWorkers: Math.max(0, config.maxWorkers),
      memoryCapMb: Math.max(0, config.memoryCapMb),
      timeoutMs: Math.max(1000, config.timeoutMs)
    },
    policy: {
      robotsAllowed: config.robotsAllowed,
      legalNotesPresent: Boolean(config.legalNotes?.trim())
    }
  };
}

export function browserWorkerCaptureContract(
  plan: BrowserWorkerIsolationPlan,
  input: BrowserWorkerCaptureInput
): BrowserWorkerCaptureContract {
  if (!plan.policy.robotsAllowed) return blocked("robots_policy_hold", "robots policy holds dynamic capture");
  if (!plan.policy.legalNotesPresent) return blocked("policy_hold", "missing legal notes for dynamic capture");
  if (input.durationMs !== undefined && input.durationMs > plan.resourceCaps.timeoutMs) return blocked("timeout", "render duration exceeded timeout cap");
  if (input.contentType && !["text/html", "application/xhtml+xml", "text/plain"].includes(input.contentType.split(";")[0]?.trim().toLowerCase() ?? "")) {
    return blocked("unsupported_media", "dynamic browser workers accept public page media only");
  }
  return {
    status: "ready",
    finalUrl: input.finalUrl ?? input.url,
    textHash: input.text ? hashContent(input.text) : undefined,
    htmlHash: input.html ? hashContent(input.html) : undefined,
    screenshotHash: input.screenshotBytes ? hashContent(new TextDecoder().decode(input.screenshotBytes)) : undefined,
    extractionStatus: "ready_for_extraction",
    notes: ["capture contract contains hashes and extracted text metadata, not screenshot bytes"]
  };
}

function blocked(failureCategory: NonNullable<BrowserWorkerCaptureContract["failureCategory"]>, note: string): BrowserWorkerCaptureContract {
  return {
    status: "blocked",
    failureCategory,
    extractionStatus: "blocked",
    notes: [note]
  };
}
