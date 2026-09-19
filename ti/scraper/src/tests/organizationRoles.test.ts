import { expect, test } from "bun:test";
import { handleApiRequest } from "../api/server.ts";
import { authorizeDwmWorkflowAccess } from "../api/dwmWorkflowRoutes.ts";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { FocusedFrontier } from "../frontier/frontier.ts";

test("organization Editors edit cases while Readers and legacy roles only view", async () => {
  const store = new InMemoryScraperStore();
  const organization = { id: "org_roles", tenantId: "org_roles", name: "Roles", status: "active", accountOrganization: true };
  store.saveOrganization(organization);
  const options = { store, frontier: new FocusedFrontier() };
  store.saveCase({ id: "case_roles", tenantId: organization.id, organizationId: organization.id, sourceType: "manual", sourceId: "manual", title: "Review", summary: "Original", priority: "high", status: "open", workflowEvents: [], createdAt: "2026-09-19T00:00:00Z", updatedAt: "2026-09-19T00:00:00Z" });
  for (const role of ["reader", "member", "viewer", "editor", "admin", "owner"]) {
    store.saveOrganizationMember({ id: `role_${role}`, organizationId: organization.id, userId: role, email: `${role}@example.test`, role, status: "active" });
    const headers = { "x-user-email": `${role}@example.test` };
    const request = new Request(`http://localhost/v1/cases/case_roles?organizationId=${organization.id}`, { headers });
    expect((await handleApiRequest(request, options)).status).toBe(200);
    const editable = ["owner", "admin", "editor"].includes(role);
    const access = authorizeDwmWorkflowAccess({ options, scope: { organizationId: organization.id, organization }, request, mode: "mutate" });
    expect(access.readOnly).toBe(!editable);
    expect(access.error?.status).toBe(editable ? undefined : 403);
    const updated = await handleApiRequest(new Request(request.url, { method: "PATCH", headers, body: JSON.stringify({ organizationId: organization.id, action: "note", note: `Updated by ${role}` }) }), options);
    expect(updated.status).toBe(editable ? 200 : 403);
  }
  expect(store.getCase("case_roles")?.workflowEvents).toHaveLength(3);
  const outsider = new Request(`http://localhost/v1/cases/case_roles?organizationId=${organization.id}`, { headers: { "x-user-email": "outsider@example.test" } });
  expect((await handleApiRequest(outsider, options)).status).toBe(403);
});
