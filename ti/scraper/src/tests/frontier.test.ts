import { describe, expect, test } from "bun:test";
import { FocusedFrontier } from "../frontier/frontier.ts";
import type { FrontierStrategy, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_test",
  name: "Test Source",
  type: "static_web",
  url: "https://example.test",
  accessMethod: "public_http",
  status: "active",
  risk: "low",
  trustScore: 0.9,
  crawlFrequencySeconds: 3600,
  legalNotes: "Public test fixture.",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

describe("FocusedFrontier", () => {
  test("enqueues high-relevance CTI candidates", () => {
    const frontier = new FocusedFrontier();
    const score = frontier.add({
      source,
      url: "https://example.test/ransomware-campaign",
      discoveredAt: new Date().toISOString(),
      anchorText: "ransomware campaign indicators",
      surroundingText: "APT malware CVE exploit details",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });

    expect(score.decision).toBe("enqueue");
    expect(frontier.snapshot()).toHaveLength(1);
  });

  test("drops inactive sources", () => {
    const frontier = new FocusedFrontier();
    const score = frontier.add({
      source: { ...source, status: "paused" },
      url: "https://example.test/ransomware",
      discoveredAt: new Date().toISOString(),
      anchorText: "ransomware"
    });

    expect(score.decision).toBe("drop");
    expect(frontier.snapshot()).toHaveLength(0);
  });

  test("uses strategy thresholds for precision and recall crawls", () => {
    const candidate = {
      source,
      url: "https://example.test/vendors/weekly-roundup",
      discoveredAt: new Date().toISOString(),
      anchorText: "weekly roundup",
      surroundingText: "APT29 mentioned in vendor telemetry",
      parentRelevance: 0.55,
      novelty: 0.7,
      freshness: 0.8
    };

    const recall = new FocusedFrontier({ strategy: "recall" }).score(candidate);
    const precision = new FocusedFrontier({ strategy: "precision" }).score(candidate);

    expect(recall.decision).toBe("enqueue");
    expect(precision.decision).toBe("review");
  });

  test("scores candidates with explicit link parent and destination classifiers across all strategy modes", () => {
    const strategies: FrontierStrategy[] = [
      "precision",
      "recall",
      "balanced",
      "efficiency",
      "link_only",
      "parent_only",
      "destination_only",
      "link_parent",
      "link_destination",
      "parent_destination",
      "hybrid_dynamic"
    ];
    const candidate = {
      source,
      url: "https://example.test/research/cve-2026-9999",
      discoveredAt: new Date().toISOString(),
      anchorText: "APT29 CVE-2026-9999 exploit indicators",
      surroundingText: "malware campaign with IOCs and victim telemetry",
      parentTitle: "Vendor threat research on APT29",
      parentText: "Parent page discusses intrusion activity, malware, campaign infrastructure, and TTPs.",
      parentRelevance: 0.86,
      destinationTitle: "APT29 exploitation report",
      destinationText: "Destination confirms CVE-2026-9999 exploitation, indicators, backdoor deployment, and affected government victims.",
      destinationRelevance: 0.92,
      novelty: 0.82,
      freshness: 0.88
    };

    const scores = strategies.map((strategy) => new FocusedFrontier({ strategy }).score(candidate));

    expect(scores).toHaveLength(11);
    expect(new Set(scores.map((score) => score.classifier?.selectedStrategy)).size).toBe(11);
    for (const score of scores) {
      expect(score.classifier).toMatchObject({
        coverage: {
          hasLinkContext: true,
          hasParentPage: true,
          hasDestinationPage: true
        }
      });
      expect(score.classifier?.link.matchedTerms).toContain("apt29");
      expect(score.classifier?.link.matchedTerms).toContain("cve-2026-9999");
      expect(score.classifier?.link.matchedTerms).toContain("exploit");
      expect(score.classifier?.parent.score).toBeGreaterThan(0.45);
      expect(score.classifier?.destination.score).toBeGreaterThan(0.5);
    }

    const byStrategy = Object.fromEntries(scores.map((score) => [score.strategy, score]));
    expect(byStrategy.destination_only.classifier?.weights.destination).toBeGreaterThan(0.65);
    expect(byStrategy.link_only.classifier?.weights.link).toBeGreaterThan(0.65);
    expect(byStrategy.parent_only.classifier?.weights.parent).toBeGreaterThan(0.65);
    expect(byStrategy.precision.classifier?.tradeoff).toBe("precision");
    expect(byStrategy.recall.classifier?.tradeoff).toBe("recall");
    expect(byStrategy.efficiency.classifier?.tradeoff).toBe("efficiency");
    expect(byStrategy.hybrid_dynamic.classifier?.selectedStrategy).toBe("hybrid_dynamic_classifier");
  });

  test("requires destination evidence for destination-only precision and redistributes missing signals for dynamic hybrid", () => {
    const ambiguousCandidate = {
      source,
      url: "https://example.test/security/weekly-roundup",
      discoveredAt: new Date().toISOString(),
      anchorText: "APT29 mention in weekly roundup",
      surroundingText: "vendor telemetry briefly mentions threat actor activity",
      parentTitle: "Threat research index",
      parentText: "Parent index links to ransomware, malware, CVE, and actor reports.",
      parentRelevance: 0.78,
      novelty: 0.8,
      freshness: 0.8
    };

    const destinationOnly = new FocusedFrontier({ strategy: "destination_only" }).score(ambiguousCandidate);
    const hybrid = new FocusedFrontier({ strategy: "hybrid_dynamic" }).score(ambiguousCandidate);

    expect(destinationOnly.decision).toBe("drop");
    expect(destinationOnly.classifier?.coverage.hasDestinationPage).toBe(false);
    expect(hybrid.total).toBeGreaterThan(destinationOnly.total);
    expect(hybrid.classifier?.weights.link).toBeGreaterThan(0.28);
    expect(hybrid.classifier?.weights.parent).toBeGreaterThan(0.22);
  });

  test("precision strategy penalizes disagreement between link context and destination content", () => {
    const now = new Date().toISOString();
    const misleading = {
      source,
      url: "https://example.test/cve-apt29-malware",
      discoveredAt: now,
      anchorText: "APT29 CVE malware exploit indicators",
      surroundingText: "threat actor campaign",
      parentRelevance: 0.7,
      destinationTitle: "Product launch webinar",
      destinationText: "Marketing webinar registration and sponsored product update with no threat intelligence details.",
      destinationRelevance: 0.05,
      novelty: 0.7,
      freshness: 0.7
    };
    const corroborated = {
      ...misleading,
      destinationTitle: "APT29 exploitation analysis",
      destinationText: "Technical report confirms CVE exploitation, malware infrastructure, IOCs, and victim targeting.",
      destinationRelevance: 0.88
    };

    const misleadingScore = new FocusedFrontier({ strategy: "precision" }).score(misleading);
    const corroboratedScore = new FocusedFrontier({ strategy: "precision" }).score(corroborated);

    expect(corroboratedScore.total).toBeGreaterThan(misleadingScore.total + 0.12);
    expect(misleadingScore.decision).not.toBe("enqueue");
    expect(corroboratedScore.decision).toBe("enqueue");
  });

  test("downgrades high-risk clear-web candidates for review", () => {
    const frontier = new FocusedFrontier({ strategy: "balanced" });
    const score = frontier.add({
      source: {
        ...source,
        risk: "high",
        type: "static_web",
        approvedAt: new Date(0).toISOString(),
        approvedBy: "analyst_1",
        governance: {
          approvalRequired: true,
          approvalState: "approved",
          metadataOnly: false,
          approvedAt: new Date(0).toISOString(),
          approvedBy: "analyst_1",
          riskJustification: "High-risk clear-web fixture approved for review-only scheduling."
        }
      },
      url: "https://example.test/leak",
      discoveredAt: new Date().toISOString(),
      anchorText: "ransomware leak victim CVE exploit",
      surroundingText: "APT malware campaign indicators",
      parentRelevance: 0.85,
      destinationRelevance: 0.6,
      novelty: 0.9,
      freshness: 0.9,
      safetyRisk: 0.7
    });

    expect(score.decision).toBe("review");
    expect(frontier.snapshot()).toHaveLength(0);
  });

  test("schedules deterministically with per-source concurrency and retry backoff", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({
      now: () => now,
      defaultPerSourceConcurrency: 1,
      baseBackoffMs: 1_000,
      crawlBudgets: { request_1: 2 }
    });

    const candidate = {
      source,
      discoveredAt: now.toISOString(),
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8,
      budgetKey: "request_1"
    };

    frontier.add({
      ...candidate,
      url: "https://example.test/apt29-ransomware",
      anchorText: "APT29 ransomware campaign"
    });
    frontier.add({
      ...candidate,
      url: "https://example.test/apt29-cve",
      anchorText: "APT29 CVE exploit"
    });

    const first = frontier.next(now);
    const blocked = frontier.next(now);
    expect(first?.targetUrl).toBe("https://example.test/apt29-ransomware");
    expect(blocked).toBeUndefined();

    const retry = first ? frontier.fail(first, now) : undefined;
    expect(retry?.retryCount).toBe(1);
    expect(retry?.availableAt).not.toBe(now.toISOString());
    expect(frontier.next(now)).toBeUndefined();
  });

  test("acknowledges complete, fail, cancel, and expired lease requeue", () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    const later = new Date("2026-01-01T00:00:02.000Z");
    const frontier = new FocusedFrontier({
      now: () => start,
      taskLeaseMs: 1_000,
      baseBackoffMs: 1_000,
      defaultPerSourceConcurrency: 2
    });

    frontier.add({
      source,
      url: "https://example.test/apt29-complete",
      discoveredAt: start.toISOString(),
      anchorText: "APT29 ransomware campaign",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const completed = frontier.next(start);
    expect(completed).toBeDefined();
    expect(completed ? frontier.complete(completed).status : "missing").toBe("completed");
    expect(frontier.leasedSnapshot()).toHaveLength(0);

    frontier.add({
      source,
      url: "https://example.test/apt29-fail",
      discoveredAt: start.toISOString(),
      anchorText: "APT29 malware campaign",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const failed = frontier.next(start);
    const failureAck = failed ? frontier.fail(failed, start, "adapter timeout") : undefined;
    expect(failureAck?.status).toBe("retry_scheduled");
    expect(failureAck?.retry?.retryCount).toBe(1);

    frontier.add({
      source: { ...source, id: "src_cancel" },
      url: "https://example.test/apt29-cancel",
      discoveredAt: start.toISOString(),
      anchorText: "APT29 exploit campaign",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const queuedCancel = frontier.snapshot().find((task) => task.targetUrl.includes("cancel"));
    expect(queuedCancel ? frontier.cancel(queuedCancel, "operator cancelled").status : "missing").toBe("cancelled");

    frontier.add({
      source: { ...source, id: "src_expire" },
      url: "https://example.test/apt29-expire",
      discoveredAt: start.toISOString(),
      anchorText: "APT29 CVE exploit",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });
    const leased = frontier.next(start);
    expect(leased).toBeDefined();
    const requeued = frontier.requeueExpiredLeases(later);
    expect(requeued).toHaveLength(1);
    expect(frontier.leasedSnapshot()).toHaveLength(0);
    expect(frontier.snapshot().some((task) => task.id === leased?.id)).toBe(true);
  });

  test("fairly rotates across tenants, requests, and sources", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 4 });

    for (const suffix of ["one", "two"]) {
      frontier.add({
        source: { ...source, id: `src_apt_${suffix}` },
        tenantId: "tenant_apt",
        intelRequestId: "request_apt29",
        url: `https://apt.example.test/${suffix}`,
        discoveredAt: now.toISOString(),
        anchorText: "APT29 ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8
      });
    }

    frontier.add({
      source: { ...source, id: "src_feed" },
      tenantId: "tenant_feeds",
      intelRequestId: "request_feed",
      url: "https://feed.example.test/daily",
      discoveredAt: now.toISOString(),
      anchorText: "APT29 ransomware campaign exploit",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });

    const first = frontier.next(now);
    const second = frontier.next(now);

    expect(first?.tenantId).toBe("tenant_apt");
    expect(second?.tenantId).toBe("tenant_feeds");
  });

  test("keeps public live searches from starving analyst, probe, and retention work", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({ now: () => now, defaultPerSourceConcurrency: 8 });

    for (const [id, budgetClass, fairnessKey] of [
      ["public_live", "interactive_live_search", "tenant:public"],
      ["analyst", "analyst_deep_dive", "tenant:analyst"],
      ["probe", "source_health_probe", "tenant:ops"],
      ["retention", "background_refresh", "retention:replay"]
    ] as const) {
      frontier.add({
        source: { ...source, id: `src_${id}` },
        tenantId: `tenant_${id}`,
        intelRequestId: `request_${id}`,
        url: `https://fairness.example.test/${id}`,
        discoveredAt: now.toISOString(),
        anchorText: "APT29 ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8,
        fairnessKey
      });
      const queued = frontier.snapshot().find((item) => item.sourceId === `src_${id}`);
      if (queued) {
        queued.task.planning = {
          budgetClass,
          decision: "selected",
          reason: "test work-class fairness",
          queryTerms: ["APT29"],
          freshness: 0.8,
          sourceTrust: 0.9,
          selectedFor: budgetClass === "source_health_probe" ? "probe" : budgetClass === "background_refresh" ? "background" : "interactive"
        };
      }
    }

    expect(frontier.next(now)?.sourceId).toBe("src_retention");
    expect(frontier.next(now)?.sourceId).toBe("src_analyst");
    expect(frontier.next(now)?.sourceId).toBe("src_probe");
    expect(frontier.next(now)?.sourceId).toBe("src_public_live");
  });

  test("groups queue snapshots and enforces task, byte, and deadline budgets", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({
      now: () => now,
      defaultPerSourceConcurrency: 3,
      crawlBudgetPolicies: {
        bytes: { taskLimit: 10, byteLimit: 1_000, deadlineAt: "2026-01-01T01:00:00.000Z" },
        expired: { taskLimit: 10, byteLimit: 10_000, deadlineAt: "2025-12-31T23:59:59.000Z" }
      }
    });

    for (const [index, budgetKey] of ["bytes", "bytes", "expired"].entries()) {
      frontier.add({
        source: { ...source, id: `src_budget_${index}` },
        tenantId: index === 2 ? "tenant_expired" : "tenant_budget",
        intelRequestId: `request_${budgetKey}`,
        url: `https://budget.example.test/${budgetKey}/${index}`,
        discoveredAt: now.toISOString(),
        anchorText: "APT29 ransomware campaign exploit",
        parentRelevance: 0.9,
        novelty: 0.8,
        freshness: 0.8,
        budgetKey,
        maxBytes: 600
      });
    }

    const first = frontier.next(now);
    const second = frontier.next(now);
    expect(first?.crawlBudgetKey).toBe("bytes");
    expect(second).toBeUndefined();

    const grouped = frontier.groupedSnapshot(now);
    expect(grouped.groups.tenants.tenant_budget).toBe(2);
    expect(grouped.groups.adapterTypes.static_web).toBeGreaterThan(0);
    expect(grouped.groups.priorityBuckets.critical).toBeGreaterThan(0);
    expect(grouped.groups.ageBuckets.lt_5m).toBeGreaterThan(0);
    expect(grouped.budgets.bytes.bytesRemaining).toBe(400);
    expect(grouped.budgets.expired.expired).toBe(true);
  });

  test("tracks scheduling metrics and retry-exhausted dead letters", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const frontier = new FocusedFrontier({
      now: () => now,
      defaultRetryBudget: 0,
      defaultPerSourceConcurrency: 2
    });

    frontier.add({
      source,
      tenantId: "tenant_metrics",
      url: "https://example.test/apt29-dead-letter",
      discoveredAt: now.toISOString(),
      anchorText: "APT29 ransomware campaign exploit",
      parentRelevance: 0.9,
      novelty: 0.8,
      freshness: 0.8
    });

    const leased = frontier.next(now);
    const ack = leased ? frontier.fail(leased, now, "permanent fixture failure") : undefined;
    expect(ack?.status).toBe("retry_exhausted");
    expect(frontier.deadLetterSnapshot()).toHaveLength(1);

    const metrics = frontier.metrics(now);
    expect(metrics.throughput.failed).toBe(1);
    expect(metrics.throughput.retryExhausted).toBe(1);
    expect(metrics.queueAgeSeconds.highPriorityMax).toBeGreaterThanOrEqual(0);
    expect(metrics.tenantStarvation).toBe(0);
  });
});
