import { expect, test } from 'bun:test'
import { receiveSecurityCase } from '../api/securityCases.ts'
import { InMemoryScraperStore } from '../storage/memoryStore.ts'

test('security case migration never assigns a user from another organization', async () => {
    const store = new InMemoryScraperStore()
    const at = '2026-09-14T12:00:00Z'
    store.saveOrganization({ id: 'org-a', tenantId: 'org-a', status: 'active', name: 'Example team', createdAt: at, updatedAt: at })
    store.saveOrganizationMember({ id: 'outside', userId: 'outside', organizationId: 'org-b', role: 'admin', status: 'active', createdAt: at, updatedAt: at })
    const response = await receiveSecurityCase(new Request('http://localhost/v1/cases/security-detections', {
        method: 'POST', headers: { 'x-hanasand-service-token': 'test-token' },
        body: JSON.stringify({ id: 'finding-a', organizationId: 'org-a', ruleId: 'auth.new_device.v1', summary: 'New device login', severity: 'medium', status: 'investigating', firstObserved: at, lastObserved: at, assigneeId: 'outside', events: [] }),
    }), { store, serviceToken: 'test-token' } as any)
    expect(response.status).toBe(201)
    const id = (await response.json() as any).case.id
    expect(store.getCase(id)?.assignedOwner).toBeUndefined()
    expect(store.getCase(id)?.workflowEvents.some((event: any) => event.toOwner === 'outside')).toBe(false)
})
