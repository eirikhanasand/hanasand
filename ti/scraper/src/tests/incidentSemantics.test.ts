import { describe, expect, test } from "bun:test";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { INCIDENT_CLASSIFIER_VERSION } from "../pipeline/incidentCandidate.ts";
import { hashContent } from "../utils.ts";

function item(title: string, rawText: string, metadata: Record<string, unknown> = {}) {
  return processCollectedItem({
    sourceId: "src_incident_semantics",
    url: `https://example.test/${hashContent(title).slice(0, 8)}`,
    title,
    rawText,
    collectedAt: "2026-07-21T10:00:00.000Z",
    publishedAt: "2026-07-20T10:00:00.000Z",
    contentHash: hashContent(rawText),
    links: [],
    metadata,
    sensitive: false,
  });
}

describe("incident semantics", () => {
  test("does not turn profiles, explainers, or IOC references into incidents", () => {
    expect(item(
      "Akira",
      "Lineage profile. Public channel classes: DLS, Chat. Public victim listing count: 1387.",
      { extractionProfile: "ransomware_group_metadata", ransomwareGroup: { actorName: "Akira" } },
    ).incident).toBeUndefined();
    expect(item("What is APT29?", "APT29 is a threat actor associated with malware and historical victims.").incident).toBeUndefined();
    expect(item("APT29 threat profile", "Victim: Northwind Health. This profile documents historical targeting.").incident).toBeUndefined();
    expect(item("APT29 reference", "APT29 infrastructure reference: 198.51.100.10 and example.com.").incident).toBeUndefined();
  });

  test("creates incidents only for event language or structured victim claims", () => {
    const publicAttack = item("APT29 report", "APT29 used phishing against Northwind Health.");
    const victimClaim = item(
      "Akira publication",
      "Akira source metadata.",
      { extractionProfile: "ransomware_victim_blog", leakSite: { actorName: "Akira", victimName: "Northwind Health" } },
    );

    expect(publicAttack.incident).toMatchObject({ extractorVersion: INCIDENT_CLASSIFIER_VERSION });
    expect(victimClaim.incident).toMatchObject({ extractorVersion: INCIDENT_CLASSIFIER_VERSION });
  });
});
