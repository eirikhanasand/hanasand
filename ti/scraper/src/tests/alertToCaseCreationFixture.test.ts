import { describe, expect, test } from "bun:test";
import { buildAlertToCaseCreationFixture } from "../product/alertToCaseCreationFixture.ts";

describe("alert to case creation fixture", () => {
  test("builds a metadata-only case creation preflight fixture", () => {
    const fixture = buildAlertToCaseCreationFixture(alertFixture(), {
      checkedAt: "2026-06-30T05:00:00.000Z",
      assignedOwner: "owner@acme.com",
      note: "Open case for analyst review."
    });

    expect(fixture).toMatchObject({
      schemaVersion: "dwm.alert_to_case_creation_fixture.v1",
      checkedAt: "2026-06-30T05:00:00.000Z",
      tenantId: "tenant_acme",
      organizationId: "org_acme",
      alertId: "alert_acme",
      caseIdCandidate: "case_alert_acme",
      casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
      ready: true,
      route: "/v1/dwm/alerts/alert_acme/case-handoff",
      method: "POST",
      requestBody: {
        organizationId: "org_acme",
        assignedOwner: "owner@acme.com",
        note: "Open case for analyst review."
      },
      dedupe: {
        alertDedupeKey: "dwm_alert_acme"
      },
      provenance: {
        captureIds: ["cap_acme_1"],
        sourceIds: ["src_acme_tg"],
        contentHashes: ["hash_acme_1"],
        evidenceCount: 1
      },
      related: {
        watchlistIds: ["watch_acme"],
        watchlistItemIds: ["watch_item_acme_domain"],
        webhookDestinationIds: ["webhook_acme_discord"]
      },
      blockerCodes: [],
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
        crossOrgDataExposed: false
      }
    });
    expect(fixture.requestBody.idempotencyKey).toMatch(/^alert_case_creation_/);
    expect(JSON.stringify(fixture)).not.toContain("rawText");
    expect(JSON.stringify(fixture)).not.toContain("discord.com/api/webhooks");
  });

  test("blocks case creation preflight when alert identity or provenance is incomplete", () => {
    const fixture = buildAlertToCaseCreationFixture({
      id: "alert_incomplete",
      tenantId: "tenant_acme",
      evidence: []
    }, { checkedAt: "2026-06-30T05:01:00.000Z" });

    expect(fixture).toMatchObject({
      ready: false,
      alertId: "alert_incomplete",
      route: "/v1/dwm/alerts/alert_incomplete/case-handoff",
      blockerCodes: expect.arrayContaining([
        "missing_organization_scope",
        "missing_case_id_candidate",
        "missing_case_path",
        "missing_capture_provenance",
        "missing_source_provenance",
        "missing_content_hash"
      ]),
      safeOutput: {
        metadataOnly: true,
        rawEvidenceExposed: false
      }
    });
  });
});

function alertFixture() {
  return {
    id: "alert_acme",
    tenantId: "tenant_acme",
    organizationId: "org_acme",
    dedupeKey: "dwm_alert_acme",
    caseIdCandidate: "case_alert_acme",
    casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
    workflowContext: {
      organizationId: "org_acme",
      caseIdCandidate: "case_alert_acme",
      casePath: "/v1/cases/case_alert_acme?alertId=alert_acme",
      watchlistIds: ["watch_acme"],
      watchlistItemIds: ["watch_item_acme_domain"],
      captureIds: ["cap_acme_1"],
      sourceIds: ["src_acme_tg"],
      webhookDestinationIds: ["webhook_acme_discord"]
    },
    webhookContext: {
      organizationId: "org_acme",
      webhookDestinationIds: ["webhook_acme_discord"]
    },
    provenance: {
      captureIds: ["cap_acme_1"],
      sourceIds: ["src_acme_tg"],
      contentHashes: ["hash_acme_1"]
    },
    watchlistIds: ["watch_acme"],
    watchlistItemIds: ["watch_item_acme_domain"],
    evidence: [{
      id: "ev_acme_1",
      sourceId: "src_acme_tg",
      contentHash: "hash_acme_1",
      provenance: { captureId: "cap_acme_1", sourceId: "src_acme_tg" }
    }]
  };
}
