import { canonicalFeedKey } from "./sourceSeedUtils.ts";

const FAMILIES = new Set(["clear_web", "lawful_dark_web", "public_telegram"]);
const TYPES = {
  clear_web: new Set(["rss", "api", "json_api"]),
  lawful_dark_web: new Set(["tor_metadata", "darkweb_metadata"]),
  public_telegram: new Set(["telegram_public"])
} as const;
export function validateSourcePortfolioBatch(bundle: any, generatedAt: string) {
  if (bundle?.schemaVersion !== "ti.source_portfolio_batch.v1") return { recognized: false, valid: true, errors: [] as Array<{ sourceId?: string; message: string }> };
  const errors: Array<{ sourceId?: string; message: string }> = [];
  const family = String(bundle.family ?? "") as keyof typeof TYPES;
  if (!FAMILIES.has(family)) errors.push({ message: "source portfolio family is invalid" });
  if (!Array.isArray(bundle.sources)) errors.push({ message: "source portfolio sources must be an array" });
  const ids = new Set<string>(), keys = new Set<string>();
  for (const source of bundle.sources ?? []) {
    const sourceId = typeof source?.id === "string" ? source.id : undefined;
    const verification = source?.metadata?.sourcePortfolioVerification;
    const verifiedAt = Date.parse(String(verification?.verifiedAt ?? ""));
    const legalBasisVerifiedAt = Date.parse(String(verification?.legalBasisVerifiedAt ?? ""));
    const now = Date.parse(generatedAt);
    const key = canonicalFeedKey(String(source?.url ?? ""));
    if (!sourceId || ids.has(sourceId)) errors.push({ sourceId, message: "source portfolio source ID must be present and unique" });
    if (!source?.url || keys.has(key)) errors.push({ sourceId, message: "source portfolio endpoint must be present and unique" });
    if (!TYPES[family]?.has(source?.type)) errors.push({ sourceId, message: "source type does not match source portfolio family" });
    if (!verification
      || verification.outcome !== "content_parsed"
      || !Number.isInteger(verification.observedItemCount)
      || verification.observedItemCount < 1
      || !Number.isFinite(verifiedAt)
      || !Number.isFinite(legalBasisVerifiedAt)
      || verifiedAt > now + 5 * 60_000
      || legalBasisVerifiedAt > now + 5 * 60_000) {
      errors.push({ sourceId, message: "parser and legal verification evidence is required" });
    }
    if (source?.health || source?.lastSeenAt || source?.crawlState?.lastCollectedAt || source?.crawlState?.lastUsefulAt) {
      errors.push({ sourceId, message: "runtime collection timestamps must not be seeded" });
    }
    if (Object.entries(source?.metadata ?? {}).some(([key, value]) => value === true && /generated|padded|padding/i.test(key))) {
      errors.push({ sourceId, message: "generated or padded source rows are forbidden" });
    }
    if (sourceId) ids.add(sourceId);
    if (source?.url) keys.add(key);
  }
  return { recognized: true, valid: errors.length === 0, errors };
}
