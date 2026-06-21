import type { MarketplaceRow, PaidRowDecision } from "./types.ts";

export function whyWorthPayingFor(row: MarketplaceRow, decision: Pick<MarketplaceRow, "paidRowDecision" | "billingGuidance">): string {
  if (decision.billingGuidance === "charge") {
    if (row.sourceFamilyCount >= 2) return "fresh corroborated public signal with source-family diversity";
    return "specific public intelligence row ready for analyst triage";
  }
  if (decision.paidRowDecision === "included_with_caveat") {
    if (row.evidenceGrade === "single_source") return "fresh single-source lead with caveat and next collection pivots";
    if (row.sourceFamilyCount < 2) return "useful lead that shows the missing source family to close";
    return "actionable context that needs more corroboration before paid promotion";
  }
  if (decision.paidRowDecision === "coverage_gap_only") {
    return "source gap explains what to collect next before trusting the answer";
  }
  if (decision.paidRowDecision === "suppress") {
    return "not payworthy yet because no safe matching evidence exists";
  }
  if (row.contradictionHints.length > 0) return "held because public reporting is contradictory";
  if (row.freshnessStatus === "stale") return "held because support is stale for monitoring use";
  return "held until evidence, freshness, or specificity improves";
}

export function paidRowDecisionFor(
  row: MarketplaceRow,
  parserAdmissionRuntimeProof?: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>
): Pick<MarketplaceRow, "paidRowDecision" | "paidRowReason" | "paidRowReasonCodes" | "paidRowRemediationActions" | "buyerValueScore" | "billingGuidance"> {
  if (row.rowType === "dataset" && row.sourceType === "darknet_metadata" && !row.hasDarknetMetadata) {
    return {
      paidRowDecision: "suppress",
      paidRowReason: "This row advertises metadata capability but has no matching safe metadata evidence for the query; keep it out of paid findings.",
      paidRowReasonCodes: ["capability_without_evidence", "source_poor_row"],
      paidRowRemediationActions: [
        { owner: "agent_05", action: "add_searchable_safe_metadata_for_query", expectedEffect: "Move future rows to included_with_caveat when safe metadata corroborates the actor or victim context." },
        { owner: "agent_07", action: "keep_suppressed_until_evidence_exists", expectedEffect: "Prevent metadata capability rows from being counted as useful paid intelligence." }
      ],
      buyerValueScore: 0.05,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (row.rowType === "coverage_gap") {
    return {
      paidRowDecision: "coverage_gap_only",
      paidRowReason: "Coverage-gap rows explain what is missing and should be treated as remediation context, not a complete intelligence finding.",
      paidRowReasonCodes: ["coverage_gap", "missing_source_family"],
      paidRowRemediationActions: [
        { owner: "agent_01", action: "replace_or_add_payworthy_public_sources", expectedEffect: "Improve source-family diversity before paid promotion." },
        { owner: "agent_04", action: "activate_highest_value_missing_family", expectedEffect: "Close the visible source gap within the expected 1-3 day signal window." }
      ],
      buyerValueScore: 0.2,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (row.rowType === "source") {
    return {
      paidRowDecision: "suppress",
      paidRowReason: "Source provenance pages are safe support material but are not buyer-payworthy findings by themselves; charge only for admitted actor, target, TTP, or activity rows that cite them.",
      paidRowReasonCodes: ["source_provenance_only", "generic_source_page", "not_a_finding"],
      paidRowRemediationActions: [
        { owner: "agent_03", action: "convert_source_support_into_specific_parser_admitted_findings", expectedEffect: "Replace provenance-only rows with actor, target, TTP, date, confidence, and buyer-action fields." },
        { owner: "agent_07", action: "keep_source_pages_out_of_paid_findings", expectedEffect: "Prevent safe source URLs from being charged as intelligence findings." }
      ],
      buyerValueScore: 0.05,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (parserAdmissionRuntimeProof?.countsTowardCurrentSellableRows) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Runtime parser admission proved actor, target, sector/country, impact, TTP, dates, public support, confidence, provenance, and buyer pivots for this current row.",
      paidRowReasonCodes: ["parser_runtime_admission", "buyer_fields_complete", "fresh_or_recent", "corroborated", "actionable"],
      paidRowRemediationActions: [],
      buyerValueScore: 0.86,
      billingGuidance: "charge"
    };
  }
  if (
    row.contradictionHints.length > 0
    || row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    || row.coverageStatus === "no_evidence"
  ) {
    return {
      paidRowDecision: "hold",
      paidRowReason: "This row has a hold condition such as contradictory reporting, stale or missing evidence, low confidence, or no public evidence.",
      paidRowReasonCodes: [
        ...(row.contradictionHints.length > 0 ? ["contradiction_hold"] : []),
        ...(row.coverageStatus === "no_evidence" ? ["no_public_evidence"] : []),
        ...row.reviewReasons.filter((reason) => reason.startsWith("hold:"))
      ],
      paidRowRemediationActions: [
        { owner: "agent_03", action: "repair_parser_or_summary_specificity", expectedEffect: "Recover supported extracted facts before row promotion." },
        { owner: "agent_07", action: "rerun_quality_gate_after_repair", expectedEffect: "Keep held rows out of paid findings until evidence support is measurable." }
      ],
      buyerValueScore: row.evidenceGrade === "corroborated" ? 0.45 : 0.3,
      billingGuidance: "do_not_charge_if_metered"
    };
  }
  if (
    row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceFamilyCount >= 2
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
  ) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Fresh or recent corroborated public evidence supports this row enough for paid monitoring output.",
      paidRowReasonCodes: ["fresh_or_recent", "corroborated", "source_family_diverse", "actionable"],
      paidRowRemediationActions: [],
      buyerValueScore: 0.9,
      billingGuidance: "charge"
    };
  }
  if (isCorroboratedPublicFinding(row)) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "Multiple fresh or recent public sources support this profile or targeting row; missing public-channel coverage remains visible as a caveat but does not make the corroborated public finding non-chargeable.",
      paidRowReasonCodes: ["fresh_or_recent", "corroborated", "multi_source_public", "actionable", "source_family_gap_visible"],
      paidRowRemediationActions: [
        { owner: "agent_04", action: "add_public_channel_or_dark_metadata_corroboration", expectedEffect: "Lift future confidence and source-family diversity while preserving this row as a chargeable public finding." },
        { owner: "agent_08", action: "preserve_graph_relationship_pivots_in_paid_row", expectedEffect: "Keep actor-to-target/TTP/source-family pivots visible so the sellable decision remains explainable and export-reviewable." }
      ],
      buyerValueScore: 0.78,
      billingGuidance: "charge"
    };
  }
  if (isSellablePublicEvidenceRow(row)) {
    return {
      paidRowDecision: "sellable",
      paidRowReason: "This public source-provenance row directly supports the actor result with fresh or recent safe evidence, a source URL, confidence, provenance hash, and next investigation pivots.",
      paidRowReasonCodes: ["public_evidence_row", "fresh_or_recent", "corroborated", "safe_source_url", "actionable"],
      paidRowRemediationActions: [
        { owner: "agent_09", action: "keep_source_rows_labelled_as_evidence_not_claims", expectedEffect: "Make paid rows useful without presenting a provenance row as a confirmed incident." },
        { owner: "agent_10", action: "track_source_evidence_rows_separately_in_paid_floor", expectedEffect: "Measure whether buyers value provenance rows and suppress them if conversion or refund signals are poor." }
      ],
      buyerValueScore: 0.7,
      billingGuidance: "charge"
    };
  }
  if (row.isActionable || row.evidenceGrade === "single_source" || row.coverageStatus === "thin") {
    return {
      paidRowDecision: "included_with_caveat",
      paidRowReason: "This row is useful as a lead but needs corroboration, source-family diversity, or fresher supporting evidence before promotion.",
      paidRowReasonCodes: [
        ...(row.evidenceGrade === "single_source" ? ["single_source"] : []),
        ...(row.sourceFamilyCount < 2 ? ["source_family_thin"] : []),
        ...(row.freshnessStatus === "stale" ? ["stale_support"] : []),
        ...(row.isActionable ? ["lead_is_actionable"] : ["lead_only"])
      ],
      paidRowRemediationActions: [
        { owner: "agent_01", action: "add_corroborating_clear_web_source", expectedEffect: "Increase source count and source-family diversity." },
        { owner: "agent_03", action: "extract_specific_actor_victim_ttp_fields", expectedEffect: "Move generic leads toward sellable rows after parser repair." }
      ],
      buyerValueScore: row.isActionable ? 0.65 : 0.5,
      billingGuidance: "include_as_context"
    };
  }
  return {
    paidRowDecision: "hold",
    paidRowReason: "This row is retained for context but is not ready as paid intelligence output.",
    paidRowReasonCodes: ["not_actionable", "low_support"],
    paidRowRemediationActions: [
      { owner: "agent_07", action: "keep_out_of_paid_findings", expectedEffect: "Avoid presenting unsupported context as a buyer-payworthy row." }
    ],
    buyerValueScore: 0.25,
    billingGuidance: "do_not_charge_if_metered"
  };
}

export function isCorroboratedPublicFinding(row: MarketplaceRow): boolean {
  return row.isActionable
    && row.evidenceGrade === "corroborated"
    && (row.rowType === "profile" || row.rowType === "target" || row.rowType === "ttp")
    && row.sourceCount >= 4
    && row.sourceFamilies.includes("clear_web")
    && !row.contradictionHints.length
    && !row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent");
}

export function isSellablePublicEvidenceRow(row: MarketplaceRow): boolean {
  return row.rowType === "source"
    && row.sourceType !== "system"
    && row.sourceUrl !== undefined
    && row.sourceUrl.length > 0
    && row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceCount >= 4
    && row.sourceFamilies.includes("clear_web")
    && !row.contradictionHints.length
    && !row.reviewReasons.some((reason) => reason.startsWith("hold:"))
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
    && row.safety.metadataOnly
    && !row.rawContentIncluded
    && !row.safety.credentialsIncluded
    && !row.safety.privateContentIncluded
    && !row.safety.stolenFilesIncluded;
}
