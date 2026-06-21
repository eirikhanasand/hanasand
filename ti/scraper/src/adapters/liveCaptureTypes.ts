import type { AdapterRunResult, CollectionTask, SourceRecord } from "../types.ts";

export type LiveCaptureAdapterKind = "rss_feed" | "static_html" | "report_index" | "public_advisory" | "pdf_report";
export type LiveCaptureFailureClass = "none" | "http_error" | "parse_error" | "malformed_feed" | "unsupported_mime" | "excessive_redirects" | "unsafe_url" | "duplicate_content" | "stale_source" | "empty_capture" | "robots_or_legal_hold" | "content_too_large" | "rate_limited" | "not_modified";
export type LiveCaptureStatus = "captured" | "empty" | "failed" | "duplicate" | "stale";
export type LiveCaptureFixtureClass = "github_security_advisory" | "cisa_kev" | "vendor_advisory_json" | "cert_html" | "vendor_blog_html" | "rss_atom" | "report_index";
export type LiveCaptureCanaryFixtureClass = LiveCaptureFixtureClass | "pdf_text_layer_report" | "unsupported_mime" | "hostile_unsafe_link_suppression";
export type LiveCaptureCanaryRunClass = "first_run" | "repeat_run" | "burst_failure" | "source_outage" | "parser_regression" | "source_family_shortage";
export type LiveCaptureCanaryState = "promote" | "watch" | "hold" | "rollback";
export type ParserRepairCategory = "none" | "malformed_feed" | "changed_layout" | "report_index_drift" | "public_advisory_schema_change" | "unsupported_mime" | "excessive_redirects" | "source_outage" | "duplicate_heavy_output" | "stale_source_window" | "unsafe_link_suppression";

export interface LiveCaptureRuntimeInput {
  generatedAt?: string;
  captures: LiveCaptureRuntimeCaptureInput[];
  previousDedupeKeys?: string[];
  requiredFixtureClasses?: LiveCaptureFixtureClass[];
}

export interface LiveCaptureRuntimeCaptureInput {
  source: SourceRecord;
  result: AdapterRunResult;
  adapter: LiveCaptureAdapterKind;
  task?: CollectionTask;
  contentType?: string;
  freshnessTargetSeconds?: number;
  timeoutMs?: number;
  maxBytes?: number;
  mimeAllowlist?: string[];
  redirectCount?: number;
  queryClass?: string;
}

export interface LiveCaptureCanaryInput extends LiveCaptureRuntimeInput {
  canaryPhase?: "fixture_replay" | "dry_run" | "operator_approved_live";
  runClass?: LiveCaptureCanaryRunClass;
  sourceFamilyMinimums?: Record<string, number>;
  requiredCanaryFixtures?: LiveCaptureCanaryFixtureClass[];
}

export type LiveCaptureRuntimeRowDto = any;
export type LiveCaptureEvidenceHandoffDto = any;
export type LiveCaptureCanaryRowDto = any;
export type LiveCaptureCanaryPacketDto = any;
export type LiveCaptureRuntimePacketDto = any;
