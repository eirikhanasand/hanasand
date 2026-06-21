import type { LiveCaptureCanaryFixtureClass, LiveCaptureFailureClass, LiveCaptureFixtureClass } from "./liveCaptureTypes.ts";

export const FIXTURES: LiveCaptureFixtureClass[] = ["github_security_advisory", "cisa_kev", "vendor_advisory_json", "cert_html", "vendor_blog_html", "rss_atom", "report_index"];
export const CANARY_FIXTURES: LiveCaptureCanaryFixtureClass[] = [...FIXTURES, "pdf_text_layer_report", "unsupported_mime", "hostile_unsafe_link_suppression"];
export const FAILURES: LiveCaptureFailureClass[] = ["none", "http_error", "parse_error", "malformed_feed", "unsupported_mime", "excessive_redirects", "unsafe_url", "duplicate_content", "stale_source", "empty_capture", "robots_or_legal_hold", "content_too_large", "rate_limited", "not_modified"];
export const forbiddenFields = () => ["url", "canonicalUrl", "requestedUrl", "finalUrl", "rawText", "html", "body", "payload", "credential", "password", "cookie", "token", "privateInvite", "onionUrl", "downloadUrl", "objectRef", "objectKey"];
export const safetyDefaults = () => ({ publicOnly: true, disabledByDefaultForUnapprovedNetworkPaths: true, noPrivateGithubRepos: true, noAuthBypass: true, noCaptchaSolving: true, noPayloadDownloads: true, noLeakedDatasets: true, noUnsafeOnionContent: true, noCredentialCollection: true, unsafeUrlExposed: false });
export const routeContract = (stableFields: string[]) => ({ safeForPublicApi: true, stableFields, forbiddenFields: forbiddenFields() });
