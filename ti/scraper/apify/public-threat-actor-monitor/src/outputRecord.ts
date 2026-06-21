import type { MarketplaceRow, MonetizationSummary } from "./types.ts";
import { dailyCollectionRunForRows, monetizationReadinessForRows, paidRowQualitySummary, revenueConversionChecklistForRows, buyerVisibleOutputQualityForRows } from "./outputQuality.ts";

export function outputRecord(rows: MarketplaceRow[], monetizationSummary: MonetizationSummary) {
  const paidRowQuality = paidRowQualitySummary(rows);
  const revenueConversionChecklist = revenueConversionChecklistForRows(rows, paidRowQuality);
  const buyerVisibleOutputQuality = buyerVisibleOutputQualityForRows(rows);
  return {
    outputContract: "safe_metadata_only.v1",
    rowCount: rows.length,
    paidRowQuality,
    monetizationReadiness: monetizationReadinessForRows(rows, paidRowQuality),
    revenueConversionChecklist,
    buyerVisibleOutputQuality,
    generatedAt: new Date().toISOString(),
    monetization: monetizationSummary,
    dailyCollectionRun: dailyCollectionRunForRows(rows),
    rows
  };
}


