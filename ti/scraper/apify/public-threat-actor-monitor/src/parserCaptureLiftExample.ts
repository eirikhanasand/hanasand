import type { PaidRowDecision } from "./commonActorTypes.ts";

export interface ParserCaptureLiftExample {
  id: string;
  sourceFamily: "rss_security_blog" | "vendor_report" | "cert_advisory" | "github_security_advisory" | "public_channel_handoff";
  parserFamily: "rss" | "static_html" | "advisory_security_signal" | "public_channel_handoff";
  beforeDecision: PaidRowDecision;
  afterDecision: PaidRowDecision;
  outcome: "accepted" | "rejected";
  repairAction: string;
  buyerVisibleFieldsAdded: Array<"actor" | "victim" | "sector" | "country" | "claim_type" | "first_reported_at" | "last_reported_at" | "publisher_count" | "ttp_tool" | "confidence" | "source_family" | "corroborating_source_ids">;
  blockerCodesRemoved: string[];
  rejectedReason?: "stale_report" | "single_source_low_context" | "duplicate_syndication" | "unsafe_or_restricted_capture" | "auth_captcha_private_source" | "raw_url_or_body_leak" | "credential_or_payload_material";
  sellableRowsDelta: number;
  usefulRowsDelta: number;
  freshRowsDelta: number;
  caveatedRowsDelta: number;
  estimatedBuyerValueDelta: number;
  noLeak: true;
}
