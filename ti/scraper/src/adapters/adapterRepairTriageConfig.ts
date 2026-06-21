export const ADAPTERS = ["static_html", "rss_feed", "dynamic_public_browser", "pdf_report", "public_channel_handoff", "advisory_signal", "multilingual_handoff"];
export const MODE_ORDER = ["success", "parser_drift", "stale_dates", "language_mismatch", "unsupported_mime", "timeout", "rate_limit", "duplicate_canonical", "truncated_capture", "empty_extraction"];

export const routeContract = {
  safeForPublicApi: true,
  stableFields: ["schemaVersion", "generatedAt", "decision", "readyForCertification", "browserWorkersEnabled", "recommendations", "adapterSummaries", "summary", "sandboxFixtureReplay", "routeContract", "safety"],
  forbiddenFields: ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl", "objectRef"],
  compactApiProof: { noRawUrls: true, noRawText: true, noHtml: true, noScreenshots: true, noCredentials: true, noPrivateInvites: true, noOnionLinks: true, noRestrictedMaterial: true, dryRunOnly: true }
};

export const safety = { publicOnly: true, dryRunOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false };
