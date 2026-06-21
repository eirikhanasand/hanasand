import { uniq } from "./dynamicBrowserUtils.ts";

export function readiness(decision: string, gates: any[], fixtures: any[]) {
  const holds = gates.filter((g) => g.status === "hold").map((g) => g.name);
  const watches = gates.filter((g) => g.status === "watch").map((g) => g.name);
  return {
    state: decision === "canary_ready" ? "ready_for_fixture_canary" : decision,
    liveBrowserEnablement: "disabled_requires_separate_operator_allocation",
    staticRssPdfFallbackRequired: true,
    requiredBeforeLiveCanary: uniq(["explicit_operator_approval", "separate_worker_pool_allocation", "public_host_allowlist_hash_review", "robots_and_legal_notes_current", "screenshot_hash_only_storage_verified", "ephemeral_storage_verified", "no_cookie_jar_no_local_storage_verified", "static_rss_pdf_fallback_documented", ...holds.map((g) => `clear_hold_gate:${g}`), ...watches.map((g) => `review_watch_gate:${g}`)]),
    rollbackTriggers: uniq([...fixtures.flatMap((f) => f.provenance.extractionWarnings.map((w: string) => `fixture_warning:${w}`)), ...holds.map((g) => `hold_gate:${g}`), "browser_workers_enabled_without_release_board", "raw_url_or_html_serialized", "cookie_or_storage_persistence_detected", "screenshot_bytes_persisted", "download_or_private_network_attempt"]),
    proofCommands: ["bun test src/tests/dynamicBrowserCutover.test.ts", "bun run check"]
  };
}
