import { beforeEach, expect, mock, test } from 'bun:test'
import Fastify from 'fastify'
import { normalizeInviteInput, normalizeMemberRoleInput, organizationAlertCaseRoleActions, organizationVisibilityDecision } from '../src/utils/organizations.ts'
import { roleCanEditOrganization, roleCanManageOrganization, type OrganizationRole } from '../src/utils/organizationRoles.ts'
import * as webhooks from '../src/utils/dwm/webhooks.ts'

let role: OrganizationRole = 'reader'
let active = true
let archived = false
const writes: string[] = []
const destination = { id: 'target', orgId: 'org', ownerId: 'owner', name: 'Delivery target', kind: 'webhook', status: 'active', endpointHint: 'example.com/…', endpointHash: 'hash', events: ['dwm.alert.created'] }
const query = async (sql: string, params: unknown[] = []) => {
    if (/^\s*(INSERT|UPDATE|DELETE)/.test(sql)) writes.push(sql)
    if (sql.includes('FROM dwm_webhook_destinations')) return { rows: [{ id: 'target', org_id: 'org' }] }
    if (sql.includes('FROM organizations o')) return { rows: params[0] === 'org' && active ? [{ id: 'org', name: 'Organization', slug: 'org', status: 'active', role, owner_count: 1 }] : [] }
    if (sql.includes('FROM organization_members member')) return { rows: active ? [{ role, organization_status: 'active' }] : [] }
    if (sql.includes('FROM organization_members')) return { rows: [{ user_id: 'teammate', role: 'reader', status: 'active' }] }
    return { rows: [] }
}
mock.module('#db', () => ({ default: query, withTransaction: async (work: (runQuery: typeof query) => unknown) => work(query), withDatabaseAdvisoryLock: async (_key: string, work: () => unknown) => work() }))
mock.module('#utils/auth/tokenWrapper.ts', () => ({ default: async () => ({ valid: true, id: 'actor' }) }))
mock.module('#utils/logs/recordLog.ts', () => ({ default: async () => {} }))
mock.module('#utils/systemEvent.ts', () => ({ recordSystemEvent: async () => {} }))
mock.module('#utils/dwm/webhooks.ts', () => ({
    ...webhooks,
    listDwmWebhookDestinations: async () => [destination],
    listDwmWebhookDeliveries: async () => [],
    listDwmWebhookAuditEvents: async () => [],
    archiveDwmWebhookDestination: async () => { archived = true; return { ...destination, status: 'archived' } },
}))
const org = await import('../src/handlers/organizations.ts')
const { deleteDwmWebhookDestination } = await import('../src/handlers/dwm/webhooks.ts')
const app = Fastify()
app.delete('/targets/:id', deleteDwmWebhookDestination)
app.put('/org/:id/settings', org.putOrganizationSettings)
app.post('/org/:id/invites', org.postOrganizationInvites)
app.post('/org/:id/api-keys', org.postOrganizationApiKey)
app.post('/org/:id/cleanup', org.postOrganizationWatchlistCleanup)
app.post('/org/:id/watchlists', org.postOrganizationWatchlist)
app.patch('/org/:id/members/:userId/role', org.patchOrganizationMemberRole)
app.delete('/org/:id/members/:userId', org.deleteOrganizationMember)

beforeEach(() => { role = 'reader'; active = true; archived = false; writes.length = 0 })

test('legacy roles and invitations become Reader without gaining permissions', () => {
    for (const legacy of ['member', 'viewer']) {
        expect(normalizeInviteInput({ email: 'person@example.com', role: legacy }).role).toBe('reader')
        expect(normalizeMemberRoleInput({ role: legacy, reason: 'Migrate existing access' }).role).toBe('reader')
        expect(roleCanEditOrganization(legacy)).toBe(false)
        expect(organizationAlertCaseRoleActions(legacy as OrganizationRole)).toEqual([])
    }
    expect(normalizeInviteInput({ email: 'person@example.com' }).role).toBe('reader')
    expect(normalizeInviteInput({ email: 'person@example.com', role: 'editor' }).role).toBe('editor')
})

test('Editors can edit content but cannot manage the organization; Readers can view', () => {
    expect(roleCanEditOrganization('editor')).toBe(true)
    expect(roleCanManageOrganization('editor')).toBe(false)
    expect(organizationAlertCaseRoleActions('editor')).toContain('assign_case')
    expect(organizationAlertCaseRoleActions('editor')).not.toContain('manage_invites')
    for (const viewerRole of ['editor', 'reader'] as const) {
        expect(organizationVisibilityDecision({ role: viewerRole, status: 'active', userActive: true }).allowed).toBe(true)
        expect(organizationVisibilityDecision({ role: viewerRole, status: 'removed', userActive: true }).allowed).toBe(false)
    }
    expect(organizationAlertCaseRoleActions('reader')).toEqual([])
    expect(roleCanEditOrganization('unexpected')).toBe(false)
})

test('Editor can remove a delivery target; Reader and legacy roles cannot', async () => {
    for (const viewerRole of ['reader', 'member', 'viewer'] as const) {
        role = viewerRole
        expect((await app.inject({ method: 'DELETE', url: '/targets/target' })).statusCode).toBe(403)
        expect(archived).toBe(false)
    }
    role = 'editor'
    const response = await app.inject({ method: 'DELETE', url: '/targets/target' })
    expect(response.statusCode).toBe(200)
    expect(archived).toBe(true)
    expect(response.json().destination.status).toBe('archived')
})

test('Reader cannot create watchlists, even with a direct request', async () => {
    expect((await app.inject({ method: 'POST', url: '/org/org/watchlists', payload: { kind: 'domain', value: 'example.com' } })).statusCode).toBe(403)
    expect(writes).toHaveLength(0)
})

test('Editor and Reader are denied administrative mutations without domain writes', async () => {
    for (const actorRole of ['reader', 'editor'] as const) {
        role = actorRole
        const requests = [
            { method: 'PUT', url: '/org/org/settings', payload: { name: 'Changed' } },
            { method: 'POST', url: '/org/org/invites', payload: { email: 'person@example.com', role: 'admin' } },
            { method: 'POST', url: '/org/org/api-keys', payload: { name: 'Key' } },
            { method: 'POST', url: '/org/org/cleanup', payload: { itemIds: ['watch'] } },
            { method: 'PATCH', url: '/org/org/members/teammate/role', payload: { role: 'admin', reason: 'Attempt privilege change' } },
            { method: 'DELETE', url: '/org/org/members/teammate' },
        ] as const
        for (const request of requests) expect((await app.inject(request)).statusCode).toBe(403)
        expect(writes).toHaveLength(0)
    }
})

test('removed Editors and cross-organization requests are denied', async () => {
    role = 'editor'; active = false
    expect((await app.inject({ method: 'DELETE', url: '/targets/target' })).statusCode).toBe(404)
    expect(archived).toBe(false)
    active = true
    expect((await app.inject({ method: 'POST', url: '/org/other/watchlists', payload: { kind: 'domain', value: 'example.com' } })).statusCode).toBe(404)
    expect(writes).toHaveLength(0)
})
