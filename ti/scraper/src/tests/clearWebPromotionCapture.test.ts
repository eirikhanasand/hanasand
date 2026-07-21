// @ts-nocheck
import { describe, expect, test } from "bun:test";
import { promoteSearchResultToCanonicalCapture } from "../adapters/clearWebPromotion.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { fixtureFetch, reportHtml, responseFixture, source } from "./helpers/adapterFixtureHelpers.ts";
import { handoff } from "./helpers/clearWebPromotionFixtures.ts";

describe("clear-web promotion captures", () => {
  test("promotes live handoffs into canonical captures with API-ready evidence metadata", async () => {
    const store = new InMemoryScraperStore();
    const clearWebSource = source({ id: "src_clear_web_promotion", name: "Clear-web promotion source", type: "static_web", url: "https://example.test/research/index" });
    store.saveSource(clearWebSource);
    const handoffs = [
      handoff(1, "APT29", "apt29-report", "APT29 campaign report", "APT29 campaign used malware and phishing against government victims with CVE-2026-1001.", "matched"),
      handoff(2, "APT42", "apt42-report", "APT42 campaign report", "APT42 intrusion campaign targeted civil society victims with credential theft malware.", "matched"),
      handoff(3, "Turla", "turla-report", "Turla report", "Turla malware campaign used Snake tooling against diplomatic targets.", "not_matched"),
      handoff(4, "Volt Typhoon", "volt-typhoon-report", "Volt Typhoon advisory", "Volt Typhoon campaign targeted critical infrastructure sectors with living-off-the-land techniques.", "matched"),
      handoff(5, "Scattered Spider", "scattered-spider-report", "Scattered Spider report", "Scattered Spider intrusion targeted hospitality victim help desks with social engineering.", "matched"),
      handoff(6, "Akira ransomware", "akira-report", "Akira ransomware report", "Akira ransomware leak claim names victim Fjord Energy AS in the energy sector.", "matched"),
      handoff(7, "Random Actor", "random-actor-report", "Random Actor report", "Random Actor campaign compromised a manufacturing victim and published indicators.", "not_matched"),
      handoff(8, "Made Up Actor", "made-up-actor-profile", "Made Up Actor profile", "Made Up Actor is an unconfirmed name seen in a public index with no incident language.", "not_configured"),
      handoff(9, "CVE-2026-12345", "cve-2026-12345-advisory", "CVE-2026-12345 advisory", "CVE-2026-12345 exploit observed in a public advisory with intrusion indicators.", "not_matched")
    ];
    const fetcher = fixtureFetch({ "https://example.test/robots.txt": responseFixture("User-agent: *\nAllow: /\n", { status: 200 }, "https://example.test/robots.txt"), ...Object.fromEntries(handoffs.map((item) => [item.url, responseFixture(reportHtml(item.title, item.snippet, item.url), { status: 200, headers: { etag: `"${item.resultId}"`, "last-modified": "Sun, 24 May 2026 12:00:00 GMT" } }, item.url)])) });
    const proofs = [];
    for (const item of handoffs) proofs.push(await promoteSearchResultToCanonicalCapture(store, clearWebSource, item, { fetcher }));

    expect(proofs).toHaveLength(9);
    expect(proofs.every((proof) => proof.status === "captured")).toBe(true);
    expect(proofs.map((proof) => proof.query)).toEqual(["APT29", "APT42", "Turla", "Volt Typhoon", "Scattered Spider", "Akira ransomware", "Random Actor", "Made Up Actor", "CVE-2026-12345"]);
    expect(proofs.every((proof) => proof.captureId?.startsWith("cap_"))).toBe(true);
    expect(proofs.filter((proof) => proof.query !== "Made Up Actor").every((proof) => proof.incidentId?.startsWith("inc_"))).toBe(true);
    expect(proofs.find((proof) => proof.query === "Made Up Actor")?.incidentId).toBeUndefined();
    expect(store.listDiscoveryEvidence().every((item) => item.promotedToCaptureId && item.promotedToTaskId)).toBe(true);
    expect(store.listCaptures()).toHaveLength(9);
    expect(store.listIncidents()).toHaveLength(8);
    expect(proofs.find((proof) => proof.query === "APT42")?.publicChannelMatchState).toBe("matched");
    expect(proofs.find((proof) => proof.query === "Made Up Actor")?.apiPromotionMetadata.agent07.answerState).toBe("answerable");
    expect(JSON.stringify({ proofs, captures: store.listCaptures() })).not.toContain("object/key");
  });
});
