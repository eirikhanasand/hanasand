// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { promoteSearchResultToCanonicalCapture } from "../adapters/clearWebPromotion.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureFetch, reportHtml, responseFixture, source } from "./helpers/adapterFixtureHelpers.ts";
import { failureByQuery, failureHandoff } from "./helpers/clearWebPromotionFixtures.ts";

describe("clear-web promotion failures", () => {
  test("reports clear-web failure outcomes without unsafe collection", async () => {
    const store = new InMemoryScraperStore();
    const clearWebSource = source({ id: "src_clear_web_failures", name: "Clear-web failure source", type: "static_web", url: "https://failure.example.test/research/index" });
    store.saveSource(clearWebSource);
    const duplicateFirst = failureHandoff(1, "APT29 duplicate one", "duplicate-one");
    const duplicateSecond = { ...failureHandoff(2, "APT29 duplicate two", "duplicate-two"), url: "https://failure.example.test/research/duplicate-two?utm=search#summary" };
    const handoffs = [
      failureHandoff(3, "Robots Blocked Actor", "robots-blocked", "https://robots.example.test/private/report"),
      failureHandoff(4, "Rate Limited Actor", "rate-limited"),
      failureHandoff(5, "Missing Actor", "not-found"),
      failureHandoff(6, "Oversized Actor", "too-large"),
      failureHandoff(7, "Unsupported MIME Actor", "unsupported-mime")
    ];
    const fetcher = fixtureFetch({
      "https://failure.example.test/robots.txt": responseFixture("User-agent: *\nAllow: /\n", { status: 200 }, "https://failure.example.test/robots.txt"),
      "https://robots.example.test/robots.txt": responseFixture("User-agent: *\nDisallow: /private\n", { status: 200 }, "https://robots.example.test/robots.txt"),
      [duplicateFirst.url]: responseFixture(reportHtml("APT29 duplicate one", "APT29 campaign used malware and phishing against government victims.", duplicateFirst.url), { status: 200, headers: { "content-type": "text/html" } }, duplicateFirst.url),
      [duplicateSecond.url]: responseFixture(reportHtml("APT29 duplicate two", "APT29 campaign used malware and phishing against government victims.", duplicateFirst.url), { status: 200, headers: { "content-type": "text/html" } }, duplicateSecond.url),
      "https://failure.example.test/research/rate-limited?utm=search#summary": responseFixture("retry later", { status: 429, headers: { "retry-after": "30" } }, "https://failure.example.test/research/rate-limited?utm=search#summary"),
      "https://failure.example.test/research/not-found?utm=search#summary": responseFixture("not found", { status: 404 }, "https://failure.example.test/research/not-found?utm=search#summary"),
      "https://failure.example.test/research/too-large?utm=search#summary": responseFixture(reportHtml("Oversized Actor", "Oversized Actor campaign ".repeat(200), "https://failure.example.test/research/too-large"), { status: 200, headers: { "content-type": "text/html" } }, "https://failure.example.test/research/too-large?utm=search#summary"),
      "https://failure.example.test/research/unsupported-mime?utm=search#summary": responseFixture("%PDF-1.7", { status: 200, headers: { "content-type": "application/pdf" } }, "https://failure.example.test/research/unsupported-mime?utm=search#summary")
    });
    const firstProof = await promoteSearchResultToCanonicalCapture(store, clearWebSource, duplicateFirst, { fetcher });
    const duplicateProof = await promoteSearchResultToCanonicalCapture(store, clearWebSource, duplicateSecond, { fetcher });
    const proofs = [firstProof, duplicateProof, ...(await Promise.all(handoffs.map((item) => promoteSearchResultToCanonicalCapture(store, clearWebSource, item, { fetcher, maxBytes: item.resultId === "result_too-large" ? 128 : 1_000_000 }))))];

    expect(firstProof.status).toBe("captured");
    expect(duplicateProof).toMatchObject({ status: "duplicate", failureCategory: "duplicate_canonical", captureId: firstProof.captureId });
    expect(failureByQuery(proofs, "Robots Blocked Actor")).toMatchObject({ status: "blocked", failureCategory: "robots_blocked" });
    expect(failureByQuery(proofs, "Rate Limited Actor")).toMatchObject({ status: "blocked", failureCategory: "rate_limited", responseStatus: 429, retryAfterSeconds: 30 });
    expect(failureByQuery(proofs, "Missing Actor")).toMatchObject({ status: "blocked", failureCategory: "not_found", responseStatus: 404 });
    expect(failureByQuery(proofs, "Oversized Actor")).toMatchObject({ status: "blocked", failureCategory: "too_large", responseStatus: 200 });
    expect(failureByQuery(proofs, "Unsupported MIME Actor")).toMatchObject({ status: "blocked", failureCategory: "unsupported_mime", responseStatus: 200 });
    expect(proofs.filter((proof) => proof.status === "blocked").every((proof) => proof.apiPromotionMetadata.agent09.publicTiImpact === "blocked")).toBe(true);
    expect(store.listDiscoveryEvidence().every((item) => item.promotedToTaskId)).toBe(true);
    expect(store.listCaptures()).toHaveLength(1);
  });
});
