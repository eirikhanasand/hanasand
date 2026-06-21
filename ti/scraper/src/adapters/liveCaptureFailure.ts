import type { CollectedItem } from "../types.ts";
import { freshnessState } from "./liveCaptureFreshness.ts";
import type { LiveCaptureFailureClass, LiveCaptureRuntimeCaptureInput } from "./liveCaptureTypes.ts";
import { num } from "./liveCaptureUtils.ts";

export function classifyLiveCaptureFailure(input: LiveCaptureRuntimeCaptureInput, item: CollectedItem | undefined, generatedAt: string): LiveCaptureFailureClass {
  const meta = input.result.metadata ?? {}, failure = String(meta.failureCategory ?? ""), warnings = input.result.warnings.join(" ").toLowerCase();
  if (["not_modified", "rate_limited"].includes(failure)) return failure as LiveCaptureFailureClass;
  if (["unsupported_mime", "unsupported_media"].includes(failure)) return "unsupported_mime";
  if (["too_large", "content_too_large"].includes(failure)) return "content_too_large";
  if (["robots_blocked", "policy_blocked", "policy_hold"].includes(failure)) return "robots_or_legal_hold";
  if (failure === "http_error" || (num(meta.responseStatus) ?? 0) >= 400) return "http_error";
  if (warnings.match(/malformed|xml parse|json parse/)) return input.adapter === "rss_feed" ? "malformed_feed" : "parse_error";
  if (Array.isArray(meta.suppressedRecords) && meta.suppressedRecords.length) return "unsafe_url";
  if ((input.redirectCount ?? 0) > 5) return "excessive_redirects";
  if (!item) return "empty_capture";
  return freshnessState(item, input.freshnessTargetSeconds, generatedAt).state === "stale" ? "stale_source" : "none";
}
