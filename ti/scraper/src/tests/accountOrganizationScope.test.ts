import { expect, test } from "bun:test";
import { InMemoryScraperStore } from "../storage/memoryStore.ts";
import { PostgresScraperStore } from "../storage/postgresScraperStore.ts";
import { resolveOrganizationScope } from "../api/organizationRoutes.ts";
import { authorizeDwmWorkflowAccess } from "../api/dwmWorkflowRoutes.ts";

test("account organization scope loads current membership and rejects removal, inactivity and empty membership", async () => {
  let organization: any = { id: "org-one", name: "Example", slug: "example", status: "active", alert_visibility_policy: "members" };
  let members: any[] = [{ user_id: "user-one", role: "member", status: "active", user_active: true }];
  const sql: any = async (parts: TemplateStringsArray) => {
    const query = parts.join("?");
    if (query.includes("to_regclass")) return [{ organizations: "organizations" }];
    if (query.includes("FROM public.organizations")) return organization ? [organization] : [];
    if (query.includes("FROM public.organization_members")) return members;
    throw new Error("Unexpected query");
  };
  const store = new (PostgresScraperStore as any)(sql, []);
  InMemoryScraperStore.prototype.saveOrganizationMember.call(store, { id: "legacy-member", organizationId: "org-one", userId: "user-one", role: "owner", status: "active" });
  // The test seed writes through the parent store to avoid any persistence queue.
  const request = new Request("https://example.test/v1/dwm/product?organizationId=org-one", { headers: { id: "user-one", authorization: "Bearer session" } });
  const options: any = { store };
  const scope = () => resolveOrganizationScope({ request, url: new URL(request.url) }, options);
  const access = () => authorizeDwmWorkflowAccess({ options, scope: scope(), request, mode: "read" });
  await store.refreshAccountOrganization("org-one");
  expect(scope().error).toBeUndefined();
  expect(access().error).toBeUndefined();
  expect(store.getOrganizationMember("legacy-member").role).toBe("analyst");
  members[0].status = "removed";
  await store.refreshAccountOrganization("org-one");
  expect(access().error?.status).toBe(403);
  members[0].status = "active"; members[0].user_active = false;
  await store.refreshAccountOrganization("org-one");
  expect(access().error?.status).toBe(403);
  members = [];
  await store.refreshAccountOrganization("org-one");
  expect(access().error?.status).toBe(403);
  organization.status = "archived";
  await store.refreshAccountOrganization("org-one");
  expect(scope().error?.status).toBe(403);
});
