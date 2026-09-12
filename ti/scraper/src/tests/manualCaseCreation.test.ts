import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from './apiTestHarness.ts';
import { handleApiRequest } from '../api/server.ts';
import { FocusedFrontier } from '../frontier/frontier.ts';
import { FileBackedScraperStore } from '../storage/fileBackedScraperStore.ts';

describe('manual case creation', () => {
  test('creates, audits, retries, scopes and persists a case without an alert', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'manual-case-'));
    try {
      const snapshotPath = join(dir, 'store.json');
      const store = new FileBackedScraperStore({ snapshotPath });
      const options = { store, frontier: new FocusedFrontier() } as any;
      const body = { sourceType: 'manual', title: 'Investigate service outage', summary: 'Review the failing dependency.', priority: 'high', tenantId: 'owner', actor: 'owner', idempotencyKey: crypto.randomUUID() };
      const create = (patch = {}) => handleApiRequest(new Request('http://127.0.0.1/v1/cases', { method: 'POST', body: JSON.stringify({ ...body, ...patch }) }), options);
      expect((await create({ title: '  ' })).status).toBe(400);
      expect((await create({ priority: 'invalid' })).status).toBe(400);
      expect((await create({ alertId: 'unrelated' })).status).toBe(400);
      const response = await create();
      expect(response.status).toBe(201);
      const item = (await response.json() as any).case;
      expect(item.sourceType).toBe('manual');
      expect(item.status).toBe('open');
      expect(item.workflowEvents[0]).toMatchObject({ actor: 'owner', action: 'open', note: body.summary });
      expect((await create()).status).toBe(200);
      expect((await create({ title: 'Different case' })).status).toBe(409);
      expect(store.listCases()).toHaveLength(1);
      (store as any).listDwmWebhookDeliveries = () => [{ id: 'unrelated-delivery', tenantId: 'another-tenant', status: 'delivered' }];
      const get = await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${item.id}?tenantId=owner`), options);
      expect(get.status).toBe(200);
      const detail = await get.json() as any;
      expect(detail.case.id).toBe(item.id);
      expect(JSON.stringify(detail)).not.toContain('unrelated-delivery');
      expect((await handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${item.id}?tenantId=other`), options)).status).toBe(404);
      const listing = await handleApiRequest(new Request('http://127.0.0.1/v1/cases?tenantId=owner'), options);
      expect((await listing.json() as any).items[0].source).toBe('manual');
      const change = (action: string, note?: string) => handleApiRequest(new Request(`http://127.0.0.1/v1/cases/${item.id}`, { method: 'PATCH', body: JSON.stringify({ tenantId: 'owner', actor: 'owner', action, note }) }), options);
      expect((await change('start_progress', 'Investigating')).status).toBe(200);
      expect((await change('close')).status).toBe(400);
      expect((await change('close', 'Verified the dependency is restored.')).status).toBe(200);
      const orgResponse = await handleApiRequest(new Request('http://127.0.0.1/v1/organizations', { method: 'POST', body: JSON.stringify({ name: 'Case team', ownerEmail: 'admin@example.com' }) }), options);
      const org = (await orgResponse.json() as any).organization.id;
      (store as any).saveOrganizationMember({ id: 'viewer', organizationId: org, email: 'viewer@example.com', userId: 'viewer', role: 'viewer', status: 'active', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      expect((await create({ tenantId: org, organizationId: org, actor: 'viewer@example.com' })).status).toBe(403);
      const orgCase = await create({ tenantId: org, organizationId: org, actor: 'admin@example.com' });
      expect(orgCase.status).toBe(201);
      expect((await orgCase.json() as any).case.id === item.id).toBe(false);
      const restored = new FileBackedScraperStore({ snapshotPath });
      expect(restored.getCase(item.id)?.title).toBe(body.title);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
