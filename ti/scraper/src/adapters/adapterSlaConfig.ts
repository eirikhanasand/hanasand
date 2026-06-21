export const THRESHOLDS = {
  minParserConfidence: 0.62,
  maxExtractionWarnings: 2,
  maxFailureRatio: 0.25,
  maxDuplicateCanonicalCount: 0,
  maxStaleCount: 0,
  maxRateLimitedCount: 1,
  minLanguageConfidence: 0.7
};

export const CONFIGS = [
  ["static_html", "static_html", "static_html", true, false],
  ["rss_feed", "rss_feed", "rss_entry", true, false],
  ["dynamic_public_browser", "dynamic_page", "dynamic_page", false, true],
  ["pdf_report", "pdf_report", "pdf_report", false, true],
  ["public_channel_handoff", "public_channel", "public_channel_handoff", false, true],
  ["advisory_signal", "advisory_signal", "static_html", true, false],
  ["multilingual_handoff", "multilingual_handoff", "translation_handoff", false, true]
];

export const FORBIDDEN = ["url", "canonicalUrl", "rawText", "translatedText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "screenshotBytes", "downloadUrl"];
export const safety = () => ({ publicOnly: true, noAuthBypass: true, noCaptchaSolving: true, noPrivateCommunities: true, noExploitPayloadDownload: true, noRestrictedRawMaterial: true, unsafeUrlExposed: false, dryRunOnly: true });
