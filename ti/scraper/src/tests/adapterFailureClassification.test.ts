import { describe, expect, test } from "bun:test";
import { buildAdapterFailureObservation, buildAdapterFailureObservatory } from "../adapters/adapterFailureObservatory.ts";
import { failureCases } from "./helpers/adapterFailureCases.ts";
import { generatedAt } from "./helpers/adapterFailureFixtures.ts";

describe("adapter failure classification", () => {
  test("classifies public-source fixture failures and emits route-safe DTOs", () => {
    const fixtures = failureCases();
    const observations = fixtures.map((item) => buildAdapterFailureObservation({
      generatedAt,
      queryClass: item.queryClass,
      source: item.source,
      result: item.run,
      profile: item.profile,
      retryAfterSeconds: item.retryAfterSeconds,
      staleDate: item.staleDate,
      duplicateRate: item.duplicateRate,
      noiseRate: item.noiseRate,
      contentType: item.contentType,
      contentLengthBytes: item.contentLengthBytes,
      maxBytes: item.maxBytes
    }));

    expect(observations.map((observation) => observation.failureClass)).toEqual(fixtures.map((fixture) => fixture.expected));
    expect(observations.every((observation) => observation.canonicalUrlHash?.startsWith("urlhash:"))).toBe(true);
    expect(JSON.stringify(observations)).not.toContain("https://");
    expect(JSON.stringify(observations)).not.toContain(".onion");

    const byFailure = new Map(observations.map((observation) => [observation.failureClass, observation]));
    expect(byFailure.get("rate_limited")?.handoffs.agent02Scheduling).toBe("retry_after");
    expect(byFailure.get("parser_gap")?.handoffs.agent07QualityGate).toBe("parser_gap");
    expect(byFailure.get("duplicate_canonical")?.handoffs.agent06EvidenceRetention).toBe("suppress_duplicate");
    expect(byFailure.get("robots_policy_hold")?.diagnostics.robotsLegalHold).toBe(true);
    expect(byFailure.get("unsupported_media")?.diagnostics.unsupportedMime).toBe("application/zip");

    const observatory = buildAdapterFailureObservatory({ generatedAt, observations });
    expect(observatory.summary).toMatchObject({ total: fixtures.length, ok: 1 });
    expect(observatory.summary.failureClasses.parser_gap).toBe(1);
    expect(observatory.summary.parserProfiles.public_channel_handoff).toBe(2);
    expect(observatory.summary.sourceFamilies.public_channel).toBe(2);
    expect(observatory.routeContract.safeForPublicApi).toBe(true);
    expect(observatory.routeContract.forbiddenFields).toEqual(expect.arrayContaining(["rawText", "onionUrl"]));
  });
});
