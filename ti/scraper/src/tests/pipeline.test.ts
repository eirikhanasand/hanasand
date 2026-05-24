import { describe, expect, test } from "bun:test";
import { actorAliasesFor } from "../pipeline/actorAliases.ts";
import { buildAnalystFeedbackLoopDto } from "../pipeline/analystFeedback.ts";
import { buildAttackMappingQualityDto } from "../pipeline/attackMappingQuality.ts";
import { buildLiveActorIntelligenceDto, buildPublicIntelAnswerDto, fuseActorProfile, type ActorProfileSnapshot } from "../pipeline/actorProfileFusion.ts";
import { buildEntityResolutionWorkbenchDto } from "../pipeline/entityResolution.ts";
import { evaluateExtractionCalibration, evaluateExtractionFixtures } from "../pipeline/evaluation.ts";
import { EXTRACTOR_VERSION } from "../pipeline/extractors.ts";
import { buildActorQueryExtractionProfile, buildLiveTiSearchSummary, buildTiSearchResultDto, extractionProfileKinds, summarizeEvidenceDeltas, type EvidenceStage, type TiConfidenceCaveatCode } from "../pipeline/intelligenceProfiles.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import { analystCaveatPacks, buildSearchQualityApiDto, buildSearchQualityApplyPlan, buildSearchQualityDashboardDto, evaluateSearchQualityGate, searchQualityApiExamples } from "../pipeline/searchQualityGate.ts";
import { buildTimelinessGroundTruthHarnessDto } from "../pipeline/timelinessGroundTruth.ts";
import { hashContent } from "../utils.ts";
import { extractionEvaluationCorpus } from "./fixtures/extraction/corpus.ts";
import { extractionCalibrationCorpus } from "./fixtures/extraction/calibration.ts";
import { extractionCorpus } from "./fixtures/extractionCorpus.ts";
import { liveActorIntelligenceFixtures } from "./fixtures/liveActorIntelligence.ts";

describe("pipeline", () => {
  test("extracts indicators and creates an incident candidate with provenance", () => {
    const rawText = "LockBit ransomware exploited CVE-2025-12345 and used https://evil.example.com payload.";
    const result = processCollectedItem({
      sourceId: "src_test",
      url: "https://example.test/report",
      collectedAt: new Date().toISOString(),
      title: "Threat report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true },
      sensitive: false
    });

    expect(result.capture.sourceId).toBe("src_test");
    expect(result.indicators.some((indicator) => indicator.type === "cve")).toBe(true);
    expect(result.entities.some((entity) => entity.type === "actor")).toBe(true);
    expect(result.incident?.captureId).toBe(result.capture.id);
    expect(result.indicators[0]?.provenance?.[0]).toMatchObject({
      sourceId: "src_test",
      captureId: result.capture.id,
      extractorVersion: EXTRACTOR_VERSION
    });
    expect(result.capture.metadata.extractorVersion).toBe(EXTRACTOR_VERSION);
    expect(result.incident?.extractorVersion).toBe(EXTRACTOR_VERSION);
    expect(result.incident?.reviewReasonDetails?.every((reason) => reason.extractorVersion === EXTRACTOR_VERSION)).toBe(true);
  });

  test("runs the fixture corpus through normalization and extraction", () => {
    for (const fixture of extractionCorpus) {
      const result = processCollectedItem({
        sourceId: `src_${fixture.name.replace(/\W+/g, "_")}`,
        url: `https://example.test/${fixture.name.replace(/\W+/g, "-")}`,
        collectedAt: "2026-05-24T00:00:00.000Z",
        title: fixture.name,
        rawText: fixture.rawText,
        contentHash: hashContent(fixture.rawText),
        language: fixture.language,
        links: [],
        metadata: { fixture: true, ...fixture.metadata },
        sensitive: fixture.sensitive ?? false
      });

      expect(result.capture.metadata.languageHooks).toBeArray();
      expect(result.incident).toBeDefined();
      expect(result.incident?.entities.length ?? 0).toBeGreaterThan(0);
      expect(result.incident?.reviewReasons).toBeArray();
    }
  });

  test("normalizes defanged URLs and preserves uncertainty for weak indicators", () => {
    const rawText = "Akira listed victim: Fjord Energy AS and posted hxxps://leak[.]example[.]onion/path plus 10.0.0.4.";
    const result = processCollectedItem({
      sourceId: "src_sensitive",
      url: "http://exampleonion.onion/post",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "Metadata claim",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { safeExcerpt: "Akira listed Fjord Energy AS." },
      sensitive: true
    });

    expect(result.capture.storageKind).toBe("metadata_only");
    expect(result.capture.body).toBeUndefined();
    expect(result.indicators.some((indicator) => indicator.value.includes("https://leak.example.onion"))).toBe(true);
    expect(result.indicators.some((indicator) => indicator.reviewReasons?.some((reason) => reason.includes("private")))).toBe(true);
    expect(result.entities.some((entity) => entity.type === "victim" && entity.value === "Fjord Energy AS")).toBe(true);
    expect(result.incident?.reviewReasons).toContain("sensitive source metadata only");
  });

  test("normalizes APT29 aliases through the actor alias data file", () => {
    const rawText = "Cozy Bear, also tracked as Midnight Blizzard, used phishing against Northwind Health.";
    const result = processCollectedItem({
      sourceId: "src_alias",
      url: "https://example.test/apt29-alias",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "Alias report",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { fixture: true },
      sensitive: false
    });

    expect(actorAliasesFor("APT29")).toContain("midnight blizzard");
    expect(result.entities.some((entity) => entity.type === "actor" && entity.value === "APT29")).toBe(true);
  });

  test("applies victim guardrails and reports precision-ish fixture counts", () => {
    const report = evaluateExtractionFixtures(extractionEvaluationCorpus);

    expect(report.disclaimer).toContain("not a full extraction benchmark");
    expect(report.fixtureCount).toBe(extractionEvaluationCorpus.length);
    expect(report.matchedCount).toBeGreaterThanOrEqual(report.expectedCount - 3);
    expect(report.fixtures.find((fixture) => fixture.fixtureId === "generic-victim-guardrail")?.unexpected)
      .not.toContain("victim:organizations");
  });

  test("calibrates extraction quality across categories evidence stages and API quality notes", () => {
    const report = evaluateExtractionCalibration(extractionCalibrationCorpus);

    expect(report.disclaimer).toContain("Calibration scores");
    expect(report.fixtureCount).toBe(extractionCalibrationCorpus.length);
    expect(report.categoryScores.find((score) => score.category === "actor")?.recall).toBeGreaterThan(0.7);
    expect(report.categoryScores.find((score) => score.category === "cve")?.f1).toBe(1);
    expect(report.evidenceStageReports.map((stage) => stage.evidenceStage)).toEqual(expect.arrayContaining([
      "live_discovery",
      "captured_page",
      "public_channel_message",
      "metadata_only_claim"
    ]));
    expect(report.falsePositiveExamples.length).toBeGreaterThanOrEqual(0);
    expect(report.falseNegativeExamples.length).toBeGreaterThan(0);
    expect(qualityNoteCodes(report)).toEqual(expect.arrayContaining([
      "low_evidence_count",
      "alias_collision",
      "stale_source",
      "contradicted_attribution",
      "weak_victim_claim",
      "extracted_ttp_needs_review",
      "source_family_bias"
    ]));
  });

  test("builds actor intelligence profiles and /ti search DTOs with temporal context", () => {
    const rawText = [
      "Published May 20, 2026. Microsoft linked Midnight Blizzard to spearphishing against Contoso Research.",
      "First seen 2026-04-12 and last seen 2026-05-18, the campaign Blue Frost used Cobalt Strike,",
      "credential dumping, and infrastructure at https://login.contoso-security[.]com."
    ].join(" ");
    const result = processCollectedItem({
      sourceId: "src_public_material",
      url: "https://example.test/public-apt29",
      collectedAt: "2026-05-24T00:00:00.000Z",
      title: "Public APT29 material",
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { publishedAt: "2026-05-20T10:00:00.000Z" },
      sensitive: false
    });

    const profile = buildActorQueryExtractionProfile("APT29", result);
    const dto = buildTiSearchResultDto("APT29", result);

    expect(extractionProfileKinds()).toContain("ransomware_victim_intelligence");
    expect(extractionProfileKinds()).toContain("attack_ttp");
    expect(profile.canonicalActor).toBe("APT29");
    expect(profile.attribution.signal).toBe("direct_attribution");
    expect(profile.temporal.firstSeenAt).toBe("2026-04-12T00:00:00.000Z");
    expect(profile.temporal.lastSeenAt).toBe("2026-05-18T00:00:00.000Z");
    expect(profile.temporal.freshnessScore).toBeGreaterThan(0.7);
    expect(profile.attackTechniques.every((ttp) => (ttp.provenance?.length ?? 0) > 0)).toBe(true);
    expect(dto.summaryBullets.length).toBeGreaterThan(0);
    expect(dto.targets.victims).toContain("Contoso Research");
    expect(dto.datasets.coverage).toContain("grounded-ttp-observations");
    expect(dto.sources[0]).toMatchObject({ sourceId: "src_public_material" });
    expect(dto.caveats.map((caveat) => caveat.code)).toContain("direct_attribution");
    expect(dto.caveats.every((caveat) => caveat.grounding.length > 0)).toBe(true);
  });

  test("classifies uncertainty signals for disagreement, background, and translation context", () => {
    const cases = [
      { text: "Vendors disputed attribution to FIN7 in this report.", expected: "vendor_disagreement" },
      { text: "Historically, Turla used Snake malware in background reporting.", expected: "historical_background" },
      { text: "Machine translated reporting possibly links Kimsuky to phishing.", expected: "machine_translation_uncertainty" }
    ] as const;

    for (const item of cases) {
      const result = processCollectedItem({
        sourceId: `src_${item.expected}`,
        url: `https://example.test/${item.expected}`,
        collectedAt: "2026-05-24T00:00:00.000Z",
        title: item.expected,
        rawText: item.text,
        contentHash: hashContent(item.text),
        links: [],
        metadata: { fixture: true },
        sensitive: false
      });

      expect(buildActorQueryExtractionProfile(item.text, result).attribution.signal).toBe(item.expected);
    }
  });

  test("summarizes staged live evidence without overstating partial confidence", () => {
    const evidence = [
      stagedResult("scattered-seed", "seeded", "Scattered Spider historically appears in a list of social engineering actors."),
      stagedResult("scattered-live", "live_discovery", "Live discovery snippet: Octo Tempest may be targeting help desks at Example Telecom with sms phishing."),
      stagedResult("scattered-capture", "captured_page", "CrowdStrike linked Scattered Spider to sms phishing against Example Telecom. First seen 2026-05-21.", 0.42, "seeded")
    ];

    const summary = buildLiveTiSearchSummary("Scattered Spider", evidence);

    expect(summary.evidenceStage).toBe("captured_page");
    expect(summary.isPartial).toBe(true);
    expect(summary.needsAnalystReview).toBe(true);
    expect(summary.targets.victims).toContain("Example Telecom");
    expect(summary.ttps).toContain("sms phishing");
    expect(summary.evidenceDeltas?.promoted).toBe(1);
    expect(summary.evidenceDeltas?.changes[0]?.changeKind).toBe("promoted");
    expect(summary.confidence).toBeLessThan(0.8);
    expect(caveatCodes(summary)).toContain("live_snippet_only");
    expect(summary.caveats.every((caveat) => caveat.grounding.every((grounding) => grounding.text.length > 0))).toBe(true);
  });

  test("reports added promoted downgraded and blocked evidence for polling clients", () => {
    const evidence = [
      stagedResult("apt29-added", "live_discovery", "Midnight Blizzard possibly mentioned in a new discovery snippet."),
      stagedResult("apt29-promoted", "reviewed_promoted", "Analyst reviewed and promoted APT29 phishing against Northwind Health.", 0.48, "captured_page"),
      stagedResult("apt29-downgraded", "live_discovery", "Historically APT29 appeared in an unrelated threat actor roundup.", 0.62, "captured_page"),
      stagedResult("apt29-blocked", "metadata_only_claim", "APT29 blocked source metadata-only claim.", undefined, undefined, "restricted source disabled")
    ];

    const deltas = summarizeEvidenceDeltas(evidence);

    expect(deltas.added).toBe(1);
    expect(deltas.promoted).toBe(1);
    expect(deltas.downgraded).toBe(1);
    expect(deltas.blocked).toBe(1);
    expect(deltas.changes.some((change) => change.needsAnalystReview)).toBe(true);
  });

  test("keeps live summaries useful across mixed actor fixtures", () => {
    const cases = [
      stagedResult("volt-live", "live_discovery", "Volt Typhoon live snippet mentions living off the land against Pacific Energy Corp.", 0.4),
      stagedResult("akira-metadata", "metadata_only_claim", "Akira claimed victim: Fjord Energy AS on 2026-05-20.", 0.5),
      stagedResult("apt29-captured", "captured_page", "Nobelium was linked to phishing against Contoso Research with Cobalt Strike.", 0.7),
      stagedResult("noisy-news", "live_discovery", "A noisy news query listed APT29, Volt Typhoon, and Akira historically without new activity.", 0.3)
    ];

    const summary = buildLiveTiSearchSummary("mixed actors", cases);

    expect(summary.datasets.sourceCount).toBe(4);
    expect(summary.targets.victims).toContain("Pacific Energy Corp");
    expect(summary.targets.victims).toContain("Fjord Energy AS");
    expect(summary.targets.victims).toContain("Contoso Research");
    expect(summary.confidenceCaveats.some((note) => note.includes("partial"))).toBe(true);
    expect(summary.sourceCoverageGaps.length).toBeGreaterThan(0);
  });

  test("keeps noisy and copied actor mentions from becoming confident assertions", () => {
    const cases = [
      { id: "noisy-list", text: "Noisy list: APT29, Volt Typhoon, Akira, Scattered Spider, and Turla were named historically.", code: "historical_context" },
      { id: "unrelated-arrest", text: "Police arrested suspects in an unrelated fraud case; articles copied old Scattered Spider background.", code: "historical_context" },
      { id: "copied-news", text: "Copied news snippet says according to researchers APT29 was previously known for phishing, no new activity.", code: "historical_context" }
    ] as const;

    for (const item of cases) {
      const summary = buildTiSearchResultDto(item.id, stagedResult(item.id, "live_discovery", item.text).result);

      expect(summary.confidence).toBeLessThan(0.45);
      expect(summary.needsAnalystReview).toBe(true);
      expect(caveatCodes(summary)).toContain(item.code);
      expect(caveatCodes(summary)).toContain("live_snippet_only");
    }
  });

  test("marks metadata-only and policy-blocked evidence as non-confident review material", () => {
    const summary = buildLiveTiSearchSummary("Akira", [
      stagedResult("akira-meta", "metadata_only_claim", "Akira claimed victim: Example Bank Ltd on 2026-05-22.", undefined, undefined, "restricted source disabled")
    ]);

    expect(summary.confidence).toBeLessThan(0.45);
    expect(summary.needsAnalystReview).toBe(true);
    expect(caveatCodes(summary)).toContain("metadata_only_leak_claim");
    expect(caveatCodes(summary)).toContain("needs_review");
    expect(summary.evidenceDeltas?.blocked).toBe(1);
  });

  test("ranks promoted and captured evidence ahead of discovery and restricted metadata", () => {
    const summary = buildLiveTiSearchSummary("APT29", [
      stagedResult("apt29-discovery", "live_discovery", "APT29 appears in a historical list.", undefined, undefined),
      stagedResult("apt29-metadata", "metadata_only_claim", "APT29 metadata-only claim against Example Bank Ltd.", undefined, undefined, "restricted source disabled"),
      stagedResult("apt29-captured", "captured_page", "Mandiant attributed phishing against Northwind Health to APT29.", undefined, undefined),
      stagedResult("apt29-promoted", "reviewed_promoted", "Analyst reviewed and promoted APT29 phishing against Northwind Health.", 0.5, "captured_page")
    ]);

    expect(summary.evidenceStage).toBe("reviewed_promoted");
    expect(summary.evidenceDeltas?.changes[0]?.changeKind).toBe("promoted");
    expect(summary.caveats.some((caveat) => caveat.code === "metadata_only_leak_claim" && caveat.severity === "critical")).toBe(true);
  });

  test("fuses actor profiles while preserving Scattered Spider and ShinyHunters naming drift", () => {
    const baseline = actorBaseline("Scattered Spider", {
      aliases: ["scattered spider", "octo tempest"],
      confidence: 0.54,
      evidenceIds: ["seed-scattered"]
    });
    const fused = fuseActorProfile({
      query: "Scattered Spider",
      baseline,
      evidence: [
        stagedResult(
          "scattered-shinyhunters",
          "captured_page",
          "CrowdStrike linked Scattered Spider, also known as ShinyHunters by some reporting, to sms phishing against Example Telecom."
        )
      ]
    });

    expect(fused.profile.aliases).toContain("shinyhunters");
    expect(fused.profile.vendorNames).toContain("shinyhunters");
    expect(fused.profile.sourceUncertainty[0]?.caveatCodes).toContain("vendor_reported_attribution");
    expect(deltaKinds(fused)).toContain("new_alias");
    expect(deltaKinds(fused)).toContain("changed_targeting_pattern");
    expect(deltaKinds(fused)).toContain("profile_changed");
  });

  test("distinguishes APT29 historical context from current grounded tradecraft", () => {
    const baseline = actorBaseline("APT29", {
      aliases: ["apt29", "cozy bear"],
      ttps: ["phishing"],
      updatedAt: "2026-05-20T00:00:00.000Z",
      confidence: 0.58
    });
    const historicalOnly = stagedResult("apt29-history", "live_discovery", "Cyber gang list: APT29 historically used phishing in old campaigns.");
    const current = stagedResult("apt29-current", "captured_page", "Mandiant linked APT29 to credential dumping against Northwind Health. First seen 2026-05-22.");
    const fused = fuseActorProfile({ query: "APT29", baseline, evidence: [historicalOnly, current] });

    expect(fused.profile.ttps).toContain("credential dumping");
    expect(fused.profile.targets.victims).toContain("Northwind Health");
    expect(fused.profile.sourceUncertainty.find((source) => source.evidenceId === "apt29-history")?.caveatCodes).toContain("historical_context");
    expect(deltaKinds(fused)).toContain("new_ttp");
    expect(deltaKinds(fused)).toContain("needs_review");
  });

  test("keeps ransomware rebrands and broad gang lists from becoming profile facts without support", () => {
    const baseline = actorBaseline("ALPHV", {
      aliases: ["alphv", "blackcat"],
      confidence: 0.62,
      evidenceIds: ["seed-alphv"]
    });
    const fused = fuseActorProfile({
      query: "ALPHV",
      baseline,
      evidence: [
        stagedResult("ransomware-list", "live_discovery", "Cyber gang list: LockBit, Akira, ALPHV, Clop, and Scattered Spider were named historically."),
        stagedResult("alphv-current", "captured_page", "Researchers linked BlackCat, also tracked as ALPHV, to data exfiltration against Example Retail.")
      ]
    });

    expect(fused.profile.targets.victims).toContain("Example Retail");
    expect(fused.profile.targets.victims).not.toContain("LockBit");
    expect(fused.profile.sourceUncertainty.find((source) => source.evidenceId === "ransomware-list")?.caveatCodes).toContain("historical_context");
    expect(deltaKinds(fused)).toContain("evidence_added");
    expect(deltaKinds(fused)).toContain("changed_targeting_pattern");
  });

  test("emits API-ready actor profile deltas for confidence, stale fields, contradiction, and source spikes", () => {
    const baseline = actorBaseline("FIN7", {
      aliases: ["fin7"],
      targets: { victims: ["Old Bank"], sectors: ["finance"], regions: ["Norway"] },
      ttps: ["phishing"],
      confidence: 0.82,
      updatedAt: "2025-01-01T00:00:00.000Z",
      evidenceIds: ["old-fin7"]
    });
    const fused = fuseActorProfile({
      query: "FIN7",
      baseline,
      now: "2026-05-24T00:00:00.000Z",
      staleAfterDays: 90,
      sourceSpikeThreshold: 2,
      evidence: [
        stagedResult("fin7-disputed-a", "captured_page", "Vendors disputed attribution to FIN7 in the report."),
        stagedResult("fin7-disputed-b", "captured_page", "Conflicting reports linked FIN7 to activity but did not name a victim."),
        stagedResult("fin7-disputed-c", "captured_page", "Different vendors disputed FIN7 attribution.")
      ]
    });

    const kinds = deltaKinds(fused);
    expect(kinds).toContain("profile_changed");
    expect(kinds).toContain("evidence_added");
    expect(kinds).toContain("confidence_changed");
    expect(kinds).toContain("needs_review");
    expect(kinds).toContain("stale_field_removed");
    expect(kinds).toContain("contradiction_detected");
    expect(kinds).toContain("sudden_source_spike");
    expect(fused.deltas.contradictionDetected).toBe(true);
    expect(fused.deltas.staleFieldRemoved).toBe(true);
  });

  test("builds final API-ready live actor intelligence DTOs with provenance and public deltas", () => {
    const baseline = actorBaseline("APT29", {
      aliases: ["apt29", "cozy bear"],
      targets: { victims: [], sectors: ["government"], regions: [] },
      ttps: ["phishing"],
      confidence: 0.2,
      evidenceIds: ["seed-apt29"]
    });
    const dto = buildLiveActorIntelligenceDto({
      query: "APT29",
      baseline,
      evidence: [
        liveFixtureEvidence("apt29-current", 0.42, "live_discovery"),
        stagedResult("apt29-public-channel", "public_channel_message", "Public channel message says APT29 may be phishing against Example Ministry in Norway.", 0.34)
      ]
    });

    expect(dto.actor).toBe("APT29");
    expect(dto.aliases).toContain("midnight blizzard");
    expect(dto.targets.victims).toContain("Northwind Health");
    expect(dto.targets.sectors).toContain("government");
    expect(dto.targets.regions).toContain("Norway");
    expect(dto.ttps).toContain("credential dumping");
    expect(dto.infrastructure).toContain("https://login-northwind.example.com");
    expect(dto.vulnerabilities).toContain("CVE-2026-11111");
    expect(dto.datasets.evidenceStageCounts.captured_page).toBe(1);
    expect(dto.datasets.evidenceStageCounts.public_channel_message).toBe(1);
    expect(dto.provenance.every((item) => item.evidenceId && item.sourceId && item.grounding.length > 0)).toBe(true);
    expect(publicDeltaKinds(dto)).toContain("new_evidence");
    expect(publicDeltaKinds(dto)).toContain("changed_confidence");
    expect(publicDeltaKinds(dto)).toContain("new_target_sector");
    expect(publicDeltaKinds(dto)).toContain("new_target_country");
    expect(publicDeltaKinds(dto)).toContain("added_ttp");
    expect(publicDeltaKinds(dto)).toContain("needs_review");
  });

  test("builds per-field actor readiness across runtime evidence stages and downgrades", () => {
    const ready = buildLiveActorIntelligenceDto({
      query: "APT29",
      baseline: actorBaseline("APT29", {
        aliases: ["apt29", "cozy bear"],
        targets: { victims: [], sectors: ["government"], regions: [] },
        confidence: 0.7,
        evidenceIds: ["seed-apt29"]
      }),
      evidence: [
        stagedResult("apt29-q-clear-web", "captured_page", "Microsoft linked Midnight Blizzard to credential dumping against Northwind Health in the healthcare sector in Norway using Cobalt Strike and CVE-2026-11111. First seen 2026-05-22. Infrastructure observed on 2026-05-22 at https://login-northwind.example.com."),
        stagedResult("apt29-q-promoted", "reviewed_promoted", "Analyst reviewed and promoted APT29 phishing against Northwind Health in Norway. First seen 2026-05-22."),
        stagedResult("apt29-q-graph", "extracted_relationship", "Graph relationship: APT29 attributed to credential dumping against Northwind Health in Norway. First seen 2026-05-22.")
      ]
    });
    const downgraded = buildLiveActorIntelligenceDto({
      query: "Akira",
      baseline: actorBaseline("Akira", { aliases: ["akira"], confidence: 0.6 }),
      evidence: [
        stagedResult("akira-q-restricted", "metadata_only_claim", "Akira claimed victim: Fjord Energy AS on 2026-05-20."),
        stagedResult("akira-q-overlap", "captured_page", "Cyber gang list: Akira, LockBit, ALPHV, and BlackCat were named historically in a ransomware rebrand roundup."),
        stagedResult("akira-q-public", "public_channel_message", "Public channel message says Akira may have listed a victim but no corroborating source is available.")
      ]
    });
    const random = buildLiveActorIntelligenceDto({
      query: "Crimson Pineapple",
      evidence: [liveFixtureEvidence("unknown-random")]
    });

    expect(ready.readiness.sourceFamilyCount).toBe(3);
    expect(ready.readiness.fields.victims.status).toBe("fact");
    expect(ready.readiness.fields.ttps.status).toBe("fact");
    expect(ready.readiness.fields.malware_tools.status).toBe("fact");
    expect(ready.readiness.fields.vulnerabilities.status).toBe("fact");
    expect(ready.readiness.fields.infrastructure.status).toBe("fact");
    expect(ready.readiness.fields.datasets.evidenceIds.length).toBeGreaterThanOrEqual(3);

    expect(downgraded.readiness.overall).toBe("needs_review");
    expect(downgraded.readiness.fields.victims.status).toBe("needs_review");
    expect(downgraded.readiness.fields.aliases.status).toBe("needs_review");
    expect(downgraded.readiness.downgradeReasons).toEqual(expect.arrayContaining([
      "unsupported restricted metadata requires analyst review",
      "alias collision or ransomware overlap requires analyst review",
      "public-channel evidence needs corroboration"
    ]));
    expect(downgraded.falsePositiveControls).toContain("broad list page suppressed as profile fact source");
    expect(downgraded.readiness.evidenceStageCounts.metadata_only_claim).toBe(1);
    expect(downgraded.readiness.evidenceStageCounts.public_channel_message).toBe(1);

    expect(random.readiness.overall).not.toBe("fact");
    expect(random.readiness.fields.summary.status).toBe("partial_evidence");
    expect(random.falsePositiveControls).toContain("partial or historical evidence did not support profile facts");
  });

  test("freezes public intelligence answer contract with operational downgrade reasons", () => {
    const ready = buildPublicIntelAnswerDto(buildLiveActorIntelligenceDto({
      query: "APT29",
      evidence: [
        stagedResult("apt29-answer-ready-a", "reviewed_promoted", "Mandiant linked APT29 to credential dumping against Northwind Health in the healthcare sector during campaign Blue Frost. First seen 2026-05-22.", undefined, undefined, undefined, {
          evidenceLedgerId: "ledger_apt29_ready_a"
        }),
        stagedResult("apt29-answer-ready-b", "extracted_relationship", "Graph relationship: APT29 attributed to phishing against Northwind Health in Norway. Last seen 2026-05-23.", undefined, undefined, undefined, {
          ledgerIds: ["ledger_apt29_graph_b"]
        })
      ]
    }), { status: "ready", score: 0.88, publicWarningCodes: ["direct_attribution"], publicWarningText: ["ready for public answer"] });
    const partial = buildPublicIntelAnswerDto(buildLiveActorIntelligenceDto({
      query: "Random Actor",
      evidence: [
        stagedResult("random-answer-partial", "live_discovery", "Random Actor appears in a search result snippet without attributed activity."),
        stagedResult("random-answer-stale", "captured_page", "Historically Random Actor was named in old reporting.", undefined, undefined)
      ]
    }), { status: "partial", score: 0.32, publicWarningCodes: ["weak-evidence"], publicWarningText: ["weak evidence"] });
    const blocked = buildPublicIntelAnswerDto(buildLiveActorIntelligenceDto({
      query: "Akira",
      evidence: [
        stagedResult("akira-answer-restricted", "metadata_only_claim", "Akira claimed victim: Fjord Energy AS on 2026-05-20."),
        stagedResult("akira-answer-ledger", "public_channel_message", "Public channel message says Akira may have posted a victim claim.", undefined, undefined, undefined, {
          evidenceLedgerIds: ["ledger_akira_public_channel"],
          evidenceTrustLedger: "degraded",
          sourceSlo: "missed",
          publicChannelReliability: "low",
          publicChannelRuntimeStatus: "high_churn",
          publicChannelPromotionYield: "low",
          restrictedMetadataCompliance: "blocked",
          graphExportReadiness: "blocked"
        })
      ]
    }), { status: "needs-review", score: 0.18, publicWarningCodes: ["metadata_only_leak_claim"], publicWarningText: ["needs review"] });

    expect(ready.status).toBe("fact");
    expect(ready.summary.length).toBeGreaterThan(0);
    expect(ready.victims).toContain("Northwind Health");
    expect(ready.timeline.length).toBeGreaterThan(0);
    expect(ready.provenanceNotes.every((note) => !note.includes("https://"))).toBe(true);
    expect(ready.claims.map((claim) => claim.kind)).toEqual(expect.arrayContaining([
      "actor",
      "campaign",
      "victim",
      "sector",
      "region",
      "ttp",
      "dataset",
      "timeline"
    ]));
    expect(ready.claims.find((claim) => claim.kind === "campaign")?.value).toBe("Blue Frost");
    expect(ready.claims.every((claim) => claim.confidence >= 0 && claim.confidence <= 1)).toBe(true);
    expect(ready.claims.every((claim) => claim.extractionVersion === "ti-basic-extractor-v1")).toBe(true);
    expect(ready.claims.every((claim) => claim.ledgerIds.length > 0)).toBe(true);
    expect(ready.claims.some((claim) => claim.ledgerIds.includes("ledger_apt29_ready_a"))).toBe(true);
    expect(ready.claims.some((claim) => claim.ledgerIds.includes("ledger_apt29_graph_b"))).toBe(true);
    expect(ready.claims.every((claim) => claim.sourceFamilySupport.length > 0)).toBe(true);
    expect(ready.claims.every((claim) => claim.freshness.score >= 0 && claim.freshness.score <= 1)).toBe(true);
    expect(ready.claims.every((claim) => Array.isArray(claim.caveatCodes) && Array.isArray(claim.downgradeReasons))).toBe(true);
    expect(ready.claims.every((claim) => ["not_required", "recommended", "required"].includes(claim.analystReviewState))).toBe(true);
    expect(ready.claims.find((claim) => claim.kind === "actor")?.status).toBe("fact");
    expect(ready.reviewGates.every((gate) => gate.requiredForReady === false)).toBe(true);
    expect(ready.deltas.map((delta) => delta.kind)).toEqual(expect.arrayContaining(["new", "promoted"]));
    expect(ready.readinessSla).toMatchObject({
      status: "ready",
      graphState: { status: "ready" },
      sourceSla: { status: "met" },
      schedulerState: { status: "normal" },
      publicChannelSla: { status: "none" },
      restrictedMetadataSla: { status: "none" }
    });
    expect(ready.readinessSla.evidenceFamilySupport.ledgerIds).toEqual(expect.arrayContaining(["ledger_apt29_ready_a", "ledger_apt29_graph_b"]));
    expect(ready.readinessSla.confidence).toBeGreaterThan(0);
    expect(ready.promotionPolicy).toMatchObject({
      state: "ready",
      canPromote: true,
      publicStatus: "ready"
    });
    expect(ready.promotionPolicy.rules.every((rule) => rule.state === "pass" || rule.state === "warning")).toBe(true);
    expect(ready.analystFusion).toMatchObject({
      queryClass: "actor",
      answerState: "ready",
      targetSectors: expect.arrayContaining(["healthcare"]),
      targetRegions: expect.arrayContaining(["Norway"]),
      liveCollectionWaitingFor: []
    });
    expect(ready.analystFusion.firstSeen).toBe("2026-05-22T00:00:00.000Z");
    expect(ready.analystFusion.lastSeen).toBe("2026-05-23T00:00:00.000Z");
    expect(ready.analystFusion.recentAttacks.some((attack) => attack.victim === "Northwind Health")).toBe(true);
    expect(ready.analystFusion.claims.every((claim) => claim.ledgerIds.length > 0 && claim.provenance.length > 0 && claim.graphExportState === "ready")).toBe(true);
    expect(ready.analystFusion.changed.map((item) => item.field)).toEqual(expect.arrayContaining(["victims", "ttps", "timeline"]));
    expect(ready.publicContract).toMatchObject({
      schemaVersion: "ti.public_answer_contract.v1",
      queryClass: "actor",
      state: "ready",
      displayState: "ready",
      noResult: false,
      graphStixReadiness: {
        state: "ready",
        readyForDefaultExport: true
      },
      safeWording: {
        overstatesLiveSnippets: false,
        rawEvidenceExposed: false,
        restrictedPayloadsExposed: false
      }
    });
    expect(ready.publicContract.safeSummary.length).toBeGreaterThan(0);
    expect(ready.publicContract.evidenceLedgerReferences.every((ref) => ref.ledgerIds.length > 0 && ref.provenance.length > 0)).toBe(true);
    expect(ready.publicContract.nextPoll.cursorRequired).toBe(true);

    expect(partial.status).toBe("partial_evidence");
    expect(partial.warningCodes).toContain("weak-evidence");
    expect(partial.warnings.join(" ")).toContain("partial");
    expect(partial.claims.every((claim) => claim.status !== "fact")).toBe(true);
    expect(partial.reviewGates.some((gate) => gate.requiredReviews.includes("attribution"))).toBe(true);
    expect(partial.deltas.map((delta) => delta.kind)).toContain("downgraded");
    expect(partial.readinessSla.status).toBe("review_required");
    expect(partial.readinessSla.explanations.map((item) => item.code)).toEqual(expect.arrayContaining([
      "missing_captures",
      "weak_evidence",
      "review_required_claims"
    ]));
    expect(partial.promotionPolicy.canPromote).toBe(false);
    expect(partial.promotionPolicy.rules.map((rule) => rule.code)).toEqual(expect.arrayContaining([
      "ready_support",
      "claim_ledger",
      "review_gate"
    ]));
    expect(partial.promotionPolicy.caveats.map((item) => item.code)).toEqual(expect.arrayContaining([
      "missing_captures",
      "weak_evidence"
    ]));
    expect(partial.promotionPolicy.pollableDeltas.map((delta) => delta.pollReason)).toContain("quality_hold");
    expect(partial.analystFusion.answerState).toBe("review_required");
    expect(partial.analystFusion.sourceBias.missingSourceFamily).toBe(false);
    expect(partial.analystFusion.liveCollectionWaitingFor.map((item) => item.code)).toEqual(expect.arrayContaining([
      "capture_promotion",
      "restricted_metadata_review"
    ]));
    expect(partial.publicContract.displayState).toBe("review_required");
    expect(partial.publicContract.safeSummary[0]).toContain("Partial");
    expect(partial.publicContract.waitReasons.map((item) => item.code)).toContain("capture_promotion");

    expect(blocked.status).toBe("needs_review");
    expect(blocked.readiness.downgradeReasons).toEqual(expect.arrayContaining([
      "evidence trust ledger downgraded this claim",
      "source SLO missed freshness or reliability target",
      "public-channel reliability is low",
      "public-channel runtime status is high_churn",
      "public-channel promotion yield is low",
      "restricted metadata compliance blocks promotion",
      "graph export readiness blocks fact promotion"
    ]));
    expect(blocked.warningCodes).toContain("metadata_only_leak_claim");
    expect(blocked.claims.some((claim) => claim.ledgerIds.includes("ledger_akira_public_channel"))).toBe(true);
    expect(blocked.claims.every((claim) => claim.analystReviewState !== "not_required")).toBe(true);
    expect(blocked.reviewGates.map((gate) => gate.requiredReviews).flat()).toEqual(expect.arrayContaining([
      "victim_claim",
      "restricted_metadata",
      "public_channel",
      "graph_hold"
    ]));
    expect(blocked.deltas.map((delta) => delta.kind)).toContain("review_required");
    expect(blocked.readinessSla.status).toBe("blocked");
    expect(blocked.readinessSla.graphState.status).toBe("hold");
    expect(blocked.readinessSla.sourceSla.status).toBe("missed");
    expect(blocked.readinessSla.publicChannelSla.status).toBe("unstable");
    expect(blocked.readinessSla.restrictedMetadataSla.status).toBe("blocked");
    expect(blocked.readinessSla.explanations.map((item) => item.code)).toEqual(expect.arrayContaining([
      "public_channel_instability",
      "restricted_only_evidence",
      "graph_hold",
      "review_required_claims"
    ]));
    expect(blocked.promotionPolicy).toMatchObject({
      state: "blocked",
      canPromote: false,
      publicStatus: "blocked"
    });
    expect(blocked.promotionPolicy.rules.find((rule) => rule.code === "restricted_metadata_sla")?.state).toBe("block");
    expect(blocked.promotionPolicy.rules.find((rule) => rule.code === "graph_export_state")?.state).toBe("hold");
    expect(blocked.promotionPolicy.pollableDeltas.map((delta) => delta.pollReason)).toContain("review_required");
    expect(blocked.analystFusion.queryClass).toBe("ransomware");
    expect(blocked.analystFusion.contradictionHandling.holdReadyPromotion).toBe(false);
    expect(blocked.analystFusion.claims.some((claim) => claim.kind === "victim" && claim.graphExportState === "hold")).toBe(true);
    expect(blocked.analystFusion.liveCollectionWaitingFor.map((item) => item.code)).toEqual(expect.arrayContaining([
      "restricted_metadata_review",
      "public_channel_corroboration",
      "graph_review"
    ]));
  });

  test("applies final public answer promotion policy across actor CVE victim and unknown fixtures", () => {
    const answer = (
      query: string,
      evidence: ReturnType<typeof stagedResult>[],
      quality: Parameters<typeof buildPublicIntelAnswerDto>[1] = { status: "partial", score: 0.5 }
    ) => buildPublicIntelAnswerDto(buildLiveActorIntelligenceDto({ query, evidence }), quality);

    const readyApt29 = answer("APT29", [
      stagedResult("apt29-policy-ready-a", "reviewed_promoted", "Mandiant linked APT29 to phishing against Northwind Health in healthcare. First seen 2026-05-22.", undefined, undefined, undefined, { evidenceLedgerId: "ledger_policy_apt29_a" }),
      stagedResult("apt29-policy-ready-b", "extracted_relationship", "Graph relationship: APT29 attributed to credential dumping against Northwind Health in Norway. Last seen 2026-05-23.", undefined, undefined, undefined, { evidenceLedgerId: "ledger_policy_apt29_b" })
    ], { status: "ready", score: 0.9, publicWarningText: ["ready for public answer"], publicWarningCodes: ["direct_attribution"] });
    const scatteredSourceBiased = answer("Scattered Spider", [
      stagedResult("scattered-policy-single", "reviewed_promoted", "CrowdStrike linked Scattered Spider to sms phishing against Example Telecom in telecommunications. First seen 2026-05-23.")
    ], { status: "ready", score: 0.8 });
    const voltContradicted = answer("Volt Typhoon", [
      stagedResult("volt-policy-contradicted", "captured_page", "Vendors disputed attribution to Volt Typhoon but mentioned living off the land against Pacific Energy Corp.")
    ]);
    const akiraBlockedVictim = answer("Akira", [
      stagedResult("akira-policy-blocked", "metadata_only_claim", "Akira claimed victim: Fjord Energy AS on 2026-05-20.", undefined, undefined, undefined, {
        restrictedMetadataCompliance: "blocked",
        graphExportReadiness: "blocked"
      })
    ], { status: "needs-review", score: 0.25, publicWarningCodes: ["metadata_only_leak_claim"] });
    const turlaStale = answer("Turla", [
      stagedResult("turla-policy-stale", "captured_page", "Researchers linked Turla to Snake malware against Example Embassy. Last seen 2024-01-01.")
    ]);
    const cveReview = answer("APT29", [
      stagedResult("cve-policy-review", "captured_page", "Microsoft linked APT29 to phishing against Northwind Health using CVE-2026-11111.")
    ]);
    const unknown = buildPublicIntelAnswerDto(buildLiveActorIntelligenceDto({
      query: "Crimson Pineapple",
      evidence: [liveFixtureEvidence("unknown-random")]
    }));

    expect(readyApt29.promotionPolicy.state).toBe("ready");
    expect(readyApt29.promotionPolicy.canPromote).toBe(true);
    expect(readyApt29.analystFusion.answerState).toBe("ready");
    expect(scatteredSourceBiased.promotionPolicy.state).toBe("source_biased");
    expect(scatteredSourceBiased.promotionPolicy.caveats.map((item) => item.code)).toContain("source_bias");
    expect(scatteredSourceBiased.analystFusion.sourceBias.missingSourceFamily).toBe(true);
    expect(voltContradicted.promotionPolicy.state).toBe("contradicted");
    expect(voltContradicted.promotionPolicy.caveats.map((item) => item.code)).toContain("contradicted_answer");
    expect(voltContradicted.analystFusion.contradictionHandling.contradicted).toBe(true);
    expect(akiraBlockedVictim.promotionPolicy.state).toBe("blocked");
    expect(akiraBlockedVictim.promotionPolicy.rules.find((rule) => rule.code === "restricted_metadata_sla")?.state).toBe("block");
    expect(turlaStale.promotionPolicy.state).toBe("stale");
    expect(turlaStale.promotionPolicy.caveats.map((item) => item.code)).toContain("stale_answer");
    expect(turlaStale.analystFusion.staleEvidence.stale).toBe(true);
    expect(cveReview.reviewGates.map((gate) => gate.requiredReviews).flat()).toContain("cve_exploitation");
    expect(cveReview.analystFusion.queryClass).toBe("cve");
    expect(cveReview.promotionPolicy.canPromote).toBe(false);
    expect(unknown.promotionPolicy.canPromote).toBe(false);
    expect(unknown.analystFusion.queryClass).toBe("unknown");
    expect(unknown.promotionPolicy.rules.find((rule) => rule.code === "ready_support")?.state).toBe("hold");
    for (const item of [readyApt29, scatteredSourceBiased, voltContradicted, akiraBlockedVictim, turlaStale, cveReview, unknown]) {
      expect(item.promotionPolicy.rules.map((rule) => rule.code)).toEqual(expect.arrayContaining([
        "ready_support",
        "source_sla",
        "scheduler_sla",
        "public_channel_sla",
        "restricted_metadata_sla",
        "graph_export_state",
        "claim_ledger",
        "freshness",
        "contradiction",
        "review_gate"
      ]));
      expect(["ready", "partial", "review_required", "blocked", "stale", "contradicted", "source_biased"]).toContain(item.promotionPolicy.state);
      expect(item.promotionPolicy.pollableDeltas.every((delta) => delta.nextPollAfterSeconds > 0)).toBe(true);
      expect(item.analystFusion.pollableDeltas).toEqual(item.promotionPolicy.pollableDeltas);
      expect(item.analystFusion.claims.every((claim) => claim.ledgerIds.length > 0 && claim.evidenceIds.length > 0)).toBe(true);
    }
  });

  test("applies live actor fixtures across expected actor families and unknowns", () => {
    const byQuery = new Map(liveActorIntelligenceFixtures.map((fixture) => [fixture.query, fixture]));
    for (const query of ["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "MuddyWater", "ShinyHunters", "Crimson Pineapple"]) {
      expect(byQuery.has(query)).toBe(true);
    }

    const turla = buildLiveActorIntelligenceDto({ query: "Turla", evidence: [liveFixtureEvidence("turla-current")] });
    const muddyWater = buildLiveActorIntelligenceDto({ query: "MuddyWater", evidence: [liveFixtureEvidence("muddywater-current")] });
    const unknown = buildLiveActorIntelligenceDto({ query: "Crimson Pineapple", evidence: [liveFixtureEvidence("unknown-random")] });
    const shinyHunters = buildLiveActorIntelligenceDto({ query: "ShinyHunters", evidence: [liveFixtureEvidence("shinyhunters-drift")] });

    expect(turla.malwareTools).toContain("snake");
    expect(turla.infrastructure).toContain("https://snake-c2.example.net");
    expect(muddyWater.actor).toBe("MuddyWater");
    expect(muddyWater.aliases).toEqual(expect.arrayContaining(["seedworm", "static kitten"]));
    expect(muddyWater.targets.sectors).toContain("government");
    expect(muddyWater.malwareTools).toContain("powgoop");
    expect(shinyHunters.actor).toBe("ShinyHunters");
    expect(shinyHunters.aliases).toContain("shinyhunters");
    expect(unknown.confidence).toBeLessThan(0.45);
    expect(unknown.falsePositiveControls).toContain("partial or historical evidence did not support profile facts");
    expect(unknown.targets.victims).toEqual([]);
    expect(unknown.needsAnalystReview).toBe(true);
  });

  test("suppresses alias collisions marketing pages unrelated CVEs and ransomware rebrand overlap in live DTOs", () => {
    const dto = buildLiveActorIntelligenceDto({
      query: "Akira",
      baseline: actorBaseline("Akira", { aliases: ["akira"], confidence: 0.6 }),
      evidence: [
        stagedResult("akira-marketing", "captured_page", "Vendor marketing webinar: download our report about Akira, LockBit, and Clop trends against Everyone Corp."),
        stagedResult("akira-cve", "captured_page", "Unrelated CVE article: CVE-2026-22222 affects a firewall. No actor attribution is included."),
        stagedResult("akira-rebrand-overlap", "captured_page", "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup."),
        liveFixtureEvidence("akira-current")
      ]
    });

    expect(dto.targets.victims).toContain("Fjord Energy AS");
    expect(dto.targets.victims).not.toContain("Everyone Corp");
    expect(dto.vulnerabilities).not.toContain("CVE-2026-22222");
    expect(dto.falsePositiveControls).toContain("vendor marketing page suppressed as profile fact source");
    expect(dto.falsePositiveControls).toContain("unrelated CVE article suppressed because actor attribution was not grounded");
    expect(dto.falsePositiveControls).toContain("broad list page suppressed as profile fact source");
    expect(dto.falsePositiveControls).toContain("actor alias collision or ransomware rebrand overlap needs review");
  });

  test("gates live actor search quality with calibration caveats and graph review state", () => {
    const calibration = evaluateExtractionCalibration(extractionCalibrationCorpus);
    const contradicted = buildLiveActorIntelligenceDto({
      query: "Volt Typhoon",
      evidence: [
        stagedResult("volt-contradicted", "public_channel_message", "Public channel message: Vendors disputed attribution to Volt Typhoon but mentioned living off the land against Pacific Energy Corp.")
      ]
    });
    const stale = buildLiveActorIntelligenceDto({
      query: "Turla",
      evidence: [
        stagedResult("turla-stale-gate", "captured_page", "Researchers linked Turla to Snake malware against Example Embassy.", undefined, undefined)
      ]
    });
    stale.caveats.push({
      code: "stale",
      label: "Stale evidence",
      severity: "warning",
      reason: "fixture forced stale caveat",
      grounding: stale.provenance[0]?.grounding ?? []
    });
    const akira = buildLiveActorIntelligenceDto({
      query: "Akira",
      evidence: [liveFixtureEvidence("akira-current")]
    });

    expect(evaluateSearchQualityGate({ dto: contradicted, calibration, graphReviewState: "contradiction" }).status).toBe("contradicted");
    expect(evaluateSearchQualityGate({ dto: stale, calibration, graphReviewState: "stale" }).status).toBe("stale");
    const akiraGate = evaluateSearchQualityGate({ dto: akira, calibration });
    expect(akiraGate.status).toBe("source-biased");
    expect(akiraGate.supportingStatuses).toEqual(expect.arrayContaining(["insufficient-capture", "needs-review"]));
    expect(akiraGate.apiWarnings.some((warning) => warning.code === "weak_victim_claim")).toBe(true);
  });

  test("keeps weak snippet-only actor search partial until stronger evidence improves it", () => {
    const weak = buildLiveActorIntelligenceDto({
      query: "Crimson Pineapple",
      evidence: [liveFixtureEvidence("unknown-random")]
    });
    const improved = buildLiveActorIntelligenceDto({
      query: "Scattered Spider",
      evidence: [
        liveFixtureEvidence("unknown-random"),
        liveFixtureEvidence("scattered-spider-current")
      ]
    });
    const weakGate = evaluateSearchQualityGate({ dto: weak });
    const improvedGate = evaluateSearchQualityGate({ dto: improved, graphReviewState: "accepted" });

    expect(weakGate.status).toBe("partial");
    expect(weakGate.supportingStatuses).toEqual(expect.arrayContaining(["partial", "weak-evidence", "insufficient-capture"]));
    expect(improvedGate.supportingStatuses).not.toContain("insufficient-capture");
    expect(improvedGate.score).toBeGreaterThan(weakGate.score);
  });

  test("provides analyst caveat packs for named and unknown actor searches", () => {
    const packs = analystCaveatPacks();
    const actors = packs.map((pack) => pack.actor);

    expect(actors).toEqual(expect.arrayContaining(["APT29", "Scattered Spider", "Volt Typhoon", "Turla", "Akira", "MuddyWater", "ShinyHunters", "Unknown actor"]));
    expect(packs.find((pack) => pack.actor === "Scattered Spider")?.reviewFocus).toContain("alias collision");
    expect(packs.find((pack) => pack.actor === "Unknown actor")?.caveats.some((caveat) => caveat.includes("Snippet-only"))).toBe(true);
  });

  test("builds analyst apply plans for weak partial contradicted stale and alias-collision quality findings", () => {
    const weak = buildLiveActorIntelligenceDto({
      query: "Crimson Pineapple",
      evidence: [liveFixtureEvidence("unknown-random")]
    });
    const contradicted = buildLiveActorIntelligenceDto({
      query: "Volt Typhoon",
      evidence: [stagedResult("volt-apply-contradicted", "public_channel_message", "Vendors disputed attribution to Volt Typhoon but mentioned living off the land.")]
    });
    const stale = buildLiveActorIntelligenceDto({
      query: "Turla",
      evidence: [liveFixtureEvidence("turla-current")]
    });
    stale.caveats.push({ code: "stale", label: "Stale evidence", severity: "warning", reason: "forced stale fixture", grounding: stale.provenance[0]?.grounding ?? [] });
    const noisyAlias = buildLiveActorIntelligenceDto({
      query: "Akira",
      evidence: [stagedResult("akira-apply-alias", "captured_page", "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.")]
    });

    const weakPlan = buildSearchQualityApplyPlan(weak, evaluateSearchQualityGate({ dto: weak }));
    const contradictedPlan = buildSearchQualityApplyPlan(contradicted, evaluateSearchQualityGate({ dto: contradicted, graphReviewState: "contradiction" }));
    const stalePlan = buildSearchQualityApplyPlan(stale, evaluateSearchQualityGate({ dto: stale, graphReviewState: "stale" }));
    const noisyAliasPlan = buildSearchQualityApplyPlan(noisyAlias, evaluateSearchQualityGate({ dto: noisyAlias }));

    expect(applyActionKinds(weakPlan)).toEqual(expect.arrayContaining(["analyst_review", "lower_confidence", "request_more_capture_evidence"]));
    expect(applyActionKinds(contradictedPlan)).toContain("mark_contradiction");
    expect(contradictedPlan.actions.find((action) => action.kind === "mark_contradiction")?.manualOnly).toBe(true);
    expect(applyActionKinds(stalePlan)).toContain("expire_stale_claim");
    expect(applyActionKinds(noisyAliasPlan)).toContain("suppress_noisy_alias");
    expect(weakPlan.actions.every((action) => action.prerequisites.length > 0 && action.evidenceIds.length > 0 && action.rollback.length > 0)).toBe(true);
  });

  test("moves actor search from partial to ready only after quality gates are satisfied", () => {
    const partialApt29 = buildLiveActorIntelligenceDto({
      query: "APT29",
      evidence: [stagedResult("apt29-apply-partial", "live_discovery", "Live discovery snippet: APT29 may be phishing against Northwind Health.")]
    });
    const readyApt29 = buildLiveActorIntelligenceDto({
      query: "APT29",
      evidence: [stagedResult("apt29-apply-ready", "reviewed_promoted", "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in the healthcare sector. First seen 2026-05-22.")]
    });
    const partialTurla = buildLiveActorIntelligenceDto({
      query: "Turla",
      evidence: [stagedResult("turla-apply-partial", "live_discovery", "Live snippet says Turla may be using Snake malware.")]
    });
    const readyTurla = buildLiveActorIntelligenceDto({
      query: "Turla",
      evidence: [stagedResult("turla-apply-ready", "reviewed_promoted", "Researchers attributed command and control against Example Embassy to Turla using Snake malware. First seen 2026-05-22.")]
    });
    const partialScattered = buildLiveActorIntelligenceDto({
      query: "Scattered Spider",
      evidence: [stagedResult("scattered-apply-partial", "live_discovery", "Scattered Spider appeared in a cyber gang list with ShinyHunters.")]
    });
    const readyScattered = buildLiveActorIntelligenceDto({
      query: "Scattered Spider",
      evidence: [stagedResult("scattered-apply-ready", "reviewed_promoted", "CrowdStrike linked Scattered Spider to sms phishing against Example Telecom in the telecommunications sector. First seen 2026-05-23.")]
    });
    const partialAkira = buildLiveActorIntelligenceDto({
      query: "Akira",
      evidence: [liveFixtureEvidence("akira-current")]
    });
    const readyAkira = buildLiveActorIntelligenceDto({
      query: "Akira",
      evidence: [stagedResult("akira-apply-ready", "reviewed_promoted", "Analyst attributed ransomware activity against Fjord Energy AS in Norway to Akira. First seen 2026-05-22.")]
    });

    for (const dto of [partialApt29, partialTurla, partialScattered, partialAkira]) {
      const gate = evaluateSearchQualityGate({ dto });
      const plan = buildSearchQualityApplyPlan(dto, gate);
      expect(plan.canPromoteToReady).toBe(false);
      expect(plan.currentStatus).not.toBe("ready");
    }

    for (const dto of [readyApt29, readyTurla, readyScattered, readyAkira]) {
      const gate = evaluateSearchQualityGate({ dto, graphReviewState: "accepted" });
      const plan = buildSearchQualityApplyPlan(dto, gate);
      expect(gate.status).toBe("ready");
      expect(plan.canPromoteToReady).toBe(true);
      expect(plan.targetStatus).toBe("ready");
      expect(applyActionKinds(plan)).toContain("promote_quality_status");
      expect(plan.actions.find((action) => action.kind === "promote_quality_status")?.expectedApiEffect).toContain("ready");
    }
  });

  test("freezes compact API quality DTOs and examples for live actor search", () => {
    const examples = searchQualityApiExamples();
    const statuses = examples.map((example) => example.quality.status);
    expect(statuses).toEqual(expect.arrayContaining([
      "ready",
      "partial",
      "weak-evidence",
      "contradicted",
      "stale",
      "source-biased",
      "insufficient-capture",
      "needs-review"
    ]));

    for (const example of examples) {
      expect(example.quality.score).toBeGreaterThanOrEqual(0);
      expect(example.quality.score).toBeLessThanOrEqual(1);
      expect(example.quality.caveatCodes).toBeArray();
      expect(example.quality.qualityNoteCodes).toBeArray();
      expect(example.quality.publicWarningText.length).toBeGreaterThan(0);
      expect(example.dashboard.schemaVersion).toBe("ti.search_quality_dashboard.v1");
      expect(example.dashboard.fields.length).toBeGreaterThanOrEqual(12);
      expect(example.dashboard.metrics.usefulAnswerRate).toBeGreaterThanOrEqual(0);
      expect(example.dashboard.metrics.expectedFactRecall).toBeGreaterThanOrEqual(0);
      expect(example.dashboard.reviewQueues).toBeDefined();
      expect(Object.keys(example.quality.evidenceStageCounts).sort()).toEqual([
        "captured_page",
        "extracted_relationship",
        "live_discovery",
        "metadata_only_claim",
        "public_channel_message",
        "reviewed_promoted",
        "seeded"
      ]);
    }

    expect(examples.find((example) => example.quality.status === "ready")?.quality.canPromoteToReady).toBe(true);
    expect(examples.find((example) => example.quality.status === "contradicted")?.quality.analystActions.map((action) => action.kind)).toContain("mark_contradiction");
  });

  test("exposes snippet-only and alias-collision quality warnings through API DTOs", () => {
    const snippetOnly = buildLiveActorIntelligenceDto({
      query: "Crimson Pineapple",
      evidence: [liveFixtureEvidence("unknown-random")]
    });
    const aliasCollision = buildLiveActorIntelligenceDto({
      query: "Akira",
      evidence: [
        stagedResult("akira-api-alias", "captured_page", "Cyber gang list: Akira, ALPHV, BlackCat, and LockBit were named historically in a ransomware rebrand roundup.")
      ]
    });

    const snippetGate = evaluateSearchQualityGate({ dto: snippetOnly });
    const snippetQuality = buildSearchQualityApiDto(snippetOnly, snippetGate);
    expect(snippetQuality.status).not.toBe("ready");
    expect(snippetQuality.canPromoteToReady).toBe(false);
    expect(snippetQuality.publicWarningCodes).toEqual(expect.arrayContaining(["partial", "weak-evidence", "insufficient-capture"]));
    expect(snippetQuality.analystActions.map((action) => action.kind)).toEqual(expect.arrayContaining(["lower_confidence", "request_more_capture_evidence"]));
    expect(snippetQuality.evidenceStageCounts.live_discovery).toBeGreaterThan(0);
    expect(snippetQuality.evidenceStageCounts.captured_page).toBe(0);

    const aliasGate = evaluateSearchQualityGate({ dto: aliasCollision });
    const aliasQuality = buildSearchQualityApiDto(aliasCollision, aliasGate);
    const aliasDashboard = buildSearchQualityDashboardDto(aliasCollision, aliasGate, "2026-05-24T12:00:00.000Z");
    expect(aliasQuality.publicWarningCodes).toContain("alias_collision_warning");
    expect(aliasQuality.publicWarningText.join(" ")).toContain("alias");
    expect(aliasQuality.analystActions.map((action) => action.kind)).toContain("suppress_noisy_alias");
    expect(aliasDashboard.metrics.citationAvailability).toBeGreaterThan(0);
    expect(aliasDashboard.fields.map((field) => field.field)).toEqual(expect.arrayContaining([
      "actor_summary",
      "recent_activity",
      "tools_malware",
      "cves",
      "iocs",
      "provenance"
    ]));
    expect(aliasDashboard.releaseGate.decision).not.toBe("promote");
    expect(JSON.stringify(aliasDashboard)).not.toContain("Cyber gang list");
  });

  test("builds entity resolution workbench candidates with review states and provenance", () => {
    const workbench = buildEntityResolutionWorkbenchDto({
      query: "Turla Snake",
      generatedAt: "2026-05-24T02:00:00.000Z",
      evidence: [
        stagedResult("turla-resolution-a", "captured_page", "Turla, also known as Snake, used Snake malware against Fjord Energy AS in Norway with CVE-2026-1234 and hxxps://snake[.]example[.]com/a."),
        stagedResult("turla-resolution-b", "extracted_relationship", "Waterbug operators used phishing against Fjord Energy AS in the energy sector. Last seen 2026-05-23."),
        stagedResult("akira-resolution", "metadata_only_claim", "Akira claimed victim: Northwind Health and listed a ransomware post.")
      ]
    });

    const byKind = (kind: string) => workbench.candidates.filter((candidate) => candidate.kind === kind);
    const turla = byKind("actor_alias").find((candidate) => candidate.canonicalValue === "Turla");
    const snakeTool = byKind("malware_tool").find((candidate) => candidate.canonicalValue === "Snake");
    const akiraRebrand = byKind("ransomware_rebrand").find((candidate) => candidate.canonicalValue === "Akira");
    if (!turla) throw new Error("Expected Turla actor candidate");
    if (!snakeTool) throw new Error("Expected Snake tool candidate");
    if (!akiraRebrand) throw new Error("Expected Akira ransomware rebrand candidate");

    expect(workbench.schemaVersion).toBe("ti.entity_resolution_workbench.v1");
    expect(workbench.summary.candidateCount).toBeGreaterThan(0);
    expect(workbench.summary.reviewRequiredCount).toBeGreaterThan(0);
    expect(turla.observedValues.map((value) => value.toLowerCase())).toEqual(expect.arrayContaining(["turla", "snake"]));
    expect(turla.confidenceReasons.join(" ")).toContain("source family");
    expect(snakeTool.reviewState).toBe("review_required");
    expect(snakeTool.uncertaintyReasons.join(" ")).toContain("alias collision");
    expect(akiraRebrand.reviewState).toBe("review_required");
    expect(akiraRebrand.uncertaintyReasons.join(" ")).toContain("metadata-only");
    expect(byKind("victim_company").map((candidate) => candidate.canonicalValue)).toEqual(expect.arrayContaining(["Fjord Energy AS", "Northwind Health"]));
    expect(byKind("cve").map((candidate) => candidate.canonicalValue)).toContain("CVE-2026-1234");
    expect(byKind("infrastructure").some((candidate) => candidate.canonicalValue.includes("snake.example.com"))).toBe(true);
    expect(snakeTool).toBeDefined();
    expect(workbench.reviewQueues.aliasCollisions).toContain(snakeTool!.id);
    expect(workbench.reviewQueues.graphReview.length).toBeGreaterThan(0);
    expect(workbench.candidates.every((candidate) => candidate.provenance.every((item) => item.evidenceId && item.captureId && item.extractorVersion))).toBe(true);
    expect(JSON.stringify(workbench)).not.toContain("rawText");
    expect(workbench.safety).toMatchObject({
      rawEvidenceExposed: false,
      restrictedPayloadsExposed: false,
      preservesUncertainty: true
    });
  });

  test("builds timeliness ground truth harness that blocks stale latest-activity wording", () => {
    const staleApt29 = buildTimelinessGroundTruthHarnessDto({
      query: "APT29",
      generatedAt: "2026-05-24T00:00:00.000Z",
      evidence: [
        stagedResult("apt29-stale-time-a", "captured_page", "APT29 used phishing against Northwind Health. Last seen 2025-12-01.", undefined, undefined, undefined, {
          publishedAt: "2025-12-01T00:00:00.000Z"
        }),
        stagedResult("apt29-stale-time-b", "live_discovery", "Historical report says Cozy Bear targeted government agencies in 2024.", undefined, undefined, undefined, {
          publishedAt: "2025-11-20T00:00:00.000Z"
        })
      ]
    });
    const freshApt29 = buildTimelinessGroundTruthHarnessDto({
      query: "APT29",
      generatedAt: "2026-05-24T00:00:00.000Z",
      evidence: [
        stagedResult("apt29-fresh-time-a", "captured_page", "Mandiant linked APT29 to phishing against Northwind Health. Last seen 2026-05-22.", undefined, undefined, undefined, {
          publishedAt: "2026-05-22T00:00:00.000Z"
        }),
        stagedResult("apt29-fresh-time-b", "extracted_relationship", "Graph relationship: APT29 used credential dumping against Northwind Health in Norway on 2026-05-23.", undefined, undefined, undefined, {
          publishedAt: "2026-05-23T00:00:00.000Z"
        })
      ]
    });

    expect(staleApt29.schemaVersion).toBe("ti.timeliness_ground_truth.v1");
    expect(staleApt29.queryClass).toBe("high_activity_actor");
    expect(staleApt29.expectations.staleCannotBeLatest).toBe(true);
    expect(staleApt29.fields.find((field) => field.field === "recent_activity")?.status).toBe("stale");
    expect(staleApt29.gaps.map((gap) => gap.code)).toEqual(expect.arrayContaining(["stale_latest_source", "stale_field"]));
    expect(staleApt29.releaseImpact).toMatchObject({
      publicAnswerState: "partial",
      holdsReadyPromotion: true
    });
    expect(freshApt29.releaseImpact.holdsReadyPromotion).toBe(false);
    expect(freshApt29.fields.find((field) => field.field === "recent_activity")?.status).toBe("current");
    expect(JSON.stringify(staleApt29)).not.toContain("Historical report");
    expect(staleApt29.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      preservesUncertainty: true
    });
  });

  test("builds analyst feedback loop contracts without model self mutation", () => {
    const evidence = [
      stagedResult("feedback-apt29-a", "captured_page", "APT29 may have used phishing against Northwind Health. Last seen 2025-12-01.", undefined, undefined, undefined, {
        publishedAt: "2025-12-01T00:00:00.000Z"
      })
    ];
    const actorProfile = buildLiveActorIntelligenceDto({ query: "APT29", evidence });
    const answer = buildPublicIntelAnswerDto(actorProfile, { status: "partial", score: 0.42, publicWarningCodes: ["weak-evidence"], publicWarningText: ["weak evidence"] });
    const qualityGate = evaluateSearchQualityGate({ dto: actorProfile });
    const qualityDashboard = buildSearchQualityDashboardDto(actorProfile, qualityGate, "2026-05-24T12:00:00.000Z");
    const entityResolutionWorkbench = buildEntityResolutionWorkbenchDto({ query: "APT29", evidence, generatedAt: "2026-05-24T12:00:00.000Z" });
    const timelinessGroundTruth = buildTimelinessGroundTruthHarnessDto({ query: "APT29", evidence, generatedAt: "2026-05-24T12:00:00.000Z" });
    const feedback = buildAnalystFeedbackLoopDto({
      query: "APT29",
      actorProfile,
      claims: answer.claims,
      qualityDashboard,
      entityResolutionWorkbench,
      timelinessGroundTruth,
      generatedAt: "2026-05-24T12:00:00.000Z"
    });

    expect(feedback.schemaVersion).toBe("ti.analyst_feedback_loop.v1");
    expect(feedback.items.map((item) => item.mark)).toEqual(expect.arrayContaining(["stale", "underconfident", "missing"]));
    expect(feedback.routing.qualityGate.length).toBeGreaterThan(0);
    expect(feedback.routing.entityResolution.length).toBeGreaterThan(0);
    expect(feedback.routing.publicAnswerCaveats.length).toBeGreaterThan(0);
    expect(feedback.policy).toMatchObject({
      modelSelfMutationAllowed: false,
      analystApprovalRequired: true,
      rawEvidenceRequired: false,
      preservesProvenance: true
    });
    expect(feedback.items.every((item) => item.immutable && item.appliesAutomatically === false)).toBe(true);
    expect(JSON.stringify(feedback)).not.toContain("https://example.test");
    expect(JSON.stringify(feedback)).not.toContain("may have used phishing");
  });

  test("builds ATT&CK mapping quality and drift evaluation without raw evidence", () => {
    const evidence = [
      stagedResult("attack-quality-ready", "reviewed_promoted", "Mandiant linked APT29 to phishing and credential dumping against Northwind Health in the healthcare sector. First seen 2026-05-22."),
      stagedResult("attack-quality-held", "captured_page", "Conflicting reports disputed APT29 living off the land mapping for Northwind Health; analysts marked a deprecated ATT&CK technique reference.")
    ];
    const quality = buildAttackMappingQualityDto({
      query: "APT29",
      evidence,
      generatedAt: "2026-05-24T12:00:00.000Z"
    });

    expect(quality.schemaVersion).toBe("ti.attack_mapping_quality.v1");
    expect(quality.summary.candidateCount).toBeGreaterThanOrEqual(2);
    expect(quality.summary.mappedAttackIdCount).toBeGreaterThan(0);
    expect(quality.techniques.some((technique) => technique.attackId === "T1566")).toBe(true);
    expect(quality.techniques.some((technique) => technique.actorRelevance.matchedActorAliases.includes("APT29"))).toBe(true);
    expect(quality.reviewQueues.deprecatedOrRevoked.length).toBeGreaterThan(0);
    expect(quality.reviewQueues.contradictions.length).toBeGreaterThan(0);
    expect(quality.reviewQueues.stixBlocked.length).toBeGreaterThan(0);
    expect(quality.releaseImpact.holdsReadyPromotion).toBe(true);
    expect(quality.techniques.every((technique) => technique.citations.every((citation) => citation.evidenceId && citation.sourceId && citation.captureId))).toBe(true);
    expect(quality.safety).toMatchObject({
      rawEvidenceExposed: false,
      sourceUrlsExposed: false,
      preservesUncertainty: true
    });
    expect(JSON.stringify(quality)).not.toContain("https://example.test");
    expect(JSON.stringify(quality)).not.toContain("Conflicting reports disputed");
  });
});

function caveatCodes(summary: { caveats: Array<{ code: TiConfidenceCaveatCode }> }): TiConfidenceCaveatCode[] {
  return summary.caveats.map((caveat) => caveat.code);
}

function stagedResult(
  id: string,
  stage: EvidenceStage,
  rawText: string,
  previousConfidence?: number,
  previousStage?: EvidenceStage,
  blockedReason?: string,
  metadata: Record<string, unknown> = {}
) {
  return {
    id,
    stage,
    previousStage,
    previousConfidence,
    blockedReason,
    observedAt: "2026-05-24T01:00:00.000Z",
    result: processCollectedItem({
      sourceId: `src_${id}`,
      url: `https://example.test/${id}`,
      collectedAt: "2026-05-24T01:00:00.000Z",
      publishedAt: typeof metadata.publishedAt === "string" ? metadata.publishedAt : undefined,
      title: id,
      rawText,
      contentHash: hashContent(rawText),
      links: [],
      metadata: { evidenceStage: stage, ...metadata },
      sensitive: stage === "metadata_only_claim"
    })
  };
}

function liveFixtureEvidence(id: string, previousConfidence?: number, previousStage?: EvidenceStage) {
  const fixture = liveActorIntelligenceFixtures.find((item) => item.id === id);
  if (!fixture) throw new Error(`Missing live actor intelligence fixture: ${id}`);
  return stagedResult(id, fixture.stage, fixture.rawText, previousConfidence, previousStage);
}

function actorBaseline(actor: string, overrides: Partial<ActorProfileSnapshot> = {}): ActorProfileSnapshot {
  const { targets: targetOverrides, ...rest } = overrides;
  const targets = { victims: [], sectors: [], regions: [], ...targetOverrides };
  return {
    actor,
    aliases: [],
    vendorNames: [],
    ttps: [],
    confidence: 0.5,
    updatedAt: "2026-05-01T00:00:00.000Z",
    evidenceIds: [],
    sourceUncertainty: [],
    needsAnalystReview: false,
    ...rest,
    targets
  };
}

function deltaKinds(fused: ReturnType<typeof fuseActorProfile>): string[] {
  return fused.deltas.changes.map((change) => change.kind);
}

function publicDeltaKinds(dto: ReturnType<typeof buildLiveActorIntelligenceDto>): string[] {
  return dto.profileDeltas.map((change) => change.kind);
}

function qualityNoteCodes(report: ReturnType<typeof evaluateExtractionCalibration>): string[] {
  return report.qualityNotes.map((note) => note.code);
}

function applyActionKinds(plan: ReturnType<typeof buildSearchQualityApplyPlan>): string[] {
  return plan.actions.map((action) => action.kind);
}
