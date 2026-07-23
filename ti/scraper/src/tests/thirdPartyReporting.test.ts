import { describe, expect, test } from "./apiTestHarness.ts";
import { handleApiRequest } from "../api/server.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";
import { validateStixBundle } from "../export/stixValidation.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { containsUnsafeCustomerOutboundText } from "../../../../api/src/utils/dwm/customerOutputSafety.ts";

const generatedAt = "2026-07-23T10:00:00.000Z";
const serviceHeaders = {
  "x-hanasand-service-token": "report-service",
  "x-user-email": "analyst@acme.example"
};

describe("authenticated third-party reporting", () => {
  test("exports only selected tenant evidence as safe JSON and valid STIX", async () => {
    const { store, options } = reportingFixture();
    const noAuthentication = await handleApiRequest(new Request("http://local/v1/cases/case_report/export?organizationId=org_report&report=true&format=json&evidenceId=evidence_public", {
      headers: { "x-user-email": "analyst@acme.example" }
    }), options);
    expect(noAuthentication.status).not.toBe(200);

    const jsonResponse = await report(options, "json", ["evidence_public"]);
    const jsonPayload = await jsonResponse.json() as any;
    expect(jsonResponse.status).toBe(200);
    expect(jsonPayload).toMatchObject({
      schemaVersion: "analyst.case_export.v1",
      reportPolicy: {
        direction: "outbound_third_party",
        format: "hanasand-json",
        caseId: "case_report",
        alertId: "alert_report",
        evidenceIds: ["evidence_public"],
        evidenceCount: 1,
        evidenceLimit: 25
      },
      summary: { caseId: "case_report", evidenceCount: 1 },
      auditSafety: {
        rawSensitiveEvidenceIncluded: false,
        restrictedSourceLocatorsIncluded: false,
        credentialsIncluded: false
      }
    });
    expect(jsonPayload.exportChecksum).toMatch(/^case_report_/);
    expect(jsonPayload.evidence.map((item: any) => item.id)).toEqual(["evidence_public"]);
    expectCustomerSafe(jsonPayload);
    expect(JSON.stringify(jsonPayload)).not.toContain("PUBLIC BODY MUST NOT EXPORT");

    const repeatResponse = await report(options, "json", ["evidence_public"]);
    expect((await repeatResponse.json() as any).exportChecksum).toBe(jsonPayload.exportChecksum);

    store.saveCase({ ...store.getCase("case_report"), title: "Changed report semantics without a timestamp change" } as any);
    const changedResponse = await report(options, "json", ["evidence_public"]);
    expect((await changedResponse.json() as any).exportChecksum).not.toBe(jsonPayload.exportChecksum);

    const orderedJson = await report(options, "json", ["evidence_public", "evidence_sensitive"]);
    const reversedJson = await report(options, "json", ["evidence_sensitive", "evidence_public"]);
    const orderedJsonPayload = await orderedJson.json() as any;
    const reversedJsonPayload = await reversedJson.json() as any;
    expect(reversedJsonPayload.reportPolicy.evidenceIds).toEqual(["evidence_public", "evidence_sensitive"]);
    expect(reversedJsonPayload.exportChecksum).toBe(orderedJsonPayload.exportChecksum);

    const stixResponse = await report(options, "stix", ["evidence_public", "evidence_sensitive"]);
    const stixPayload = await stixResponse.json() as any;
    expect(stixResponse.status).toBe(200);
    expect(stixPayload.standardsValidation).toEqual({ standard: "STIX 2.1", valid: true, issues: [] });
    expect(stixPayload.reportPolicy).toMatchObject({ format: "stix-2.1", evidenceCount: 2 });
    expect(stixPayload.bundle.objects.filter((item: any) => item.type === "x-ti-evidence")).toHaveLength(2);
    const reportObjects = stixPayload.bundle.objects.filter((item: any) => item.type === "report");
    expect(reportObjects).toHaveLength(1);
    expect(reportObjects[0].published).toBe(generatedAt);
    const invalidWithoutPublished = {
      ...stixPayload.bundle,
      objects: stixPayload.bundle.objects.map((item: any) => item.type === "report"
        ? Object.fromEntries(Object.entries(item).filter(([key]) => key !== "published"))
        : item)
    };
    expect(validateStixBundle(invalidWithoutPublished)).toMatchObject({
      valid: false,
      issues: [{ path: expect.stringContaining(".published"), message: "report published must be an ISO timestamp" }]
    });
    expect(JSON.stringify(stixPayload)).not.toContain("PUBLIC BODY MUST NOT EXPORT");
    expectCustomerSafe(stixPayload);

    const reversedStix = await report(options, "stix", ["evidence_sensitive", "evidence_public"]);
    expect((await reversedStix.json() as any).exportChecksum).toBe(stixPayload.exportChecksum);

    const duplicateEvidence = await report(options, "json", ["evidence_public", "evidence_public"]);
    expect(duplicateEvidence.status).toBe(400);
    expect((await duplicateEvidence.json() as any).error.code).toBe("report_duplicate_evidence_selection");

    const duplicateCaptureAlert = store.getDwmAlert("alert_report");
    store.saveDwmAlert({
      ...duplicateCaptureAlert,
      evidence: [
        ...duplicateCaptureAlert.evidence,
        {
          id: "evidence_public_alias",
          sourceId: "source_report",
          contentHash: "hash-public",
          provenance: { captureId: "capture_public", sourceId: "source_report", contentHash: "hash-public" }
        }
      ]
    });
    const duplicateCapture = await report(options, "stix", ["evidence_public", "evidence_public_alias"]);
    expect(duplicateCapture.status).toBe(400);
    expect((await duplicateCapture.json() as any).error).toMatchObject({
      code: "report_duplicate_capture_selection",
      evidenceIds: ["evidence_public_alias"]
    });
    store.saveDwmAlert(duplicateCaptureAlert);

    const emptySelection = await report(options, "json", []);
    expect(emptySelection.status).toBe(400);
    expect((await emptySelection.json() as any).error.code).toBe("report_evidence_required");

    const unsupportedFormat = await handleApiRequest(new Request("http://local/v1/cases/case_report/export?organizationId=org_report&report=true&format=xml&evidenceId=evidence_public", {
      headers: serviceHeaders
    }), options);
    expect(unsupportedFormat.status).toBe(400);
    expect((await unsupportedFormat.json() as any).error.code).toBe("unsupported_report_format");

    store.saveCase({
      id: "case_unscoped_report",
      tenantId: "tenant_report",
      sourceType: "dwm_alert",
      sourceId: "alert_report",
      alertId: "alert_report",
      title: "Legacy unscoped case",
      summary: "Must not leave an organization boundary.",
      priority: "high",
      status: "open",
      createdAt: generatedAt,
      updatedAt: generatedAt,
      workflowEvents: []
    });
    const unscoped = await handleApiRequest(new Request("http://local/v1/cases/case_unscoped_report/export?organizationId=org_report&report=true&format=json&evidenceId=evidence_public", {
      headers: serviceHeaders
    }), options);
    expect(unscoped.status).toBe(403);
    expect((await unscoped.json() as any).error.code).toBe("report_organization_scope_mismatch");

    const unknownResponse = await report(options, "json", ["evidence_not_on_case"]);
    expect(unknownResponse.status).toBe(400);
    expect((await unknownResponse.json() as any).error.code).toBe("report_evidence_not_found");

    const scopedAlert = store.getDwmAlert("alert_report");
    store.saveDwmAlert({ ...scopedAlert, tenantId: "tenant_other" });
    const crossTenantAlert = await report(options, "json", ["evidence_public"]);
    expect(crossTenantAlert.status).toBe(409);
    expect((await crossTenantAlert.json() as any).error.code).toBe("report_alert_scope_mismatch");
    store.saveDwmAlert(scopedAlert);

    const scopedCapture = store.listCaptures().find((item: any) => item.id === "capture_public");
    store.saveCapture({ ...scopedCapture, id: "capture_other_tenant", tenantId: "tenant_other" } as any);
    store.saveDwmAlert({
      ...scopedAlert,
      evidence: scopedAlert.evidence.map((item: any) => item.id === "evidence_public"
        ? { ...item, provenance: { ...item.provenance, captureId: "capture_other_tenant" } }
        : item)
    });
    const crossTenantCapture = await report(options, "json", ["evidence_public"]);
    expect(crossTenantCapture.status).toBe(409);
    expect((await crossTenantCapture.json() as any).error.code).toBe("report_evidence_provenance_invalid");
    store.saveDwmAlert(scopedAlert);

    store.saveDwmAlert({
      ...store.getDwmAlert("alert_report"),
      evidence: Array.from({ length: 26 }, (_, index) => ({
        id: `evidence_${index}`,
        sourceId: "source_report",
        contentHash: "hash-public",
        provenance: { captureId: "capture_public", sourceId: "source_report", contentHash: "hash-public" }
      }))
    });
    const oversized = await report(options, "stix", Array.from({ length: 26 }, (_, index) => `evidence_${index}`));
    expect(oversized.status).toBe(413);
    expect((await oversized.json() as any).error.code).toBe("report_evidence_limit");
  });

  test("authenticates the existing run-scoped STIX export", async () => {
    const { store, options } = reportingFixture();
    store.saveRun({ id: "run_report", tenantId: "tenant_report", captureIds: ["capture_public"], status: "completed", createdAt: generatedAt, updatedAt: generatedAt } as any);
    const unauthenticated = await handleApiRequest(new Request("http://local/v1/exports/stix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ runId: "run_report", tenantId: "tenant_report" })
    }), options);
    expect(unauthenticated.status).not.toBe(200);

    const authenticated = await handleApiRequest(new Request("http://local/v1/exports/stix", {
      method: "POST",
      headers: { ...serviceHeaders, "content-type": "application/json", "x-tenant-id": "tenant_report" },
      body: JSON.stringify({ runId: "run_report", tenantId: "tenant_report", generatedAt })
    }), options);
    expect(authenticated.status).toBe(200);
    const payload = await authenticated.json() as any;
    expect(payload.standardsValidation).toEqual({ standard: "STIX 2.1", valid: true, issues: [] });
    expectCustomerSafe(payload);
  });
});

const unsafeCustomerText = [
  "examplehiddenservice.onion/path",
  "examplehiddenservice.i2p/path",
  "https://t.me/source_contact",
  "https://telegram.dog/source_contact",
  "analyst@source.example",
  "@operator_handle",
  "+47 912 34 567",
  "1:BOTTOKENSECRETABCDEFGHIJKLMNOP",
  "12345678:BOTTOKENSECRETABCDEFGHIJKLMNOP",
  "12345678901:BOTTOKENSECRETABCDEFGHIJKLMNOP",
  "12345678901234567890123456789012:BOTTOKENSECRETABCDEFGHIJKLMNOP",
  "1234567890123456789012345678901234567890:BOTTOKENSECRETABCDEFGHIJKLMNOP",
  "api_key=APIKEYSECRET123",
  "key=KEYSECRET123456",
  "access_token=ACCESSSECRET123",
  "refresh_token=REFRESHSECRET123",
  "client_secret=CLIENTSECRET123",
  "private_key=PRIVATEKEYSECRET123",
  "password=PASSWORDSECRET123",
  "passwd=PASSWDSECRET123",
  "session_string=SESSIONSECRET123",
  "token=TOKENVALUESECRET123",
  "secret=SECRETVALUEMARKER123",
  "authorization=AUTHSECRET123",
  "cookie=COOKIESECRET123",
  "Bearer BEARERSECRET123",
  "Basic BASICSECRET123",
  "sk_CREDENTIALSECRET123456789"
].join(" ");

const forbiddenCustomerFragments = [
  ".onion",
  ".i2p",
  "t.me/",
  "telegram.dog",
  "analyst@",
  "@operator_handle",
  "912 34 567",
  "BOTTOKENSECRET",
  "APIKEYSECRET",
  "KEYSECRET",
  "ACCESSSECRET",
  "REFRESHSECRET",
  "CLIENTSECRET",
  "PRIVATEKEYSECRET",
  "PASSWORDSECRET",
  "PASSWDSECRET",
  "SESSIONSECRET",
  "TOKENVALUESECRET",
  "SECRETVALUEMARKER",
  "AUTHSECRET",
  "COOKIESECRET",
  "BEARERSECRET",
  "BASICSECRET",
  "CREDENTIALSECRET"
];

function expectCustomerSafe(value: unknown) {
  const encoded = JSON.stringify(value);
  expect(containsUnsafeCustomerOutboundText(value)).toBe(false);
  for (const fragment of forbiddenCustomerFragments) expect(encoded).not.toContain(fragment);
}

async function report(options: any, format: "json" | "stix", evidenceIds: string[]) {
  const query = new URLSearchParams({ organizationId: "org_report", report: "true", format });
  for (const evidenceId of evidenceIds) query.append("evidenceId", evidenceId);
  return handleApiRequest(new Request(`http://local/v1/cases/case_report/export?${query}`, { headers: serviceHeaders }), options);
}

function reportingFixture() {
  const store = new InMemoryScraperStore();
  store.saveOrganization({ id: "org_report", tenantId: "tenant_report", name: "Acme reporting", status: "active", createdAt: generatedAt, updatedAt: generatedAt });
  store.saveOrganizationMember({ id: "member_report", organizationId: "org_report", email: "analyst@acme.example", role: "analyst", status: "active", createdAt: generatedAt, updatedAt: generatedAt });
  store.saveSource({
    id: "source_report",
    tenantId: "tenant_report",
    name: "Public advisory",
    type: "public_advisory",
    url: "https://source.example/advisory",
    accessMethod: "public_http",
    status: "active",
    risk: "low",
    trustScore: 0.9,
    legalNotes: "Public advisory only.",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    governance: { approvalRequired: false, approvalState: "approved", metadataOnly: false }
  } as any);
  store.saveCapture({
    id: "capture_public",
    tenantId: "tenant_report",
    sourceId: "source_report",
    url: "https://source.example/advisory",
    collectedAt: generatedAt,
    mediaType: "text/plain",
    storageKind: "inline_text",
    contentHash: "hash-public",
    sensitive: false,
    body: "PUBLIC BODY MUST NOT EXPORT",
    metadata: { title: `Public advisory ${unsafeCustomerText}` }
  } as any);
  store.saveCapture({
    id: "capture_sensitive",
    tenantId: "tenant_report",
    sourceId: "source_report",
    url: "metadata://darkweb/report-sensitive",
    collectedAt: generatedAt,
    mediaType: "application/json",
    storageKind: "metadata_only",
    contentHash: "hash-sensitive",
    sensitive: true,
    metadata: { title: "Sensitive evidence metadata" }
  } as any);
  store.saveDwmAlert({
    id: "alert_report",
    tenantId: "tenant_report",
    organizationId: "org_report",
    severity: "high",
    firstSeenAt: generatedAt,
    lastSeenAt: generatedAt,
    updatedAt: generatedAt,
    evidence: [
      {
        id: "evidence_public",
        sourceId: "source_report",
        sourceName: `Public advisory ${unsafeCustomerText}`,
        sourceFamily: unsafeCustomerText,
        observedAt: generatedAt,
        redactionState: "public_excerpt",
        excerpt: "Evidence at https://examplehiddenservice.onion/path?token=secret-token",
        contentHash: "hash-public",
        provenance: { captureId: "capture_public", sourceId: "source_report", contentHash: "hash-public", url: "https://examplehiddenservice.onion/path" }
      },
      {
        id: "evidence_sensitive",
        sourceId: "source_report",
        sourceName: "Restricted metadata",
        sourceFamily: "darkweb_metadata",
        observedAt: generatedAt,
        redactionState: "raw_sensitive",
        excerpt: "SECRET RAW EVIDENCE",
        contentHash: "hash-sensitive",
        provenance: { captureId: "capture_sensitive", sourceId: "source_report", contentHash: "hash-sensitive" }
      }
    ]
  });
  store.saveCase({
    id: "case_report",
    tenantId: "tenant_report",
    organizationId: "org_report",
    sourceType: "dwm_alert",
    sourceId: "alert_report",
    alertId: "alert_report",
    title: "Acme evidence-backed report",
    summary: "Selected source claims for authorized third-party handling.",
    priority: "high",
    status: "open",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    workflowEvents: []
  });
  return { store, options: { store, frontier: new FocusedFrontier(), serviceToken: "report-service" } };
}
