import { expect, test } from "bun:test";
import { buildCorroboratedEvaluationCorpus } from "../../scripts/bootstrap-corroborated-evaluation.ts";

test("labels only claims corroborated by distinct safe public publishers", () => {
  const claim = {
    id: "claim_akira",
    claimType: "actor",
    value: { value: "Akira" },
    corroborationState: "corroborated",
    sourceIndependence: { groupCount: 2 },
    captureIds: ["cap_vendor", "cap_news", "cap_duplicate", "cap_restricted"],
    updatedAt: "2026-07-20T00:00:00.000Z"
  };
  const captures = [
    { id: "cap_vendor", canonicalUrl: "https://vendor.test/report", collectedAt: "2026-07-19T00:00:00.000Z" },
    { id: "cap_news", url: "https://news.test/story", collectedAt: "2026-07-19T01:00:00.000Z" },
    { id: "cap_duplicate", url: "https://vendor.test/duplicate", collectedAt: "2026-07-19T02:00:00.000Z" },
    { id: "cap_restricted", url: `http://${"a".repeat(56)}.onion/post`, collectedAt: "2026-07-19T03:00:00.000Z" }
  ];

  const corpus = buildCorroboratedEvaluationCorpus([claim], captures);
  expect(corpus.labels).toEqual([expect.objectContaining({ claimId: claim.id, labelType: "actor", expectedValue: "Akira", outcome: "true_positive", labelingMethod: "cross_source_corroboration", independentFromExtractor: false })]);
  expect(corpus.validations).toHaveLength(2);
  expect(JSON.stringify(corpus)).not.toContain(".onion");

  expect(buildCorroboratedEvaluationCorpus([{ ...claim, sourceIndependence: { groupCount: 1 } }], captures).labels).toHaveLength(0);
  expect(buildCorroboratedEvaluationCorpus([claim], captures.filter((capture) => capture.id !== "cap_news")).labels).toHaveLength(0);
});
