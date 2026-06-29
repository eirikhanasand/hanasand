import { describe, expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { buildDwmAlertCustomerProofHandoffRow, buildDwmAlertDownstreamHandoff, buildDwmAlertGenerationPlan, buildDwmAlertGenerationReadiness, buildDwmAlertWorkflowExecutionReadiness, buildDwmOrgAlertCaseRoleGate, rebuildDwmRuntimeAlerts, dwmAlertToSqlRecord } from "../storage/dwmAlertRepository.ts";
import { orgWatchlistContractToRuntimeDwmWatchlists } from "../storage/dwmOrgWatchlistBridge.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const telegramSource: SourceRecord = {
  id: "src_repo_tg",
  name: "Repository public Telegram",
  type: "telegram_public",
  url: "https://t.me/repo_public",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.82,
  legalNotes: "Public channel preview only.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const darkwebSource: SourceRecord = {
  id: "src_repo_darkweb",
  name: "Repository actor metadata",
  type: "tor_metadata",
  url: "http://repo-example.onion",
  accessMethod: "approved_proxy",
  status: "active",
  trustScore: 0.77,
  legalNotes: "Metadata-only collection.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const telegramCapture: RawCapture = {
  id: "cap_repo_tg_acme",
  sourceId: telegramSource.id,
  url: "https://t.me/repo_public/101",
  collectedAt: "2026-06-28T13:04:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-repo-tg-acme",
  sensitive: false,
  body: "acme.com appears in Lumma C2 public Telegram chatter with Okta live cookie and AWS IAM key exposure.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 101 }
} as RawCapture;

const telegramFollowupCapture: RawCapture = {
  id: "cap_repo_tg_acme_followup",
  sourceId: telegramSource.id,
  url: "https://t.me/repo_public/102",
  collectedAt: "2026-06-28T13:16:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-repo-tg-acme-followup",
  sensitive: false,
  body: "Follow-up public Telegram post repeats acme.com Lumma C2 Okta live cookie and AWS IAM key exposure.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 102 }
} as RawCapture;

const telegramDuplicateCapture: RawCapture = {
  ...telegramCapture,
  id: "cap_repo_tg_acme_duplicate"
} as RawCapture;

const nonmatchCapture: RawCapture = {
  id: "cap_repo_tg_quiet",
  sourceId: telegramSource.id,
  url: "https://t.me/repo_public/103",
  collectedAt: "2026-06-28T13:18:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-repo-tg-quiet",
  sensitive: false,
  body: "Public Telegram chatter mentions unrelated.example and generic credential markets, but not the customer watchlist.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 103 }
} as RawCapture;

const darkwebCapture: RawCapture = {
  id: "cap_repo_darkweb_acme",
  sourceId: darkwebSource.id,
  url: "http://repo-example.onion/acme",
  collectedAt: "2026-06-28T13:09:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-repo-darkweb-acme",
  sensitive: true,
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "acme.com",
      description: "Actor-page metadata claims acme.com supplier contracts.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

const actorSource: SourceRecord = {
  id: "src_repo_actor",
  name: "Repository actor-page metadata",
  type: "actor_page",
  url: "https://threat.example/actors/repo-actor",
  accessMethod: "public_http_metadata",
  status: "active",
  trustScore: 0.73,
  legalNotes: "Public actor-page metadata only.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const publicAdvisorySource: SourceRecord = {
  id: "src_repo_public_ti",
  name: "Repository public TI advisory",
  type: "public_advisory",
  url: "https://cert.example/advisories/acme",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.69,
  legalNotes: "Public TI advisory metadata.",
  createdAt: "2026-06-28T13:00:00.000Z",
  updatedAt: "2026-06-28T13:00:00.000Z"
} as SourceRecord;

const publicAdvisoryCapture: RawCapture = {
  id: "cap_repo_public_ti_acme",
  sourceId: publicAdvisorySource.id,
  url: "https://cert.example/advisories/acme-session",
  collectedAt: "2026-06-28T13:11:00.000Z",
  mediaType: "text/html",
  storageKind: "inline_text",
  contentHash: "hash-repo-public-ti-acme",
  sensitive: false,
  body: "Public TI advisory says acme.com customers should rotate exposed partner API keys after credential resale claims.",
  metadata: { adapter: "public_advisory", title: "acme.com partner API key exposure" }
} as RawCapture;

const substringFalsePositiveCapture: RawCapture = {
  id: "cap_repo_tg_notacme_false_positive",
  sourceId: telegramSource.id,
  url: "https://t.me/repo_public/104",
  collectedAt: "2026-06-28T13:19:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-repo-tg-notacme",
  sensitive: false,
  body: "Broker chatter mentions notacme.com Okta sessions only; this must not match the customer watchlist term.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 104 }
} as RawCapture;

const overlapTelegramCapture: RawCapture = {
  ...telegramCapture,
  id: "cap_repo_overlap_acme",
  contentHash: "hash-repo-overlap-acme",
  body: "acme.com appears in public Telegram chatter with fresh Okta session-cookie resale.",
  metadata: { adapter: "telegram_public", channel: "repo_public", messageId: 201 }
} as RawCapture;

const orgADarkwebCapture: RawCapture = {
  ...darkwebCapture,
  id: "cap_repo_darkweb_alpha",
  contentHash: "hash-repo-darkweb-alpha",
  metadata: {
    adapter: "darknet_metadata",
    leakSite: {
      actorName: "Akira",
      victimName: "alpha-payments.example",
      description: "Actor-page metadata claims alpha-payments.example finance contracts.",
      captureMode: "metadata_only"
    }
  }
} as RawCapture;

const orgBActorCapture: RawCapture = {
  id: "cap_repo_actor_beta",
  sourceId: actorSource.id,
  url: "https://threat.example/actors/repo-actor/beta",
  collectedAt: "2026-06-28T13:22:00.000Z",
  mediaType: "text/plain",
  storageKind: "metadata_only",
  contentHash: "hash-repo-actor-beta",
  sensitive: false,
  body: "Actor profile lists beta-payments.example as a target with active credential broker interest.",
  metadata: { adapter: "actor_page_metadata", actor: "RepoActor", victimName: "beta-payments.example" }
} as RawCapture;

describe("dwm alert repository", () => {
  test("rebuilds tenant/org alerts from watchlist and fixture Telegram/darkweb captures with SQL-shaped persistence", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveSource(publicAdvisorySource);
    store.saveCapture(telegramCapture);
    store.saveCapture(telegramDuplicateCapture);
    store.saveCapture(nonmatchCapture);
    store.saveCapture(substringFalsePositiveCapture);
    store.saveCapture(darkwebCapture);
    store.saveCapture(publicAdvisoryCapture);
    (store as any).saveDwmWatchlist({
      id: "watch_repo_acme",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      name: "Acme exposure watch",
      terms: [{ id: "watch_item_acme_domain", value: "acme.com", kind: "domain" }],
      webhookDestinationId: "webhook_repo_discord",
      status: "active",
      createdAt: "2026-06-28T13:00:00.000Z",
      updatedAt: "2026-06-28T13:00:00.000Z"
    });
    (store as any).saveDwmWatchlist({
      id: "watch_repo_acme_duplicate",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      name: "Acme duplicate exposure watch",
      terms: [{ id: "watch_item_acme_duplicate_domain", value: "ACME.com", kind: "domain" }],
      webhookDestinationId: "webhook_repo_backup",
      status: "active",
      createdAt: "2026-06-28T13:00:00.000Z",
      updatedAt: "2026-06-28T13:00:00.000Z"
    });
    (store as any).saveDwmWatchlist({
      id: "watch_repo_acme_paused",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      name: "Paused Acme exposure watch",
      terms: [{ id: "watch_item_acme_paused_domain", value: "acme.com", kind: "domain" }],
      webhookDestinationId: "webhook_repo_paused",
      status: "paused",
      createdAt: "2026-06-28T13:00:00.000Z",
      updatedAt: "2026-06-28T13:00:00.000Z"
    });

    const generationPlan = buildDwmAlertGenerationPlan({
      watchlists: (store as any).listDwmWatchlists(),
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      visibilityPolicy: "admins",
      sources: store.listSources(),
      captures: store.listCaptures()
    });
    expect(generationPlan).toMatchObject({
      schemaVersion: "dwm.alert_generation_plan.v1",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      visibilityPolicy: "admins",
      candidateCount: 1,
      activeWatchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"]
    });
    expect(generationPlan.skippedWatchlists).toContainEqual({ watchlistId: "watch_repo_acme_paused", reason: "paused" });
    expect(generationPlan.candidates[0]).toMatchObject({
      normalizedTerm: "acme.com",
      watchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"],
      watchlistItemIds: ["watch_item_acme_domain", "watch_item_acme_duplicate_domain"],
      webhookDestinationIds: ["webhook_repo_discord", "webhook_repo_backup"],
      hasWebhookRoute: true,
      visibilityPolicy: "admins",
      sourceFamilies: ["telegram_public", "darkweb_metadata", "public_advisory"]
    });
    expect(generationPlan.candidates[0].captureRefs.map((ref) => ref.captureId).sort()).toEqual(["cap_repo_darkweb_acme", "cap_repo_public_ti_acme", "cap_repo_tg_acme"].sort());
    expect(generationPlan.candidates[0].captureRefs.map((ref) => ref.contentHash)).toEqual(expect.arrayContaining(["hash-repo-tg-acme", "hash-repo-darkweb-acme", "hash-repo-public-ti-acme"]));
    expect(generationPlan.candidates[0].captureRefs.map((ref) => ref.captureId)).not.toContain("cap_repo_tg_notacme_false_positive");
    expect(generationPlan.candidates[0].captureRefs.map((ref) => ref.captureId)).not.toContain("cap_repo_tg_acme_duplicate");
    expect(generationPlan.candidates[0].evidenceWindow).toMatchObject({
      captureIds: expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_darkweb_acme", "cap_repo_public_ti_acme"]),
      sourceFamilies: ["telegram_public", "darkweb_metadata", "public_advisory"],
      contentHashes: expect.arrayContaining(["hash-repo-tg-acme", "hash-repo-darkweb-acme", "hash-repo-public-ti-acme"]),
      firstObservedAt: "2026-06-28T13:04:00.000Z",
      lastObservedAt: "2026-06-28T13:11:00.000Z"
    });
    expect(generationPlan.candidates[0].dedupeKeyCandidate).toMatch(/^dwm_dedupe_candidate_/);

    const readiness = buildDwmAlertGenerationReadiness({
      watchlists: (store as any).listDwmWatchlists(),
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      visibilityPolicy: "admins",
      sources: store.listSources(),
      captures: store.listCaptures()
    });
    expect(readiness).toMatchObject({
      schemaVersion: "dwm.alert_generation_readiness.v1",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      visibilityPolicy: "admins",
      readyForRebuild: true,
      readyForCustomerDelivery: true,
      counts: {
        activeWatchlists: 2,
        skippedWatchlists: 1,
        blockedWatchlists: 0,
        candidateCount: 1,
        rawActiveTermCount: 2,
        duplicateCollapseCount: 1,
        captureRefCount: 3,
        matchedCandidateCount: 1,
        unmatchedCandidateCount: 0
      },
      webhookReadiness: {
        ready: true,
        routedCandidateCount: 1,
        missingRouteCandidateCount: 0,
        webhookDestinationIds: ["webhook_repo_discord", "webhook_repo_backup"]
      },
      caseReadiness: {
        ready: true,
        candidateCount: 1,
        casePathTemplate: "/v1/cases/:caseId?alertId=:alertId&dedupeKey=:dedupeKey"
      },
      productDedupeBlocker: {
        blocked: false
      }
    });
    expect(readiness.sourceFamilyCoverage).toEqual([
      { sourceFamily: "darkweb_metadata", candidateCount: 1, captureRefCount: 1, watchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"] },
      { sourceFamily: "public_advisory", candidateCount: 1, captureRefCount: 1, watchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"] },
      { sourceFamily: "telegram_public", candidateCount: 1, captureRefCount: 1, watchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"] }
    ]);
    expect(readiness.blockerCodes).toEqual([]);
    expect(readiness.typedBlockers).toEqual([]);
    expect(readiness.blockers).toEqual([]);
    expect(readiness.zeroAlertProof).toMatchObject({
      schemaVersion: "dwm.zero_alert_proof.v1",
      zeroAlert: false,
      state: "alerts_expected",
      expectedAlertDelta: 3,
      blockerCodes: [],
      counts: { activeWatchlists: 2, candidateCount: 1, captureRefCount: 3, matchedCandidateCount: 1, unmatchedCandidateCount: 0 }
    });
    expect(readiness.plan.candidates[0].webhookDestinationIds).toEqual(["webhook_repo_discord", "webhook_repo_backup"]);

    const blockedWithoutOrg = buildDwmAlertGenerationPlan({
      watchlists: (store as any).listDwmWatchlists(),
      tenantId: "tenant_repo_acme",
      sources: store.listSources(),
      captures: store.listCaptures()
    });
    expect(blockedWithoutOrg.candidates).toHaveLength(0);
    expect(blockedWithoutOrg.blockedWatchlists).toEqual([
      { watchlistId: "watch_repo_acme", reason: "missing_org_context", organizationId: "org_repo_acme" },
      { watchlistId: "watch_repo_acme_duplicate", reason: "missing_org_context", organizationId: "org_repo_acme" }
    ]);
    const readinessWithoutOrg = buildDwmAlertGenerationReadiness({
      watchlists: (store as any).listDwmWatchlists(),
      tenantId: "tenant_repo_acme",
      sources: store.listSources(),
      captures: store.listCaptures()
    });
    expect(readinessWithoutOrg).toMatchObject({
      readyForRebuild: false,
      counts: { candidateCount: 0, blockedWatchlists: 2 },
      blockerCodes: expect.arrayContaining(["blocked_watchlist_scope", "org_export_unavailable"]),
      plan: { candidates: [] }
    });
    expect(JSON.stringify(readinessWithoutOrg.plan.candidates)).not.toContain("acme.com");
    const blockedRebuild = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_acme" });
    expect(blockedRebuild.savedAlertCount).toBe(0);
    expect(blockedRebuild.generationPlan.blockedWatchlists).toEqual(blockedWithoutOrg.blockedWatchlists);
    expect((store as any).listDwmAlerts()).toHaveLength(0);

    const first = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_acme", organizationId: "org_repo_acme", visibilityPolicy: "admins" });

    expect(first.savedAlertCount).toBe(3);
    expect(first.generationPlan.candidateCount).toBe(1);
    expect(first.generationPlan.skippedWatchlists).toContainEqual({ watchlistId: "watch_repo_acme_paused", reason: "paused" });
    expect(first.alerts.map((alert) => alert.sourceFamily).sort()).toEqual(["darkweb_metadata", "public_advisory", "telegram_public"]);
    expect(first.alerts.every((alert) => alert.organizationId === "org_repo_acme")).toBe(true);
    expect(first.alerts.every((alert) => alert.dedupeKey === alert.webhookDelivery.dedupeKey)).toBe(true);
    expect(first.alerts.every((alert) => alert.provenance.matchBasis === "watchlist_capture_text")).toBe(true);
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.recommendedRoute).toBe("identity_response");
    expect(first.alerts.find((alert) => alert.sourceFamily === "darkweb_metadata")?.provenance.metadataOnly).toBe(true);
    expect(first.alerts.find((alert) => alert.sourceFamily === "public_advisory")).toMatchObject({
      sourceFamily: "public_advisory",
      recommendedRoute: "identity_response",
      provenance: expect.objectContaining({ captureIds: ["cap_repo_public_ti_acme"] }),
      matchContext: expect.objectContaining({
        matchType: "bounded_text_or_metadata",
        matchedFieldHints: expect.arrayContaining(["body", "metadata.title"])
      })
    });
    expect(JSON.stringify(first.alerts)).not.toContain("cap_repo_tg_notacme_false_positive");
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.sourceCount).toBe(1);
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.workflowContext).toMatchObject({
      organizationId: "org_repo_acme",
      visibilityPolicy: "admins",
      watchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"],
      watchlistItemIds: ["watch_item_acme_domain", "watch_item_acme_duplicate_domain"],
      actor: "Repo Public",
      entity: {
        company: "acme",
        artifactType: "nhi_exposure_hint"
      },
      sourceFamily: "telegram_public",
      primaryCaptureId: "cap_repo_tg_acme",
      evidenceCount: 1,
      generationEvidenceWindow: {
        firstObservedAt: "2026-06-28T13:04:00.000Z",
        lastObservedAt: "2026-06-28T13:11:00.000Z",
        sourceFamilies: ["telegram_public", "darkweb_metadata", "public_advisory"]
      },
      recommendedRoute: "identity_response",
      hasWebhookRoute: true
    });
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.alertCreatedEvent).toMatchObject({
      schemaVersion: "dwm.alert_created_event.v1",
      eventType: "dwm.alert.created",
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      sourceFamily: "telegram_public",
      watchlistIds: ["watch_repo_acme", "watch_repo_acme_duplicate"],
      watchlistItemIds: ["watch_item_acme_domain", "watch_item_acme_duplicate_domain"],
      captureIds: ["cap_repo_tg_acme"],
      evidenceCount: 1,
      dedupeKey: first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.dedupeKey,
      recommendedRoute: "identity_response",
      confidenceReasoning: expect.arrayContaining([expect.stringContaining("Watchlist term matched")]),
      provenance: expect.objectContaining({
        matchBasis: "watchlist_capture_text",
        captureIds: ["cap_repo_tg_acme"]
      })
    });
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.alertEvents).toHaveLength(1);
    expect(first.alerts.find((alert) => alert.sourceFamily === "telegram_public")?.webhookContext).toMatchObject({
      organizationId: "org_repo_acme",
      visibilityPolicy: "admins",
      watchlistItemIds: ["watch_item_acme_domain", "watch_item_acme_duplicate_domain"],
      entity: {
        company: "acme"
      },
      captureIds: ["cap_repo_tg_acme"],
      evidenceCount: 1,
      generationEvidenceWindow: {
        firstObservedAt: "2026-06-28T13:04:00.000Z",
        lastObservedAt: "2026-06-28T13:11:00.000Z"
      },
      recommendedRoute: "identity_response"
    });
    const telegramAlert = first.alerts.find((alert) => alert.sourceFamily === "telegram_public");
    expect(telegramAlert?.caseIdCandidate).toMatch(/^case_/);
    expect(telegramAlert?.workflowContext.caseIdCandidate).toBe(telegramAlert?.caseIdCandidate);
    expect(telegramAlert?.webhookContext.caseIdCandidate).toBe(telegramAlert?.caseIdCandidate);
    expect(telegramAlert?.casePath).toContain(`/v1/cases/${telegramAlert?.caseIdCandidate}`);
    expect(telegramAlert?.alertDetailPath).toContain(`/v1/dwm/alerts/${telegramAlert?.id}`);
    expect(telegramAlert?.alertDetailPath).toContain("organizationId=org_repo_acme");
    expect(telegramAlert?.alertDetailPath).toContain(`dedupeKey=${telegramAlert?.dedupeKey}`);
    expect(telegramAlert?.workflowContext.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramAlert?.webhookContext.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramAlert?.deliveryReadinessContext.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramAlert?.alertCreatedEvent.alertDetailPath).toBe(telegramAlert?.alertDetailPath);

    const telegramSql = dwmAlertToSqlRecord(telegramAlert);
    expect(telegramSql).toMatchObject({
      tenant_id: "tenant_repo_acme",
      organization_id: "org_repo_acme",
      event_type: "darkweb.monitoring.match",
      source_family: "telegram_public",
      recommended_route: "identity_response",
      delivery_state: "pending_review"
    });
    expect(telegramSql.dedupe_key).toMatch(/^dwm_dedupe_/);
    expect(telegramSql.provenance.captureIds).toContain("cap_repo_tg_acme");
    expect(telegramSql.evidence[0].provenance.captureId).toBe("cap_repo_tg_acme");
    expect(telegramSql.watchlist_ids).toEqual(["watch_repo_acme", "watch_repo_acme_duplicate"]);
    expect(telegramSql.watchlist_item_ids).toEqual(["watch_item_acme_domain", "watch_item_acme_duplicate_domain"]);
    expect(telegramSql.workflow_context.captureIds).toEqual(["cap_repo_tg_acme"]);
    expect(telegramSql.workflow_context.generationCandidateId).toBe(generationPlan.candidates[0].id);
    expect(telegramSql.workflow_context.webhookDestinationIds).toEqual(["webhook_repo_discord", "webhook_repo_backup"]);
    expect(telegramSql.webhook_context.casePath).toContain(telegramSql.id);
    expect(telegramSql.alert_detail_path).toBe(telegramAlert?.alertDetailPath);
    expect(telegramSql.delivery_readiness_context).toMatchObject({
      schemaVersion: "dwm.alert_delivery_persistence.v1",
      organizationId: "org_repo_acme",
      selectedCaptureIds: ["cap_repo_tg_acme"],
      sourceFamily: "telegram_public",
      deliveryDedupeKey: telegramAlert?.webhookDelivery.dedupeKey,
      webhookDestinationIds: ["webhook_repo_discord", "webhook_repo_backup"],
      blockerCodes: ["missing_org_ref"]
    });
    expect(telegramSql.delivery_readiness_context).toMatchObject({
      alertCreatedEventId: telegramAlert?.alertCreatedEvent.id,
      alertCreatedAt: telegramAlert?.alertCreatedEvent.at
    });
    expect(telegramSql.case_id_candidate).toBe(telegramAlert?.caseIdCandidate);
    expect(telegramSql.case_path).toContain(`/v1/cases/${telegramAlert?.caseIdCandidate}`);
    const telegramHandoff = buildDwmAlertDownstreamHandoff({ alert: telegramAlert });
    expect(telegramHandoff.createdEvent).toMatchObject({
      schemaVersion: "dwm.alert_created_event.v1",
      eventId: telegramAlert?.alertCreatedEvent.id,
      eventType: "dwm.alert.created",
      sourceFamily: "telegram_public",
      captureIds: ["cap_repo_tg_acme"],
      dedupeKey: telegramAlert?.dedupeKey,
      deliveryDedupeKey: telegramAlert?.dedupeKey,
      recommendedRoute: "identity_response",
      alertDetailPath: telegramAlert?.alertDetailPath
    });
    expect(telegramHandoff.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramHandoff.evidence.generationEvidenceWindow).toMatchObject({
      captureIds: expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_darkweb_acme", "cap_repo_public_ti_acme"]),
      sourceFamilies: ["telegram_public", "darkweb_metadata", "public_advisory"],
      firstObservedAt: "2026-06-28T13:04:00.000Z",
      lastObservedAt: "2026-06-28T13:11:00.000Z"
    });
    const telegramProof = buildDwmAlertCustomerProofHandoffRow({ alert: telegramAlert });
    expect(telegramProof.createdEvent).toMatchObject({
      eventId: telegramAlert?.alertCreatedEvent.id,
      captureIds: ["cap_repo_tg_acme"],
      recommendedRoute: "identity_response",
      alertDetailPath: telegramAlert?.alertDetailPath
    });
    expect(telegramProof.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramProof.consumerAdapter.dashboard.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramProof.consumerContract.detail.alertDetailPath).toBe(telegramAlert?.alertDetailPath);
    expect(telegramProof.consumerContract.webhookEvent.requiredFields).toContain("alertDetailPath");
    expect(telegramProof.generationEvidenceWindow).toMatchObject({
      contentHashes: expect.arrayContaining(["hash-repo-tg-acme", "hash-repo-darkweb-acme", "hash-repo-public-ti-acme"]),
      firstObservedAt: "2026-06-28T13:04:00.000Z"
    });
    expect(buildDwmAlertWorkflowExecutionReadiness({
      alert: telegramAlert,
      organizationId: "org_repo_acme",
      action: "assign",
      actorRole: "analyst"
    })).toMatchObject({
      ready: true,
      createdEvent: {
        schemaVersion: "dwm.alert_created_event.v1",
        eventId: telegramAlert?.alertCreatedEvent.id,
        sourceFamily: "telegram_public",
        captureIds: ["cap_repo_tg_acme"],
        dedupeKey: telegramAlert?.dedupeKey,
        recommendedRoute: "identity_response",
        alertDetailPath: telegramAlert?.alertDetailPath
      }
    });

    const existing = first.alerts[0];
    store.saveDwmAlert({
      ...existing,
      reviewState: "false_positive",
      deliveryState: "muted",
      assignedOwner: "analyst-1",
      caseId: "case_existing_repo",
      workflowNote: "Owner suppressed this as a duplicate customer-domain decision.",
      workflowEvents: [{ id: "evt_1", at: "2026-06-28T13:12:00.000Z", toReviewState: "false_positive", toDeliveryState: "muted" }],
      replayCount: 2,
      lastReplayedAt: "2026-06-28T13:13:00.000Z",
      deliveredAt: "2026-06-28T13:14:00.000Z"
    });
    store.saveCapture(telegramFollowupCapture);

    const second = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_acme", organizationId: "org_repo_acme", visibilityPolicy: "admins" });
    const preserved = second.alerts.find((alert) => alert.id === existing.id);

    expect(preserved?.reviewState).toBe("false_positive");
    expect(preserved?.deliveryState).toBe("muted");
    expect(preserved?.assignedOwner).toBe("analyst-1");
    expect(preserved?.workflowNote).toBe("Owner suppressed this as a duplicate customer-domain decision.");
    expect(preserved?.workflowEvents).toHaveLength(1);
    expect(preserved?.alertCreatedEvent).toEqual(existing.alertCreatedEvent);
    expect(preserved?.alertEvents).toHaveLength(2);
    expect(preserved?.alertEvents[0]).toEqual(existing.alertCreatedEvent);
    expect(preserved?.alertUpdatedEvent).toMatchObject({
      schemaVersion: "dwm.alert_updated_event.v1",
      eventType: "dwm.alert.updated",
      alertId: existing.id,
      tenantId: "tenant_repo_acme",
      organizationId: "org_repo_acme",
      sourceFamily: "telegram_public",
      captureIds: ["cap_repo_tg_acme", "cap_repo_tg_acme_followup"],
      addedCaptureIds: ["cap_repo_tg_acme_followup"],
      removedCaptureIds: [],
      evidenceCount: 2,
      previousEvidenceCount: 1,
      dedupeKey: existing.dedupeKey,
      deliveryDedupeKey: existing.dedupeKey,
      recommendedRoute: "identity_response"
    });
    expect(preserved?.alertUpdatedEvent.id).toMatch(/^dwm_alert_updated_event_/);
    expect(preserved?.alertEvents[1]).toEqual(preserved?.alertUpdatedEvent);
    expect(buildDwmAlertDownstreamHandoff({ alert: preserved }).createdEvent).toMatchObject({
      eventId: existing.alertCreatedEvent.id,
      captureIds: ["cap_repo_tg_acme"]
    });
    expect(buildDwmAlertDownstreamHandoff({ alert: preserved }).evidence.generationEvidenceWindow).toMatchObject({
      captureIds: expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_tg_acme_followup"]),
      lastObservedAt: "2026-06-28T13:16:00.000Z"
    });
    expect(buildDwmAlertWorkflowExecutionReadiness({
      alert: preserved,
      organizationId: "org_repo_acme",
      action: "replay",
      expectedWorkflowEventCount: 0
    })).toMatchObject({
      ready: false,
      blockerCodes: ["stale_workflow_version"],
      createdEvent: {
        eventId: existing.alertCreatedEvent.id,
        sourceFamily: "telegram_public",
        captureIds: ["cap_repo_tg_acme"],
        recommendedRoute: "identity_response"
      }
    });
    expect(preserved?.caseId).toBe("case_existing_repo");
    expect(preserved?.replayCount).toBe(2);
    expect(preserved?.lastReplayedAt).toBe("2026-06-28T13:13:00.000Z");
    expect(preserved?.deliveredAt).toBe("2026-06-28T13:14:00.000Z");
    expect(preserved?.sourceCount).toBe(2);
    expect(preserved?.workflowContext.evidenceCount).toBe(2);
    expect(preserved?.webhookContext.evidenceCount).toBe(2);
    expect(preserved?.workflowContext.generationEvidenceWindow).toMatchObject({
      firstObservedAt: "2026-06-28T13:04:00.000Z",
      lastObservedAt: "2026-06-28T13:16:00.000Z"
    });
    expect(preserved?.workflowContext.generationEvidenceWindow.captureIds).toContain("cap_repo_tg_acme");
    expect(preserved?.workflowContext.generationEvidenceWindow.captureIds).toContain("cap_repo_tg_acme_followup");
    expect(preserved?.webhookContext.generationEvidenceWindow).toMatchObject({
      lastObservedAt: "2026-06-28T13:16:00.000Z"
    });
    expect(preserved?.webhookContext.generationEvidenceWindow.contentHashes).toContain("hash-repo-tg-acme-followup");
    expect(preserved?.webhookContext.generationEvidenceWindow.contentHashes.filter((hash: string) => hash === "hash-repo-tg-acme")).toHaveLength(1);
    expect(preserved?.workflowContext.generationEvidenceWindow.captureIds).not.toContain("cap_repo_tg_acme_duplicate");
    expect(preserved?.evidence.map((item: any) => item.id)).toContain("cap_repo_tg_acme_followup");
    expect(preserved?.evidence.map((item: any) => item.id)).not.toContain("cap_repo_tg_acme_duplicate");
    expect(preserved?.evidence.map((item: any) => item.id)).not.toContain("cap_repo_tg_quiet");
    expect(preserved?.provenance.captureIds).toContain("cap_repo_tg_acme_followup");
    expect(preserved?.deliveryReadinessContext).toMatchObject({
      state: "delivered",
      blockerCodes: expect.arrayContaining(["replay_already_delivered", "duplicate_delivered_dedupe"]),
      alertCreatedEventId: existing.alertCreatedEvent.id,
      alertCreatedAt: existing.alertCreatedEvent.at,
      deliveryHistoryRefs: []
    });
    expect(preserved?.deliveryReadinessContext.selectedCaptureIds).toContain("cap_repo_tg_acme");
    expect(preserved?.deliveryReadinessContext.selectedCaptureIds).toContain("cap_repo_tg_acme_followup");
    const third = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_acme", organizationId: "org_repo_acme", visibilityPolicy: "admins" });
    const stable = third.alerts.find((alert) => alert.id === existing.id);
    expect(stable?.alertEvents.map((event: any) => event.eventType)).toEqual(["dwm.alert.created", "dwm.alert.updated"]);
    expect(stable?.alertUpdatedEvent).toEqual(preserved?.alertUpdatedEvent);
  });

  test("isolates overlapping org watchlist terms across tenants, dedupe, workflow, and case handoff", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveCapture(telegramCapture);

    for (const watchlist of [
      ...orgWatchlistContractToRuntimeDwmWatchlists({
        schemaVersion: "organization.watchlist_alert_generation.v1",
        organizationId: "org_overlap_alpha",
        tenantId: "org_overlap_alpha",
        ownerOrganizationId: "org_overlap_alpha",
        visibilityPolicy: "admins",
        canGenerateAlerts: true,
        activeTerms: [{
          watchlistId: "watch_overlap_alpha",
          watchlistItemId: "watch_item_overlap_alpha",
          organizationId: "org_overlap_alpha",
          tenantId: "org_overlap_alpha",
          kind: "domain",
          termFamily: "domain",
          term: "acme.com",
          status: "active",
          alertGeneratorKey: "org:org_overlap_alpha:watchlist:watch_item_overlap_alpha:domain:acme.com"
        }],
        watchlistTerms: [{
          watchlistId: "watch_overlap_alpha_archived",
          watchlistItemId: "watch_item_overlap_alpha_archived",
          organizationId: "org_overlap_alpha",
          tenantId: "org_overlap_alpha",
          kind: "domain",
          term: "acme.com",
          status: "archived"
        }]
      }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_overlap_alpha" })),
      ...orgWatchlistContractToRuntimeDwmWatchlists({
        schemaVersion: "organization.watchlist_alert_generation.v1",
        organizationId: "org_overlap_beta",
        tenantId: "org_overlap_beta",
        ownerOrganizationId: "org_overlap_beta",
        visibilityPolicy: "members",
        canGenerateAlerts: true,
        activeTerms: [{
          watchlistId: "watch_overlap_beta",
          watchlistItemId: "watch_item_overlap_beta",
          organizationId: "org_overlap_beta",
          tenantId: "org_overlap_beta",
          kind: "domain",
          termFamily: "domain",
          term: "acme.com",
          status: "active",
          alertGeneratorKey: "org:org_overlap_beta:watchlist:watch_item_overlap_beta:domain:acme.com"
        }]
      }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_overlap_beta" }))
    ]) {
      (store as any).saveDwmWatchlist(watchlist);
    }

    const alphaPlan = buildDwmAlertGenerationPlan({
      watchlists: (store as any).listDwmWatchlists(),
      tenantId: "org_overlap_alpha",
      organizationId: "org_overlap_alpha",
      visibilityPolicy: "admins",
      sources: store.listSources(),
      captures: store.listCaptures()
    });
    expect(alphaPlan.candidates).toHaveLength(1);
    expect(alphaPlan.blockedWatchlists).toEqual([]);
    expect(alphaPlan.skippedWatchlists).toEqual([
      { watchlistId: "watch_overlap_alpha_archived", reason: "archived" },
      { watchlistId: "watch_overlap_beta", reason: "tenant_mismatch" }
    ]);
    expect(alphaPlan.candidates[0]).toMatchObject({
      organizationId: "org_overlap_alpha",
      watchlistIds: ["watch_overlap_alpha"],
      watchlistItemIds: ["watch_item_overlap_alpha"],
      alertGeneratorKeys: ["org:org_overlap_alpha:watchlist:watch_item_overlap_alpha:domain:acme.com"]
    });

    const alpha = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "org_overlap_alpha", organizationId: "org_overlap_alpha", visibilityPolicy: "admins" });
    const beta = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "org_overlap_beta", organizationId: "org_overlap_beta", visibilityPolicy: "members" });
    expect(alpha.savedAlertCount).toBe(1);
    expect(beta.savedAlertCount).toBe(1);
    const alphaAlert = alpha.alerts[0];
    const betaAlert = beta.alerts[0];
    expect(alphaAlert.organizationId).toBe("org_overlap_alpha");
    expect(betaAlert.organizationId).toBe("org_overlap_beta");
    expect(alphaAlert.id).not.toBe(betaAlert.id);
    expect(alphaAlert.dedupeKey).not.toBe(betaAlert.dedupeKey);
    expect(alphaAlert.workflowContext).toMatchObject({
      organizationId: "org_overlap_alpha",
      visibilityPolicy: "admins",
      watchlistIds: ["watch_overlap_alpha"],
      watchlistItemIds: ["watch_item_overlap_alpha"],
      alertGeneratorKeys: ["org:org_overlap_alpha:watchlist:watch_item_overlap_alpha:domain:acme.com"],
      sourceFamily: "telegram_public"
    });
    expect(betaAlert.workflowContext).toMatchObject({
      organizationId: "org_overlap_beta",
      visibilityPolicy: "members",
      watchlistIds: ["watch_overlap_beta"],
      watchlistItemIds: ["watch_item_overlap_beta"],
      alertGeneratorKeys: ["org:org_overlap_beta:watchlist:watch_item_overlap_beta:domain:acme.com"],
      sourceFamily: "telegram_public"
    });
    expect(alphaAlert.workflowContext.watchlistProvenance[0]).toMatchObject({
      organizationId: "org_overlap_alpha",
      watchlistItemId: "watch_item_overlap_alpha",
      status: "active"
    });
    expect(JSON.stringify(alphaAlert)).not.toContain("watch_item_overlap_beta");
    expect(JSON.stringify(betaAlert)).not.toContain("watch_item_overlap_alpha");
    expect((store as any).listDwmAlerts().map((alert: any) => alert.organizationId).sort()).toEqual(["org_overlap_alpha", "org_overlap_beta"]);

    const alphaProof = buildDwmAlertCustomerProofHandoffRow({ alert: alphaAlert, generatedAt: "2026-06-28T13:40:00.000Z" });
    expect(alphaProof.consumerAdapter).toMatchObject({
      schemaVersion: "dwm.org_alert_case_consumer_adapter.v1",
      organizationId: "org_overlap_alpha",
      tenantId: "org_overlap_alpha",
      watchlistItemIds: ["watch_item_overlap_alpha"],
      publicTI: {
        canConsume: true
      },
      helpdesk: {
        redacted: true
      },
      roleGates: {
        create_watchlist: ["owner", "admin"],
        acknowledge_alert: ["owner", "admin", "analyst"],
        assign_case: ["owner", "admin", "analyst"],
        manage_invites: ["owner", "admin"]
      }
    });
    const alphaDownstreamHandoff = buildDwmAlertDownstreamHandoff({
      alert: alphaAlert,
      organizationId: "org_overlap_alpha",
      generatedAt: "2026-06-28T13:41:00.000Z"
    });
    expect(alphaDownstreamHandoff).toMatchObject({
      schemaVersion: "dwm.alert_downstream_handoff.v1",
      ready: true,
      organizationId: "org_overlap_alpha",
      watchlist: {
        watchlistIds: ["watch_overlap_alpha"],
        watchlistItemIds: ["watch_item_overlap_alpha"],
        alertGeneratorKeys: ["org:org_overlap_alpha:watchlist:watch_item_overlap_alpha:domain:acme.com"]
      },
      caseReadiness: {
        ready: true,
        route: "/v1/cases"
      },
      deliveryReadiness: {
        ready: true,
        webhookDestinationIds: ["webhook_overlap_alpha"]
      },
      replay: {
        idempotent: true,
        duplicate: false,
        canReplay: true
      },
      blockerCodes: []
    });

    expect(buildDwmOrgAlertCaseRoleGate({ role: "owner", capability: "manage_invites" }).allowed).toBe(true);
    expect(buildDwmOrgAlertCaseRoleGate({ role: "admin", capability: "edit_watchlist_terms" }).allowed).toBe(true);
    expect(buildDwmOrgAlertCaseRoleGate({ role: "analyst", capability: "acknowledge_alert" }).allowed).toBe(true);
    expect(buildDwmOrgAlertCaseRoleGate({ role: "analyst", capability: "manage_invites" })).toMatchObject({ allowed: false, deniedReason: "insufficient_role" });
    expect(buildDwmOrgAlertCaseRoleGate({ role: "viewer", capability: "assign_case" })).toMatchObject({ allowed: false, deniedReason: "insufficient_role" });
    expect(buildDwmOrgAlertCaseRoleGate({ role: "nonmember", capability: "acknowledge_alert" })).toMatchObject({ allowed: false, deniedReason: "not_member" });
    expect(buildDwmAlertWorkflowExecutionReadiness({
      alert: alphaAlert,
      organizationId: "org_overlap_alpha",
      action: "assign",
      actorRole: "viewer"
    }).blockerCodes).toContain("role_not_allowed");
    expect(buildDwmAlertWorkflowExecutionReadiness({
      alert: alphaAlert,
      organizationId: "org_overlap_alpha",
      action: "assign",
      actorRole: "analyst"
    }).ready).toBe(true);
  });

  test("matching probe reports blockers and preserves zero mutation for no match, inactive source, and entitlement denial", () => {
    const noMatchStore = new InMemoryScraperStore();
    noMatchStore.saveSource(telegramSource);
    noMatchStore.saveCapture(nonmatchCapture);
    (noMatchStore as any).saveDwmWatchlist({
      id: "watch_repo_nomatch",
      tenantId: "tenant_repo_nomatch",
      organizationId: "org_repo_nomatch",
      terms: [{ id: "watch_item_nomatch", value: "acme.com", kind: "domain" }],
      webhookDestinationId: "webhook_repo_nomatch",
      status: "active"
    });
    (noMatchStore as any).saveDwmAlert({ id: "alert_existing_nomatch", tenantId: "tenant_repo_nomatch", dedupeKey: "existing", savedAt: "2026-06-28T13:00:00.000Z" });

    const noMatchReadiness = buildDwmAlertGenerationReadiness({
      watchlists: (noMatchStore as any).listDwmWatchlists(),
      tenantId: "tenant_repo_nomatch",
      organizationId: "org_repo_nomatch",
      sources: noMatchStore.listSources(),
      captures: noMatchStore.listCaptures()
    });
    expect(noMatchReadiness).toMatchObject({
      readyForRebuild: true,
      readyForCustomerDelivery: false,
      counts: { candidateCount: 1, captureRefCount: 0, matchedCandidateCount: 0, unmatchedCandidateCount: 1 },
      blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"]),
      zeroAlertProof: {
        schemaVersion: "dwm.zero_alert_proof.v1",
        zeroAlert: true,
        state: "blocked_no_matching_capture",
        expectedAlertDelta: 0,
        blockerCodes: expect.arrayContaining(["no_matching_captures", "missing_evidence"]),
        counts: { activeWatchlists: 1, candidateCount: 1, captureRefCount: 0, matchedCandidateCount: 0, unmatchedCandidateCount: 1 },
        watchlistIds: ["watch_repo_nomatch"],
        watchlistTerms: [{
          candidateId: expect.any(String),
          watchlistIds: ["watch_repo_nomatch"],
          watchlistItemIds: ["watch_item_nomatch"],
          term: "acme.com",
          kind: "domain",
          organizationId: "org_repo_nomatch",
          hasMatchingCaptures: false,
          sourceFamilies: [],
          captureRefCount: 0
        }],
        routes: {
          readiness: "/v1/dwm/alerts/readiness",
          rebuild: "/v1/dwm/alerts/rebuild",
          alerts: "/v1/dwm/alerts"
        },
        nextAction: "Add or collect a recent capture containing the active watchlist term."
      }
    });
    const noMatchRebuild = rebuildDwmRuntimeAlerts({ store: noMatchStore as any, tenantId: "tenant_repo_nomatch", organizationId: "org_repo_nomatch" });
    expect(noMatchRebuild.savedAlertCount).toBe(0);
    expect(noMatchRebuild.zeroAlertProof).toMatchObject({
      schemaVersion: "dwm.zero_alert_proof.v1",
      zeroAlert: true,
      state: "blocked_no_matching_capture",
      expectedAlertDelta: 0
    });
    expect(noMatchRebuild.zeroAlertProof.watchlistTerms[0]).toMatchObject({
      term: "acme.com",
      watchlistItemIds: ["watch_item_nomatch"],
      hasMatchingCaptures: false,
      captureRefCount: 0
    });
    expect(noMatchRebuild.generationReadiness.zeroAlertProof.state).toBe("blocked_no_matching_capture");
    expect((noMatchStore as any).listDwmAlerts()).toEqual([expect.objectContaining({ id: "alert_existing_nomatch" })]);

    const inactiveStore = new InMemoryScraperStore();
    inactiveStore.saveSource({ ...telegramSource, id: "src_repo_tg_inactive", status: "candidate" } as SourceRecord);
    inactiveStore.saveCapture({ ...telegramCapture, id: "cap_repo_inactive_acme", sourceId: "src_repo_tg_inactive" } as RawCapture);
    (inactiveStore as any).saveDwmWatchlist({
      id: "watch_repo_inactive",
      tenantId: "tenant_repo_inactive",
      organizationId: "org_repo_inactive",
      terms: [{ id: "watch_item_inactive", value: "acme.com", kind: "domain" }],
      webhookDestinationId: "webhook_repo_inactive",
      status: "active"
    });
    const inactiveReadiness = buildDwmAlertGenerationReadiness({
      watchlists: (inactiveStore as any).listDwmWatchlists(),
      tenantId: "tenant_repo_inactive",
      organizationId: "org_repo_inactive",
      sources: inactiveStore.listSources(),
      captures: inactiveStore.listCaptures()
    });
    expect(inactiveReadiness.blockerCodes).toContain("source_family_inactive");
    expect(inactiveReadiness.zeroAlertProof).toMatchObject({
      zeroAlert: true,
      state: "blocked_inactive_source",
      expectedAlertDelta: 0,
      blockerCodes: expect.arrayContaining(["source_family_inactive"])
    });
    expect(inactiveReadiness.typedBlockers.find((blocker) => blocker.code === "source_family_inactive")).toMatchObject({
      sourceFamilies: ["telegram_public"]
    });
    const inactiveRebuild = rebuildDwmRuntimeAlerts({ store: inactiveStore as any, tenantId: "tenant_repo_inactive", organizationId: "org_repo_inactive" });
    expect(inactiveRebuild.savedAlertCount).toBe(0);
    expect((inactiveStore as any).listDwmAlerts()).toEqual([]);

    const deniedStore = new InMemoryScraperStore();
    deniedStore.saveSource(telegramSource);
    deniedStore.saveCapture(telegramCapture);
    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: "org_repo_denied",
      tenantId: "org_repo_denied",
      ownerOrganizationId: "org_repo_denied",
      entitlementStatus: "suspended",
      canGenerateAlerts: false,
      blockedReasons: ["entitlement_suspended"],
      activeTerms: [{
        watchlistId: "watch_repo_denied",
        watchlistItemId: "watch_item_denied",
        organizationId: "org_repo_denied",
        tenantId: "org_repo_denied",
        kind: "domain",
        termFamily: "domain",
        term: "acme.com",
        status: "active"
      }]
    })) {
      (deniedStore as any).saveDwmWatchlist(watchlist);
    }
    const deniedReadiness = buildDwmAlertGenerationReadiness({
      watchlists: (deniedStore as any).listDwmWatchlists(),
      tenantId: "org_repo_denied",
      organizationId: "org_repo_denied",
      sources: deniedStore.listSources(),
      captures: deniedStore.listCaptures()
    });
    expect(deniedReadiness).toMatchObject({
      readyForRebuild: false,
      blockerCodes: expect.arrayContaining(["entitlement_denied", "org_export_unavailable"]),
      zeroAlertProof: {
        zeroAlert: true,
        state: "blocked_entitlement",
        expectedAlertDelta: 0,
        blockerCodes: expect.arrayContaining(["entitlement_denied", "org_export_unavailable"])
      }
    });
    const deniedRebuild = rebuildDwmRuntimeAlerts({ store: deniedStore as any, tenantId: "org_repo_denied", organizationId: "org_repo_denied" });
    expect(deniedRebuild.savedAlertCount).toBe(0);
    expect((deniedStore as any).listDwmAlerts()).toEqual([]);
  });

  test("builds customer proof rows from org export alerts while preserving workflow and delivery replay state", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveCapture(telegramCapture);
    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: "org_repo_customer",
      tenantId: "org_repo_customer",
      ownerOrganizationId: "org_repo_customer",
      visibilityPolicy: "members",
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistId: "watch_repo_customer",
        watchlistItemId: "watch_item_customer",
        organizationId: "org_repo_customer",
        tenantId: "org_repo_customer",
        kind: "domain",
        termFamily: "domain",
        term: "acme.com",
        status: "active",
        alertGeneratorKey: "org:org_repo_customer:watchlist:watch_item_customer:domain:acme.com"
      }],
      watchlistTerms: [{
        watchlistId: "watch_repo_customer_paused",
        watchlistItemId: "watch_item_customer_paused",
        organizationId: "org_repo_customer",
        tenantId: "org_repo_customer",
        kind: "domain",
        term: "acme.com",
        status: "paused"
      }, {
        watchlistId: "watch_repo_customer_archived",
        watchlistItemId: "watch_item_customer_archived",
        organizationId: "org_repo_customer",
        tenantId: "org_repo_customer",
        kind: "domain",
        term: "acme.com",
        status: "archived"
      }]
    }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_repo_customer" }))) {
      (store as any).saveDwmWatchlist(watchlist);
    }

    const first = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "org_repo_customer", organizationId: "org_repo_customer" });
    expect(first.savedAlertCount).toBe(1);
    expect(first.generationPlan.skippedWatchlists).toEqual([
      { watchlistId: "watch_repo_customer_paused", reason: "paused" },
      { watchlistId: "watch_repo_customer_archived", reason: "archived" }
    ]);
    const alert = first.alerts[0];
    expect(alert).toMatchObject({
      organizationId: "org_repo_customer",
      sourceFamily: "telegram_public",
      watchlistItemIds: ["watch_item_customer"],
      deliveryReadinessContext: {
        selectedCaptureIds: ["cap_repo_tg_acme"],
        generationEvidenceWindow: {
          captureIds: ["cap_repo_tg_acme"],
          sourceFamilies: ["telegram_public"],
          firstObservedAt: "2026-06-28T13:04:00.000Z",
          lastObservedAt: "2026-06-28T13:04:00.000Z"
        },
        alertGeneratorKeys: ["org:org_repo_customer:watchlist:watch_item_customer:domain:acme.com"],
        blockerCodes: []
      }
    });
    const initialHandoff = buildDwmAlertDownstreamHandoff({
      alert,
      organizationId: "org_repo_customer",
      generatedAt: "2026-06-28T13:10:00.000Z"
    });
    expect(initialHandoff.createdEventDispatch).toMatchObject({
      schemaVersion: "dwm.alert_created_event_dispatch.v1",
      ready: true,
      eventId: alert.alertCreatedEvent.id,
      eventType: "dwm.alert.created",
      alertId: alert.id,
      organizationId: "org_repo_customer",
      sourceFamily: "telegram_public",
      captureIds: ["cap_repo_tg_acme"],
      selectedCaptureIds: ["cap_repo_tg_acme"],
      deliveryDedupeKey: alert.deliveryReadinessContext.deliveryDedupeKey,
      workflowEventCount: 0,
      blockerCodes: []
    });
    expect(initialHandoff.createdEventDispatch.idempotencyKey).toMatch(/^dwm_alert_created_dispatch_/);

    store.saveDwmAlert({
      ...alert,
      workflowStatus: "investigating",
      reviewState: "reviewing",
      deliveryState: "delivered",
      assignedOwner: "analyst-customer-proof",
      severityOverride: "critical",
      workflowNote: "Customer proof analyst note.",
      workflowRationale: "Evidence is tied to active org watchlist term.",
      workflowEvents: [{ id: "evt_customer_proof", at: "2026-06-28T13:20:00.000Z", note: "Customer proof analyst note." }],
      caseId: "case_customer_proof",
      casePath: `/v1/cases/case_customer_proof?alertId=${alert.id}`,
      deliveredAt: "2026-06-28T13:21:00.000Z",
      replayCount: 3
    });
    const delivery = (store as any).saveDwmWebhookDelivery({
      id: "delivery_customer_proof",
      tenantId: "org_repo_customer",
      organizationId: "org_repo_customer",
      alertId: alert.id,
      webhookDestinationId: "webhook_repo_customer",
      dedupeKey: alert.dedupeKey,
      attemptedAt: "2026-06-28T13:21:00.000Z",
      status: "delivered",
      httpStatus: 202
    });
    store.saveCapture(telegramFollowupCapture);

    const rebuilt = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "org_repo_customer", organizationId: "org_repo_customer" });
    const preserved = rebuilt.alerts[0];
    expect(preserved).toMatchObject({
      workflowStatus: "investigating",
      assignedOwner: "analyst-customer-proof",
      severityOverride: "critical",
      workflowNote: "Customer proof analyst note.",
      workflowRationale: "Evidence is tied to active org watchlist term.",
      caseId: "case_customer_proof",
      casePath: `/v1/cases/case_customer_proof?alertId=${alert.id}`,
      replayCount: 3
    });
    expect(preserved.workflowEvents).toHaveLength(1);
    expect(preserved.deliveryReadinessContext).toMatchObject({
      replayCount: 3,
      sourceFamily: "telegram_public",
      generationEvidenceWindow: {
        firstObservedAt: "2026-06-28T13:04:00.000Z",
        lastObservedAt: "2026-06-28T13:16:00.000Z"
      }
    });
    expect(preserved.deliveryReadinessContext.generationEvidenceWindow?.captureIds).toContain("cap_repo_tg_acme");
    expect(preserved.deliveryReadinessContext.generationEvidenceWindow?.captureIds).toContain("cap_repo_tg_acme_followup");
    expect(preserved.deliveryReadinessContext.selectedCaptureIds).toContain("cap_repo_tg_acme");
    expect(preserved.deliveryReadinessContext.selectedCaptureIds).toContain("cap_repo_tg_acme_followup");
    expect(preserved.deliveryReadinessContext.blockerCodes).toContain("replay_already_delivered");
    expect(preserved.deliveryReadinessContext.blockerCodes).toContain("duplicate_delivered_dedupe");
    const preservedHandoff = buildDwmAlertDownstreamHandoff({
      alert: preserved,
      deliveries: [delivery],
      organizationId: "org_repo_customer",
      generatedAt: "2026-06-28T13:30:00.000Z"
    });
    expect(preservedHandoff.alertDetailPath).toBe(preserved.alertDetailPath);
    expect(preservedHandoff.createdEventDispatch).toMatchObject({
      ready: false,
      eventId: alert.alertCreatedEvent.id,
      captureIds: ["cap_repo_tg_acme"],
      workflowEventCount: 1
    });
    expect(preservedHandoff.createdEventDispatch.blockerCodes).toContain("replay_already_delivered");
    expect(preservedHandoff.createdEventDispatch.blockerCodes).toContain("duplicate_delivered_dedupe");
    expect(preservedHandoff.createdEventDispatch.selectedCaptureIds).toContain("cap_repo_tg_acme");
    expect(preservedHandoff.createdEventDispatch.selectedCaptureIds).toContain("cap_repo_tg_acme_followup");
    expect(preservedHandoff.evidence.generationEvidenceWindow).toMatchObject({
      sourceFamilies: ["telegram_public"],
      firstObservedAt: "2026-06-28T13:04:00.000Z",
      lastObservedAt: "2026-06-28T13:16:00.000Z"
    });
    expect(preservedHandoff.evidence.generationEvidenceWindow?.captureIds).toContain("cap_repo_tg_acme");
    expect(preservedHandoff.evidence.generationEvidenceWindow?.captureIds).toContain("cap_repo_tg_acme_followup");

    const proof = buildDwmAlertCustomerProofHandoffRow({
      alert: preserved,
      deliveries: [delivery],
      webhookDestinationLifecycle: { verified: false, destinationId: "webhook_repo_customer" },
      generatedAt: "2026-06-28T13:30:00.000Z"
    });
    expect(proof).toMatchObject({
      schemaVersion: "dwm.customer_alert_proof.v1",
      alertId: alert.id,
      organizationId: "org_repo_customer",
      sourceFamily: "telegram_public",
      evidenceCount: 2,
      updatedEvent: {
        schemaVersion: "dwm.alert_updated_event.v1",
        eventType: "dwm.alert.updated",
        alertDetailPath: preserved.alertDetailPath,
        addedCaptureIds: ["cap_repo_tg_acme_followup"],
        captureIds: expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_tg_acme_followup"]),
        evidenceCount: 2,
        previousEvidenceCount: 1,
        dedupeKey: alert.dedupeKey,
        deliveryDedupeKey: alert.dedupeKey
      },
      workflow: {
        status: "investigating",
        assignedOwner: "analyst-customer-proof",
        severityOverride: "critical",
        eventCount: 1,
        replayCount: 3
      },
      caseHandoff: {
        ready: true,
        caseId: "case_customer_proof",
        route: "/v1/cases"
      },
      delivery: {
        delivered: true,
        deliveryHistoryRefs: ["delivery_customer_proof"],
        lastDeliveryStatus: "delivered"
      },
      consumerCompatibility: {
        webhook: { canConsume: true },
        helpdesk: { canConsume: true, supportOnlyRedactionNeeded: false },
        publicTI: { canConsume: true, alertGeneratorKeys: ["org:org_repo_customer:watchlist:watch_item_customer:domain:acme.com"] }
      },
      consumerAdapter: {
        schemaVersion: "dwm.org_alert_case_consumer_adapter.v1",
        organizationId: "org_repo_customer",
        watchlistItemIds: ["watch_item_customer"],
        alertGeneratorKeys: ["org:org_repo_customer:watchlist:watch_item_customer:domain:acme.com"],
        dashboard: {
          route: "organization_watchlist",
          alertDetailPath: preserved.alertDetailPath
        },
        helpdesk: { redacted: true },
        publicTI: { canConsume: true }
      },
      consumerContract: {
        schemaVersion: "dwm.alert_consumer_contract.v1",
        queue: {
          route: "/v1/dwm/alerts",
          workflowStatus: "investigating",
          sourceFamily: "telegram_public",
          evidenceCount: 2
        },
        detail: {
          route: "/v1/dwm/alerts/:alertId",
          alertDetailPath: preserved.alertDetailPath,
          selectedCaptureIds: expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_tg_acme_followup"]),
          provenanceCaptureIds: expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_tg_acme_followup"])
        },
        webhookEvent: {
          eventType: "dwm.alert.created",
          eventId: alert.alertCreatedEvent.id,
          dispatchReady: true,
          deliveryDedupeKey: alert.dedupeKey,
          requiredFields: ["alertId", "eventId", "alertDetailPath", "deliveryDedupeKey", "selectedCaptureIds", "sourceFamily", "organizationId"]
        },
        webhookUpdatedEvent: {
          eventType: "dwm.alert.updated",
          eventId: preserved.alertUpdatedEvent.id,
          dispatchReady: true,
          deliveryDedupeKey: alert.dedupeKey,
          addedCaptureIds: ["cap_repo_tg_acme_followup"],
          requiredFields: ["alertId", "eventId", "alertDetailPath", "deliveryDedupeKey", "addedCaptureIds", "selectedCaptureIds", "sourceFamily", "organizationId"]
        },
        publicTI: {
          redacted: true,
          canConsume: true,
          alertGeneratorKeys: ["org:org_repo_customer:watchlist:watch_item_customer:domain:acme.com"]
        }
      }
    });
    expect(proof.consumerContract.queue.stableFields).toContain("caseHandoff.casePath");
    expect(proof.consumerContract.queue.stableFields).toContain("alertDetailPath");
    expect(proof.consumerContract.queue.stableFields).toContain("updatedEvent");
    expect(proof.consumerContract.detail.stableFields).toContain("alertDetailPath");
    expect(proof.consumerContract.detail.stableFields).toContain("generationEvidenceWindow");
    expect(proof.consumerContract.detail.stableFields).toContain("updatedEvent");
    expect(proof.consumerContract.publicTI.stableFields).toContain("provenance.captureIds");
    expect(proof.alertDetailPath).toBe(preserved.alertDetailPath);
    expect(proof.createdEvent?.alertDetailPath).toBe(preserved.alertDetailPath);
    expect(proof.consumerAdapter.dashboard.fields).toContain("updatedEvent");
    expect(proof.consumerAdapter.dashboard.fields).toContain("alertDetailPath");
    expect(proof.selectedCaptureIds).toEqual(expect.arrayContaining(["cap_repo_tg_acme", "cap_repo_tg_acme_followup"]));
    expect(proof.blockerCodes).toEqual(expect.arrayContaining(["duplicate_delivered_dedupe", "webhook_destination_not_verified"]));
    expect(dwmAlertToSqlRecord(preserved).alert_detail_path).toBe(preserved.alertDetailPath);
  });

  test("builds isolated downstream handoff records for overlapping org watchlist terms across Telegram, darkweb, and actor captures", () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveSource(darkwebSource);
    store.saveSource(actorSource);
    store.saveCapture(overlapTelegramCapture);
    store.saveCapture(orgADarkwebCapture);
    store.saveCapture(orgBActorCapture);

    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: "org_repo_alpha",
      tenantId: "tenant_repo_shared",
      ownerOrganizationId: "org_repo_alpha",
      visibilityPolicy: "members",
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistId: "watch_repo_alpha_overlap",
        watchlistItemId: "watch_item_alpha_overlap_acme",
        organizationId: "org_repo_alpha",
        tenantId: "tenant_repo_shared",
        kind: "domain",
        termFamily: "domain",
        term: "acme.com",
        category: "domain",
        status: "active",
        alertGeneratorKey: "org:org_repo_alpha:watchlist:watch_item_alpha_overlap_acme:domain:acme.com"
      }, {
        watchlistId: "watch_repo_alpha_unique",
        watchlistItemId: "watch_item_alpha_unique",
        organizationId: "org_repo_alpha",
        tenantId: "tenant_repo_shared",
        kind: "domain",
        termFamily: "domain",
        term: "alpha-payments.example",
        category: "domain",
        status: "active",
        alertGeneratorKey: "org:org_repo_alpha:watchlist:watch_item_alpha_unique:domain:alpha-payments.example"
      }]
    }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_alpha_ops" }))) {
      (store as any).saveDwmWatchlist(watchlist);
    }
    for (const watchlist of orgWatchlistContractToRuntimeDwmWatchlists({
      schemaVersion: "organization.watchlist_alert_generation.v1",
      organizationId: "org_repo_beta",
      tenantId: "tenant_repo_shared",
      ownerOrganizationId: "org_repo_beta",
      visibilityPolicy: "members",
      entitlementStatus: "active",
      canGenerateAlerts: true,
      activeTerms: [{
        watchlistId: "watch_repo_beta_overlap",
        watchlistItemId: "watch_item_beta_overlap_acme",
        organizationId: "org_repo_beta",
        tenantId: "tenant_repo_shared",
        kind: "domain",
        termFamily: "domain",
        term: "acme.com",
        category: "domain",
        status: "active",
        alertGeneratorKey: "org:org_repo_beta:watchlist:watch_item_beta_overlap_acme:domain:acme.com"
      }, {
        watchlistId: "watch_repo_beta_unique",
        watchlistItemId: "watch_item_beta_unique",
        organizationId: "org_repo_beta",
        tenantId: "tenant_repo_shared",
        kind: "domain",
        termFamily: "domain",
        term: "beta-payments.example",
        category: "domain",
        status: "active",
        alertGeneratorKey: "org:org_repo_beta:watchlist:watch_item_beta_unique:domain:beta-payments.example"
      }]
    }).map((watchlist) => ({ ...watchlist, webhookDestinationId: "webhook_beta_ops" }))) {
      (store as any).saveDwmWatchlist(watchlist);
    }

    const alpha = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_shared", organizationId: "org_repo_alpha" });
    const beta = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_shared", organizationId: "org_repo_beta" });
    expect(alpha.savedAlertCount).toBe(2);
    expect(beta.savedAlertCount).toBe(2);
    expect(alpha.alerts.map((alert) => alert.sourceFamily).sort()).toEqual(["darkweb_metadata", "telegram_public"]);
    expect(beta.alerts.map((alert) => alert.sourceFamily).sort()).toEqual(["actor_page", "telegram_public"]);

    const alphaTelegram = alpha.alerts.find((alert) => alert.sourceFamily === "telegram_public");
    const betaTelegram = beta.alerts.find((alert) => alert.sourceFamily === "telegram_public");
    expect(alphaTelegram?.id).not.toBe(betaTelegram?.id);
    expect(alphaTelegram?.dedupeKey).not.toBe(betaTelegram?.dedupeKey);

    const alphaHandoff = buildDwmAlertDownstreamHandoff({ alert: alphaTelegram });
    const betaHandoff = buildDwmAlertDownstreamHandoff({ alert: betaTelegram });
    expect(alphaHandoff).toMatchObject({
      schemaVersion: "dwm.alert_downstream_handoff.v1",
      ready: true,
      organizationId: "org_repo_alpha",
      sourceFamily: "telegram_public",
      watchlist: {
        watchlistIds: ["watch_repo_alpha_overlap"],
        watchlistItemIds: ["watch_item_alpha_overlap_acme"],
        alertGeneratorKeys: ["org:org_repo_alpha:watchlist:watch_item_alpha_overlap_acme:domain:acme.com"]
      },
      deliveryReadiness: {
        webhookDestinationIds: ["webhook_alpha_ops"],
        destinationReady: true
      },
      deliverySelection: {
        schemaVersion: "dwm.alert_delivery_selection.v1",
        ready: true,
        selectedWebhookDestinationId: "webhook_alpha_ops",
        enabledWebhookDestinationIds: ["webhook_alpha_ops"],
        disabledWebhookDestinationIds: [],
        selectedCaptureIds: ["cap_repo_overlap_acme"],
        sourceFamily: "telegram_public"
      }
    });
    expect(betaHandoff).toMatchObject({
      ready: true,
      organizationId: "org_repo_beta",
      sourceFamily: "telegram_public",
      watchlist: {
        watchlistIds: ["watch_repo_beta_overlap"],
        watchlistItemIds: ["watch_item_beta_overlap_acme"],
        alertGeneratorKeys: ["org:org_repo_beta:watchlist:watch_item_beta_overlap_acme:domain:acme.com"]
      },
      deliveryReadiness: {
        webhookDestinationIds: ["webhook_beta_ops"],
        destinationReady: true
      },
      deliverySelection: {
        schemaVersion: "dwm.alert_delivery_selection.v1",
        ready: true,
        selectedWebhookDestinationId: "webhook_beta_ops",
        enabledWebhookDestinationIds: ["webhook_beta_ops"],
        disabledWebhookDestinationIds: [],
        selectedCaptureIds: ["cap_repo_overlap_acme"],
        sourceFamily: "telegram_public"
      }
    });
    expect(JSON.stringify(alphaHandoff)).not.toContain("webhook_beta_ops");
    expect(JSON.stringify(betaHandoff)).not.toContain("webhook_alpha_ops");
    expect(alphaHandoff.evidence.selectedCaptureIds).toEqual(["cap_repo_overlap_acme"]);
    expect(betaHandoff.evidence.selectedCaptureIds).toEqual(["cap_repo_overlap_acme"]);
    expect(alpha.alerts.flatMap((alert) => alert.deliveryReadinessContext.selectedCaptureIds)).not.toContain("cap_repo_actor_beta");
    expect(beta.alerts.flatMap((alert) => alert.deliveryReadinessContext.selectedCaptureIds)).not.toContain("cap_repo_darkweb_alpha");

    store.saveDwmAlert({
      ...alphaTelegram,
      workflowStatus: "investigating",
      assignedOwner: "alpha-analyst",
      caseId: "case_alpha_overlap",
      casePath: `/v1/cases/case_alpha_overlap?alertId=${alphaTelegram?.id}`,
      workflowEvents: [{ id: "evt_alpha_case_link", at: "2026-06-28T13:32:00.000Z", toWorkflowStatus: "investigating", toCaseId: "case_alpha_overlap" }],
      replayCount: 1
    });
    const alphaDelivery = (store as any).saveDwmWebhookDelivery({
      id: "delivery_alpha_overlap",
      tenantId: "tenant_repo_shared",
      organizationId: "org_repo_alpha",
      alertId: alphaTelegram?.id,
      webhookDestinationId: "webhook_alpha_ops",
      dedupeKey: alphaTelegram?.dedupeKey,
      attemptedAt: "2026-06-28T13:33:00.000Z",
      status: "delivered",
      httpStatus: 202
    });
    const preservedAlpha = buildDwmAlertDownstreamHandoff({
      alert: (store as any).getDwmAlert(alphaTelegram?.id),
      deliveries: [alphaDelivery],
      organizationId: "org_repo_alpha"
    });
    const betaAfterAlphaWorkflow = rebuildDwmRuntimeAlerts({ store: store as any, tenantId: "tenant_repo_shared", organizationId: "org_repo_beta" });
    const betaTelegramAfterAlphaWorkflow = betaAfterAlphaWorkflow.alerts.find((alert) => alert.sourceFamily === "telegram_public");
    expect(preservedAlpha).toMatchObject({
      blockerCodes: ["duplicate_replay"],
      replay: { duplicate: true, canReplay: false },
      caseReadiness: { caseId: "case_alpha_overlap" },
      deliveryReadiness: { deliveryHistoryRefs: ["delivery_alpha_overlap"] },
      deliverySelection: {
        ready: false,
        selectedWebhookDestinationId: undefined,
        blockerCodes: expect.arrayContaining(["duplicate_replay"]),
        selectedCaptureIds: ["cap_repo_overlap_acme"]
      }
    });
    expect(betaTelegramAfterAlphaWorkflow?.workflowEvents ?? []).toHaveLength(0);
    expect(betaTelegramAfterAlphaWorkflow?.assignedOwner).toBeUndefined();
    expect(betaTelegramAfterAlphaWorkflow?.deliveryReadinessContext.deliveryHistoryRefs).toEqual([]);
    expect(JSON.stringify(betaTelegramAfterAlphaWorkflow)).not.toContain("case_alpha_overlap");
    expect(JSON.stringify(betaTelegramAfterAlphaWorkflow)).not.toContain("delivery_alpha_overlap");
  });

  test("API rebuild and list expose generated alerts in product-ready shape", async () => {
    const store = new InMemoryScraperStore();
    store.saveSource(telegramSource);
    store.saveCapture(telegramCapture);
    const options = { store, frontier: new FocusedFrontier() };

    const watchlistResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/watchlists", {
      method: "POST",
      body: JSON.stringify({
        tenantId: "tenant_api_acme",
        name: "API Acme exposure watch",
        terms: ["acme.com"]
      })
    }), options);
    expect(watchlistResponse.status).toBe(201);

    const rebuildResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts/rebuild", {
      method: "POST",
      body: JSON.stringify({ tenantId: "tenant_api_acme" })
    }), options);
    const rebuild = await rebuildResponse.json() as any;

    expect(rebuildResponse.status).toBe(200);
    expect(rebuild.savedAlertCount).toBe(1);
    expect(rebuild.alerts[0]).toMatchObject({
      tenantId: "tenant_api_acme",
      eventType: "darkweb.monitoring.match",
      sourceFamily: "telegram_public",
      recommendedRoute: "identity_response",
      deliveryState: "pending_review"
    });
    expect(rebuild.alerts[0].dedupeKey).toMatch(/^dwm_dedupe_/);
    expect(rebuild.alerts[0].confidenceReasoning.join(" ")).toContain("Watchlist term matched");
    expect(rebuild.alerts[0].provenance.captureIds).toContain("cap_repo_tg_acme");
    expect(rebuild.alerts[0].evidence[0].provenance.captureId).toBe("cap_repo_tg_acme");
    expect(rebuild.alerts[0].workflowContext).toMatchObject({
      tenantId: "tenant_api_acme",
      sourceFamily: "telegram_public",
      primaryCaptureId: "cap_repo_tg_acme",
      evidenceCount: 1,
      recommendedRoute: "identity_response",
      hasWebhookRoute: false
    });
    expect(rebuild.alerts[0].workflowContext.watchlistItemIds[0]).toContain("acme.com");
    expect(rebuild.alerts[0].webhookContext).toMatchObject({
      tenantId: "tenant_api_acme",
      sourceFamily: "telegram_public",
      captureIds: ["cap_repo_tg_acme"],
      evidenceCount: 1,
      recommendedRoute: "identity_response"
    });
    expect(rebuild.alerts[0].caseIdCandidate).toMatch(/^case_/);
    expect(rebuild.alerts[0].casePath).toContain(`/v1/cases/${rebuild.alerts[0].caseIdCandidate}`);

    const listResponse = await handleApiRequest(new Request("http://127.0.0.1/v1/dwm/alerts?tenantId=tenant_api_acme"), options);
    const list = await listResponse.json() as any;

    expect(listResponse.status).toBe(200);
    expect(list.alerts).toHaveLength(1);
    expect(list.alerts[0].watchlistIds).toHaveLength(1);
    expect(list.alerts[0].webhookDelivery.dedupeKey).toBe(list.alerts[0].dedupeKey);
    expect(list.alerts[0].workflowContext.casePath).toBe(list.alerts[0].casePath);
    expect(list.alerts[0].workflowContext.caseIdCandidate).toBe(list.alerts[0].caseIdCandidate);
    expect(list.alerts[0].webhookContext.caseIdCandidate).toBe(list.alerts[0].caseIdCandidate);
    expect(list.alerts[0].webhookContext.dedupeKey).toBe(list.alerts[0].dedupeKey);
  });
});
