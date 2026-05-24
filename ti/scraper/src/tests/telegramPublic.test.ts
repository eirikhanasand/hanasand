import { describe, expect, test } from "bun:test";
import { evaluateSourceForCollection } from "../policy/collectionPolicy.ts";
import { processCollectedItem } from "../pipeline/pipeline.ts";
import type { CollectedItem, CollectionTask, SourceRecord } from "../types.ts";
import {
  applyTelegramPublicAbuseControls,
  buildTelegramPublicAnswerReadinessDto,
  bridgeTelegramPublicActivationSource,
  buildTelegramPublicActivationProgram,
  buildTelegramPublicApplyPlan,
  buildTelegramPublicCanaryRollout,
  buildTelegramPublicCompactSearchSummary,
  buildTelegramPublicCutoverReport,
  buildTelegramPublicEvidencePromotionProgram,
  buildTelegramPublicReconciliation,
  buildTelegramPublicReliabilityReport,
  buildTelegramPublicRuntimeCollection,
  buildTelegramPublicOperatorControlEffects,
  buildTelegramPublicPromotionCanaryProof,
  buildTelegramPublicPromotionCertification,
  buildTelegramPublicSlaReport,
  buildTelegramPublicSourcePackCompatibility,
  buildTelegramPublicSourcePackReadiness,
  buildTelegramPublicSourceHealthUpdate,
  buildTelegramPublicIncrementalPollDto,
  explainTelegramPublicCoverageGaps,
  minimizeTelegramPii,
  parseTelegramTarget,
  planTelegramPublicSearchBackfill,
  planTelegramPublicQueryWindows,
  promotePublicChannelEvidence,
  publicChannelEvidenceFromCollectedItem,
  recommendTelegramPublicSourcePacks,
  searchTelegramPublicChannels,
  TelegramPublicAdapter,
  TelegramPublicAdapterError,
  TelegramBotApiClient,
  telegramPublicChannelSearchHitToCandidateSource,
  telegramPublicApplyPlanApiContract,
  telegramPublicChannelSourceModel,
  telegramPublicSourcePackEntryToSource,
  validateTelegramPublicSourcePack,
  validateTelegramPublicSourceCompliance,
  type OfficialTelegramClient,
  type OfficialTelegramSearchClient,
  type TelegramPublicSourcePack,
  type TelegramPublicFetchRequest
} from "../adapters/telegramPublic.ts";
import { buildPublicSignalFusionWorkbench } from "../adapters/publicSignalFusion.ts";

function source(input: Partial<SourceRecord> = {}): SourceRecord {
  return {
    id: input.id ?? "src_telegram",
    name: input.name ?? "Public Telegram Channel",
    type: "telegram_public",
    url: input.url ?? "https://t.me/securityalerts",
    accessMethod: input.accessMethod ?? "official_api",
    status: input.status ?? "active",
    risk: input.risk ?? "medium",
    trustScore: input.trustScore ?? 0.7,
    language: input.language,
    crawlFrequencySeconds: input.crawlFrequencySeconds ?? 300,
    legalNotes: input.legalNotes ?? "Public channel reviewed for CTI collection through official Telegram APIs.",
    approvedAt: "approvedAt" in input ? input.approvedAt : new Date(0).toISOString(),
    approvedBy: "approvedBy" in input ? input.approvedBy : "reviewer_1",
    governance: input.governance ?? {
      approvalRequired: true,
      approvalState: "approved",
      metadataOnly: false,
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer_1",
      policyVersion: "collection-policy:v1"
    },
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    health: input.health,
    scoring: input.scoring,
    crawlState: input.crawlState,
    lifecycle: input.lifecycle,
    tags: input.tags,
    catalog: input.catalog,
    metadata: input.metadata
  };
}

const task: CollectionTask = {
  id: "task_telegram",
  sourceId: "src_telegram",
  sourceType: "telegram_public",
  targetUrl: "https://t.me/securityalerts",
  queuedAt: new Date(0).toISOString(),
  priority: 0.8,
  reason: "fixture",
  retryCount: 0
};

function collectedTelegramItem(id: number, text: string, metadata: Record<string, unknown> = {}): CollectedItem {
  const deleted = metadata.deleted === true;
  const unavailable = metadata.unavailable === true;
  return {
    sourceId: "src_runtime_state",
    url: `https://t.me/securityalerts/${id}`,
    collectedAt: "2026-01-01T00:00:00.000Z",
    publishedAt: "2026-01-01T00:00:00.000Z",
    rawText: text,
    contentHash: `hash-${id}-${metadata.editDate ?? ""}-${deleted}-${unavailable}`,
    links: [],
    metadata: {
      adapter: "telegram_public",
      channel: "securityalerts",
      messageId: id,
      messageState: deleted ? "deleted" : unavailable ? "unavailable" : "available",
      editDate: metadata.editDate,
      urlMentions: [],
      media: { retention: "metadata_only", items: [] },
      extractionHandoff: {
        messageText: text,
        actorAliases: text.includes("APT29") ? ["APT29"] : [],
        cves: [],
        victims: [],
        uncertaintyMarkers: deleted ? ["message_deleted"] : []
      },
      provenance: { confidence: 0.8 }
    },
    sensitive: false
  };
}

describe("TelegramPublicAdapter", () => {
  test("fuses approved public signal families with duplicate suppression reliability decay and mergeable deltas", () => {
    const generatedAt = "2026-05-24T12:00:00.000Z";
    const publicChannel = source({
      id: "src_channel_apt29",
      name: "APT29 public channel",
      tags: ["APT29", "Cozy Bear", "CVE-2026-9999"],
      metadata: {
        actors: ["APT29", "Cozy Bear"],
        sourceFamilies: ["public_channel"],
        countries: ["United States"],
        regions: ["North America"],
        rateLimitResetAt: "2026-05-24T12:05:00.000Z"
      }
    });
    const github = {
      ...source({ id: "src_github_ghsa", name: "GitHub Security Advisory", tags: ["GHSA", "APT29", "CVE-2026-9999"] }),
      type: "api",
      accessMethod: "official_api",
      url: "https://api.github.com/advisories/GHSA-apt29",
      metadata: { cves: ["CVE-2026-9999"], sourceFamilies: ["github_advisory"] }
    } satisfies SourceRecord;
    const cert = {
      ...source({ id: "src_cisa_kev", name: "CISA KEV", tags: ["CISA", "APT29", "energy"] }),
      type: "api",
      accessMethod: "official_api",
      url: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
      metadata: { sectors: ["energy"], countries: ["US"], regions: ["North America"] }
    } satisfies SourceRecord;
    const vendor = {
      ...source({ id: "src_vendor_mandiant", name: "Mandiant APT29 report", tags: ["Mandiant", "APT29"] }),
      type: "static_web",
      accessMethod: "public_http",
      url: "https://www.mandiant.com/resources/blog/apt29-report",
      metadata: { actors: ["APT29"], languages: ["en"], regions: ["Europe"] }
    } satisfies SourceRecord;
    const malware = {
      ...source({ id: "src_malware_threatfox", name: "ThreatFox malware report feed", tags: ["malware", "CVE-2026-9999"] }),
      type: "api",
      accessMethod: "official_api",
      url: "https://threatfox.abuse.ch/api/",
      metadata: { cves: ["CVE-2026-9999"], sourceFamilies: ["malware_report_feed"] }
    } satisfies SourceRecord;
    const duplicateVendor = {
      ...source({ id: "src_duplicate_vendor", name: "Duplicate Mandiant mirror", tags: ["APT29"] }),
      type: "static_web",
      accessMethod: "public_http",
      url: "https://www.mandiant.com/resources/blog/apt29-report/"
    } satisfies SourceRecord;
    const unavailable = {
      ...source({
        id: "src_old_social",
        name: "Public social APT29 watch",
        status: "retired",
        tags: ["social", "APT29"],
        metadata: { unavailableAt: "2026-05-23T00:00:00.000Z" }
      }),
      type: "api",
      accessMethod: "official_api",
      url: "https://public.social.example/apt29"
    } satisfies SourceRecord;
    const evidence = publicChannelEvidenceFromCollectedItem({
      ...collectedTelegramItem(99, "APT29 Cozy Bear exploit update for CVE-2026-9999", {
        editDate: "2026-05-24T11:58:00.000Z"
      }),
      sourceId: "src_channel_apt29",
      collectedAt: generatedAt,
      publishedAt: "2026-05-24T11:57:00.000Z",
      contentHash: "hash-public-signal-apt29"
    });

    const fusion = buildPublicSignalFusionWorkbench({
      query: "APT29",
      entityType: "actor",
      sources: [publicChannel, github, cert, vendor, malware, duplicateVendor, unavailable],
      evidence: evidence ? [evidence] : [],
      generatedAt
    });

    expect(fusion.status).toBe("ready");
    expect(fusion.familyCoverage.familiesCovered).toEqual(expect.arrayContaining([
      "public_channel",
      "github_advisory",
      "cert_government",
      "vendor_report",
      "malware_report_feed"
    ]));
    expect(fusion.familyCoverage.diversityScore).toBeGreaterThanOrEqual(1);
    expect(fusion.selectedSources.find((item) => item.sourceId === "src_channel_apt29")).toMatchObject({
      rateLimit: { delayed: true },
      availability: { editedPublicMessages: 1 }
    });
    expect(fusion.suppressed.duplicateUrls).toEqual(expect.arrayContaining(["https://www.mandiant.com/resources/blog/apt29-report/"]));
    expect(fusion.suppressed.unavailableSourceIds).toEqual(expect.arrayContaining(["src_old_social"]));
    expect(fusion.publicSignalDeltas).toEqual(expect.arrayContaining([expect.objectContaining({
      sourceId: "src_channel_apt29",
      mergeTarget: "public_channel_partial_evidence",
      state: "edited",
      provenance: expect.objectContaining({ publicOnly: true, evidenceBacked: true, safeUrl: true })
    })]));
    expect(fusion.analystWorkQueue.map((item) => item.action)).toEqual(expect.arrayContaining(["review_backoff", "review_unavailable", "confirm_public_only_claim"]));
    expect(fusion.guardrails).toMatchObject({
      publicOnly: true,
      privateJoinsUsed: false,
      accountAutomationUsed: false,
      rawMediaDownloaded: false,
      unsafeUrlsExposed: false,
      publicChannelOnlyClaimsAreCaveated: true
    });
  });

  test("uses Bot API getUpdates as an official public-channel client without account automation", async () => {
    const requests: RequestInit[] = [];
    const client = new TelegramBotApiClient({
      token: "test-token",
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      fetcher: async (_input, init) => {
        requests.push(init ?? {});
        return new Response(JSON.stringify({
          ok: true,
          result: [
            {
              update_id: 1,
              channel_post: {
                message_id: 41,
                date: 1767225600,
                chat: { id: -1001, username: "securityalerts", title: "Security Alerts" },
                text: "Historical APT29 note"
              }
            },
            {
              update_id: 2,
              channel_post: {
                message_id: 42,
                date: 1767225660,
                chat: { id: -1001, username: "securityalerts", title: "Security Alerts" },
                text: "APT29 infrastructure update for CVE-2026-12345 https://example.test/apt29"
              }
            },
            {
              update_id: 3,
              channel_post: {
                message_id: 99,
                date: 1767225660,
                chat: { id: -1002, username: "otherchannel", title: "Other" },
                text: "Should not be included"
              }
            }
          ]
        }), { status: 200 });
      }
    });

    const result = await client.fetchPublicChannelMessages({
      channel: "securityalerts",
      limit: 25,
      pagination: { afterMessageId: 41 }
    });

    expect(JSON.parse(String(requests[0]?.body))).toMatchObject({
      allowed_updates: ["channel_post", "edited_channel_post"]
    });
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toMatchObject({
      id: 42,
      channel: "securityalerts",
      url: "https://t.me/securityalerts/42"
    });
    expect(result.messages[0]?.links).toEqual(["https://example.test/apt29"]);
    expect(result.nextPagination?.afterMessageId).toBe(42);
  });

  test("runs practical public-channel search across approved sources and official search boundaries", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages(request) {
        expect(request.channel).toBe("securityalerts");
        return {
          nextPagination: { afterMessageId: 101 },
          messages: [
            {
              id: 100,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/100",
              date: "2026-01-01T00:00:00.000Z",
              text: "Generic malware note"
            },
            {
              id: 101,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/101",
              date: "2026-01-01T00:01:00.000Z",
              text: "APT29 public channel mention with CVE-2026-12345 and https://example.test/report"
            }
          ]
        };
      }
    };
    const officialSearch: OfficialTelegramSearchClient = {
      async searchPublicChannels(request) {
        expect(request.query).toBe("APT29");
        return [{
          channelHandle: "apt29research",
          publicUrl: "https://t.me/apt29research",
          title: "APT29 Research",
          description: "Public actor research feed.",
          topicTags: ["apt", "state actor"],
          confidence: 0.72,
          provenance: {
            api: "mtproto_library",
            method: "contacts.search",
            searchedAt: "2026-01-01T00:00:00.000Z",
            query: "APT29"
          }
        }];
      },
      async searchPublicMessages(request) {
        return [{
          id: 77,
          channel: "securityalerts",
          url: "https://t.me/securityalerts/77",
          date: "2026-01-01T00:02:00.000Z",
          text: "Global official search hit for APT29",
          matchedTerms: ["apt29"],
          provenance: {
            api: "mtproto_library",
            method: "messages.searchGlobal",
            searchedAt: "2026-01-01T00:00:00.000Z",
            query: request.query
          }
        }];
      }
    };

    const result = await searchTelegramPublicChannels({
      query: "APT29",
      entityType: "actor",
      sources: [source({ tags: ["apt29"], metadata: { actors: ["APT29"], pageSize: 25 } })],
      client,
      officialSearchClient: officialSearch,
      createdAt: "2026-01-01T00:00:00.000Z",
      maxTasks: 4
    });

    expect(result.status).toBe("ready");
    expect(result.matchedItems.map((item) => item.url)).toEqual(expect.arrayContaining([
      "https://t.me/securityalerts/101",
      "https://t.me/securityalerts/77"
    ]));
    expect(result.evidence.some((item) => item.snippet.includes("APT29"))).toBe(true);
    expect(result.promotion.promoted.length).toBeGreaterThan(0);
    expect(result.candidateChannels[0]).toMatchObject({
      channelHandle: "apt29research",
      publicUrl: "https://t.me/apt29research"
    });
    expect(result.safety).toMatchObject({
      publicChannelsOnly: true,
      officialApisOnly: true,
      accountCreationAutomated: false,
      privateJoinOrInviteUsed: false,
      darknetBrowsingUsed: false,
      rawMediaPayloadsFetched: false
    });
  });

  test("converts official public-channel discovery hits into review-only candidate sources", () => {
    const candidate = telegramPublicChannelSearchHitToCandidateSource({
      generatedAt: "2026-01-01T00:00:00.000Z",
      hit: {
        channelHandle: "@apt29research",
        publicUrl: "https://t.me/apt29research",
        title: "APT29 Research",
        topicTags: ["apt", "nobelium"],
        confidence: 0.74,
        provenance: {
          api: "mtproto_library",
          method: "contacts.search",
          searchedAt: "2026-01-01T00:00:00.000Z",
          query: "APT29"
        }
      }
    });

    expect(candidate).toMatchObject({
      type: "telegram_public",
      accessMethod: "official_api",
      status: "needs_review",
      url: "https://t.me/apt29research",
      legalNotes: expect.stringContaining("source review")
    });
    expect(candidate.governance).toMatchObject({
      approvalRequired: true,
      approvalState: "pending"
    });
    expect(candidate.metadata).toMatchObject({
      channelHandle: "apt29research",
      mediaDownload: false,
      minimizePii: true
    });
  });

  test("collects public channel messages through an official client and preserves provenance", async () => {
    const requests: TelegramPublicFetchRequest[] = [];
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages(request) {
        requests.push(request);
        return {
          nextPagination: { afterMessageId: 42 },
          rateLimitResetAt: "2026-01-01T00:01:00.000Z",
          messages: [{
            id: 42,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/42",
            date: "2026-01-01T00:00:00.000Z",
            text: "APT29 infrastructure update. Contact analyst@example.test or +47 123 45 678. See https://example.test/report",
            views: 123,
            links: ["https://example.test/report"]
          }]
        };
      }
    };

    const adapter = new TelegramPublicAdapter(client);
    const result = await adapter.collect(source({ metadata: { pageSize: 25, afterMessageId: 40 } }), task);

    expect(requests[0]).toMatchObject({
      channel: "securityalerts",
      limit: 25,
      pagination: { afterMessageId: 40 }
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.rawText).toContain("[redacted_email]");
    expect(result.items[0]?.rawText).toContain("[redacted_phone]");
    expect(result.items[0]?.links).toEqual(["https://example.test/report"]);
    expect(result.items[0]?.metadata).toMatchObject({
      adapter: "telegram_public",
      api: "bot_api",
      channel: "securityalerts",
      messageId: 42,
      crawlState: {
        channel: "securityalerts",
        afterMessageId: 40,
        nextAfterMessageId: 42,
        rateLimitResetAt: "2026-01-01T00:01:00.000Z",
        lastMessageDate: "2026-01-01T00:00:00.000Z",
        lastMessageId: 42
      },
      provenance: {
        sourceId: "src_telegram",
        sourceType: "telegram_public",
        channel: "securityalerts",
        messageId: 42,
        messageUrl: "https://t.me/securityalerts/42",
        extractorVersion: "telegram_public_adapter_v1",
        confidence: 0.95
      }
    });
    expect(result.metadata).toMatchObject({
      adapter: "telegram_public",
      crawlState: {
        channel: "securityalerts",
        afterMessageId: 40,
        nextAfterMessageId: 42,
        lastMessageId: 42
      }
    });
    expect(result.items[0]?.sensitive).toBe(false);
    expect(result.discovered).toEqual([]);
  });

  test("blocks public Telegram sources without review approval", () => {
    const decision = evaluateSourceForCollection(source({
      approvedAt: undefined,
      approvedBy: undefined,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false,
        policyVersion: "collection-policy:v1"
      }
    }));
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("approval");
  });

  test("rejects non-public Telegram targets and account automation patterns", () => {
    expect(parseTelegramTarget("https://t.me/securityalerts")).toEqual({ channel: "securityalerts" });
    expect(parseTelegramTarget("@SecurityAlerts")).toEqual({ channel: "securityalerts" });
    expect(parseTelegramTarget("https://t.me/+privateInvite")).toEqual({});
    expect(parseTelegramTarget("https://t.me/joinchat/abcdef")).toEqual({});
    expect(parseTelegramTarget("https://t.me/c/12345/678")).toEqual({});
    expect(validateTelegramPublicSourceCompliance(source({ metadata: { sessionString: "secret" } })).allowed).toBe(false);
    expect(evaluateSourceForCollection(source({ url: "https://t.me/c/12345/678" })).allowed).toBe(false);
    expect(evaluateSourceForCollection(source({ metadata: { accountAutomation: true } })).reason).toContain("accountAutomation");
  });

  test("minimizes obvious PII before producing CollectedItem text", () => {
    expect(minimizeTelegramPii("Email First.Last@example.test or call +1 (202) 555-0199")).toBe(
      "Email [redacted_email] or call [redacted_phone]"
    );
  });

  test("continues pagination from source crawl state and records next cursor", async () => {
    const requests: TelegramPublicFetchRequest[] = [];
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages(request) {
        requests.push(request);
        return {
          nextPagination: { afterMessageId: 105 },
          messages: [{
            id: 105,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/105",
            date: "2026-01-01T00:05:00.000Z",
            text: "New CVE-2026-1000 observed."
          }]
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source({
      metadata: { afterMessageId: 100, beforeMessageId: 200, pageSize: 10 }
    }), task);

    expect(requests[0]?.pagination).toEqual({ afterMessageId: 100, beforeMessageId: 200 });
    expect(result.metadata?.crawlState).toMatchObject({
      afterMessageId: 100,
      beforeMessageId: 200,
      nextAfterMessageId: 105,
      lastMessageId: 105,
      lastMessageDate: "2026-01-01T00:05:00.000Z"
    });
  });

  test("preserves edited message provenance in hash and metadata", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          messages: [{
            id: 77,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/77",
            date: "2026-01-01T00:00:00.000Z",
            editDate: "2026-01-01T00:03:00.000Z",
            text: "Edited APT29 update."
          }]
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source(), task);
    expect(result.items[0]?.metadata).toMatchObject({
      messageId: 77,
      edited: true,
      editDate: "2026-01-01T00:03:00.000Z"
    });
    expect(result.items[0]?.contentHash).toBeTruthy();
  });

  test("records deleted and unavailable messages without raw payload assumptions", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          deletedMessageIds: [12],
          unavailableMessageIds: [13],
          messages: [
            {
              id: 12,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/12",
              date: "2026-01-01T00:00:00.000Z",
              text: "",
              deleted: true
            },
            {
              id: 13,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/13",
              date: "2026-01-01T00:01:00.000Z",
              text: "",
              unavailable: true
            }
          ]
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source(), task);
    expect(result.items.map((item) => item.metadata.messageState)).toEqual(["deleted", "unavailable"]);
    expect(result.warnings.some((warning) => warning.includes("deleted messages"))).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("unavailable messages"))).toBe(true);
  });

  test("returns rate limit failure category and crawl state without fetching items", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        throw new TelegramPublicAdapterError("rate_limited", "flood wait", {
          rateLimitResetAt: "2026-01-01T00:10:00.000Z"
        });
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source(), task);
    expect(result.items).toEqual([]);
    expect(result.metadata).toMatchObject({
      failureCategory: "rate_limited",
      crawlState: {
        channel: "securityalerts",
        rateLimitResetAt: "2026-01-01T00:10:00.000Z"
      }
    });
  });

  test("records empty channel windows with cursor-safe crawl state", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return { messages: [], nextPagination: { afterMessageId: 500 } };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source({ metadata: { afterMessageId: 499 } }), task);
    expect(result.items).toEqual([]);
    expect(result.warnings).toContain("telegram_public empty channel window");
    expect(result.metadata?.crawlState).toMatchObject({
      afterMessageId: 499,
      nextAfterMessageId: 500
    });
  });

  test("blocks prohibited invite and account automation configs before client calls", async () => {
    let called = false;
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        called = true;
        return { messages: [] };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source({
      url: "https://t.me/+invite",
      metadata: { accountAutomation: true }
    }), { ...task, targetUrl: "https://t.me/+invite" });

    expect(called).toBe(false);
    expect(result.metadata?.failureCategory).toBe("policy_blocked");
    expect(result.warnings[0]).toContain("prohibited");
  });

  test("models approved public channels with focus, cursors, rate limits, and retention", () => {
    const model = telegramPublicChannelSourceModel(source({
      tags: ["apt", "nordic"],
      language: "nb",
      metadata: {
        channelId: "100123",
        approvalScope: "public posts only",
        topicTags: ["ransomware"],
        actors: ["APT29"],
        cves: ["cve-2026-1111"],
        sectors: ["energy"],
        countries: ["NO"],
        afterMessageId: 88,
        rateLimitResetAt: "2026-01-01T00:10:00.000Z"
      }
    }));

    expect(model).toMatchObject({
      channelHandle: "securityalerts",
      channelId: "100123",
      legalStatus: "approved_public",
      complianceStatus: "public_only",
      approvalScope: "public posts only",
      language: "nb",
      cursorState: { afterMessageId: 88 },
      rateLimitState: { resetAt: "2026-01-01T00:10:00.000Z" },
      retentionClass: "public_chat_text"
    });
    expect(model.topicTags).toContain("ransomware");
    expect(model.focus.actors).toEqual(["APT29"]);
    expect(model.focus.cves).toEqual(["CVE-2026-1111"]);
  });

  test("plans query-relevant public channel windows for actor aliases without private access", () => {
    const plan = planTelegramPublicQueryWindows({
      query: "APT29",
      entityType: "actor",
      createdAt: "2026-01-01T00:00:00.000Z",
      intelRequestId: "intel_apt29",
      sources: [
        source({
          id: "apt_channel",
          metadata: { actors: ["Cozy Bear"], afterMessageId: 10, pageSize: 20 }
        }),
        source({
          id: "generic_channel",
          tags: ["general-news"],
          metadata: { topicTags: ["weather"] }
        }),
        source({
          id: "private_channel",
          url: "https://t.me/c/12345/1"
        })
      ]
    });

    expect(plan.queryTerms).toContain("Cozy Bear");
    expect(plan.tasks).toHaveLength(1);
    expect(plan.tasks[0]).toMatchObject({
      sourceId: "apt_channel",
      sourceType: "telegram_public",
      targetUrl: "https://t.me/securityalerts",
      reason: expect.stringContaining("APT29")
    });
    expect(plan.tasks[0]?.planning?.queryTerms).toContain("Nobelium");
    expect(plan.blocked.some((item) => item.sourceId === "private_channel")).toBe(true);
    expect(plan.skipped.some((item) => item.sourceId === "generic_channel")).toBe(true);
  });

  test("delays query windows when public channel rate-limit state is active", () => {
    const plan = planTelegramPublicQueryWindows({
      query: "Akira",
      entityType: "malware",
      createdAt: "2026-01-01T00:00:00.000Z",
      sources: [
        source({
          id: "ransomware_channel",
          metadata: {
            ransomware: ["Akira"],
            rateLimitResetAt: "2026-01-01T00:05:00.000Z"
          }
        })
      ]
    });

    expect(plan.tasks[0]?.availableAt).toBe("2026-01-01T00:05:00.000Z");
    expect(plan.tasks[0]?.planning?.decision).toBe("waiting-for-backoff");
  });

  test("normalizes pinned public forwards, replies, repeated URLs, media metadata, and handoff fields", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          messages: [{
            id: 501,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/501",
            date: "2026-01-01T00:00:00.000Z",
            text: "Pinned APT29 claim against Fjord Energy AS for CVE-2026-9999 https://ioc.example/a https://ioc.example/a",
            quotedText: "Unconfirmed victim: Fjord Energy AS",
            pinned: true,
            forward: {
              fromChannel: "public_origin",
              fromMessageId: 99,
              fromUrl: "https://t.me/public_origin/99",
              date: "2025-12-31T23:00:00.000Z"
            },
            replyToMessageId: 500,
            threadId: 10,
            media: [{
              type: "document",
              fileName: "claim.pdf",
              mimeType: "application/pdf",
              sizeBytes: 12345,
              thumbnailHash: "thumbhash"
            }]
          }]
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source(), task);
    const item = result.items[0];
    expect(item?.links).toEqual(["https://ioc.example/a"]);
    expect(item?.metadata).toMatchObject({
      pinned: true,
      replyToMessageId: 500,
      threadId: 10,
      forward: {
        fromChannel: "public_origin",
        fromMessageId: 99,
        fromUrl: "https://t.me/public_origin/99"
      },
      media: {
        retention: "metadata_only",
        items: [{ type: "document", fileName: "claim.pdf", mimeType: "application/pdf", sizeBytes: 12345 }]
      },
      extractionHandoff: {
        actorAliases: ["APT29"],
        cves: ["CVE-2026-9999"],
        victims: ["Fjord Energy AS"],
        uncertaintyMarkers: ["claim_uncorroborated", "forwarded_public_message"]
      }
    });
    expect(String(item?.rawText)).toContain("quoted:");
  });

  test("preserves non-English public channel content and language hints", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          messages: [{
            id: 601,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/601",
            date: "2026-01-01T00:00:00.000Z",
            text: "APT29 kampanje mot energi i Norge"
          }]
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source({ language: "nb" }), task);
    expect(result.items[0]?.language).toBe("nb");
    expect(result.items[0]?.rawText).toContain("Norge");
  });

  test("handles high-volume public channel windows without duplicate URL expansion", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          messages: Array.from({ length: 125 }, (_, index) => {
            const id = index + 1;
            return {
              id,
              channel: "securityalerts",
              url: `https://t.me/securityalerts/${id}`,
              date: `2026-01-01T00:${String(index % 60).padStart(2, "0")}:00.000Z`,
              text: `APT29 high volume item ${id} https://repeat.example/ioc https://repeat.example/ioc`,
              links: ["https://repeat.example/ioc", "https://repeat.example/ioc"]
            };
          })
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source({ metadata: { pageSize: 100 } }), task);
    expect(result.items).toHaveLength(125);
    expect(result.metadata?.crawlState).toMatchObject({ lastMessageId: 125, nextAfterMessageId: 125 });
    expect(result.items.every((item) => item.links.length === 1)).toBe(true);
  });

  test("plans Scattered Spider public-channel backfill from alias coverage", () => {
    const plan = planTelegramPublicSearchBackfill({
      query: "Scattered Spider",
      entityType: "actor",
      sources: [
        source({
          id: "src_scattered",
          metadata: { actors: ["UNC3944"], topicTags: ["cybercrime"] }
        })
      ]
    });

    expect(plan.status).toBe("partial");
    expect(plan.queryTerms).toContain("Octo Tempest");
    expect(plan.tasks[0]?.sourceId).toBe("src_scattered");
  });

  test("plans CVE and ransomware victim public-channel searches from source coverage", () => {
    const cvePlan = planTelegramPublicSearchBackfill({
      query: "CVE-2026-9999",
      entityType: "cve",
      sources: [source({ id: "src_cve", metadata: { cves: ["CVE-2026-9999"], topicTags: ["vulnerability"] } })]
    });
    const victimPlan = planTelegramPublicSearchBackfill({
      query: "Fjord Energy AS",
      entityType: "victim",
      sources: [source({ id: "src_victim", metadata: { victims: ["Fjord Energy AS"], ransomware: ["Akira"] } })]
    });

    expect(cvePlan.tasks[0]?.sourceId).toBe("src_cve");
    expect(victimPlan.tasks[0]?.sourceId).toBe("src_victim");
  });

  test("returns pending channel search recommendations when matching channels are not active", () => {
    const plan = planTelegramPublicSearchBackfill({
      query: "Akira",
      entityType: "malware",
      sources: [
        source({
          id: "src_candidate",
          status: "candidate",
          governance: {
            approvalRequired: true,
            approvalState: "pending",
            metadataOnly: false,
            policyVersion: "collection-policy:v1"
          },
          approvedAt: undefined,
          approvedBy: undefined,
          metadata: { ransomware: ["Akira"], topicTags: ["ransomware"] }
        })
      ]
    });

    expect(plan.status).toBe("pending_channel_search");
    expect(plan.tasks).toEqual([]);
    expect(plan.activationRecommendations[0]).toMatchObject({
      sourceId: "src_candidate",
      requiredAction: "approve"
    });
  });

  test("builds public-channel evidence DTOs from collected items", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          messages: [{
            id: 700,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/700",
            date: "2026-01-01T00:00:00.000Z",
            text: "Scattered Spider posted infrastructure at https://evil.example",
            forward: { fromChannel: "public_origin", fromMessageId: 44, fromUrl: "https://t.me/public_origin/44" }
          }]
        };
      }
    };

    const result = await new TelegramPublicAdapter(client).collect(source(), task);
    const dto = publicChannelEvidenceFromCollectedItem(result.items[0]!);
    expect(dto).toMatchObject({
      sourceId: "src_telegram",
      channel: "securityalerts",
      messageUrl: "https://t.me/securityalerts/700",
      messageTimestamp: "2026-01-01T00:00:00.000Z",
      extractedUrls: ["https://evil.example"],
      forward: { fromChannel: "public_origin", fromMessageId: 44 },
      confidence: 0.95,
      messageId: 700,
      messageState: "available"
    });
    expect(dto?.snippet).toContain("Scattered Spider");
  });

  test("promotes public-channel partial evidence to capture and extraction input with stable provenance", () => {
    const promotion = promotePublicChannelEvidence({
      source: source({ metadata: { actors: ["Scattered Spider"], topicTags: ["cybercrime"] } }),
      task,
      promotedAt: "2026-01-01T00:10:00.000Z",
      promotedBy: "planner",
      query: "Scattered Spider",
      evidence: {
        sourceId: "src_telegram",
        channel: "securityalerts",
        messageUrl: "https://t.me/securityalerts/900",
        messageTimestamp: "2026-01-01T00:09:00.000Z",
        snippet: "Scattered Spider breach claim with IOC https://evil.example/path and email actor@example.test",
        extractedUrls: ["https://evil.example/path"],
        confidence: 0.74,
        messageId: 900,
        messageState: "available"
      }
    });

    expect(promotion.allowed).toBe(true);
    if (!promotion.allowed) throw new Error(promotion.reason);
    expect(promotion.item.rawText).toContain("[redacted_email]");
    expect(promotion.item.metadata).toMatchObject({
      promotedFrom: "public_channel_partial_evidence",
      promotion: {
        stage: "promoted",
        promotedAt: "2026-01-01T00:10:00.000Z",
        urlStable: true,
        query: "Scattered Spider"
      },
      provenance: {
        sourceId: "src_telegram",
        sourceType: "telegram_public",
        channel: "securityalerts",
        messageId: 900,
        messageUrl: "https://t.me/securityalerts/900",
        evidenceStage: "promoted",
        confidence: 0.74
      },
      media: {
        retention: "metadata_only",
        items: []
      }
    });

    const pipeline = processCollectedItem(promotion.item);
    expect(pipeline.capture.url).toBe("https://t.me/securityalerts/900");
    expect(pipeline.capture.metadata.provenance).toMatchObject({ evidenceStage: "promoted" });
    expect(pipeline.incident?.confidence).toBeGreaterThan(0);
    expect(promotion.extractionInput.metadata.extractionHandoff).toMatchObject({
      actorAliases: ["Scattered Spider"]
    });
  });

  test("blocks unsafe public-channel promotion inputs and raw media payloads", () => {
    const safeEvidence = {
      sourceId: "src_telegram",
      channel: "securityalerts",
      messageUrl: "https://t.me/securityalerts/901",
      snippet: "APT29 public update",
      extractedUrls: [],
      confidence: 0.7,
      messageId: 901,
      messageState: "available" as const
    };

    expect(promotePublicChannelEvidence({
      source: source({ url: "https://t.me/+invite" }),
      evidence: { ...safeEvidence, messageUrl: "https://t.me/+invite" }
    })).toMatchObject({ allowed: false });
    expect(promotePublicChannelEvidence({
      source: source(),
      evidence: { ...safeEvidence, messageUrl: "https://t.me/c/12345/901" }
    })).toMatchObject({ allowed: false });
    expect(promotePublicChannelEvidence({
      source: source({ metadata: { accountAutomation: true } }),
      evidence: safeEvidence
    })).toMatchObject({ allowed: false });
    expect(promotePublicChannelEvidence({
      source: source({ metadata: { mediaDownload: true } }),
      evidence: safeEvidence
    })).toMatchObject({ allowed: false });
    expect(promotePublicChannelEvidence({
      source: source(),
      evidence: safeEvidence,
      mediaPayload: new Uint8Array([1, 2, 3])
    })).toMatchObject({ allowed: false, reason: expect.stringContaining("raw media") });
  });

  test("builds production promotion program for ready partial blocked duplicate edited and rate-limited public-channel evidence", () => {
    const generatedAt = "2026-01-01T00:00:00.000Z";
    const readySource = source({
      id: "src_ready",
      url: "https://t.me/securityalerts",
      language: "en",
      metadata: {
        actors: ["APT29"],
        topicTags: ["espionage"],
        lastDiscoveredUrls: ["https://t.me/securityalerts/998"]
      }
    });
    const rateLimitedSource = source({
      id: "src_rate",
      url: "https://t.me/ratelimited",
      metadata: {
        actors: ["APT29"],
        rateLimitResetAt: "2026-01-01T00:30:00.000Z"
      }
    });
    const disabledSource = source({
      id: "src_disabled",
      url: "https://t.me/disabled",
      status: "disabled",
      metadata: { actors: ["APT29"] }
    });
    const program = buildTelegramPublicEvidencePromotionProgram({
      query: "APT29",
      sources: [readySource, rateLimitedSource, disabledSource],
      previousUrls: ["https://t.me/securityalerts/998"],
      generatedAt,
      evidence: [
        {
          sourceId: "src_ready",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/999",
          messageTimestamp: generatedAt,
          snippet: "APT29 public report with CVE-2026-9999 and victim: Fjord Energy AS",
          extractedUrls: ["https://report.example/apt29"],
          replyToMessageId: 900,
          media: { retention: "metadata_only", rawFetchAllowed: false, items: [{ type: "document", fileName: "report.pdf", sizeBytes: 1000 }] },
          languageHint: "en",
          extractionHandoff: {
            actorAliases: ["APT29"],
            cves: ["CVE-2026-9999"],
            victims: ["Fjord Energy AS"],
            uncertaintyMarkers: []
          },
          confidence: 0.8,
          messageId: 999,
          messageState: "available",
          contentHash: "hash-ready"
        },
        {
          sourceId: "src_ready",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/998",
          snippet: "duplicate APT29 URL",
          extractedUrls: [],
          confidence: 0.6,
          messageId: 998,
          messageState: "available"
        },
        {
          sourceId: "src_ready",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/997",
          snippet: "edited APT29 note",
          extractedUrls: [],
          confidence: 0.6,
          messageId: 997,
          messageState: "available",
          editedAt: "2026-01-01T00:10:00.000Z",
          contentHash: "hash-edited"
        },
        {
          sourceId: "src_ready",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/996",
          snippet: "",
          extractedUrls: [],
          confidence: 0.1,
          messageId: 996,
          messageState: "deleted"
        },
        {
          sourceId: "src_missing",
          channel: "missing",
          messageUrl: "https://t.me/missing/1",
          snippet: "APT29 missing source",
          extractedUrls: [],
          confidence: 0.5,
          messageId: 1,
          messageState: "available"
        }
      ]
    });

    expect(program.status).toBe("ready");
    expect(program.promoted.map((item) => item.messageUrl)).toContain("https://t.me/securityalerts/999");
    expect(program.promoted[0]?.extractionHandoff).toMatchObject({
      actorAliases: ["APT29"],
      cves: ["CVE-2026-9999"],
      victims: ["Fjord Energy AS"]
    });
    expect(program.duplicateSuppressed).toContainEqual({
      sourceId: "src_ready",
      messageUrl: "https://t.me/securityalerts/998",
      reason: "duplicate_url"
    });
    expect(program.editedMessages.map((item) => item.messageId)).toContain(997);
    expect(program.deletedOrUnavailable.map((item) => item.messageId)).toEqual([996]);
    expect(program.blocked[0]).toMatchObject({ sourceId: "src_missing" });
    expect(program.rateLimitBackoff).toEqual([{ sourceId: "src_rate", channelHandle: "ratelimited", resetAt: "2026-01-01T00:30:00.000Z" }]);
    expect(program.policyDisabled).toEqual([{ sourceId: "src_disabled", reason: "public-channel source is disabled by policy" }]);
    expect(program.safeOutput).toEqual({
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    });
    expect(JSON.stringify(program)).not.toContain("mediaPayload");
    expect(JSON.stringify(program)).not.toContain("sessionString");
  });

  test("builds runtime collection contracts with cursor updates promotion handoff and scheduler hints", async () => {
    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          nextPagination: { afterMessageId: 1004 },
          messages: [
            {
              id: 1001,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/1001",
              date: "2026-01-01T00:01:00.000Z",
              text: "APT29 public update using CVE-2026-9999 against victim: Fjord Energy AS",
              replyToMessageId: 990,
              links: ["https://report.example/apt29"],
              media: [{ type: "document", fileName: "brief.pdf", sizeBytes: 2048 }]
            },
            {
              id: 1002,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/1002",
              date: "2026-01-01T00:02:00.000Z",
              editDate: "2026-01-01T00:03:00.000Z",
              text: "APT29 edited note forwarding public context",
              forward: { fromChannel: "public_origin", fromMessageId: 77, fromUrl: "https://t.me/public_origin/77" }
            },
            {
              id: 1003,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/1003",
              date: "2026-01-01T00:04:00.000Z",
              text: "APT29 stable follow-up"
            },
            {
              id: 1004,
              channel: "securityalerts",
              url: "https://t.me/securityalerts/1004",
              date: "2026-01-01T00:04:30.000Z",
              text: "APT29 second stable follow-up"
            }
          ]
        };
      }
    };
    const src = source({
      id: "src_runtime",
      metadata: {
        actors: ["APT29"],
        afterMessageId: 1000,
        publicQueryWindowLimit: 25,
        lastDiscoveredUrls: ["https://report.example/apt29"]
      }
    });
    const result = await new TelegramPublicAdapter(client).collect(src, { ...task, sourceId: "src_runtime" });
    const runtime = buildTelegramPublicRuntimeCollection({
      source: src,
      task: { ...task, sourceId: "src_runtime" },
      result,
      query: "APT29",
      generatedAt: "2026-01-01T00:05:00.000Z"
    });

    expect(runtime.status).toBe("ready");
    expect(runtime.cursorWindow).toMatchObject({
      requested: { afterMessageId: 1000 },
      next: { afterMessageId: 1004 },
      lastMessageId: 1004,
      lastMessageDate: "2026-01-01T00:04:30.000Z"
    });
    expect(runtime.collection).toMatchObject({
      itemCount: 4,
      newCount: 3,
      editedCount: 1,
      deletedOrUnavailableCount: 0,
      duplicateSuppressedCount: 0,
      urlMentionCount: 1,
      forwardCount: 1,
      replyCount: 1,
      mediaMetadataCount: 1
    });
    expect(runtime.promotedItems[0]).toMatchObject({
      sourceId: "src_runtime",
      url: "https://t.me/securityalerts/1001",
      sensitive: false,
      metadata: {
        promotedFrom: "public_channel_partial_evidence",
        media: { retention: "metadata_only" },
        provenance: {
          sourceType: "telegram_public",
          evidenceStage: "promoted"
        }
      }
    });
    expect(runtime.extractionInputs[0]?.metadata.extractionHandoff).toMatchObject({
      cves: ["CVE-2026-9999"],
      victims: ["Fjord Energy AS"]
    });
    expect(runtime.sourcePatch).toMatchObject({
      id: "src_runtime",
      crawlState: {
        cursor: "1004",
        lastCollectedAt: "2026-01-01T00:05:00.000Z",
        retryCount: 0
      },
      metadata: {
        afterMessageId: 1004,
        lastTelegramRuntimeStatus: "ready"
      }
    });
    expect(runtime.schedulerHints).toEqual({ acknowledge: "complete", reason: "public-channel runtime produced safe evidence state" });
    expect(runtime.connector).toMatchObject({
      sourceId: "src_runtime",
      channelHandle: "securityalerts",
      operatorState: {
        state: "actively_collectable",
        collectable: true,
        reviewRequired: false
      },
      cursorLease: {
        requested: { afterMessageId: 1000 },
        next: { afterMessageId: 1004 },
        lastMessageId: 1004
      },
      rateLimitState: {
        minIntervalSeconds: 60
      },
      windowSizing: {
        requested: 50,
        effective: 25,
        perChannelLimit: 25
      },
      sourceHealthPatch: {
        fetchOutcome: "success",
        lastSeenMessageId: 1004
      },
      deltas: {
        newMessageIds: [1001, 1003, 1004],
        editedMessageIds: [1002],
        deletedOrUnavailableMessageIds: []
      },
      promotionHandoff: {
        targetAgent: "agent_06",
        promotedCount: 4,
        extractionInputCount: 4
      },
      actorReadiness: {
        status: "ready"
      },
      answerReadiness: {
        status: "partial",
        agent06: {
          targetAgent: "agent_06",
          promotedCount: 4,
          extractionInputCount: 4,
          ledgerBackedClaimYield: {
            ledgerBackedClaimCount: 4,
            candidateClaimCount: 4,
            ratio: 1,
            enforcementState: "pass"
          }
        },
        agent07: {
          claimStatus: "partial_evidence",
          analystReviewState: "queued",
          enforcementState: "warning",
          caveatCodes: expect.arrayContaining(["public_channel_edited_messages"])
        },
        ledgerLinks: expect.arrayContaining([
          expect.objectContaining({
            messageId: 1001,
            deltaKind: "new",
            promotedToAgent06: true
          }),
          expect.objectContaining({
            messageId: 1002,
            deltaKind: "edited",
            promotedToAgent06: true
          })
        ])
      },
      safeOutput: {
        rawMediaPayloadsExposed: false,
        mediaRetention: "metadata_only"
      }
    });
    expect(runtime.connector.publicMessageProvenance[0]).toMatchObject({
      sourceId: "src_runtime",
      channel: "securityalerts",
      messageId: 1001,
      messageUrl: "https://t.me/securityalerts/1001",
      state: "available"
    });
    expect(JSON.stringify(runtime)).not.toContain("rawMessage");
    expect(JSON.stringify(runtime)).not.toContain("sessionString");
    expect(JSON.stringify(runtime)).not.toContain("+privateInvite");
  });

  test("classifies runtime rate limits policy disabled high duplicate and edit delete churn", () => {
    const generatedAt = "2026-01-01T00:00:00.000Z";
    const safe = source({ id: "src_runtime_state", metadata: { actors: ["APT29"] } });
    const rateLimited = buildTelegramPublicRuntimeCollection({
      source: safe,
      result: {
        items: [],
        discovered: [],
        warnings: ["flood wait"],
        metadata: {
          failureCategory: "rate_limited",
          crawlState: { rateLimitResetAt: "2026-01-01T00:10:00.000Z" }
        }
      },
      query: "APT29",
      generatedAt
    });
    expect(rateLimited).toMatchObject({
      status: "rate_limited",
      schedulerHints: {
        acknowledge: "retry",
        retryAfterSeconds: 600
      },
      sourcePatch: {
        crawlState: {
          backoffUntil: "2026-01-01T00:10:00.000Z",
          retryCount: 1
        }
      }
    });

    const policyDisabled = buildTelegramPublicRuntimeCollection({
      source: source({ id: "src_disabled_runtime", status: "disabled", metadata: { actors: ["APT29"] } }),
      result: { items: [], discovered: [], warnings: [] },
      query: "APT29",
      generatedAt
    });
    expect(policyDisabled.status).toBe("policy_disabled");
    expect(policyDisabled.schedulerHints.acknowledge).toBe("block");

    const duplicate = buildTelegramPublicRuntimeCollection({
      source: safe,
      previousUrls: ["https://t.me/securityalerts/2001", "https://t.me/securityalerts/2002"],
      result: {
        items: [
          collectedTelegramItem(2001, "APT29 duplicate one"),
          collectedTelegramItem(2002, "APT29 duplicate two"),
          collectedTelegramItem(2003, "APT29 new")
        ],
        discovered: [],
        warnings: []
      },
      query: "APT29",
      generatedAt
    });
    expect(duplicate.status).toBe("high_duplicate");
    expect(duplicate.collection.duplicateSuppressedCount).toBe(2);
    expect(duplicate.schedulerHints.reason).toContain("repeated URL suppression");

    const churn = buildTelegramPublicRuntimeCollection({
      source: safe,
      result: {
        items: [
          collectedTelegramItem(3001, "APT29 edited", { editDate: "2026-01-01T00:01:00.000Z" }),
          collectedTelegramItem(3002, "", { deleted: true }),
          collectedTelegramItem(3003, "APT29 stable")
        ],
        discovered: [],
        warnings: []
      },
      query: "APT29",
      generatedAt
    });
    expect(churn.status).toBe("high_churn");
    expect(churn.collection.editedCount).toBe(1);
    expect(churn.collection.deletedOrUnavailableCount).toBe(1);
    expect(churn.schedulerHints.reason).toContain("edit/delete churn");
  });

  test("applies abuse controls for repeated public queries by clamping windows and reusing rate limits", () => {
    const controls = applyTelegramPublicAbuseControls({
      source: source({
        metadata: {
          pageSize: 100,
          publicQueryWindowLimit: 25,
          rateLimitResetAt: "2026-01-01T00:10:00.000Z"
        }
      }),
      requestedWindow: 90,
      now: "2026-01-01T00:00:00.000Z",
      urls: ["https://t.me/securityalerts/1", "https://t.me/securityalerts/2", "https://t.me/securityalerts/2"],
      previousUrls: ["https://t.me/securityalerts/2"]
    });

    expect(controls).toMatchObject({
      allowed: false,
      requestedWindow: 90,
      effectiveWindow: 25,
      perChannelWindowLimit: 25,
      rateLimitResetAt: "2026-01-01T00:10:00.000Z",
      coverageMatched: true,
      languageMatched: true,
      suppressedUrls: ["https://t.me/securityalerts/2"]
    });
    expect(controls.notes.some((note) => note.includes("metadata-only"))).toBe(true);
  });

  test("maps public-channel deltas to Agent 06 ledger ids and Agent 07 readiness downgrades", () => {
    const runtime = buildTelegramPublicRuntimeCollection({
      source: source({ id: "src_delta_readiness", metadata: { actors: ["APT29"] } }),
      result: {
        items: [
          collectedTelegramItem(4101, "APT29 actor burst names new infrastructure"),
          collectedTelegramItem(4102, "APT29 edited CVE-2026-9999 chatter", { editDate: "2026-01-01T00:01:00.000Z" }),
          collectedTelegramItem(4103, "", { unavailable: true })
        ],
        discovered: [],
        warnings: []
      },
      query: "APT29 CVE-2026-9999",
      generatedAt: "2026-01-01T00:05:00.000Z"
    });

    const readiness = buildTelegramPublicAnswerReadinessDto({ connector: runtime.connector });

    expect(readiness).toMatchObject({
      status: "needs_review",
      agent06: {
        targetAgent: "agent_06",
        promotedCount: 0,
        extractionInputCount: 2,
        ledgerBackedClaimYield: {
          candidateClaimCount: 3,
          enforcementState: "hold"
        }
      },
      agent07: {
        claimStatus: "needs_review",
        analystReviewState: "required",
        enforcementState: "hold",
        caveatCodes: expect.arrayContaining([
          "public_channel_edited_messages",
          "public_channel_deleted_or_unavailable"
        ])
      },
      safeOutput: {
        rawPrivateDataExposed: false,
        rawMediaPayloadsExposed: false,
        credentialsExposed: false
      }
    });
    expect(readiness.ledgerLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ messageId: 4101, deltaKind: "new", promotedToAgent06: false }),
      expect.objectContaining({ messageId: 4102, deltaKind: "edited", promotedToAgent06: false }),
      expect.objectContaining({ messageId: 4103, deltaKind: "deleted_or_unavailable", promotedToAgent06: false })
    ]));
    expect(readiness.ledgerLinks.every((item) => item.ledgerId.startsWith("ledger_tg_"))).toBe(true);
  });

  test("describes operator-control answer effects and compact search readiness", () => {
    const example = telegramPublicApplyPlanApiContract().examples.automationSafe;
    const steps = ([
      "delay_poll",
      "reduce_window",
      "quarantine_channel",
      "request_review",
      "refresh_cursor",
      "suppress_repeated_urls"
    ] as const).map((action) => ({
      ...example,
      id: `step_${action}`,
      action,
      execution: action === "request_review" ? "human_approval_required" as const : action === "quarantine_channel" ? "rollback_only" as const : "automation_safe" as const
    }));
    const effects = buildTelegramPublicOperatorControlEffects({
      generatedAt: "2026-01-01T00:00:00.000Z",
      mode: "dry_run",
      query: "APT29",
      steps,
      summary: {
        stepCount: steps.length,
        automationSafeCount: 4,
        humanApprovalRequiredCount: 1,
        blockedCount: 0,
        rollbackOnlyCount: 1,
        highestPriority: "high",
        canAutoApply: false
      },
      promotionGate: {
        publicChannelApplyPlanReady: true,
        blockedUnsafeActivationCount: 0,
        manualApprovalCount: 1,
        automationSafeCount: 4,
        metadataOnlyMedia: true,
        piiMinimizationRequired: true
      }
    });

    expect(effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: "delay_poll", expectedAnswerQualityEffect: "delays_freshness_keeps_claims_partial", expectedPromotionEffect: "hold_promotions" }),
      expect.objectContaining({ action: "reduce_window", expectedAnswerQualityEffect: "reduces_noise_improves_precision" }),
      expect.objectContaining({ action: "quarantine_channel", expectedAnswerQualityEffect: "stops_untrusted_evidence_requires_review", requiresReview: true }),
      expect.objectContaining({ action: "request_review", expectedAnswerQualityEffect: "queues_human_review_for_readiness", requiresReview: true }),
      expect.objectContaining({ action: "refresh_cursor", expectedAnswerQualityEffect: "restores_delta_continuity" }),
      expect.objectContaining({ action: "suppress_repeated_urls", expectedAnswerQualityEffect: "reduces_duplicate_claim_pressure", expectedPromotionEffect: "suppress_duplicate_promotions" })
    ]));

    const cutoverReport = buildTelegramPublicCutoverReport({
      query: "APT29",
      sources: [source({ id: "src_summary", metadata: { actors: ["APT29"] } })],
      evidence: [{
        sourceId: "src_summary",
        channel: "securityalerts",
        messageUrl: "https://t.me/securityalerts/5001",
        messageTimestamp: "2026-01-01T00:01:00.000Z",
        snippet: "APT29 ransomware victim chatter CVE-2026-9999",
        extractedUrls: ["https://victim.example"],
        confidence: 0.9,
        messageId: 5001,
        messageState: "available",
        contentHash: "hash_5001"
      }]
    });
    const reliability = buildTelegramPublicReliabilityReport({
      query: "APT29",
      sources: [source({ id: "src_summary", metadata: { actors: ["APT29"] } })],
      evidence: cutoverReport.evidenceFreshness.latestMessageId ? [{
        sourceId: "src_summary",
        channel: "securityalerts",
        messageUrl: "https://t.me/securityalerts/5001",
        messageTimestamp: "2026-01-01T00:01:00.000Z",
        snippet: "APT29 ransomware victim chatter CVE-2026-9999",
        extractedUrls: ["https://victim.example"],
        confidence: 0.9,
        messageId: 5001,
        messageState: "available",
        contentHash: "hash_5001"
      }] : []
    });
    const summary = buildTelegramPublicCompactSearchSummary({
      cutoverReport,
      reliability,
      operatorStates: [{
        sourceId: "src_summary",
        channelHandle: "securityalerts",
        state: "actively_collectable",
        reason: "approved",
        reviewRequired: false,
        collectable: true
      }],
      actorReadiness: {
        status: "ready",
        downgradeReasons: [],
        sourceRatings: [{ sourceId: "src_summary", rating: "healthy", partialEvidenceOnly: false, needsReview: false }]
      }
    });

    expect(summary).toMatchObject({
      freshness: {
        latestMessageId: 5001,
        safePartialEvidenceCount: 1,
        publicChannelAddsEvidence: false
      },
      reliability: {
        sourceCount: 1,
        rating: "watch",
        needsReviewCount: 0
      },
      promotionYield: {
        rating: "high",
        promotedCount: 1
      },
      operatorStateCounts: {
        actively_collectable: 1
      },
      answerReadiness: {
        status: "ready",
        downgradeReasonCount: 0
      }
    });
  });

  test("builds public-channel SLA report for Agent 10 release gates", () => {
    const generatedAt = "2026-01-01T00:00:00.000Z";
    const runtime = buildTelegramPublicRuntimeCollection({
      source: source({ id: "src_runtime_state", metadata: { actors: ["APT29"], publicQueryWindowLimit: 25 } }),
      result: {
        items: [
          collectedTelegramItem(5101, "APT29 actor burst includes CVE-2026-9999"),
          collectedTelegramItem(5102, "APT29 duplicate victim mention https://victim.example", { editDate: "2026-01-01T00:01:00.000Z" }),
          collectedTelegramItem(5103, "", { unavailable: true })
        ],
        discovered: [],
        warnings: []
      },
      query: "APT29 CVE-2026-9999",
      previousUrls: ["https://t.me/securityalerts/5102"],
      generatedAt
    });
    const cutoverReport = buildTelegramPublicCutoverReport({
      query: "APT29",
      sources: [source({ id: "src_runtime_state", metadata: { actors: ["APT29"], publicQueryWindowLimit: 25 } })],
      evidence: runtime.evidence,
      generatedAt
    });
    const reliability = buildTelegramPublicReliabilityReport({
      query: "APT29",
      sources: [source({ id: "src_runtime_state", metadata: { actors: ["APT29"], publicQueryWindowLimit: 25 } })],
      evidence: runtime.evidence,
      healthUpdates: [runtime.connector.sourceHealthPatch],
      generatedAt
    });
    const operatorStates = [{
      sourceId: "src_runtime_state",
      channelHandle: "securityalerts",
      state: "actively_collectable" as const,
      reason: "approved",
      reviewRequired: false,
      collectable: true
    }];
    const actorReadiness = {
      status: "needs_review" as const,
      downgradeReasons: ["public-channel evidence includes deleted or unavailable messages"],
      sourceRatings: [{ sourceId: "src_runtime_state", rating: "degraded" as const, partialEvidenceOnly: true, needsReview: true }]
    };
    const sla = buildTelegramPublicSlaReport({
      cutoverReport,
      reliability,
      operatorStates,
      actorReadiness,
      answerReadiness: runtime.connector.answerReadiness,
      generatedAt
    });

    expect(sla).toMatchObject({
      status: "blocker",
      enforcement: {
        status: "hold",
        releaseAction: "hold_on_blocker",
        agent06LedgerHandoff: {
          state: "hold",
          ledgerBackedClaimCount: 1,
          candidateClaimCount: 3
        },
        agent07AnswerReadiness: {
          state: "hold",
          claimStatus: "needs_review",
          analystReviewState: "required"
        },
        agent10ReleasePacket: {
          runtimeProofName: "public_channel_sla",
          status: "blocker",
          decisionImpact: "hold_on_blocker"
        }
      },
      releaseGate: {
        owner: "Agent 04",
        agent10ProofName: "public_channel_sla",
        decisionImpact: "hold_on_blocker",
        proofCommand: "bun test src/tests/telegramPublic.test.ts"
      },
      metrics: {
        collectionSuccess: {
          sourceCount: 1
        },
        ledgerBackedClaimYield: {
          candidateClaimCount: 3
        },
        answerReadinessImpact: {
          status: "needs_review",
          partialEvidenceOnly: true
        }
      },
      safeOutput: {
        rawPrivateDataExposed: false,
        rawMediaPayloadsExposed: false,
        credentialsExposed: false,
        mediaRetention: "metadata_only",
        piiMinimized: true
      }
    });
    expect(sla.releaseGate.blockers).toEqual(expect.arrayContaining(["public_channel_answer_readiness_needs_review"]));
    expect(sla.enforcement.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "edit_delete_churn", state: "hold" }),
      expect.objectContaining({ name: "unavailable_windows", state: "hold" }),
      expect.objectContaining({ name: "ledger_backed_claim_yield", state: "hold" }),
      expect.objectContaining({ name: "answer_readiness", state: "hold" })
    ]));
    expect(sla.controls.every((control) => control.safeOutput.mediaRetention === "metadata_only")).toBe(true);
  });

  test("applies public-channel cooldown, language, topic, and query-term abuse controls", () => {
    const controls = applyTelegramPublicAbuseControls({
      source: source({
        language: "en",
        metadata: {
          actors: ["APT29"],
          topicTags: ["espionage"],
          channelCooldownUntil: "2026-01-01T00:20:00.000Z"
        }
      }),
      query: "Akira",
      entityType: "malware",
      language: "nb",
      topicTags: ["ransomware"],
      now: "2026-01-01T00:00:00.000Z"
    });

    expect(controls).toMatchObject({
      allowed: false,
      cooldownResetAt: "2026-01-01T00:20:00.000Z",
      queryTerms: ["Akira", "Akira ransomware"],
      coverageMatched: false,
      languageMatched: false
    });
    expect(controls.notes.join(" ")).toContain("cooldown");
    expect(controls.notes.join(" ")).toContain("coverage");
    expect(controls.notes.join(" ")).toContain("language");
  });

  test("builds incremental public-channel polling DTOs with new, edited, deleted, and promoted evidence", () => {
    const dto = buildTelegramPublicIncrementalPollDto({
      cursor: 100,
      generatedAt: "2026-01-01T00:15:00.000Z",
      promotedExtractionIds: ["inc_900"],
      evidence: [
        {
          sourceId: "src_telegram",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/101",
          snippet: "Akira victim update",
          extractedUrls: [],
          confidence: 0.7,
          messageId: 101,
          messageState: "available"
        },
        {
          sourceId: "src_telegram",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/102",
          snippet: "CVE-2026-9999 edited exploit note",
          extractedUrls: ["https://advisory.example/cve"],
          confidence: 0.72,
          messageId: 102,
          messageState: "available",
          editedAt: "2026-01-01T00:12:00.000Z",
          promotedExtractionId: "inc_901",
          forward: { fromChannel: "public_origin", fromMessageId: 9, fromUrl: "https://t.me/public_origin/9" }
        },
        {
          sourceId: "src_telegram",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/103",
          snippet: "",
          extractedUrls: [],
          confidence: 0.2,
          messageId: 103,
          messageState: "deleted"
        },
        {
          sourceId: "src_telegram",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/104",
          snippet: "",
          extractedUrls: [],
          confidence: 0.2,
          messageId: 104,
          messageState: "unavailable"
        }
      ]
    });

    expect(dto.nextCursor).toBe(104);
    expect(dto.cursorState.afterMessageId).toBe(104);
    expect(dto.newMessages.map((item) => item.messageId)).toEqual([101]);
    expect(dto.updatedMessages.map((item) => item.messageId)).toEqual([102]);
    expect(dto.deletedOrUnavailable.map((item) => item.messageId)).toEqual([103, 104]);
    expect(dto.forwardedMessages.map((item) => item.messageId)).toEqual([102]);
    expect(dto.urlMentionedMessages.map((item) => item.messageId)).toEqual([102]);
    expect(dto.promotedExtractionIds).toEqual(["inc_900", "inc_901"]);
    expect(dto.media).toEqual({ retention: "metadata_only", rawFetchAllowed: false });
  });

  test("supports actor, ransomware, CVE, victim, and sector fixtures that appear after first poll", () => {
    const fixtures = [
      { query: "Scattered Spider", entityType: "actor", sourceMetadata: { actors: ["Scattered Spider"] }, snippet: "Scattered Spider intrusion update" },
      { query: "Akira", entityType: "malware", sourceMetadata: { ransomware: ["Akira"] }, snippet: "Akira ransomware leak claim" },
      { query: "CVE-2026-9999", entityType: "cve", sourceMetadata: { cves: ["CVE-2026-9999"] }, snippet: "Exploit chatter for CVE-2026-9999" },
      { query: "Fjord Energy AS", entityType: "victim", sourceMetadata: { victims: ["Fjord Energy AS"] }, snippet: "victim: Fjord Energy AS listed" },
      { query: "healthcare", entityType: "sector", sourceMetadata: { sectors: ["healthcare"] }, snippet: "healthcare sector targeting note" }
    ];

    for (const [index, fixture] of fixtures.entries()) {
      const plan = planTelegramPublicSearchBackfill({
        query: fixture.query,
        entityType: fixture.entityType,
        sources: [source({ id: `src_fixture_${index}`, metadata: fixture.sourceMetadata })]
      });
      const poll = buildTelegramPublicIncrementalPollDto({
        cursor: 10,
        evidence: [{
          sourceId: `src_fixture_${index}`,
          channel: "securityalerts",
          messageUrl: `https://t.me/securityalerts/${11 + index}`,
          snippet: fixture.snippet,
          extractedUrls: [],
          confidence: 0.68,
          messageId: 11 + index,
          messageState: "available"
        }]
      });

      expect(plan.status).toBe("partial");
      expect(poll.newMessages).toHaveLength(1);
      expect(poll.newMessages[0]?.snippet).toContain(fixture.snippet.split(" ")[0]!);
    }
  });

  test("bridges Agent 01 public-channel source metadata into sanitized planning inputs", () => {
    const bridged = bridgeTelegramPublicActivationSource(source({
      id: "src_bridge",
      url: "https://t.me/scatteredintel",
      status: "candidate",
      tags: ["identity"],
      metadata: {
        sessionString: "secret",
        phoneNumber: "+47 12345678",
        afterMessageId: 10,
        topicTags: ["cybercrime"]
      },
      catalog: {
        canonicalId: "telegram:scatteredintel",
        publisher: { name: "Public Channel", trustBasis: "community" },
        tier: "watchlist",
        approvalScope: "public_requires_review",
        license: "Public Telegram channel metadata only.",
        legalBasis: "Public posts reviewed before activation.",
        reliability: 0.6,
        intelligenceValue: 0.7,
        retentionClass: "public_chat_text",
        coverage: {
          topics: ["identity abuse"],
          actors: ["Scattered Spider"],
          aliases: ["UNC3944"],
          industries: ["telecommunications"],
          regions: ["North America"],
          countries: ["US"],
          languages: ["en"],
          queryPatterns: ["Scattered Spider identity"]
        },
        collection: {
          freshnessTargetSeconds: 3600,
          collectionSlaSeconds: 7200,
          budgetClass: "normal",
          crawlCadenceSeconds: 900
        },
        adapterCompatibility: ["telegram_public"]
      }
    }));

    expect(bridged?.channelHandle).toBe("scatteredintel");
    expect(bridged?.strippedPrivateFields).toEqual(["sessionString", "phoneNumber"]);
    expect(bridged?.source.metadata?.sessionString).toBeUndefined();
    expect(bridged?.planningMetadata.focus.actors).toEqual(["Scattered Spider", "UNC3944"]);
    expect(bridged?.planningMetadata.focus.sectors).toEqual(["telecommunications"]);
    expect(bridged?.planningMetadata.cursorState.afterMessageId).toBe(10);
  });

  test("explains public-channel coverage gaps for approval, rate-limit, policy, queue, and no coverage states", () => {
    const createdAt = "2026-01-01T00:00:00.000Z";
    const pending = source({
      id: "pending_channel",
      status: "candidate",
      approvedAt: undefined,
      approvedBy: undefined,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false,
        policyVersion: "collection-policy:v1"
      },
      metadata: { actors: ["Volt Typhoon"] }
    });
    const rateLimited = source({
      id: "rate_channel",
      metadata: { actors: ["Volt Typhoon"], rateLimitResetAt: "2026-01-01T00:05:00.000Z" }
    });
    const disabled = source({
      id: "disabled_channel",
      status: "disabled",
      metadata: { actors: ["Volt Typhoon"] }
    });
    const queued = source({
      id: "queued_channel",
      metadata: { actors: ["Volt Typhoon"] }
    });

    const gaps = explainTelegramPublicCoverageGaps({
      query: "Volt Typhoon",
      entityType: "actor",
      createdAt,
      sources: [pending, rateLimited, disabled, queued],
      queuedSourceIds: ["queued_channel"]
    });

    expect(gaps.map((gap) => gap.reason)).toEqual([
      "matching_channels_pending_review",
      "matching_channels_rate_limited",
      "matching_channels_disabled_by_policy",
      "matching_channels_actively_queued"
    ]);
    expect(explainTelegramPublicCoverageGaps({
      query: "Unknown Actor",
      sources: []
    })).toMatchObject([{ reason: "no_approved_channels", requiredAction: "none" }]);
  });

  test("public-channel query moves from activation recommendations to partial evidence after approval", async () => {
    const candidate = source({
      id: "src_random_actor",
      status: "candidate",
      approvedAt: undefined,
      approvedBy: undefined,
      governance: {
        approvalRequired: true,
        approvalState: "pending",
        metadataOnly: false,
        policyVersion: "collection-policy:v1"
      },
      metadata: { actors: ["Volt Typhoon"], topicTags: ["espionage"] }
    });
    const pendingPlan = planTelegramPublicSearchBackfill({
      query: "Volt Typhoon",
      entityType: "actor",
      sources: [candidate]
    });
    expect(pendingPlan.status).toBe("pending_channel_search");
    expect(pendingPlan.activationRecommendations[0]).toMatchObject({
      sourceId: "src_random_actor",
      requiredAction: "approve"
    });

    const approved = source({
      ...candidate,
      status: "active",
      approvedAt: new Date(0).toISOString(),
      approvedBy: "reviewer_1",
      governance: {
        approvalRequired: true,
        approvalState: "approved",
        metadataOnly: false,
        approvedAt: new Date(0).toISOString(),
        approvedBy: "reviewer_1",
        policyVersion: "collection-policy:v1"
      }
    });
    const approvedPlan = planTelegramPublicSearchBackfill({
      query: "Volt Typhoon",
      entityType: "actor",
      sources: [approved]
    });
    expect(approvedPlan.status).toBe("partial");

    const client: OfficialTelegramClient = {
      async fetchPublicChannelMessages() {
        return {
          messages: [{
            id: 1200,
            channel: "securityalerts",
            url: "https://t.me/securityalerts/1200",
            date: "2026-01-01T00:20:00.000Z",
            text: "Volt Typhoon public channel infrastructure update https://ioc.example/volt"
          }]
        };
      }
    };
    const result = await new TelegramPublicAdapter(client).collect(approved, { ...task, sourceId: approved.id });
    const evidence = publicChannelEvidenceFromCollectedItem(result.items[0]!);
    expect(evidence).toMatchObject({
      sourceId: "src_random_actor",
      messageUrl: "https://t.me/securityalerts/1200",
      messageState: "available"
    });
  });

  test("summarizes per-channel provenance and source-health updates for promoted messages", () => {
    const promoted = promotePublicChannelEvidence({
      source: source(),
      promotedAt: "2026-01-01T00:30:00.000Z",
      evidence: {
        sourceId: "src_telegram",
        channel: "securityalerts",
        messageUrl: "https://t.me/securityalerts/1300",
        messageTimestamp: "2026-01-01T00:29:00.000Z",
        snippet: "Akira victim listed https://dup.example/ioc https://dup.example/ioc",
        extractedUrls: ["https://dup.example/ioc", "https://dup.example/ioc"],
        confidence: 0.8,
        messageId: 1300,
        messageState: "available"
      }
    });
    if (!promoted.allowed) throw new Error(promoted.reason);
    const deletedItem = {
      ...promoted.item,
      url: "https://t.me/securityalerts/1301",
      publishedAt: "2026-01-01T00:31:00.000Z",
      metadata: { ...promoted.item.metadata, messageId: 1301, messageState: "deleted" }
    };

    const health = buildTelegramPublicSourceHealthUpdate({
      source: source(),
      items: [promoted.item, deletedItem],
      rateLimitResetAt: "2026-01-01T00:40:00.000Z",
      policyBlockedCount: 1,
      updatedAt: "2026-01-01T00:35:00.000Z"
    });

    expect(health).toMatchObject({
      sourceId: "src_telegram",
      channel: "securityalerts",
      lastSeenMessageId: 1301,
      lastSeenMessageDate: "2026-01-01T00:31:00.000Z",
      fetchOutcome: "rate_limited",
      rateLimitResetAt: "2026-01-01T00:40:00.000Z",
      provenance: {
        adapter: "telegram_public",
        updatedAt: "2026-01-01T00:35:00.000Z",
        messageCount: 2,
        promotedMessageIds: [1300]
      }
    });
    expect(health.duplicateUrlRate).toBeGreaterThan(0);
    expect(health.deletedUnavailableRate).toBe(0.5);
    expect(health.policyBlockRate).toBeCloseTo(1 / 3);
  });

  test("scores public-channel reliability for spam churn language stale cursors and repeated actor queries", () => {
    const generatedAt = "2026-01-01T02:00:00.000Z";
    const reliability = buildTelegramPublicReliabilityReport({
      query: "APT29",
      entityType: "actor",
      language: "nb",
      generatedAt,
      sources: [
        source({
          id: "spammy",
          metadata: { actors: ["APT29"], lastDiscoveredUrls: ["https://repeat.example/ioc"] }
        }),
        source({
          id: "churn",
          metadata: { actors: ["APT29"] }
        }),
        source({
          id: "non_english_relevant",
          language: "ru",
          metadata: { actors: ["APT29"], topicTags: ["espionage"] }
        }),
        source({
          id: "stale_cursor",
          metadata: { actors: ["APT29"] },
          crawlState: { cursor: "42", lastCollectedAt: "2026-01-01T00:00:00.000Z", retryCount: 0 }
        }),
        source({
          id: "rate_limited",
          metadata: { actors: ["APT29"], rateLimitResetAt: "2026-01-01T02:30:00.000Z" }
        })
      ],
      evidence: [
        {
          sourceId: "spammy",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/1",
          messageTimestamp: "2026-01-01T01:59:00.000Z",
          snippet: "APT29 repeated actor query https://repeat.example/ioc https://repeat.example/ioc",
          extractedUrls: ["https://repeat.example/ioc", "https://repeat.example/ioc"],
          confidence: 0.8,
          messageId: 1,
          messageState: "available",
          contentHash: "spam-1"
        },
        {
          sourceId: "spammy",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/2",
          messageTimestamp: "2026-01-01T01:58:00.000Z",
          snippet: "APT29 repeated actor query https://repeat.example/ioc https://repeat.example/ioc",
          extractedUrls: ["https://repeat.example/ioc", "https://repeat.example/ioc"],
          confidence: 0.8,
          messageId: 2,
          messageState: "available",
          contentHash: "spam-2"
        },
        {
          sourceId: "churn",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/10",
          messageTimestamp: "2026-01-01T01:58:00.000Z",
          snippet: "APT29 edited claim",
          extractedUrls: [],
          confidence: 0.7,
          messageId: 10,
          messageState: "available",
          editedAt: "2026-01-01T01:59:00.000Z"
        },
        {
          sourceId: "churn",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/11",
          messageTimestamp: "2026-01-01T01:59:00.000Z",
          snippet: "APT29 deleted claim",
          extractedUrls: [],
          confidence: 0.7,
          messageId: 11,
          messageState: "deleted"
        },
        {
          sourceId: "non_english_relevant",
          channel: "securityalerts",
          messageUrl: "https://t.me/securityalerts/20",
          messageTimestamp: "2026-01-01T01:55:00.000Z",
          snippet: "APT29 кампании против энергетического сектора",
          extractedUrls: [],
          languageHint: "ru",
          confidence: 0.75,
          messageId: 20,
          messageState: "available",
          contentHash: "ru-20"
        }
      ],
      healthUpdates: [{
        sourceId: "churn",
        channel: "securityalerts",
        fetchOutcome: "success",
        duplicateUrlRate: 0,
        deletedUnavailableRate: 0.5,
        policyBlockRate: 0,
        provenance: { adapter: "telegram_public", updatedAt: generatedAt, messageCount: 2, promotedMessageIds: [] }
      }]
    });

    expect(reliability.safeOutput).toMatchObject({
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      piiMinimized: true
    });
    expect(reliability.sources.find((item) => item.sourceId === "spammy")).toMatchObject({
      rating: "watch",
      recommendedActions: expect.arrayContaining(["suppress_repeated_urls"])
    });
    expect(reliability.sources.find((item) => item.sourceId === "churn")).toMatchObject({
      needsReview: true,
      recommendedActions: expect.arrayContaining(["reduce_window", "request_review"])
    });
    const nonEnglishRelevant = reliability.sources.find((item) => item.sourceId === "non_english_relevant");
    expect(["healthy", "watch"]).toContain(nonEnglishRelevant?.rating ?? "");
    expect(nonEnglishRelevant).toMatchObject({
      partialEvidenceOnly: false,
      metrics: {
        topicFit: expect.any(Number),
        languageCoverage: 0.65
      },
      reasons: expect.arrayContaining(["topic-relevant public evidence preserved even with imperfect language match"])
    });
    expect(reliability.sources.find((item) => item.sourceId === "stale_cursor")).toMatchObject({
      recommendedActions: expect.arrayContaining(["refresh_cursor"])
    });
    expect(reliability.sources.find((item) => item.sourceId === "rate_limited")).toMatchObject({
      recommendedActions: expect.arrayContaining(["delay_poll"])
    });
    expect(reliability.summary.needsReviewCount).toBeGreaterThanOrEqual(1);
  });

  test("validates disabled-by-default public Telegram source-pack fixtures without network access", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const validation = validateTelegramPublicSourcePack(pack, "2026-05-24T00:00:00.000Z");

    expect(pack.disabledByDefault).toBe(true);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.accepted).toHaveLength(7);
    expect(validation.accepted.every((item) => item.status === "candidate")).toBe(true);
    expect(validation.accepted.every((item) => item.metadata?.sourcePackId === "public-telegram-cti-candidates")).toBe(true);
    expect(validation.accepted.every((item) => item.governance?.approvalState === "pending")).toBe(true);
    expect(validation.accepted.flatMap((item) => item.metadata?.actors as string[] | undefined ?? [])).toEqual(expect.arrayContaining(["APT29", "Scattered Spider"]));
    expect(validation.accepted.flatMap((item) => item.metadata?.ransomware as string[] | undefined ?? [])).toEqual(expect.arrayContaining(["Akira", "LockBit"]));
    expect(validation.accepted.flatMap((item) => item.metadata?.cves as string[] | undefined ?? [])).toEqual(expect.arrayContaining(["CVE-2026-9999", "CVE-2026-12345"]));
    expect(validation.accepted.flatMap((item) => item.metadata?.topicTags as string[] | undefined ?? [])).toEqual(expect.arrayContaining(["bursty spam", "edited posts", "unavailable window"]));
  });

  test("builds source-pack compatibility contracts with publicness proof and abuse defaults", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const compatibility = buildTelegramPublicSourcePackCompatibility({
      generatedAt: "2026-05-24T00:00:00.000Z",
      sourcePacks: [pack],
      sources: [
        source({
          id: "src_registry_public",
          metadata: {
            actors: ["APT29"],
            topicTags: ["espionage"],
            publicQueryWindowLimit: 20,
            pageSize: 40,
            minIntervalSeconds: 120
          }
        }),
        source({
          id: "src_unsafe_private",
          url: "https://t.me/+privateInvite",
          metadata: { accountAutomation: true }
        })
      ]
    });

    expect(compatibility.find((item) => item.sourceId === "src_registry_public")).toMatchObject({
      compatible: true,
      approvalState: "approved",
      channelPublicnessProof: {
        publicUrlParseable: true,
        inviteOrPrivateUrl: false,
        accountAutomationFieldsPresent: false
      },
      retentionClass: "public_chat_text",
      abuseControlDefaults: {
        pageSize: 40,
        minIntervalSeconds: 120,
        publicQueryWindowLimit: 20,
        mediaRetention: "metadata_only",
        piiMinimized: true
      }
    });
    expect(compatibility.find((item) => item.sourceId === "src_unsafe_private")).toMatchObject({
      compatible: false,
      channelPublicnessProof: {
        publicUrlParseable: false,
        inviteOrPrivateUrl: true,
        accountAutomationFieldsPresent: true
      }
    });
    expect(compatibility.some((item) => item.sourcePackId === "public-telegram-cti-candidates")).toBe(true);
  });

  test("builds source-pack production readiness with replayable evidence and safe caveats", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const approvedSource = source({
      id: "src_public_ready",
      url: "https://t.me/public_apt29_research",
      metadata: {
        actors: ["APT29"],
        sectors: ["government", "technology"],
        countries: ["NO", "US"],
        topicTags: ["apt", "country monitoring"],
        approvalScope: "approved_public",
        pageSize: 30,
        minIntervalSeconds: 300,
        publicQueryWindowLimit: 25,
        expectedRequestsPerHour: 12
      }
    });
    const evidence = [
      {
        sourceId: "src_public_ready",
        channel: "public_apt29_research",
        messageUrl: "https://t.me/public_apt29_research/101",
        messageTimestamp: "2026-05-24T00:01:00.000Z",
        snippet: "APT29 public report references CVE-2026-12345 in government sector.",
        extractedUrls: ["https://example.test/report"],
        languageHint: "en",
        confidence: 0.91,
        messageId: 101,
        messageState: "available" as const,
        contentHash: "hash-101"
      },
      {
        sourceId: "src_public_ready",
        channel: "public_apt29_research",
        messageUrl: "https://t.me/public_apt29_research/102",
        messageTimestamp: "2026-05-24T00:02:00.000Z",
        snippet: "Edited APT29 public update for Norway energy monitoring.",
        extractedUrls: ["https://example.test/report"],
        languageHint: "en",
        confidence: 0.82,
        messageId: 102,
        messageState: "available" as const,
        editedAt: "2026-05-24T00:03:00.000Z",
        contentHash: "hash-102"
      },
      {
        sourceId: "src_public_ready",
        channel: "public_apt29_research",
        messageUrl: "https://t.me/public_apt29_research/103",
        messageTimestamp: "2026-05-24T00:04:00.000Z",
        snippet: "Unavailable public post retained as metadata-only provenance.",
        extractedUrls: ["https://example.test/report"],
        languageHint: "en",
        confidence: 0.64,
        messageId: 103,
        messageState: "unavailable" as const,
        contentHash: "hash-103"
      }
    ];
    const reliability = buildTelegramPublicReliabilityReport({
      query: "APT29",
      entityType: "actor",
      sources: [approvedSource],
      evidence,
      generatedAt: "2026-05-24T00:05:00.000Z"
    });
    const readiness = buildTelegramPublicSourcePackReadiness({
      sources: [approvedSource],
      sourcePacks: [pack],
      evidence,
      reliability,
      generatedAt: "2026-05-24T00:05:00.000Z"
    });

    expect(readiness.summary.sourcePackCount).toBe(1);
    expect(readiness.summary.candidateCount).toBeGreaterThanOrEqual(7);
    expect(readiness.summary.approvedPublicCount).toBe(1);
    expect(readiness.summary.replayableEvidenceCount).toBe(3);
    expect(readiness.safeOutput).toMatchObject({
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false,
      mediaRetention: "metadata_only",
      piiMinimized: true
    });
    const ready = readiness.sources.find((item) => item.sourceId === "src_public_ready");
    expect(ready).toMatchObject({
      approvalScope: "approved_public",
      approvalState: "approved",
      collectionWindow: {
        pageSize: 30,
        minIntervalSeconds: 300,
        expectedRequestsPerHour: 12,
        publicQueryWindowLimit: 25
      },
      rateLimitBudget: {
        bounded: true,
        delayed: false
      },
      dedupePolicy: {
        repeatedUrlSuppression: true,
        contentHashRequired: true,
        duplicateUrlPressure: "watch"
      },
      editDeleteHandling: {
        editedMessagesPreserved: true,
        deletedUnavailableReplayableAsMetadata: true,
        churn: "high"
      },
      replayableEvidenceHandoff: {
        targetAgent: "agent_06",
        cursorReplayReady: true,
        metadataOnly: true
      },
      answerCaveats: {
        targetAgent: "agent_07",
        caveatCodes: expect.arrayContaining(["public_channel_deleted_or_unavailable_messages", "public_channel_edited_messages_preserved", "public_channel_duplicate_url_pressure"])
      },
      releaseGate: {
        targetAgent: "agent_10",
        status: "warning"
      }
    });
    expect(ready?.coverage.actors).toEqual(expect.arrayContaining(["APT29"]));
    expect(ready?.coverage.sectors).toEqual(expect.arrayContaining(["government", "technology"]));
    expect(ready?.replayableEvidenceHandoff.ledgerIds).toHaveLength(3);
    expect(ready?.replayableEvidenceHandoff.messageUrls).toHaveLength(3);
    expect(readiness.sources.find((item) => item.sourceId === "tg_candidate_bursty_duplicate_watch")).toMatchObject({
      coverage: {
        actors: expect.arrayContaining(["Scattered Spider"]),
        topicTags: expect.arrayContaining(["bursty spam", "duplicate url pressure"])
      },
      releaseGate: {
        status: "warning"
      }
    });
  });

  test("builds dry-run public-channel canary rollout for first and five-channel phases", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const sources = ["apt29", "ransomware", "cve", "regional", "burst"].map((id, index) => source({
      id: `src_canary_${id}`,
      name: `Canary ${id}`,
      url: `https://t.me/public_canary_${id}`,
      language: index === 3 ? "nb" : "en",
      metadata: {
        actors: id === "apt29" ? ["APT29"] : id === "burst" ? ["Scattered Spider"] : [],
        ransomware: id === "ransomware" ? ["Akira"] : [],
        cves: id === "cve" ? ["CVE-2026-9999"] : [],
        victims: id === "ransomware" ? ["Fjord Energy AS"] : [],
        sectors: id === "regional" ? ["energy", "telecommunications"] : ["technology"],
        countries: id === "regional" ? ["NO", "US"] : ["US"],
        topicTags: [id, "canary"],
        approvalScope: "approved_public",
        pageSize: 40,
        minIntervalSeconds: 300,
        publicQueryWindowLimit: 40,
        expectedRequestsPerHour: 12
      }
    }));
    const evidence = [
      {
        sourceId: "src_canary_apt29",
        channel: "public_canary_apt29",
        messageUrl: "https://t.me/public_canary_apt29/1",
        messageTimestamp: "2026-05-24T00:00:00.000Z",
        snippet: "APT29 canary public message",
        extractedUrls: ["https://example.test/apt29"],
        confidence: 0.9,
        messageId: 1,
        messageState: "available" as const,
        contentHash: "hash-apt29"
      },
      {
        sourceId: "src_canary_burst",
        channel: "public_canary_burst",
        messageUrl: "https://t.me/public_canary_burst/9",
        messageTimestamp: "2026-05-24T00:02:00.000Z",
        snippet: "Scattered Spider bursty actor post edited",
        extractedUrls: ["https://example.test/repeat", "https://example.test/repeat"],
        confidence: 0.74,
        messageId: 9,
        messageState: "unavailable" as const,
        editedAt: "2026-05-24T00:03:00.000Z",
        contentHash: "hash-burst"
      }
    ];
    const reliability = buildTelegramPublicReliabilityReport({
      query: "APT29",
      entityType: "actor",
      sources,
      evidence,
      generatedAt: "2026-05-24T00:05:00.000Z"
    });
    const applyPlan = buildTelegramPublicApplyPlan({
      query: "APT29",
      entityType: "actor",
      sources: [
        ...sources,
        source({
          id: "src_canary_paused",
          status: "quarantined",
          metadata: { actors: ["APT29"], approvalScope: "approved_public" }
        })
      ],
      healthUpdates: [{
        sourceId: "src_canary_paused",
        channel: "public_canary_paused",
        fetchOutcome: "failed",
        duplicateUrlRate: 0,
        deletedUnavailableRate: 0,
        policyBlockRate: 0,
        provenance: { adapter: "telegram_public", updatedAt: "2026-05-24T00:05:00.000Z", messageCount: 0, promotedMessageIds: [] }
      }],
      generatedAt: "2026-05-24T00:05:00.000Z"
    });
    const rollout = buildTelegramPublicCanaryRollout({
      sources: [
        ...sources,
        source({
          id: "src_canary_paused",
          status: "quarantined",
          metadata: { actors: ["APT29"], approvalScope: "approved_public" }
        })
      ],
      sourcePacks: [pack],
      evidence,
      reliability,
      applyPlan,
      generatedAt: "2026-05-24T00:05:00.000Z"
    });

    expect(rollout.mode).toBe("dry_run");
    expect(rollout.summary).toMatchObject({
      approvedSourceCount: 6,
      selectedSourceCount: 5,
      pendingReviewCount: 7,
      maxParallelSources: 5,
      releaseTrain: "canary_with_warnings"
    });
    expect(rollout.selectedSources[0]).toMatchObject({
      phase: "first_channel",
      collectionWindow: {
        pageSize: 25,
        publicQueryWindowLimit: 25
      },
      queryDedupe: {
        repeatedActorQuerySuppression: true,
        repeatedUrlSuppression: true
      },
      agent06EvidenceHandoff: {
        metadataOnly: true
      }
    });
    expect(rollout.selectedSources.slice(1).every((item) => item.phase === "five_channel")).toBe(true);
    expect(rollout.selectedSources.find((item) => item.sourceId === "src_canary_burst")).toMatchObject({
      spamChurnDetection: {
        duplicateUrlPressure: "watch",
        editDeleteChurn: "high",
        unavailableWindowPressure: "high"
      },
      agent07AnswerCaveats: expect.arrayContaining([
        "public_channel_duplicate_url_pressure",
        "public_channel_deleted_or_unavailable_messages",
        "public_channel_edited_messages_preserved",
        "public_channel_unavailable_window_canary_watch"
      ]),
      agent10ReleaseTrain: {
        status: "warning"
      }
    });
    expect(rollout.pendingCandidates.map((item) => item.sourceId)).toEqual(expect.arrayContaining([
      "tg_candidate_apt29_research",
      "tg_candidate_ransomware_claims",
      "tg_candidate_vuln_exploit",
      "tg_candidate_sector_country_watch",
      "tg_candidate_bursty_duplicate_watch",
      "tg_candidate_edit_delete_window"
    ]));
    expect(rollout.controls).toMatchObject({
      queryDedupe: {
        repeatedActorQueryControls: true,
        actorQueryCooldownSeconds: 300,
        duplicateUrlSuppression: true
      },
      abuse: {
        burstySpamDetection: true,
        editDeleteReplay: true,
        unavailableWindowHandling: "metadata_only_replay",
        sourcePauseQuarantine: true
      },
      rollback: {
        dryRunOnly: true,
        rollbackActions: expect.arrayContaining(["quarantine_channel"])
      }
    });
    expect(rollout.safeOutput).toMatchObject({
      rawPrivateDataExposed: false,
      rawMediaPayloadsExposed: false,
      credentialsExposed: false
    });
  });

  test("builds promotion canary proof for source health, claims, graph hints, and safe handoffs", () => {
    const generatedAt = "2026-05-24T01:00:00.000Z";
    const sources = [
      source({
        id: "src_apt29_canary",
        url: "https://t.me/public_apt29_canary",
        language: "en",
        metadata: { actors: ["APT29"], topicTags: ["apt"], approvalScope: "approved_public", lastDiscoveredUrls: ["https://repeat.example/ioc"] }
      }),
      source({
        id: "src_rate_limited_canary",
        url: "https://t.me/public_rate_canary",
        metadata: { actors: ["Scattered Spider"], approvalScope: "approved_public", rateLimitResetAt: "2026-05-24T02:00:00.000Z" }
      }),
      source({
        id: "src_low_yield_canary",
        url: "https://t.me/public_low_yield",
        language: "es",
        metadata: { ransomware: ["Akira"], victims: ["Fjord Energy AS"], approvalScope: "approved_public" }
      })
    ];
    const evidence = [
      {
        sourceId: "src_apt29_canary",
        channel: "public_apt29_canary",
        messageUrl: "https://t.me/public_apt29_canary/10",
        messageTimestamp: generatedAt,
        snippet: "APT29 targets government sector with CVE-2026-9999 in Norway https://repeat.example/ioc",
        extractedUrls: ["https://repeat.example/ioc", "https://repeat.example/ioc"],
        extractionHandoff: { actorAliases: ["APT29"], cves: ["CVE-2026-9999"], victims: [], uncertaintyMarkers: [] },
        confidence: 0.88,
        messageId: 10,
        messageState: "available" as const,
        contentHash: "hash-apt29-canary"
      },
      {
        sourceId: "src_rate_limited_canary",
        channel: "public_rate_canary",
        messageUrl: "https://t.me/public_rate_canary/11",
        messageTimestamp: generatedAt,
        snippet: "Scattered Spider bursty actor search edited post for hospitality",
        extractedUrls: ["https://burst.example/a", "https://burst.example/a"],
        extractionHandoff: { actorAliases: ["Scattered Spider"], cves: [], victims: [], uncertaintyMarkers: ["claim_uncorroborated"] },
        confidence: 0.7,
        messageId: 11,
        messageState: "unavailable" as const,
        editedAt: "2026-05-24T01:01:00.000Z",
        contentHash: "hash-burst-canary"
      },
      {
        sourceId: "src_low_yield_canary",
        channel: "public_low_yield",
        messageUrl: "https://t.me/public_low_yield/12",
        messageTimestamp: generatedAt,
        snippet: "Akira victim: Fjord Energy AS",
        extractedUrls: [],
        extractionHandoff: { actorAliases: [], cves: [], victims: ["Fjord Energy AS"], uncertaintyMarkers: ["claim_uncorroborated"] },
        confidence: 0.62,
        messageId: 12,
        messageState: "deleted" as const,
        contentHash: "hash-akira-canary"
      }
    ];
    const reliability = buildTelegramPublicReliabilityReport({
      query: "APT29",
      entityType: "actor",
      sources,
      evidence,
      language: "en",
      generatedAt
    });
    const rollout = buildTelegramPublicCanaryRollout({ sources, evidence, reliability, generatedAt });
    const proof = buildTelegramPublicPromotionCanaryProof({
      query: "APT29",
      entityType: "actor",
      sources,
      evidence,
      reliability,
      canaryRollout: rollout,
      generatedAt
    });

    expect(proof.mode).toBe("dry_run");
    expect(proof.summary).toMatchObject({
      sourceCount: 3,
      evidenceCount: 3,
      claimCandidateCount: expect.any(Number),
      graphHintCount: expect.any(Number),
      replayableEvidenceCount: 3,
      noLeakSerialization: true
    });
    expect(proof.sourceHealth.find((item) => item.sourceId === "src_rate_limited_canary")).toMatchObject({
      rateLimitDebt: "delayed",
      duplicateUrlPressure: "watch",
      editDeleteChurn: "high",
      unavailableWindows: "high",
      spamChurn: "high",
      rollbackTriggers: expect.arrayContaining(["delay_poll", "reduce_window", "suppress_repeated_urls"])
    });
    expect(proof.sourceHealth.find((item) => item.sourceId === "src_low_yield_canary")).toMatchObject({
      languageDrift: "watch",
      unavailableWindows: "high"
    });
    expect(proof.evidenceFlow).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceId: "src_apt29_canary",
        promotedToAgent06: true,
        replayable: true,
        claimCandidateIds: expect.any(Array),
        graphHintIds: expect.any(Array)
      }),
      expect.objectContaining({
        sourceId: "src_rate_limited_canary",
        state: "edited",
        replayable: true
      })
    ]));
    expect(proof.claimCandidates.map((claim) => claim.kind)).toEqual(expect.arrayContaining(["actor", "cve", "victim", "ransomware", "sector", "country", "url"]));
    expect(proof.graphHints.map((hint) => hint.relationship)).toEqual(expect.arrayContaining(["actor-cve", "actor-sector", "actor-country", "message-url", "ransomware-victim"]));
    expect(proof.handoffs.agent06EvidenceCutover).toMatchObject({
      evidenceCutoverReady: true,
      replayableLedgerIds: expect.any(Array)
    });
    expect(proof.handoffs.agent07PublicAnswer).toMatchObject({
      answerState: expect.stringMatching(/partial|needs_review/),
      caveatCodes: expect.arrayContaining(["public_channel_duplicate_url_pressure", "public_channel_edit_delete_churn", "public_channel_unavailable_windows"])
    });
    expect(proof.handoffs.agent10RcGate.status).toBe("blocker");
    expect(proof.handoffs.agent10RcGate.reasons).toEqual(expect.arrayContaining(["public-channel canary has quarantine rollback trigger"]));
    const certification = buildTelegramPublicPromotionCertification({
      query: "APT29",
      entityType: "actor",
      sources,
      evidence,
      promotionCanary: proof,
      generatedAt
    });
    expect(certification).toMatchObject({
      mode: "dry_run",
      status: "blocked",
      summary: {
        certifiedEvidenceCount: expect.any(Number),
        heldEvidenceCount: expect.any(Number),
        blockedEvidenceCount: expect.any(Number),
        answerEligibleClaimCount: expect.any(Number),
        graphEligibleHintCount: expect.any(Number),
        sourceHealthUpdateCount: 3,
        releaseDecision: "hold",
        rollbackRequired: true,
        noLeakSerialization: true
      },
      handoffs: {
        agent06EvidenceCertification: expect.objectContaining({
          certifiedLedgerIds: expect.any(Array),
          heldLedgerIds: expect.any(Array),
          blockedLedgerIds: expect.any(Array)
        }),
        agent07AnswerStateMachine: expect.objectContaining({
          state: "needs_review",
          transition: "block_public_channel_claims",
          caveatCodes: expect.arrayContaining(["public_channel_certification_partial_evidence", "public_channel_certification_blocked_evidence"])
        }),
        agent08GraphCertification: expect.objectContaining({
          status: expect.stringMatching(/blocked|review_required|certified/)
        }),
        agent10RcGate: expect.objectContaining({
          status: "blocker",
          decision: "hold",
          rollbackActions: expect.arrayContaining(["suppress_repeated_urls", "reduce_window", "quarantine_channel"])
        })
      }
    });
    expect(certification.decisionRules.map((rule) => rule.surface)).toEqual(expect.arrayContaining(["public_answer", "graph", "source_health", "release"]));
    expect(certification.evidenceCertification.some((item) =>
      item.sourceId === "src_apt29_canary" &&
      item.publicAnswerAllowed &&
      item.graphHintAllowed &&
      item.influence === "answer_and_graph"
    )).toBe(true);
    expect(certification.evidenceCertification.some((item) =>
      item.sourceId === "src_rate_limited_canary" &&
      item.influence === "source_health_only" &&
      item.sourceHealthUpdateAllowed
    )).toBe(true);
    expect(certification.claimCertification.map((claim) => claim.kind)).toEqual(expect.arrayContaining(["actor", "cve", "victim", "ransomware", "sector", "country", "url"]));
    expect(certification.graphCertification.map((hint) => hint.relationship)).toEqual(expect.arrayContaining(["actor-cve", "actor-sector", "actor-country", "message-url", "ransomware-victim"]));
    const serialized = JSON.stringify(proof);
    const certificationSerialized = JSON.stringify(certification);
    for (const forbidden of ["rawMessage", "sessionString", "mediaPayload", "phoneNumber", "password", "inviteLink"]) {
      expect(serialized).not.toContain(forbidden);
      expect(certificationSerialized).not.toContain(forbidden);
    }
  });

  test("rejects unsafe public Telegram source-pack entries", () => {
    const unsafe: TelegramPublicSourcePack = {
      version: 1,
      id: "unsafe-pack",
      name: "unsafe-pack",
      disabledByDefault: true,
      sources: [{
        id: "unsafe_private",
        name: "Unsafe Private Channel",
        channelHandle: "unsafe",
        publicUrl: "https://t.me/+privateInvite",
        legalNotes: "",
        approvalState: "pending",
        retentionClass: "public_chat_text",
        topicTags: ["actor"],
        focus: { actors: ["APT29"], ransomware: [], cves: [], victims: [], sectors: [], countries: [] },
        rateLimit: { minIntervalSeconds: 10, pageSize: 500 },
        compliance: { legalBasis: "", license: "", approvalScope: "public_requires_review" },
        metadata: {
          accountAutomation: true,
          sessionString: "secret",
          mediaDownload: true
        }
      }]
    };

    const validation = validateTelegramPublicSourcePack(unsafe);
    expect(validation.valid).toBe(false);
    expect(validation.accepted).toEqual([]);
    expect(validation.errors.map((error) => error.message).join(" ")).toContain("invite");
    expect(validation.errors.map((error) => error.message).join(" ")).toContain("legal");
    expect(validation.errors.map((error) => error.message).join(" ")).toContain("rate limits");
    expect(validation.errors.map((error) => error.message).join(" ")).toContain("mediaDownload");
  });

  test("recommends exact public-channel source packs for random actor ransomware CVE victim and sector queries", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const fixtures = [
      { query: "Scattered Spider", entityType: "actor", expectedSource: "tg_candidate_bursty_duplicate_watch" },
      { query: "Akira", entityType: "malware", expectedSource: "tg_candidate_edit_delete_window" },
      { query: "CVE-2026-9999", entityType: "cve", expectedSource: "tg_candidate_vuln_exploit" },
      { query: "Fjord Energy AS", entityType: "victim", expectedSource: "tg_candidate_edit_delete_window" },
      { query: "healthcare", entityType: "sector", expectedSource: "tg_candidate_edit_delete_window" }
    ];

    for (const fixture of fixtures) {
      const recommendations = recommendTelegramPublicSourcePacks({
        query: fixture.query,
        entityType: fixture.entityType,
        packs: [pack]
      });
      expect(recommendations[0]).toMatchObject({
        sourcePackId: "public-telegram-cti-candidates",
        sourceId: fixture.expectedSource,
        requiredAction: "review"
      });
      expect(recommendations[0]!.score).toBeGreaterThan(0);
    }
  });

  test("adds source-pack recommendations to public-channel search backfill plans", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const plan = planTelegramPublicSearchBackfill({
      query: "Volt Typhoon",
      entityType: "actor",
      sources: [],
      sourcePacks: [pack]
    });

    expect(plan.tasks).toEqual([]);
    expect(plan.status).toBe("pending_channel_search");
    expect(plan.sourcePackRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    expect(plan.activationRecommendations[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity",
      requiredAction: "review"
    });
    expect(plan.activationProgram.recommendedPublicPacks[0]).toMatchObject({
      sourcePackId: "public-telegram-cti-candidates",
      sourceId: "tg_candidate_actor_identity"
    });
  });

  test("builds Agent 09 activation outputs for source packs and channel states", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const createdAt = "2026-01-01T00:00:00.000Z";
    const program = buildTelegramPublicActivationProgram({
      query: "APT29",
      entityType: "actor",
      createdAt,
      sourcePacks: [pack],
      queuedSourceIds: ["active_queued"],
      sources: [
        source({ id: "active_queued", metadata: { actors: ["APT29"] } }),
        source({
          id: "pending_review",
          status: "candidate",
          approvedAt: undefined,
          approvedBy: undefined,
          governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false, policyVersion: "collection-policy:v1" },
          metadata: { actors: ["APT29"] }
        }),
        source({ id: "rate_limited", metadata: { actors: ["APT29"], rateLimitResetAt: "2026-01-01T00:10:00.000Z" } }),
        source({ id: "disabled_policy", status: "disabled", metadata: { actors: ["APT29"] } })
      ]
    });

    expect(program.matchingActiveChannels[0]).toMatchObject({ sourceId: "active_queued", requiredAction: "wait" });
    expect(program.pendingReviewChannels[0]).toMatchObject({ sourceId: "pending_review", requiredAction: "approve" });
    expect(program.rateLimitedChannels[0]).toMatchObject({ sourceId: "rate_limited", rateLimitResetAt: "2026-01-01T00:10:00.000Z" });
    expect(program.disabledByPolicyChannels[0]).toMatchObject({ sourceId: "disabled_policy", requiredAction: "fix_policy" });
    expect(program.recommendedPublicPacks.length).toBeGreaterThanOrEqual(0);
  });

  test("public channels augment clear-web intelligence fixtures for actors ransomware and regional queries", () => {
    const fixtures = [
      { query: "APT29", entityType: "actor", sourceMetadata: { actors: ["APT29"], topicTags: ["espionage"] }, snippet: "APT29 public channel note augments vendor report" },
      { query: "Scattered Spider", entityType: "actor", sourceMetadata: { actors: ["Scattered Spider"], topicTags: ["identity"] }, snippet: "Scattered Spider SIM swap channel mention" },
      { query: "Akira", entityType: "malware", sourceMetadata: { ransomware: ["Akira"], victims: ["Fjord Energy AS"] }, snippet: "Akira public claim after clear-web article" },
      { query: "Norway", entityType: "country", sourceMetadata: { countries: ["Norway"], sectors: ["energy"] }, snippet: "Norway energy sector public channel mention" }
    ];

    for (const [index, fixture] of fixtures.entries()) {
      const plan = planTelegramPublicSearchBackfill({
        query: fixture.query,
        entityType: fixture.entityType,
        sources: [source({ id: `src_aug_${index}`, metadata: fixture.sourceMetadata })]
      });
      const poll = buildTelegramPublicIncrementalPollDto({
        cursor: 1,
        evidence: [{
          sourceId: `src_aug_${index}`,
          channel: "securityalerts",
          messageUrl: `https://t.me/securityalerts/${2000 + index}`,
          messageTimestamp: "2026-01-01T00:00:00.000Z",
          snippet: fixture.snippet,
          extractedUrls: ["https://clearweb.example/report"],
          confidence: 0.66,
          messageId: 2000 + index,
          messageState: "available"
        }]
      });

      expect(plan.status).toBe("partial");
      expect(plan.tasks[0]?.planning?.queryTerms).toContain(fixture.query);
      expect(poll.newMessages).toHaveLength(1);
      expect(poll.urlMentionedMessages).toHaveLength(1);
    }
  });

  test("source-pack entries convert to candidate SourceRecord shape with safe catalog metadata", () => {
    const entry: TelegramPublicSourcePack["sources"][number] = {
      id: "tg_candidate_sector",
      name: "Public Sector Channel",
      channelHandle: "public_sector_channel",
      publicUrl: "https://t.me/public_sector_channel",
      legalNotes: "Candidate public sector channel reviewed for public posts only.",
      approvalState: "pending",
      retentionClass: "public_chat_text",
      topicTags: ["sector"],
      focus: { actors: [], ransomware: [], cves: [], victims: [], sectors: ["finance"], countries: ["NO"] },
      rateLimit: { minIntervalSeconds: 300, pageSize: 25 },
      compliance: {
        legalBasis: "Public post monitoring.",
        license: "Public Telegram posts; review before activation.",
        approvalScope: "public_requires_review",
        takedownContact: "legal@example.test"
      },
      trustScore: 0.61
    };
    const record = telegramPublicSourcePackEntryToSource({ id: "pack", name: "Pack" }, entry, "2026-05-24T00:00:00.000Z");

    expect(record).toMatchObject({
      id: "tg_candidate_sector",
      type: "telegram_public",
      accessMethod: "official_api",
      status: "candidate",
      risk: "medium",
      legalNotes: expect.stringContaining("public sector"),
      governance: {
        approvalRequired: true,
        approvalState: "pending"
      },
      metadata: {
        sourcePackId: "pack",
        channelHandle: "public_sector_channel",
        sectors: ["finance"],
        countries: ["NO"],
        retentionClass: "public_chat_text",
        takedownContact: "legal@example.test"
      },
      catalog: {
        approvalScope: "public_requires_review",
        retentionClass: "public_chat_text",
        adapterCompatibility: ["telegram_public"]
      }
    });
  });

  test("reconciles public source packs registry health cursors scheduler and evidence freshness", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const generatedAt = "2026-01-01T01:00:00.000Z";
    const active = source({
      id: "active_actor",
      metadata: { actors: ["APT29"], afterMessageId: 10 },
      crawlState: {
        cursor: "10",
        lastCollectedAt: "2026-01-01T00:00:00.000Z",
        retryCount: 0
      }
    });
    const approvedIdle = source({
      id: "approved_idle",
      status: "approved",
      metadata: { actors: ["APT29"] }
    });
    const pending = source({
      id: "pending_review",
      status: "candidate",
      approvedAt: undefined,
      approvedBy: undefined,
      governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false, policyVersion: "collection-policy:v1" },
      metadata: { actors: ["APT29"] }
    });
    const rateLimited = source({
      id: "rate_limited",
      metadata: { actors: ["APT29"], rateLimitResetAt: "2026-01-01T01:20:00.000Z" }
    });
    const disabled = source({
      id: "disabled_policy",
      status: "disabled",
      metadata: { actors: ["APT29"] }
    });
    const unrelated = source({
      id: "unrelated",
      metadata: { ransomware: ["Akira"] }
    });

    const reconciliation = buildTelegramPublicReconciliation({
      query: "APT29",
      entityType: "actor",
      generatedAt,
      sourcePacks: [pack],
      sources: [active, approvedIdle, pending, rateLimited, disabled, unrelated],
      scheduler: {
        queuedSourceIds: ["rate_limited"],
        deadLetterSourceIds: ["active_actor"],
        retryAfterBySourceId: { rate_limited: 1200 }
      },
      healthUpdates: [
        {
          sourceId: "active_actor",
          channel: "securityalerts",
          lastSeenMessageId: 10,
          lastSeenMessageDate: "2026-01-01T00:00:00.000Z",
          fetchOutcome: "failed",
          duplicateUrlRate: 0.5,
          deletedUnavailableRate: 0.4,
          policyBlockRate: 0,
          provenance: { adapter: "telegram_public", updatedAt: generatedAt, messageCount: 10, promotedMessageIds: [] }
        }
      ],
      staleCursorAfterSeconds: 300
    });

    expect(reconciliation.summary).toMatchObject({
      active: 3,
      approved_idle: 1,
      pending_review: 1,
      rate_limited: 1,
      unavailable: 1,
      policy_disabled: 1,
      stale_cursor: 1,
      high_duplicate_url_rate: 1,
      high_edit_delete_churn: 1,
      no_query_coverage: 1
    });
    expect(reconciliation.diagnostics.find((item) => item.sourceId === "active_actor")?.statuses).toEqual(expect.arrayContaining([
      "active",
      "unavailable",
      "stale_cursor",
      "high_duplicate_url_rate",
      "high_edit_delete_churn"
    ]));
    expect(reconciliation.repairs.map((repair) => repair.action)).toEqual(expect.arrayContaining([
      "suppress_repeated_urls",
      "reduce_window",
      "delay_poll",
      "refresh_cursor",
      "quarantine_channel",
      "request_review",
      "activate_source_pack"
    ]));
  });

  test("reconciliation keeps private invite and account automation boundaries explicit", () => {
    const unsafe = source({
      id: "unsafe_private",
      url: "https://t.me/+privateInvite",
      metadata: {
        actors: ["APT29"],
        accountAutomation: true
      }
    });

    const reconciliation = buildTelegramPublicReconciliation({
      query: "APT29",
      sources: [unsafe],
      generatedAt: "2026-01-01T00:00:00.000Z"
    });

    expect(reconciliation.diagnostics[0]).toMatchObject({
      sourceId: "unsafe_private",
      statuses: expect.arrayContaining(["policy_disabled"])
    });
    expect(reconciliation.repairs[0]).toMatchObject({
      action: "quarantine_channel",
      priority: "high"
    });
  });

  test("builds public-channel cutover rehearsal summaries for clear-web augmented evidence", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const fixtures = [
      { query: "APT29", entityType: "actor", metadata: { actors: ["APT29"], topicTags: ["espionage"], lastDiscoveredUrls: ["https://example.test/apt29"] }, snippet: "APT29 channel follow-up after clear-web discovery", url: "https://example.test/apt29" },
      { query: "Scattered Spider", entityType: "actor", metadata: { actors: ["Scattered Spider"], topicTags: ["identity"] }, snippet: "Scattered Spider public channel evidence after vendor discovery", url: "https://example.test/spider" },
      { query: "Akira", entityType: "malware", metadata: { ransomware: ["Akira"], victims: ["Fjord Energy AS"] }, snippet: "Akira channel claim augments clear-web report", url: "https://example.test/akira" },
      { query: "CVE-2026-9999", entityType: "cve", metadata: { cves: ["CVE-2026-9999"], topicTags: ["vulnerability"] }, snippet: "CVE-2026-9999 exploit chatter after advisory", url: "https://example.test/cve" }
    ];

    for (const [index, fixture] of fixtures.entries()) {
      const report = buildTelegramPublicCutoverReport({
        query: fixture.query,
        entityType: fixture.entityType,
        generatedAt: "2026-01-01T00:10:00.000Z",
        sourcePacks: [pack],
        clearWebEvidenceCount: 1,
        sources: [source({ id: `src_cutover_${index}`, metadata: fixture.metadata })],
        evidence: [{
          sourceId: `src_cutover_${index}`,
          channel: "securityalerts",
          messageUrl: `https://t.me/securityalerts/${3000 + index}`,
          messageTimestamp: "2026-01-01T00:05:00.000Z",
          snippet: fixture.snippet,
          extractedUrls: [fixture.url],
          confidence: 0.7,
          messageId: 3000 + index,
          messageState: "available"
        }]
      });

      expect(report.summary).toMatchObject({
        readyChannelCount: 1,
        safePartialEvidenceCount: 1,
        recommendedNextAction: "ready_for_cutover"
      });
      expect(report.evidenceFreshness).toMatchObject({
        latestMessageId: 3000 + index,
        safePartialEvidenceCount: 1,
        clearWebEvidenceCount: 1,
        publicChannelAddsEvidence: true
      });
      expect(report.cursorRateLimitState[0]).toMatchObject({ sourceId: `src_cutover_${index}` });
      expect(report.abuseControls[0]).toMatchObject({
        sourceId: `src_cutover_${index}`,
        allowed: true
      });
    }
  });

  test("cutover rehearsal summarizes pending rate-limited stale duplicate and policy-blocked channels", () => {
    const generatedAt = "2026-01-01T01:00:00.000Z";
    const report = buildTelegramPublicCutoverReport({
      query: "APT29",
      entityType: "actor",
      generatedAt,
      clearWebEvidenceCount: 1,
      sources: [
        source({
          id: "pending_review",
          status: "candidate",
          approvedAt: undefined,
          approvedBy: undefined,
          governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false, policyVersion: "collection-policy:v1" },
          metadata: { actors: ["APT29"] }
        }),
        source({
          id: "rate_limited",
          metadata: { actors: ["APT29"], rateLimitResetAt: "2026-01-01T01:30:00.000Z" }
        }),
        source({
          id: "stale_duplicate",
          metadata: { actors: ["APT29"] },
          crawlState: { cursor: "99", lastCollectedAt: "2026-01-01T00:00:00.000Z", retryCount: 0 }
        }),
        source({
          id: "unsafe_private",
          url: "https://t.me/+privateInvite",
          metadata: { actors: ["APT29"], accountAutomation: true }
        })
      ],
      healthUpdates: [{
        sourceId: "stale_duplicate",
        channel: "securityalerts",
        fetchOutcome: "success",
        duplicateUrlRate: 0.55,
        deletedUnavailableRate: 0.1,
        policyBlockRate: 0,
        provenance: { adapter: "telegram_public", updatedAt: generatedAt, messageCount: 20, promotedMessageIds: [] }
      }],
      staleCursorAfterSeconds: 300
    });

    expect(report.summary).toMatchObject({
      pendingReviewCount: 1,
      rateLimitedCount: 1,
      staleCursorCount: 1,
      highDuplicateUrlCount: 1,
      safePartialEvidenceCount: 0,
      recommendedNextAction: "refresh_stale_cursors"
    });
    expect(report.repairs.map((repair) => repair.action)).toEqual(expect.arrayContaining([
      "request_review",
      "delay_poll",
      "refresh_cursor",
      "suppress_repeated_urls",
      "quarantine_channel"
    ]));
    expect(report.reconciliation.diagnostics.find((item) => item.sourceId === "unsafe_private")?.statuses).toContain("policy_disabled");
  });

  test("builds dry-run public-channel apply plans for cutover repair actions", async () => {
    const pack = await Bun.file("seeds/public_telegram_channel_packs.json").json() as TelegramPublicSourcePack;
    const generatedAt = "2026-01-01T01:00:00.000Z";
    const plan = buildTelegramPublicApplyPlan({
      query: "APT29",
      entityType: "actor",
      generatedAt,
      sourcePacks: [pack],
      sources: [
        source({
          id: "rate_limited",
          metadata: { actors: ["APT29"], rateLimitResetAt: "2026-01-01T01:30:00.000Z" }
        }),
        source({
          id: "stale_churn",
          metadata: { actors: ["APT29"], publicQueryWindowLimit: 50 },
          crawlState: { cursor: "42", lastCollectedAt: "2026-01-01T00:00:00.000Z", retryCount: 0 }
        }),
        source({
          id: "pending_review",
          status: "candidate",
          approvedAt: undefined,
          approvedBy: undefined,
          governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false, policyVersion: "collection-policy:v1" },
          metadata: { actors: ["APT29"] }
        }),
        source({
          id: "active_failed",
          metadata: { actors: ["APT29"] }
        })
      ],
      scheduler: {
        retryAfterBySourceId: { rate_limited: 1800 },
        deadLetterSourceIds: ["active_failed"]
      },
      healthUpdates: [
        {
          sourceId: "stale_churn",
          channel: "securityalerts",
          fetchOutcome: "success",
          duplicateUrlRate: 0.55,
          deletedUnavailableRate: 0.4,
          policyBlockRate: 0,
          provenance: { adapter: "telegram_public", updatedAt: generatedAt, messageCount: 20, promotedMessageIds: [] }
        },
        {
          sourceId: "active_failed",
          channel: "securityalerts",
          fetchOutcome: "failed",
          duplicateUrlRate: 0,
          deletedUnavailableRate: 0,
          policyBlockRate: 0,
          provenance: { adapter: "telegram_public", updatedAt: generatedAt, messageCount: 0, promotedMessageIds: [] }
        }
      ],
      staleCursorAfterSeconds: 300
    });

    const byAction = new Map(plan.steps.map((step) => [step.action, step]));
    expect(byAction.get("delay_poll")).toMatchObject({
      execution: "automation_safe",
      automationSafe: true,
      mediaPolicy: "metadata_only",
      piiMinimizationRequired: true
    });
    expect(byAction.get("refresh_cursor")).toMatchObject({
      execution: "automation_safe",
      expectedSchedulerEffects: expect.arrayContaining(["schedule a bounded cursor refresh for the approved public source"])
    });
    expect(byAction.get("reduce_window")).toMatchObject({
      execution: "automation_safe",
      rollback: expect.arrayContaining(["restore previous publicQueryWindowLimit metadata"])
    });
    expect(byAction.get("suppress_repeated_urls")).toMatchObject({
      execution: "automation_safe",
      expectedEvidenceEffects: expect.arrayContaining(["future evidence keeps provenance but repeated URLs are suppressed from promotion"])
    });
    expect(byAction.get("request_review")).toMatchObject({
      execution: "human_approval_required",
      manual: true
    });
    expect(byAction.get("quarantine_channel")).toMatchObject({
      execution: "rollback_only",
      manual: true
    });
    expect(byAction.get("activate_source_pack")).toMatchObject({
      execution: "human_approval_required",
      expectedSchedulerEffects: expect.arrayContaining(["create candidate/approved source records only after review"])
    });
    expect(plan.summary).toMatchObject({
      stepCount: plan.steps.length,
      canAutoApply: false,
      highestPriority: "high"
    });
    expect(plan.promotionGate).toMatchObject({
      metadataOnlyMedia: true,
      piiMinimizationRequired: true
    });
  });

  test("apply plans never convert private invite or account automation targets into activations", () => {
    const plan = buildTelegramPublicApplyPlan({
      query: "APT29",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sources: [
        source({
          id: "unsafe_private",
          url: "https://t.me/+privateInvite",
          status: "candidate",
          approvedAt: undefined,
          approvedBy: undefined,
          governance: { approvalRequired: true, approvalState: "pending", metadataOnly: false, policyVersion: "collection-policy:v1" },
          metadata: {
            actors: ["APT29"],
            accountAutomation: true
          }
        })
      ]
    });

    expect(plan.steps.some((step) => step.action === "activate_source_pack")).toBe(false);
    expect(plan.steps.find((step) => step.action === "request_review")).toMatchObject({
      execution: "blocked",
      prerequisites: expect.arrayContaining(["blocked: private, invite, or account-automation targets cannot be activated"])
    });
    expect(plan.steps.find((step) => step.action === "quarantine_channel")).toMatchObject({
      execution: "human_approval_required"
    });
    expect(plan.promotionGate.blockedUnsafeActivationCount).toBe(0);
  });

  test("freezes OpenAPI-ready public-channel apply-plan examples without unsafe fields", () => {
    const contract = telegramPublicApplyPlanApiContract();
    expect(contract).toMatchObject({
      endpoint: "/v1/public-channels/apply-plan",
      method: "POST",
      mode: "dry_run",
      response: {
        actions: expect.arrayContaining([
          "activate_source_pack",
          "request_review",
          "delay_poll",
          "refresh_cursor",
          "reduce_window",
          "quarantine_channel",
          "suppress_repeated_urls"
        ]),
        executions: expect.arrayContaining([
          "automation_safe",
          "human_approval_required",
          "blocked",
          "rollback_only"
        ]),
        forbiddenFields: expect.arrayContaining([
          "rawText",
          "body",
          "mediaPayload",
          "sessionString",
          "inviteLink"
        ])
      }
    });
    expect(contract.examples.automationSafe).toMatchObject({ execution: "automation_safe", automationSafe: true, mediaPolicy: "metadata_only" });
    expect(contract.examples.humanApprovalRequired).toMatchObject({ execution: "human_approval_required", manual: true });
    expect(contract.examples.blockedPrivateTarget).toMatchObject({
      execution: "blocked",
      prerequisites: expect.arrayContaining(["blocked: private, invite, or account-automation targets cannot be activated"])
    });
    expect(contract.examples.rateLimitedChannel).toMatchObject({
      action: "delay_poll",
      rateLimitSafety: expect.arrayContaining(["honor current Telegram rate-limit reset before polling"])
    });
    expect(contract.examples.rollbackOnlyQuarantine).toMatchObject({
      action: "quarantine_channel",
      execution: "rollback_only"
    });
    expect(JSON.stringify(contract)).not.toContain("raw telegram message");
  });
});
