export const ISOLATION = [
  "private_network_target", "credential_prompt", "captcha_challenge",
  "download_attempt", "onion_redirect", "third_party_request_leak"
];

export const STABLE = [
  "schemaVersion", "generatedAt", "decision", "browserWorkersEnabled", "canaryOnly",
  "requiresExplicitApproval", "workerPool", "networkIsolation", "evidenceBoundary",
  "isolationCanary", "resourceBudget", "storageIsolation", "killSwitch", "fixtures",
  "gates", "summary", "agentHandoffs", "promotionReadiness", "routeContract", "safety"
];

export const FORBIDDEN = [
  "url", "requestedUrl", "finalUrl", "rawUrl", "unsafeUrl", "rawText", "html",
  "rawHtml", "body", "payload", "credential", "password", "cookie", "cookieJar",
  "localStorage", "sessionStorage", "token", "privateInvite", "onionUrl",
  "downloadUrl", "screenshotBytes", "objectRef"
];
