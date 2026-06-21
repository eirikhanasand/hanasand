export type DynamicBrowserFailureMode =
  | "success" | "js_render_timeout" | "redirect_chain" | "unsupported_mime"
  | "robots_legal_hold" | "capture_truncation" | "blank_page"
  | "parser_empty_extraction" | "screenshot_hash_mismatch" | "queue_pressure"
  | "private_network_target" | "credential_prompt" | "captcha_challenge"
  | "download_attempt" | "onion_redirect" | "third_party_request_leak";
export type DynamicBrowserCutoverDecision = "canary_ready" | "watch" | "hold" | "kill_switch";
export type DynamicBrowserCutoverInput = any;
export type DynamicBrowserFixtureInput = any;
export type DynamicBrowserCutoverPacketDto = any;
export type DynamicBrowserFixtureResultDto = any;
export type DynamicBrowserGateDto = any;
