export type AdapterSlaAdapterKind =
  | "static_html" | "rss_feed" | "dynamic_public_browser" | "pdf_report"
  | "public_channel_handoff" | "advisory_signal" | "multilingual_handoff";
export type AdapterRepairCategory =
  | "parser_fixture_gap" | "selector_failure" | "readability_failure"
  | "pdf_extraction_failure" | "language_detection_drift" | "dynamic_render_failure"
  | "unsupported_mime_repair" | "scheduler_backoff" | "evidence_duplicate_suppression";
export type AdapterSlaSeverity = "pass" | "warn" | "hold";
export type AdapterSlaRepairInput = any;
export type AdapterSlaContractDto = any;
export type AdapterSlaBreachDto = any;
export type AdapterParserRepairPacketDto = any;
export type AdapterSlaRepairPacketDto = any;
