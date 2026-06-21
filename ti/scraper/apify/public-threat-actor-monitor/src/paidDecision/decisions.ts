import type { MarketplaceRow } from "../types.ts";

type Decision = Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance">;

export function capabilityWithoutEvidence(): Decision {
  return decision("suppress", "This row advertises metadata capability but has no matching safe metadata evidence for the query; keep it out of paid findings.", ["capability_without_evidence", "source_poor_row"], 0.05, "do_not_charge_if_metered", [
    remediation("source", "add_searchable_safe_metadata_for_query", "Move future rows to included_with_caveat when safe metadata corroborates the actor or victim context."),
    remediation("quality", "keep_suppressed_until_evidence_exists", "Prevent metadata capability rows from being counted as useful paid intelligence.")]);
}

export function coverageGap(): Decision {
  return decision("coverage_gap_only", "Coverage-gap rows explain what is missing and should be treated as remediation context, not a complete intelligence finding.", ["coverage_gap", "missing_source_family"], 0.2, "do_not_charge_if_metered", [
    remediation("source", "replace_or_add_payworthy_public_sources", "Improve source-family diversity before paid promotion."),
    remediation("channels", "activate_highest_value_missing_family", "Close the visible source gap within the expected 1-3 day signal window.")]);
}

export function sourceProvenance(): Decision {
  return decision("suppress", "Source provenance pages are safe support material but are not buyer-payworthy findings by themselves; charge only for admitted actor, target, TTP, or activity rows that cite them.", ["source_provenance_only", "generic_source_page", "not_a_finding"], 0.05, "do_not_charge_if_metered", [
    remediation("parser", "convert_source_support_into_specific_parser_admitted_findings", "Replace provenance-only rows with actor, target, TTP, date, confidence, and buyer-action fields."),
    remediation("quality", "keep_source_pages_out_of_paid_findings", "Prevent safe source URLs from being charged as intelligence findings.")]);
}

export function parserAdmittedSellable(): Decision {
  return decision("sellable", "Runtime parser admission proved actor, target, sector/country, impact, TTP, dates, public support, confidence, provenance, and buyer pivots for this current row.", ["parser_runtime_admission", "buyer_fields_complete", "fresh_or_recent", "corroborated", "actionable"], 0.86, "charge", []);
}
export function noEvidenceHold(row: MarketplaceRow): Decision {
  return decision("hold", "This row has a hold condition such as contradictory reporting, stale or missing evidence, low confidence, or no public evidence.", [...holdCodes(row), ...row.reviewReasons.filter((reason) => reason.startsWith("hold:"))], row.evidenceGrade === "corroborated" ? 0.45 : 0.3, "do_not_charge_if_metered", [
    remediation("parser", "repair_parser_or_summary_specificity", "Recover supported extracted facts before row promotion."),
    remediation("quality", "rerun_quality_gate_after_repair", "Keep held rows out of paid findings until evidence support is measurable.")]);
}
export function strongSellable(): Decision {
  return decision("sellable", "Fresh or recent corroborated public evidence supports this row enough for paid monitoring output.", ["fresh_or_recent", "corroborated", "source_family_diverse", "actionable"], 0.9, "charge", []);
}
export function publicFindingSellable(): Decision {
  return decision("sellable", "Multiple fresh or recent public sources support this profile or targeting row; missing public-channel coverage remains visible as a caveat but does not make the corroborated public finding non-chargeable.", ["fresh_or_recent", "corroborated", "multi_source_public", "actionable", "source_family_gap_visible"], 0.78, "charge", [
    remediation("channels", "add_public_channel_or_dark_metadata_corroboration", "Lift future confidence and source-family diversity while preserving this row as a chargeable public finding."),
    remediation("graph", "preserve_graph_relationship_pivots_in_paid_row", "Keep actor-to-target/TTP/source-family pivots visible so the sellable decision remains explainable and export-reviewable.")]);
}
export function publicEvidenceSellable(): Decision {
  return decision("sellable", "This public source-provenance row directly supports the actor result with fresh or recent safe evidence, a source URL, confidence, provenance hash, and next investigation pivots.", ["public_evidence_row", "fresh_or_recent", "corroborated", "safe_source_url", "actionable"], 0.7, "charge", [
    remediation("marketplace", "keep_source_rows_labelled_as_evidence_not_claims", "Make paid rows useful without presenting a provenance row as a confirmed incident."),
    remediation("product", "track_source_evidence_rows_separately_in_paid_floor", "Measure whether buyers value provenance rows and suppress them if conversion or refund signals are poor.")]);
}
export function caveatedLead(row: MarketplaceRow): Decision {
  return decision("included_with_caveat", "This row is useful as a lead but needs corroboration, source-family diversity, or fresher supporting evidence before promotion.", caveatCodes(row), row.isActionable ? 0.65 : 0.5, "include_as_context", [
    remediation("source", "add_corroborating_clear_web_source", "Increase source count and source-family diversity."),
    remediation("parser", "extract_specific_actor_victim_ttp_fields", "Move generic leads toward sellable rows after parser repair.")]);
}
export function unsupportedContext(): Decision {
  return decision("hold", "This row is retained for context but is not ready as paid intelligence output.", ["not_actionable", "low_support"], 0.25, "do_not_charge_if_metered", [
    remediation("quality", "keep_out_of_paid_findings", "Avoid presenting unsupported context as a buyer-payworthy row.")]);
}
function decision(paidRowDecision: Decision["paidRowDecision"], paidRowReason: string, paidRowReasonCodes: string[], buyerValueScore: number, billingGuidance: Decision["billingGuidance"], paidRowRemediationActions: Decision["paidRowRemediationActions"]): Decision {
  return { paidRowDecision, paidRowReason, paidRowReasonCodes, paidRowRemediationActions, buyerValueScore, billingGuidance };
}
type RemediationAction = NonNullable<Decision["paidRowRemediationActions"]>[number];
function remediation(owner: RemediationAction["owner"], action: string, expectedEffect: string): RemediationAction { return { owner, action, expectedEffect }; }
function holdCodes(row: MarketplaceRow): string[] { return [...(row.contradictionHints.length > 0 ? ["contradiction_hold"] : []), ...(row.coverageStatus === "no_evidence" ? ["no_public_evidence"] : [])]; }
function caveatCodes(row: MarketplaceRow): string[] { return [...(row.evidenceGrade === "single_source" ? ["single_source"] : []), ...(row.sourceFamilyCount < 2 ? ["source_family_thin"] : []), ...(row.freshnessStatus === "stale" ? ["stale_support"] : []), row.isActionable ? "lead_is_actionable" : "lead_only"]; }
