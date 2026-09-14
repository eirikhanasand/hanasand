import { describe, expect, test, mkdtempSync, rmSync, join, tmpdir } from './apiTestHarness.ts';
import { handleApiRequest } from '../api/server.ts';
import { FocusedFrontier } from '../frontier/frontier.ts';
import { FileBackedScraperStore } from '../storage/fileBackedScraperStore.ts';

describe('security detections use the case workflow', () => {
  test('requires service access, preserves scope, logs, assignment and decisions across retries and restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'security-cases-'));
    try {
      const snapshotPath = join(dir, 'store.json');
      const store = new FileBackedScraperStore({ snapshotPath });
      const at = '2026-09-14T12:00:00.000Z';
      const options = { store, frontier: new FocusedFrontier(), serviceToken: 'test-only-service-secret' } as any;
      (store as any).saveOrganization({ id: 'org-a', tenantId: 'org-a', name: 'Example team', status: 'active', createdAt: at, updatedAt: at });
      (store as any).saveOrganization({ id: 'org-b', tenantId: 'org-b', name: 'Other team', status: 'active', createdAt: at, updatedAt: at });
      (store as any).saveOrganizationMember({ id: 'member-a', organizationId: 'org-a', userId: 'analyst', email: 'analyst@example.com', role: 'admin', status: 'active', createdAt: at, updatedAt: at });
      const headers = { 'x-hanasand-service-token': options.serviceToken, 'x-actor-id': 'analyst' };
      const body = { organizationId: 'org-a', id: 'finding-1', ruleId: 'auth.brute_force_success.v1', severity: 'high', summary: 'Successful login after repeated failures', status: 'new', firstObserved: at, lastObserved: at, assigneeId: 'outside-org', events: [{ id: 'log-1', at, source: 'Example identity', message: 'authentication · login · failure' }] };
      const create = (patch = {}, h: Record<string, string> = headers) => handleApiRequest(new Request('http://localhost/v1/cases/security-detections', { method: 'POST', headers: h, body: JSON.stringify({ ...body, ...patch }) }), options);
      expect((await create({}, {})).status).toBe(401);
      expect((await create({}, { ...headers, 'x-organization-id': 'org-b' })).status).toBe(403);
      expect((await create({ events: [{ id: 'bad', at: 'invalid', message: 'bad' }] })).status).toBe(400);
      const response = await create();
      expect(response.status).toBe(201);
      const id = (await response.json() as any).case.id;
      expect(store.getCase(id)?.assignedOwner).toBeUndefined();
      const get = () => handleApiRequest(new Request(`http://localhost/v1/cases/${id}?organizationId=org-a`, { headers }), options);
      const detail = await (await get()).json() as any;
      expect(detail.timeline.some((event: any) => event.eventType === 'case.log' && event.detail.includes('authentication'))).toBe(true);
      expect((await handleApiRequest(new Request(`http://localhost/v1/cases/${id}?organizationId=org-b`, { headers }), options)).status).toBe(404);
      const change = (action: string, note: string) => handleApiRequest(new Request(`http://localhost/v1/cases/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ organizationId: 'org-a', action, note, actor: 'analyst' }) }), options);
      expect((await change('start_progress', 'Investigating the login sequence.')).status).toBe(200);
      expect((await change('close', 'Confirmed the source and reset the affected credentials.')).status).toBe(200);
      const count = store.getCase(id)?.workflowEvents.length;
      expect((await create()).status).toBe(200);
      expect(store.listCases()).toHaveLength(1);
      expect(store.getCase(id)?.status).toBe('closed');
      expect(store.getCase(id)?.workflowEvents).toHaveLength(count);
      const migrated = await create({ id: 'finding-2', status: 'resolved', analystNote: 'Previously investigated.', assigneeId: 'analyst' });
      const migratedId = (await migrated.json() as any).case.id;
      expect(store.getCase(migratedId)).toMatchObject({ status: 'closed', assignedOwner: 'analyst' });
      const restored = new FileBackedScraperStore({ snapshotPath });
      expect(restored.getCase(id)?.status).toBe('closed');
      expect(restored.getCase(id)?.workflowEvents.some((event: any) => event.action === 'log')).toBe(true);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
