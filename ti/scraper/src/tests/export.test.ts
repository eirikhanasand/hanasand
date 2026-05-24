import { describe, expect, test } from "bun:test";
import { mapAttackTechniqueCandidates } from "../export/attack.ts";
import { buildRelationshipGraph, relationshipConfidence } from "../export/relationships.ts";
import { exportEvidenceBackedStixBundle, exportPipelineResultToStixBundle } from "../export/stix.ts";
import { assertValidStixBundle, validateStixBundle } from "../export/stixValidation.ts";
import { STIX_21_MEDIA_TYPE, pageBundleForTaxii, taxiiCollectionDescriptor } from "../export/taxii.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import type { PipelineResult, RawCapture } from "../types.ts";
import { hashContent } from "../utils.ts";

function fixtureResult() {
  const rawText = [
    "APT29 used phishing and credential dumping against a healthcare victim.",
    "The campaign used Cobalt Strike from https://evil.example.com and exploited CVE-2025-12345."
  ].join(" ");

  return processCollectedItem({
    sourceId: "src_report",
    url: "https://example.test/apt29-report",
    collectedAt: "2026-05-24T10:00:00.000Z",
    title: "APT29 report",
    rawText,
    contentHash: hashContent(rawText),
    links: [],
    metadata: { fixture: true },
    sensitive: false
  });
}

describe("exchange exports", () => {
  test("maps ATT&CK candidates only when evidence provenance exists", () => {
    const techniques = mapAttackTechniqueCandidates(fixtureResult());

    expect(techniques.some((technique) => technique.attackId === "T1566")).toBe(true);
    expect(techniques.every((technique) => technique.provenance.length > 0)).toBe(true);
  });

  test("builds evidence-backed actor, TTP, indicator, and incident relationships", () => {
    const graph = buildRelationshipGraph(fixtureResult());

    expect(graph.nodes.some((node) => node.type === "actor" && node.value === "APT29")).toBe(true);
    expect(graph.relationships.some((relationship) => relationship.type === "uses")).toBe(true);
    expect(graph.relationships.every((relationship) => relationship.provenance.length > 0)).toBe(true);
    expect(graph.relationships.some((relationship) => relationship.properties?.confidenceRule === "actor-uses-malware")).toBe(true);
  });

  test("exports a STIX 2.1-like bundle with confidence and provenance custom fields", () => {
    const bundle = exportPipelineResultToStixBundle(fixtureResult(), {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T10:05:00.000Z",
      tenantId: "tenant_global"
    });

    expect(bundle.type).toBe("bundle");
    expect(validateStixBundle(bundle).valid).toBe(true);
    expect(() => assertValidStixBundle(bundle)).not.toThrow();
    expect(bundle.objects.some((object) => object.type === "report" && object.x_ti_provenance)).toBe(true);
    expect(bundle.objects.some((object) => object.type === "attack-pattern" && object.external_references?.some((ref) => ref.source_name === "mitre-attack"))).toBe(true);
    expect(bundle.objects.some((object) => object.type === "relationship" && object.x_ti_provenance)).toBe(true);
    expect(bundle.objects.every((object) => object.type === "relationship" ? Boolean(object.source_ref && object.target_ref) : true)).toBe(true);
  });

  test("exports evidence-backed STIX objects directly from live stored captures", () => {
    const body = [
      "APT29 used phishing and credential dumping against Northwind Health Systems in the healthcare sector.",
      "The campaign used Cobalt Strike from https://evil.example.com and exploited CVE-2025-12345.",
      "Indicator 198.51.100.42 was observed in command and control activity."
    ].join(" ");
    const capture: RawCapture = {
      id: "cap_live_stix",
      tenantId: "tenant_global",
      sourceId: "src_live",
      taskId: "task_live",
      url: "https://example.test/live-report?utm_source=x",
      canonicalUrl: "https://example.test/live-report",
      collectedAt: "2026-05-24T10:00:00.000Z",
      contentHash: hashContent(body),
      normalizedTextHash: hashContent(body.toLowerCase()),
      mediaType: "text/plain",
      storageKind: "inline_text",
      body,
      metadata: { title: "Live APT29 report" },
      sensitive: false,
      sensitivityFlags: ["public"],
      provenance: {
        sourceId: "src_live",
        captureId: "cap_live_stix",
        url: "https://example.test/live-report",
        collectedAt: "2026-05-24T10:00:00.000Z",
        contentHash: hashContent(body),
        extractorVersion: "capture-store"
      }
    };

    const bundle = exportEvidenceBackedStixBundle({
      captures: [capture],
      options: {
        producerName: "ti-scraper",
        generatedAt: "2026-05-24T10:05:00.000Z",
        tenantId: "tenant_global",
        bundleKey: "run_live"
      }
    });

    expect(validateStixBundle(bundle).valid).toBe(true);
    expect(bundle.objects.some((object) => object.type === "indicator" && object.name === "ipv4:198.51.100.42")).toBe(true);
    expect(bundle.objects.some((object) => object.type === "vulnerability" && object.name === "CVE-2025-12345")).toBe(true);
    expect(bundle.objects.some((object) => object.type === "intrusion-set" && object.name === "APT29")).toBe(true);
    expect(bundle.objects.some((object) => object.type === "report" && object.object_refs?.length)).toBe(true);
    expect(bundle.objects.some((object) => object.type === "relationship")).toBe(true);
    expect(bundle.objects.every((object) =>
      object.x_ti_provenance ? object.x_ti_provenance.every((item) => item.captureId === "cap_live_stix") : true
    )).toBe(true);
  });

  test("represents metadata-only captures without leaking unavailable bodies", () => {
    const capture: RawCapture = {
      id: "cap_metadata_only",
      sourceId: "src_public_channel",
      url: "https://t.me/public_channel/12",
      collectedAt: "2026-05-24T10:00:00.000Z",
      contentHash: "sha256:metadata",
      mediaType: "application/json",
      storageKind: "metadata_only",
      metadata: { title: "Public channel metadata" },
      sensitive: true,
      sensitivityFlags: ["contains_pii"]
    };

    const bundle = exportEvidenceBackedStixBundle({
      captures: [capture],
      options: {
        producerName: "ti-scraper",
        generatedAt: "2026-05-24T10:05:00.000Z",
        includeMetadataOnlyCaptures: true
      }
    });

    expect(validateStixBundle(bundle).valid).toBe(true);
    const evidence = bundle.objects.find((object) => object.type === "x-ti-evidence");
    expect(evidence).toBeDefined();
    expect(evidence?.x_ti_extractable).toBe(false);
    expect(JSON.stringify(bundle)).not.toContain("body");
  });

  test("catches invalid STIX-like objects before export consumers receive them", () => {
    const bundle = exportPipelineResultToStixBundle(fixtureResult(), {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T10:05:00.000Z"
    });
    const relationship = bundle.objects.find((object) => object.type === "relationship");
    expect(relationship).toBeDefined();
    if (relationship) relationship.target_ref = "malware--00000000-0000-0000-0000-000000000000";

    const validation = validateStixBundle(bundle);
    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.path.includes("target_ref"))).toBe(true);
    expect(() => assertValidStixBundle(bundle)).toThrow("Invalid STIX bundle");
  });

  test("applies explicit relationship confidence rules", () => {
    expect(relationshipConfidence("actor-targets-victim", 0.8, 0.6)).toBeCloseTo(0.574, 3);
    expect(relationshipConfidence("actor-uses-malware", 0.8, 0.6)).toBeCloseTo(0.616, 3);
    expect(relationshipConfidence("actor-exploits-cve", 0.8, 0.9)).toBeCloseTo(0.714, 3);
    expect(relationshipConfidence("indicator-indicates-incident", 0.9, 0.7)).toBeCloseTo(0.72, 3);
  });

  test("omits relationships when either side lacks provenance", () => {
    const result = fixtureResult();
    const actor = result.entities.find((entity) => entity.type === "actor");
    const malware = result.entities.find((entity) => entity.type === "malware");
    const ttp = result.entities.find((entity) => entity.type === "ttp");
    expect(actor).toBeDefined();
    expect(malware).toBeDefined();

    const withoutActorProvenance: PipelineResult = {
      ...result,
      entities: result.entities.map((entity) => entity === actor ? { ...entity, provenance: [] } : entity)
    };
    const graph = buildRelationshipGraph(withoutActorProvenance);
    const actorNode = graph.nodes.find((node) => node.type === "actor" && node.value === "APT29");
    const malwareNode = graph.nodes.find((node) => node.type === "malware" && node.value === "cobalt strike");
    expect(actorNode).toBeDefined();
    expect(malwareNode).toBeDefined();
    expect(graph.relationships.some((relationship) =>
      relationship.type === "uses"
      && relationship.sourceRef === actorNode?.id
      && relationship.targetRef === malwareNode?.id
    )).toBe(false);

    const withoutTtpProvenance: PipelineResult = {
      ...result,
      entities: result.entities.map((entity) => entity === ttp ? { ...entity, provenance: [] } : entity)
    };
    const ttpGraph = buildRelationshipGraph(withoutTtpProvenance);
    expect(ttpGraph.relationships.every((relationship) => relationship.provenance.length > 0)).toBe(true);
  });

  test("keeps TAXII as a future interface boundary", () => {
    const descriptor = taxiiCollectionDescriptor({
      id: "default",
      title: "Default CTI export",
      canRead: true,
      canWrite: false
    });
    const bundle = exportPipelineResultToStixBundle(fixtureResult(), {
      producerName: "ti-scraper",
      generatedAt: "2026-05-24T10:05:00.000Z"
    });
    const page = pageBundleForTaxii(descriptor.id, bundle);

    expect(descriptor.mediaTypes).toEqual([STIX_21_MEDIA_TYPE]);
    expect(page.collectionId).toBe("default");
    expect(page.more).toBe(false);
    expect(page.objects.length).toBeGreaterThan(0);
  });
});
