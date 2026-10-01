import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
let internalMembershipChecks = 0
let internalMembers = new Set<string>()
let sharedOrganizationViewers = new Set(['admin', 'member'])
let impersonating = false
async function run(sql: string, values: unknown[] = []) {
    expect(sql).toContain('CASE WHEN')
    if (sql.includes('FROM users profile_user')) {
        expect(sql).toContain('organization_members viewer_membership')
        expect(sql).toContain('shared_organization.status = \'active\'')
        expect(sql).toContain('viewer_membership.status = \'active\'')
        expect(sql).toContain('profile_membership.status = \'active\'')
        const [targetId, canViewEmail, viewerId] = values
        if (targetId !== 'member' || (viewerId !== targetId && !sharedOrganizationViewers.has(String(viewerId)))) return { rows: [] }
        return { rows: [{ id: 'member', username: 'member', name: 'Member', email: canViewEmail === true ? 'support@example.com' : null }] }
    }
    const canViewEmail = values[0] === true
    return { rows: [{ id: 'member', username: 'member', name: 'Member', email: canViewEmail ? 'support@example.com' : null }] }
}
mock.module('../src/utils/db.ts', () => ({ default: run }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: FastifyRequest) => ({ valid: req.headers.authorization === 'Bearer valid', id: req.headers.id, impersonating }) }))
mock.module('../src/utils/auth/organizationPageAccess.ts', () => ({ default: async (req: FastifyRequest) => { internalMembershipChecks++; return { valid: internalMembers.has(String(req.headers.id || '')) } } }))
const { default: getUser } = await import('../src/handlers/user/get.ts')
const { default: getUsers } = await import('../src/handlers/user/getUsers.ts')
beforeEach(() => { internalMembershipChecks = 0; internalMembers = new Set(['admin']); sharedOrganizationViewers = new Set(['admin', 'member']); impersonating = false })
async function request(list: boolean, id?: string, token?: string) {
    const reply = { sent: false, code: 200, body: undefined as any, headers: {} as Record<string, string>, header(key: string, value: string) { this.headers[key] = value; return this }, status(code: number) { this.code = code; return this }, send(body: unknown) { this.body = body; this.sent = true; return this } }
    await (list ? getUsers : getUser)({ params: { id: 'member' }, headers: { id, authorization: token }, method: 'GET', url: list ? '/users' : '/user/member' } as unknown as FastifyRequest, reply as unknown as FastifyReply)
    return reply
}
for (const list of [false, true]) {
    test(`${list ? 'list' : 'profile'} exposes email only to Hanasand organization members`, async () => {
        const admin = await request(list, 'admin', 'Bearer valid')
        expect((list ? admin.body[0] : admin.body).email).toBe('support@example.com')
        expect(admin.headers['Cache-Control']).toBe('private, no-store')
        const regular = await request(list, 'member', 'Bearer valid')
        expect((list ? regular.body[0] : regular.body).email).toBeNull()
        impersonating = true
        const impersonated = await request(list, 'admin', 'Bearer valid')
        expect((list ? impersonated.body[0] : impersonated.body).email).toBeNull()
    })
}
test('profile lookups require an authenticated user in the same organization', async () => {
    const sameOrganization = await request(false, 'admin', 'Bearer valid')
    expect(sameOrganization.code).toBe(200)
    expect(sameOrganization.body.id).toBe('member')

    const self = await request(false, 'member', 'Bearer valid')
    expect(self.code).toBe(200)
    expect(self.body.id).toBe('member')

    const otherOrganization = await request(false, 'outside-org', 'Bearer valid')
    expect(otherOrganization.code).toBe(404)
    expect(otherOrganization.body.id).toBeUndefined()
})
test('anonymous and invalid sessions cannot read a profile', async () => {
    expect((await request(false)).code).toBe(401)
    expect((await request(false, 'admin')).code).toBe(401)
    expect((await request(false, 'admin', 'Bearer invalid')).code).toBe(401)
    expect(internalMembershipChecks).toBe(0)
    expect((await request(true)).code).toBe(401)
})
