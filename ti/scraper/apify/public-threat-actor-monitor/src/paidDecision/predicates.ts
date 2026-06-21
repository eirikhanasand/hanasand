import type { MarketplaceRow } from "../types.ts";

export function isCorroboratedPublicFinding(row: MarketplaceRow): boolean {
  return row.isActionable &&
    row.evidenceGrade === "corroborated" &&
    (row.rowType === "profile" || row.rowType === "target" || row.rowType === "ttp") &&
    row.sourceCount >= 4 &&
    row.sourceFamilies.includes("clear_web") &&
    !row.contradictionHints.length &&
    !row.reviewReasons.some((reason) => reason.startsWith("hold:")) &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent");
}

export function isSellablePublicEvidenceRow(row: MarketplaceRow): boolean {
  return row.rowType === "source" &&
    row.sourceType !== "system" &&
    row.sourceUrl !== undefined &&
    row.sourceUrl.length > 0 &&
    row.isActionable &&
    row.evidenceGrade === "corroborated" &&
    row.sourceCount >= 4 &&
    row.sourceFamilies.includes("clear_web") &&
    !row.contradictionHints.length &&
    !row.reviewReasons.some((reason) => reason.startsWith("hold:")) &&
    (row.freshnessStatus === "current" || row.freshnessStatus === "recent") &&
    row.safety.metadataOnly &&
    !row.rawContentIncluded &&
    !row.safety.credentialsIncluded &&
    !row.safety.privateContentIncluded &&
    !row.safety.stolenFilesIncluded;
}
