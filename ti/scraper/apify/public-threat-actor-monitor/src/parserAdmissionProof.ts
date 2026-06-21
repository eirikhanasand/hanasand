import type { MarketplaceRow, PaidRowDecision } from "./types.ts";
import { stableHash, uniqueStrings } from "./utils.ts";
import { isEvidenceSourceFamily } from "./rowSupport.ts";

export function parserAdmissionRuntimeProofForRow(row: MarketplaceRow): NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]> {
  const contradictionState: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>["contradictionState"] = row.contradictionHints.length > 0
    ? "contradicted"
    : row.reviewReasons.some((reason) => reason.startsWith("hold:"))
      ? "held"
      : "none";
  const sectors = uniqueStrings([row.sector ?? "", ...(row.affectedSectors ?? [])].filter(Boolean));
  const countries = uniqueStrings([row.country ?? "", ...(row.countries ?? []), ...(row.regions ?? [])].filter(Boolean));
  const sourceFamilySupport = uniqueStrings(row.sourceFamilies.filter(isEvidenceSourceFamily));
  const requiredChecks: Array<[string, boolean]> = [
    ["actor", row.actor.length > 0],
    ["victim_or_target", Boolean(row.victimName || sectors.length > 0 || countries.length > 0)],
    ["sector", sectors.length > 0],
    ["country_or_region", countries.length > 0],
    ["dataset_or_impact", Boolean(row.impact || row.datasetName || row.coverage || row.claimType)],
    ["ttp_tool_or_cve", Boolean(row.ttp || row.attackId || row.relationshipPivotTypes.some((type) => type === "ttp" || type === "attack" || type === "tactic"))],
    ["first_seen", row.firstSeen.length > 0 || Boolean(row.firstReportedAt)],
    ["last_seen", row.lastSeen.length > 0 || Boolean(row.lastReportedAt || row.claimedDate)],
    ["source_family_support", row.evidenceGrade === "corroborated" && row.sourceCount >= 2 && sourceFamilySupport.length > 0],
    ["confidence", row.confidence >= 0.6],
    ["caveat", row.buyerCaveat.length > 0],
    ["contradiction_state", contradictionState === "none"],
    ["provenance_hash", row.provenanceHash.length > 0],
    ["next_buyer_search", row.nextSearchPivots.length > 0]
  ];
  const requiredFieldsPresent = requiredChecks.filter(([, present]) => present).map(([field]) => field);
  const missingFields = requiredChecks.filter(([, present]) => !present).map(([field]) => field);
  const genericSourcePage = row.rowType === "source" || row.rowType === "dataset";
  const restrictedOnly = row.sourceType === "darknet_metadata" && !row.hasPublicChannelCoverage;
  const coverageGapOnly = row.rowType === "coverage_gap";
  const staleOrHeld = row.freshnessStatus === "stale" || row.freshnessStatus === "unknown" || contradictionState !== "none" || row.reviewReasons.some((reason) => reason.startsWith("hold:"));
  const singleSource = row.evidenceGrade !== "corroborated" || row.sourceCount < 2;
  const canCountAsSellable = ["activity", "profile", "target", "ttp"].includes(row.rowType)
    && missingFields.length === 0
    && row.isActionable
    && row.evidenceGrade === "corroborated"
    && row.sourceCount >= 2
    && (row.freshnessStatus === "current" || row.freshnessStatus === "recent")
    && contradictionState === "none";
  const blockedReason: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>["blockedReason"] | undefined = canCountAsSellable
    ? undefined
    : staleOrHeld
      ? "stale_or_held"
      : restrictedOnly
        ? "restricted_only_without_public_support"
        : coverageGapOnly
          ? "coverage_gap_only"
          : genericSourcePage
            ? "generic_source_page"
            : singleSource
              ? "single_source_without_caveat"
              : missingFields.length > 0
                ? "missing_required_fields"
                : row.reviewReasons.some((reason) => reason.includes("alias") || reason.includes("contradict"))
                  ? "alias_or_contradiction"
                  : "missing_required_fields";
  const repairOwner: NonNullable<MarketplaceRow["parserAdmissionRuntimeProof"]>["repairOwner"] = canCountAsSellable
    ? "agent_03"
    : blockedReason === "single_source_without_caveat"
      ? "agent_04"
      : blockedReason === "restricted_only_without_public_support"
        ? "agent_05"
        : blockedReason === "stale_or_held" || blockedReason === "alias_or_contradiction"
          ? "agent_07"
          : "agent_03";
  return {
    schemaVersion: "ti.apify_parser_admission_runtime_proof.v1",
    owner: "agent_03",
    candidateId: stableHash(["parser-admission-runtime", row.query, row.rowType, row.title, row.provenanceHash].join("|")).slice(0, 16),
    admissionDecision: canCountAsSellable ? "sellable" : blockedReason === "generic_source_page" || blockedReason === "coverage_gap_only" || blockedReason === "restricted_only_without_public_support" ? "suppress" : "useful_caveated",
    countsTowardCurrentSellableRows: canCountAsSellable,
    requiredFieldsPresent,
    missingFields,
    sourceFamilySupport,
    sourceEvidenceCount: row.sourceCount,
    confidence: row.confidence,
    freshnessStatus: row.freshnessStatus,
    caveat: canCountAsSellable ? "runtime parser proof has all buyer-visible fields and current public support" : row.buyerCaveat,
    contradictionState,
    provenanceHash: row.provenanceHash,
    nextBuyerSearch: row.nextSearchPivots[0] ?? `${row.actor} public corroboration`,
    repairOwner,
    blockedReason,
    noLeakProof: {
      rawBodiesExposed: false,
      unsafeUrlsExposed: false,
      restrictedPayloadsExposed: false,
      credentialsExposed: false,
      privateMaterialUsed: false,
      actorInteractionTextUsed: false
    }
  };
}
