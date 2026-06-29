import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import {
  orgWatchlistTermsToAlertGenerationRequest,
  persistedAlertToCaseHandoffPayload,
  persistedAlertToWebhookTriggerContext,
  publicTiArtifactToOrgWatchlistCreate,
} from "../product/analystHandoff.ts";
import {
  ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
  validateAnalystHandoffConsumerBundle,
  type AnalystHandoffConsumerBlockerCode,
  type AnalystHandoffConsumerBundle,
  type DwmWebhookAuditEventContract,
  type OrgWatchlistAlertTermsExportContract,
} from "../product/analystHandoffConsumer.ts";
import { buildDwmProductSnapshot, type DwmAlert } from "../product/dwmProduct.ts";
import type { RawCapture, SourceRecord } from "../types.ts";

const source: SourceRecord = {
  id: "src_consumer_tg",
  name: "Consumer contract Telegram",
  type: "telegram_public",
  url: "https://t.me/consumer_contract",
  accessMethod: "public_http",
  status: "active",
  trustScore: 0.84,
  legalNotes: "Public channel preview only.",
  createdAt: "2026-06-29T00:00:00.000Z",
  updatedAt: "2026-06-29T00:00:00.000Z"
} as SourceRecord;

const capture: RawCapture = {
  id: "cap_consumer_acme",
  sourceId: source.id,
  url: "https://t.me/consumer_contract/11",
  collectedAt: "2026-06-29T00:03:00.000Z",
  mediaType: "text/plain",
  storageKind: "inline_text",
  contentHash: "hash-consumer-acme",
  sensitive: false,
  body: "Lumma C2 broker channel mentions acme.com Okta sessions and a live AWS IAM key escrow offer.",
  metadata: { adapter: "telegram_public", channel: "consumer_contract", actorName: "Lumma C2", messageId: 11 }
} as RawCapture;

describe("analyst handoff consumer validation", () => {
  test("validates adapter output against org alert terms and webhook audit contracts without UI imports", () => {
    const watchlist = publicTiArtifactToOrgWatchlistCreate({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      requestedByUserId: "user_analyst",
      query: "Lumma C2",
      artifact: {
        id: "artifact_lumma_acme",
        kind: "tool",
        label: "Lumma C2",
        confidence: 91,
        freshness: "2026-06-29T00:10:00.000Z",
        provenance: ["public TI profile", "telegram broker-room capture"],
        watchlistTerms: [{ kind: "domain", value: "acme.com", notes: "Observed in Lumma C2 broker-room context." }]
      },
      generatedAt: "2026-06-29T00:10:00.000Z"
    });
    expect(watchlist.ok).toBe(true);
    if (!watchlist.ok) throw new Error("watchlist adapter failed");

    const generation = orgWatchlistTermsToAlertGenerationRequest({
      parent: watchlist.value.handoff,
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      webhookDestinationIds: ["webhook_discord"],
      createdAt: "2026-06-29T00:11:00.000Z"
    });
    expect(generation.ok).toBe(true);
    if (!generation.ok) throw new Error("generation adapter failed");

    const alert = alertFixture({
      caseIdCandidate: "case_acme_lumma",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"
    });
    const caseHandoff = persistedAlertToCaseHandoffPayload({
      parent: generation.value.handoff,
      alert,
      requestedByUserId: "user_analyst",
      createdAt: "2026-06-29T00:12:00.000Z"
    });
    expect(caseHandoff.ok).toBe(true);
    if (!caseHandoff.ok) throw new Error("case handoff adapter failed");

    const webhook = persistedAlertToWebhookTriggerContext({
      parent: caseHandoff.value.handoff,
      alert,
      requestedByUserId: "user_analyst",
      dryRun: true,
      createdAt: "2026-06-29T00:13:00.000Z"
    });
    expect(webhook.ok).toBe(true);
    if (!webhook.ok) throw new Error("webhook adapter failed");

    const bundle: AnalystHandoffConsumerBundle = {
      schemaVersion: ANALYST_HANDOFF_CONSUMER_SCHEMA_VERSION,
      generatedAt: "2026-06-29T00:14:00.000Z",
      staleEvidenceBefore: "2026-06-01T00:00:00.000Z",
      entitlement: { allowed: true },
      membership: {
        userId: "user_analyst",
        organizationId: "org_acme",
        role: "admin",
        status: "active",
        allowedRoles: ["owner", "admin", "analyst"]
      },
      stages: {
        publicTi: watchlist.value,
        orgWatchlist: {
          ...generation.value,
          termsExport: orgTermsExport()
        },
        caseHandoff: caseHandoff.value,
        webhookTrigger: {
          ...webhook.value,
          auditEvents: webhookAuditEvents(webhook.value.request.body.idempotencyKey)
        }
      }
    };

    const validation = validateAnalystHandoffConsumerBundle(bundle);
    expect(validation.ok).toBe(true);
    expect(validation.blockers).toEqual([]);
    expect(validation.identity).toMatchObject({
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      requestedByUserId: "user_analyst",
      actorQuery: "lumma c2",
      artifactId: "artifact_lumma_acme",
      watchlistId: "watch_acme",
      watchlistItemIds: ["watch_item_acme_domain"],
      alertId: "dwm_alert_acme",
      caseIdCandidate: "case_acme_lumma",
      webhookDestinationIds: ["webhook_discord"]
    });
    expect(validation.contracts).toEqual({
      publicTiSatisfied: true,
      orgAlertTermsSatisfied: true,
      alertRequestSatisfied: true,
      caseHandoffSatisfied: true,
      webhookTriggerSatisfied: true,
      webhookAuditSatisfied: true
    });
  });

  test("checked-in happy fixture validates the full consumer chain", () => {
    const fixture = loadFixture("analyst-handoff-happy.json");
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(true);
    expect(validation.contracts.orgAlertTermsSatisfied).toBe(true);
    expect(validation.contracts.webhookAuditSatisfied).toBe(true);
    expect(validation.identity?.alertId).toBe("dwm_alert_acme");
  });

  test("checked-in blocker fixture reports typed consumer blockers", () => {
    const fixture = loadFixture("analyst-handoff-blockers.json");
    const validation = validateAnalystHandoffConsumerBundle(fixture);
    expect(validation.ok).toBe(false);
    const codes = new Set(validation.blockers.map((item) => item.code));
    const expected: AnalystHandoffConsumerBlockerCode[] = [
      "missing_org",
      "missing_provenance",
      "stale_evidence",
      "missing_watchlist_id",
      "missing_watchlist_item",
      "absent_alert_id",
      "entitlement_blocked",
      "nonmember",
      "identity_mismatch",
      "org_terms_contract_mismatch",
      "webhook_trigger_contract_mismatch",
      "webhook_audit_contract_mismatch"
    ];
    for (const code of expected) expect(codes.has(code)).toBe(true);
  });
});

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function orgTermsExport(): OrgWatchlistAlertTermsExportContract {
  return {
    schemaVersion: "organization.watchlist_alert_terms_export.v1",
    organizationId: "org_acme",
    tenantId: "tenant_acme",
    member: {
      userId: "user_analyst",
      role: "admin",
      status: "active"
    },
    allowedViewerRoles: ["owner", "admin", "analyst"],
    activeTerms: [{
      watchlistItemId: "watch_item_acme_domain",
      itemId: "item_acme_domain",
      termFamily: "domain",
      term: "acme.com",
      source: "organization_shared_watchlist",
      alertGenerationReference: {
        schemaVersion: "organization.watchlist_item_alert_reference.v1",
        organizationId: "org_acme",
        tenantId: "tenant_acme",
        watchlistItemId: "watch_item_acme_domain",
        itemId: "item_acme_domain",
        termFamily: "domain",
        term: "acme.com",
        status: "active"
      }
    }],
    activeWatchlistTerms: [{
      organizationId: "org_acme",
      tenantId: "tenant_acme",
      watchlistItemId: "watch_item_acme_domain",
      itemId: "item_acme_domain",
      termFamily: "domain",
      term: "acme.com",
      status: "active"
    }],
    blockedReasons: [],
    canGenerateAlerts: true
  };
}

function webhookAuditEvents(idempotencyKey: string): DwmWebhookAuditEventContract[] {
  return [{
    schemaVersion: "dwm.webhook.audit_event.v1",
    auditEventId: "audit_webhook_acme",
    action: "delivery.dry_run",
    orgId: "org_acme",
    actorId: "user_analyst",
    destinationId: "webhook_discord",
    deliveryId: "delivery_acme",
    delivery: {
      alertId: "dwm_alert_acme",
      eventType: "darkweb.monitoring.match",
      status: "dry_run",
      dryRun: true,
      idempotencyKey,
      watchlistId: "watch_acme",
      route: "identity_response",
      casePath: "/v1/cases/case_acme_lumma?alertId=dwm_alert_acme&dedupeKey=dwm_dedupe_acme"
    },
    createdAt: "2026-06-29T00:13:30.000Z"
  }];
}

function alertFixture(overrides: { organizationId?: string; caseIdCandidate?: string; casePath?: string } = {}): DwmAlert & {
  tenantId: string;
  organizationId: string;
  watchlistIds: string[];
  watchlistItemIds: string[];
  workflowContext: Record<string, unknown>;
  webhookContext: Record<string, unknown>;
  caseIdCandidate?: string;
  casePath?: string;
} {
  const snapshot = buildDwmProductSnapshot({
    tenantId: "tenant_acme",
    watchlist: [{ kind: "domain", value: "acme.com" }],
    sources: [source],
    captures: [capture],
    generatedAt: "2026-06-29T00:10:00.000Z",
    includeDemoIfEmpty: false
  });
  const alert = snapshot.alerts[0];
  return {
    ...alert,
    id: "dwm_alert_acme",
    dedupeKey: "dwm_dedupe_acme",
    webhookDelivery: { ...alert.webhookDelivery, dedupeKey: "dwm_dedupe_acme" },
    tenantId: "tenant_acme",
    organizationId: overrides.organizationId || "org_acme",
    watchlistIds: ["watch_acme"],
    watchlistItemIds: ["watch_item_acme_domain"],
    caseIdCandidate: overrides.caseIdCandidate,
    casePath: overrides.casePath,
    workflowContext: {
      tenantId: "tenant_acme",
      organizationId: overrides.organizationId || "org_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_consumer_acme"],
      caseIdCandidate: overrides.caseIdCandidate,
      casePath: overrides.casePath,
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      webhookDestinationIds: ["webhook_discord"]
    },
    webhookContext: {
      tenantId: "tenant_acme",
      organizationId: overrides.organizationId || "org_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_consumer_acme"],
      evidenceCount: 1,
      dedupeKey: "dwm_dedupe_acme",
      recommendedRoute: "identity_response",
      caseIdCandidate: overrides.caseIdCandidate,
      casePath: overrides.casePath,
      webhookDestinationIds: ["webhook_discord"]
    }
  };
}
