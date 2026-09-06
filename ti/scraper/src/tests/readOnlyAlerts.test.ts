import { test, expect } from 'bun:test';
import { listDwmAlerts } from '../api/dwmWorkflowRoutes.ts';
import type { ApiServerOptions } from '../api/serverTypes.ts';
test('read-only alert viewing never starts projection repair', async () => {
  const options = { readOnly: true, store: {
    listDwmAlerts: () => [], listOrganizations: () => [], listSources: () => [], listCaptures: () => [],
    saveDwmAlert: () => { throw new Error('Writes must never run'); },
    queryExposureQueuePage: () => { throw new Error('Projection repair must never run'); }
  } } as unknown as ApiServerOptions;
  const request = new Request('http://localhost/v1/dwm/alerts?tenantId=probe', { headers: { 'x-user-id': 'probe' } });
  const response = await listDwmAlerts(new URL(request.url), options, request);
  expect(response.status).toBe(200);
  expect((await response.json()).alerts).toEqual([]);
});
