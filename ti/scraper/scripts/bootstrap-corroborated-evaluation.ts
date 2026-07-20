import { stableId } from "../src/utils.ts";

const LABELED_BY = "cross-source-corroboration-v1";
const TYPES = new Set([
  "actor", "victim", "cve", "ttp", "impact", "dataset", "malware", "ransomware_family",
  "country", "sector", "publication_strategy", "publicity_tactic", "channel_type",
  "victim_pressure_tactic", "extortion_type", "monetization_path", "buyer_seller_communication",
  "intermediary_communication", "profitability_signal"
]);

export function buildCorroboratedEvaluationCorpus(claims: any[], captures: any[]) {
  const captureById = new Map(captures.map((capture) => [capture.id, capture]));
  const labels: any[] = [];
  const validations: any[] = [];

  for (const claim of claims) {
    const type = String(claim.claimType ?? "");
    const value = claim.value?.value ?? claim.value?.normalizedValue;
    const groupCount = Number(claim.sourceIndependence?.groupCount ?? 0);
    if (!TYPES.has(type) || claim.corroborationState !== "corroborated" || groupCount < 2 || typeof value !== "string" || !value.trim() || value.length > 500) continue;

    const references = new Map<string, { url: string; publishedAt?: string; collectedAt: string }>();
    for (const captureId of claim.captureIds ?? []) {
      const capture = captureById.get(captureId);
      const url = publicReference(capture?.canonicalUrl ?? capture?.url ?? capture?.provenance?.url);
      if (!url) continue;
      const publisher = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      if (!references.has(publisher)) references.set(publisher, { url, publishedAt: capture.publishedAt, collectedAt: capture.collectedAt });
    }
    if (references.size < 2) continue;

    const labeledAt = claim.updatedAt ?? claim.lastSeenAt ?? [...references.values()][0]!.collectedAt;
    labels.push({
      id: stableId("label-corroborated", `${claim.id}:${type}`),
      claimId: claim.id,
      tenantId: claim.tenantId,
      labelType: type,
      expectedValue: value.trim(),
      observedValue: value.trim(),
      outcome: "true_positive",
      datasetSplit: split(claim.id),
      labeledBy: LABELED_BY,
      labelingMethod: "cross_source_corroboration",
      independentFromExtractor: false,
      labeledAt,
      notes: `Claim value is supported by ${references.size} distinct public publisher hosts; no raw evidence is included.`
    });
    for (const [publisher, reference] of references) validations.push({
      id: stableId("validation-corroborated", `${claim.id}:${publisher}`),
      claimId: claim.id,
      tenantId: claim.tenantId,
      validationType: "independent_public_reporting",
      status: "supported",
      referenceUrl: reference.url,
      referencePublishedAt: reference.publishedAt,
      matchedAt: reference.collectedAt,
      reviewerId: LABELED_BY
    });
  }
  return { labels, validations };
}

function publicReference(value: unknown) {
  try {
    const url = new URL(String(value ?? ""));
    const host = url.hostname.toLowerCase();
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || /(?:\.onion|\.i2p|\.local|\.internal)$/.test(host)) return undefined;
    if (/^(?:localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host)) return undefined;
    if ([...url.searchParams.keys()].some((key) => /token|secret|password|authorization|cookie|api[_-]?key|signature/i.test(key))) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function split(id: string) {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5 === 0 ? "validation" : "test";
}

if (import.meta.main) {
  const apply = Bun.argv.includes("--apply");
  const base = Bun.env.TI_SCRAPER_API_URL ?? "http://127.0.0.1:8097";
  const [claims, captures, existingLabels, existingValidations] = await Promise.all([
    all(base, "claims"), all(base, "captures"), all(base, "evaluation-labels"), all(base, "validation-records")
  ]);
  const corpus = buildCorroboratedEvaluationCorpus(claims, captures);
  const labelIds = new Set(existingLabels.map((row) => row.id));
  const validationIds = new Set(existingValidations.map((row) => row.id));
  const labels = corpus.labels.filter((row) => !labelIds.has(row.id));
  const validations = corpus.validations.filter((row) => !validationIds.has(row.id));
  if (apply) {
    await postInBatches(base, "evaluation-labels", labels);
    await postInBatches(base, "validation-records", validations);
  }
  console.log(JSON.stringify({ apply, plannedLabelCount: corpus.labels.length, plannedValidationCount: corpus.validations.length, createdLabelCount: apply ? labels.length : 0, createdValidationCount: apply ? validations.length : 0, skippedExistingCount: corpus.labels.length + corpus.validations.length - labels.length - validations.length }, null, 2));
}

async function all(base: string, collection: string) {
  const records: any[] = [];
  for (let cursor: string | undefined; ;) {
    const response = await fetch(`${base}/v1/intel/${collection}?limit=500${cursor ? `&cursor=${cursor}` : ""}`);
    if (!response.ok) throw new Error(`GET ${collection} failed: ${response.status} ${await response.text()}`);
    const body = await response.json() as any;
    records.push(...(body[camel(collection)] ?? []));
    cursor = body.nextCursor;
    if (!cursor) return records;
  }
}

async function postInBatches(base: string, collection: string, records: any[]) {
  for (let index = 0; index < records.length; index += 20) await Promise.all(records.slice(index, index + 20).map(async (record) => {
    const response = await fetch(`${base}/v1/intel/${collection}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(record) });
    if (response.status !== 201) throw new Error(`POST ${collection} failed: ${response.status} ${await response.text()}`);
  }));
}

function camel(value: string) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
