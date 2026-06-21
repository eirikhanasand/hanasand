import { describe, expect, test } from "bun:test";
import { buildRuntimeEvidenceFixture } from "./helpers/runtimeEvidenceFixtures.ts";

describe("runtime evidence safety output", () => {
  test("keeps connector metadata useful without exposing raw text or private material", () => {
    const { persisted } = buildRuntimeEvidenceFixture();
    expect(JSON.stringify(persisted)).not.toContain("raw media payload");
    expect(JSON.stringify(persisted)).not.toContain("+privateInvite");
    expect(persisted.snapshot.metadata.connector).toMatchObject({
      promotionHandoff: { targetAgent: "agent_06", promotedCount: 2, extractionInputCount: 2, partialEvidenceOnly: true },
      deltas: { newMessageIds: [3001], editedMessageIds: [3002], deletedOrUnavailableMessageIds: [3003] }
    });
    expect(JSON.stringify(persisted.snapshot.metadata.connector)).not.toContain("APT29 used CVE-2026-9999");
  });
});
