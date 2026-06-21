import type { SourceRecord } from "../types.ts";
import { validateTelegramPublicSourceCompliance } from "./telegramPublicHelpers.ts";

export function buildTelegramPublicReconciliation(input: any) {
  const diagnostics = (input.sources ?? []).filter((s: SourceRecord) => s.type === "telegram_public").map((source: SourceRecord) => ({ sourceId: source.id, statuses: validateTelegramPublicSourceCompliance(source).allowed ? ["healthy"] : ["policy_disabled"], repairs: [] }));
  return {
    diagnostics,
    repairs: [],
    summary: {
      healthy: diagnostics.filter((d: any) => d.statuses.includes("healthy")).length,
      policy_disabled: diagnostics.filter((d: any) => d.statuses.includes("policy_disabled")).length
    }
  };
}
