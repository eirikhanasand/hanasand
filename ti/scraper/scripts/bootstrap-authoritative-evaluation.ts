import { stableId } from "../src/utils.ts";

const SOURCE_ID = "src_seed_cisa_known_exploited_vulns";
const REFERENCE_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const LABELED_BY = "cisa-kev-authoritative-v1";
const NOTES = "Expected fields come from the official CISA KEV structured entry; observed values come from ti-source-specific-extractor-v1.";

export function buildCisaEvaluationCorpus(captures: any[], entities: any[]) {
  const labels: any[] = [], validations: any[] = [];
  const byCapture = new Map<string, any[]>();
  for (const entity of entities.filter((row) => row.sourceId === SOURCE_ID && row.extractorVersion === "ti-source-specific-extractor-v1")) {
    byCapture.set(entity.captureId, [...(byCapture.get(entity.captureId) ?? []), entity]);
  }

  const corpusCaptures = captures.filter((capture) => capture.sourceId === SOURCE_ID && capture.metadata?.extractionProfile === "cisa_kev" && capture.metadata?.structuredFields?.cveID);
  for (const capture of corpusCaptures) {
    const fields = capture.metadata.structuredFields;
    const split = datasetSplit(fields.cveID);
    const observed = byCapture.get(capture.id) ?? [];
    const expected = [
      ["cve", fields.cveID],
      ["vendor", fields.vendorProject],
      ["product", fields.product],
      ["ttp", "exploitation"]
    ].filter(([, value]) => typeof value === "string" && value.trim()) as string[][];

    for (const [type, value] of expected) {
      const match = observed.find((entity) => entity.type === type && normalized(entity.value) === normalized(value));
      labels.push(label(capture, split, type, value, match));
    }

    const expectedDate = new Date(`${fields.dateAdded}T00:00:00.000Z`).toISOString();
    labels.push({
      id: stableId("label-cisa", `${capture.id}:date_extraction`),
      captureId: capture.id,
      labelType: "date_extraction",
      expectedValue: expectedDate,
      observedValue: capture.publishedAt,
      outcome: capture.publishedAt === expectedDate ? "true_positive" : "false_negative",
      datasetSplit: split,
      labeledBy: LABELED_BY,
      labeledAt: capture.collectedAt,
      notes: NOTES
    });
    validations.push({
      id: stableId("validation-cisa", capture.id),
      captureId: capture.id,
      validationType: "authoritative_catalog_entry",
      status: "supported",
      referenceUrl: REFERENCE_URL,
      referencePublishedAt: expectedDate,
      matchedAt: capture.collectedAt,
      reviewerId: LABELED_BY
    });
  }
  return { captures: corpusCaptures, labels, validations };
}

function label(capture: any, split: string, type: string, expectedValue: string, entity?: any) {
  return {
    id: stableId("label-cisa", `${capture.id}:${type}_extraction`),
    ...(entity ? { entityId: entity.id } : { captureId: capture.id }),
    labelType: `${type}_extraction`,
    expectedValue,
    observedValue: entity?.value,
    outcome: entity ? "true_positive" : "false_negative",
    datasetSplit: split,
    labeledBy: LABELED_BY,
    labeledAt: capture.collectedAt,
    notes: NOTES
  };
}

function datasetSplit(cve: string) {
  return [...cve].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5 === 0 ? "validation" : "test";
}

const normalized = (value: unknown) => String(value ?? "").trim().toLowerCase();

if (import.meta.main) {
  const apply = Bun.argv.includes("--apply");
  const base = Bun.env.TI_SCRAPER_API_URL ?? "http://127.0.0.1:8097";
  const [captures, entities, existingLabels, existingValidations] = await Promise.all([
    all(base, "captures"), all(base, "entities"), all(base, "evaluation-labels"), all(base, "validation-records")
  ]);
  const corpus = buildCisaEvaluationCorpus(captures, entities);
  const labelIds = new Set(existingLabels.map((row) => row.id));
  const validationIds = new Set(existingValidations.map((row) => row.id));
  const labels = corpus.labels.filter((row) => !labelIds.has(row.id));
  const validations = corpus.validations.filter((row) => !validationIds.has(row.id));
  if (apply) {
    await postInBatches(base, "evaluation-labels", labels);
    await postInBatches(base, "validation-records", validations);
  }
  console.log(JSON.stringify({ apply, captureCount: corpus.captures.length, plannedLabelCount: corpus.labels.length, plannedValidationCount: corpus.validations.length, createdLabelCount: apply ? labels.length : 0, createdValidationCount: apply ? validations.length : 0, skippedExistingCount: corpus.labels.length + corpus.validations.length - labels.length - validations.length }, null, 2));
}

async function all(base: string, collection: string) {
  const rows: any[] = [];
  for (let cursor: string | undefined; ;) {
    const response = await fetch(`${base}/v1/intel/${collection}?limit=500${cursor ? `&cursor=${cursor}` : ""}`);
    if (!response.ok) throw new Error(`GET ${collection} failed: ${response.status} ${await response.text()}`);
    const body = await response.json() as any;
    rows.push(...(body[camel(collection)] ?? []));
    cursor = body.nextCursor;
    if (!cursor) return rows;
  }
}

async function postInBatches(base: string, collection: string, rows: any[]) {
  for (let index = 0; index < rows.length; index += 10) await Promise.all(rows.slice(index, index + 10).map(async (row) => {
    const response = await fetch(`${base}/v1/intel/${collection}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(row) });
    if (response.status !== 201) throw new Error(`POST ${collection} failed: ${response.status} ${await response.text()}`);
  }));
}

function camel(value: string) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
