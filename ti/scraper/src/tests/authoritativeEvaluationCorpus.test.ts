import { expect, test } from "bun:test";
import { buildCisaEvaluationCorpus } from "../../scripts/bootstrap-authoritative-evaluation.ts";

test("builds deterministic CISA field-parity diagnostics including missing extractions", () => {
  const capture = { id: "cap_cisa", sourceId: "src_seed_cisa_known_exploited_vulns", collectedAt: "2026-07-20T00:00:00.000Z", publishedAt: "2026-07-19T00:00:00.000Z", metadata: { extractionProfile: "cisa_kev", structuredFields: { cveID: "CVE-2026-4242", vendorProject: "Vendor", product: "Product", dateAdded: "2026-07-19" } } };
  const entities = ["cve", "vendor", "ttp"].map((type) => ({ id: `entity_${type}`, sourceId: capture.sourceId, captureId: capture.id, type, value: type === "cve" ? "CVE-2026-4242" : type === "vendor" ? "Vendor" : "exploitation", extractorVersion: "ti-source-specific-extractor-v1" }));
  const corpus = buildCisaEvaluationCorpus([capture], entities);

  expect(corpus.captures).toHaveLength(1);
  expect(corpus.labels).toHaveLength(5);
  expect(corpus.labels.find((row) => row.labelType === "product_extraction")).toMatchObject({ captureId: capture.id, outcome: "false_negative", expectedValue: "Product" });
  expect(corpus.labels.find((row) => row.labelType === "date_extraction")).toMatchObject({ outcome: "true_positive" });
  expect(corpus.labels.every((row) => row.labelingMethod === "source_field_parity" && row.independentFromExtractor === false)).toBe(true);
  expect(corpus.validations).toHaveLength(1);
});
