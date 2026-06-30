import { describe, expect, test } from "bun:test";
import { buildActorResultDto } from "../export/actorGraph.ts";
import { exportPipelineResultToStixBundle } from "../export/stix.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { hashContent } from "../utils.ts";

function result(rawText: string, collectedAt: string, title = "APT29 fixture") {
  return processCollectedItem({
    sourceId: `src_${hashContent(title + collectedAt)}`,
    url: `https://example.test/${hashContent(rawText)}`,
    collectedAt,
    title,
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata: { fixture: true },
    sensitive: false
  });
}

describe("actor result graph", () => {
  test("merges APT29 aliases and ranks recent activity, targets, sectors, regions, TTPs, tooling, CVEs, and infrastructure", () => {
    const dto = buildActorResultDto([
      result("Cozy Bear target: Fjord Energy AS\nsector: energy\ncountry: Norway\nused phishing and Cobalt Strike from https://new.example.com exploiting CVE-2025-12345.", "2026-05-20T00:00:00.000Z", "Recent APT29"),
      result("APT29 target: Alpine Bank Corp\nsector: finance\ncountry: United States\nused credential dumping from https://older.example.com.", "2025-01-01T00:00:00.000Z", "Historical APT29")
    ], {
      actor: "APT29",
      aliases: ["cozy bear", "nobelium"],
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 180
    });

    expect(dto.actor.value).toBe("APT29");
    expect(dto.aliases).toContain("cozy bear");
    expect(dto.graph.nodes.filter((node) => node.type === "actor" && node.value === "APT29")).toHaveLength(1);
    expect(dto.rankings["recent-activity"][0]?.lastSeenAt).toBe("2026-05-20T00:00:00.000Z");
    expect(dto.rankings["supported-target"].some((item) => item.label === "Fjord Energy AS")).toBe(true);
    expect(dto.rankings["target-sector"].some((item) => item.label.toLowerCase() === "energy")).toBe(true);
    expect(dto.rankings["target-region"].some((item) => item.label.toLowerCase() === "norway")).toBe(true);
    expect(dto.rankings["confident-ttp"].some((item) => item.label === "phishing")).toBe(true);
    expect(dto.rankings["malware-tooling"].some((item) => item.label === "cobalt strike")).toBe(true);
    expect(dto.rankings.cve.some((item) => item.label === "CVE-2025-12345")).toBe(true);
    expect(dto.rankings["emerging-infrastructure"].some((item) => item.label.includes("new.example.com"))).toBe(true);
    expect(dto.rankings["stale-context"].some((item) => item.stale)).toBe(true);
  });

  test("extracts ransomware source rows into victim tool TTP infrastructure and alertable graph facts", () => {
    const dto = buildActorResultDto([
      result(
        "Akira ransomware claimed victim Fjord Energy AS in the energy sector in Norway. Operators used AnyDesk, Rclone, and valid accounts from https://akira-cdn.example.com for data theft.",
        "2026-05-23T00:00:00.000Z",
        "Akira public advisory"
      )
    ], {
      actor: "Akira",
      generatedAt: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 7
    });

    expect(dto.actor.value).toBe("Akira");
    expect(dto.rankings["supported-target"].some((item) => item.label === "Fjord Energy AS")).toBe(true);
    expect(dto.rankings["target-sector"].some((item) => item.label.toLowerCase() === "energy")).toBe(true);
    expect(dto.rankings["target-region"].some((item) => item.label.toLowerCase() === "norway")).toBe(true);
    expect(dto.rankings["confident-ttp"].some((item) => item.label === "valid accounts")).toBe(true);
    expect(dto.rankings["confident-ttp"].some((item) => item.label === "data theft")).toBe(true);
    expect(dto.rankings["malware-tooling"].some((item) => item.label === "Akira")).toBe(true);
    expect(dto.rankings["malware-tooling"].some((item) => item.label === "anydesk")).toBe(true);
    expect(dto.rankings["malware-tooling"].some((item) => item.label === "rclone")).toBe(true);
    expect(dto.rankings["emerging-infrastructure"].some((item) => item.label.includes("akira-cdn.example.com"))).toBe(true);
    expect(dto.graph.relationships.every((relationship) => relationship.provenance.length > 0)).toBe(true);
  });

  test("aggregates confidence from repeated support and marks conflicting attribution as contested", () => {
    const dto = buildActorResultDto([
      result("APT29 target: Fjord Energy AS\nsector: energy\ncountry: Norway\nused phishing and Cobalt Strike from https://one.example.com.", "2026-05-20T00:00:00.000Z", "Support one"),
      result("Nobelium target: Fjord Energy AS\nsector: energy\ncountry: Norway\nused phishing and Cobalt Strike from https://two.example.com.", "2026-05-21T00:00:00.000Z", "Support two"),
      result("APT29 and Lazarus target: Fjord Energy AS\nsector: energy\ncountry: Norway\nused phishing.", "2026-05-22T00:00:00.000Z", "Conflicting attribution")
    ], {
      actor: "APT29",
      aliases: ["nobelium"],
      generatedAt: "2026-05-24T00:00:00.000Z"
    });

    const target = dto.rankings["supported-target"].find((item) => item.label === "Fjord Energy AS");
    expect(target?.supportCount).toBeGreaterThan(1);
    expect(target?.confidence).toBeGreaterThan(0.45);
    expect(dto.rankings["contested-claim"].some((item) => item.contested)).toBe(true);
  });

  test("rejects unsupported relationships and keeps STIX expanded export valid", () => {
    const pipelineResult = result("APT29 target: Fjord Energy AS\nsector: energy\ncountry: Norway\nused phishing from https://infra.example.com exploiting CVE-2025-12345.", "2026-05-20T00:00:00.000Z");
    const dto = buildActorResultDto([pipelineResult], {
      actor: "APT29",
      generatedAt: "2026-05-24T00:00:00.000Z"
    });
    const unsupported = dto.graph.relationships.filter((relationship) => relationship.provenance.length === 0);
    const bundle = exportPipelineResultToStixBundle(pipelineResult, {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T00:00:00.000Z"
    });

    expect(unsupported).toHaveLength(0);
    expect(bundle.objects.some((object) => object.type === "intrusion-set")).toBe(true);
    expect(bundle.objects.some((object) => object.type === "observed-data")).toBe(true);
    expect(validateStixBundle(bundle).valid).toBe(true);
  });
});
