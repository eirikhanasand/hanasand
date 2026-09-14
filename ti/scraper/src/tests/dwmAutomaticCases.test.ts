import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FileBackedScraperStore } from "../storage/fileBackedScraperStore.ts";

const at = "2026-09-14T12:00:00.000Z";
const organization = { id: "org_monitor", tenantId: "org_monitor", name: "Monitor", status: "active", createdAt: at, updatedAt: at };
const finding = (patch: any = {}) => ({
  id: "event_one", tenantId: organization.id, organizationId: organization.id,
  eventType: "darkweb.monitoring.match", severity: "high", company: "Example", claimSummary: "A watched domain appeared in a source.",
  matchedTerm: { value: "example.com", kind: "domain" }, savedAt: at, updatedAt: at,
  provenance: { captureIds: ["capture_one"], sourceIds: ["source_one"], contentHashes: ["hash_one"] },
  ...patch,
});
class HydrationStore extends InMemoryScraperStore {
  loadOld(event: any, caseRecord?: any) {
    this.hydrateWithoutOrganizationWriteGuard(() => {
      this.saveDwmAlert(event);
      if (caseRecord) this.saveCase(caseRecord);
    });
  }
}
function setup<T extends InMemoryScraperStore>(store: T = new InMemoryScraperStore() as T) { store.saveOrganization(organization); return store; }

describe("monitoring events create normal cases", () => {
  test("creates and links one case when a finding with source evidence is saved", () => {
    const store = setup();
    const saved = store.saveDwmAlert(finding());
    expect(store.listCases()).toHaveLength(1);
    expect(store.getCase(saved.caseId)).toMatchObject({ organizationId: organization.id, alertId: saved.id, status: "open", priority: "high", title: "Example" });
    expect(saved.workflowContext.caseId).toBe(saved.caseId);
    expect(saved.casePath).toContain(saved.caseId);
    store.saveDwmAlert(finding());
    expect(store.listCases()).toHaveLength(1);
  });
  test("does not turn incomplete evidence or an invalid organization into a case", () => {
    const store = setup();
    for (const provenance of [{}, { captureIds: ["capture"] }, { captureIds: ["capture"], sourceIds: ["source"] }]) store.saveDwmAlert(finding({ provenance }));
    store.saveDwmAlert(finding({ tenantId: "foreign_tenant" }));
    store.saveDwmAlert(finding({ organizationId: "missing_org" }));
    store.saveDwmAlert(finding({ workflowContext: { organizationId: "other_org" } }));
    expect(store.listCases()).toHaveLength(0);
    store.saveOrganization({ ...organization, status: "archived" });
    store.saveDwmAlert(finding());
    expect(store.listCases()).toHaveLength(0);
  });
  test("replays never reopen cases or overwrite assignment, comments, or resolution", () => {
    const store = setup();
    const event = store.saveDwmAlert(finding());
    const decided = { ...store.getCase(event.caseId), status: "closed", assignedOwner: "analyst", resolution: { note: "Resolved" }, workflowEvents: [{ id: "comment", note: "Keep this decision" }] };
    store.saveCase(decided);
    store.saveDwmAlert(finding({ workflowStatus: "new", severity: "critical", updatedAt: "2026-09-15T12:00:00.000Z" }));
    expect(store.getCase(event.caseId)).toEqual(decided);
    expect(store.listCases()).toHaveLength(1);
  });
  test("same evidence in two organizations creates separate cases", () => {
    const store = setup();
    store.saveOrganization({ ...organization, id: "org_two", tenantId: "org_two" });
    const first = store.saveDwmAlert(finding());
    const second = store.saveDwmAlert(finding({ id: "event_two", tenantId: "org_two", organizationId: "org_two" }));
    expect(first.caseId).not.toBe(second.caseId);
    expect(store.listCases()).toHaveLength(2);
    store.saveDwmAlert(finding({ id: "event_three", caseIdCandidate: second.caseId }));
    expect(store.listCases()).toHaveLength(2);
  });
  test("backfills only after hydration and preserves already closed legacy cases", () => {
    const store = setup(new HydrationStore());
    const closed = { id: "legacy_case", tenantId: organization.id, organizationId: organization.id, alertId: "event_one", status: "closed", title: "Original title" };
    store.loadOld(finding({ caseIdCandidate: closed.id }), closed);
    store.loadOld(finding({ id: "event_two" }));
    expect(store.listCases()).toEqual([closed]);
    store.backfillDwmCases();
    expect(store.getCase(closed.id)).toEqual(closed);
    expect(store.listCases()).toHaveLength(2);
    store.backfillDwmCases();
    expect(store.listCases()).toHaveLength(2);
  });
  test("preserves the disposition of historical matches during backfill", () => {
    const store = setup(new HydrationStore());
    store.loadOld(finding({ workflowStatus: "false_positive", workflowNote: "Not our domain" }));
    store.backfillDwmCases();
    expect(store.listCases()[0]).toMatchObject({ status: "false_positive", lastDecision: "Not our domain" });
  });
  test("case and source link survive a restart without duplicate creation", () => {
    const folder = mkdtempSync(join(tmpdir(), "dwm-cases-"));
    try {
      const options = { snapshotPath: join(folder, "store.json") };
      const first = setup(new FileBackedScraperStore(options));
      const event = first.saveDwmAlert(finding());
      first.saveCase({ ...first.getCase(event.caseId), status: "false_positive" });
      const second = new FileBackedScraperStore(options);
      expect(second.listCases()).toHaveLength(1);
      expect(second.getCase(event.caseId).status).toBe("false_positive");
      expect(second.getDwmAlert(event.id).caseId).toBe(event.caseId);
    } finally { rmSync(folder, { recursive: true, force: true }); }
  });
});
