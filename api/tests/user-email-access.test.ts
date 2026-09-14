import { beforeEach, expect, mock, test } from 'bun:test'
import type { FastifyReply, FastifyRequest } from 'fastify'
let roleChecks = 0
let impersonating = false
async function run(sql: string, values: unknown[] = []) {
    if (sql.includes('AS has_role')) { roleChecks++; expect(values[1]).toBe('user_admin'); return { rows: [{ has_role: values[0] === 'admin' }] } }
    expect(sql).toContain('CASE WHEN')
    const allowed = values.at(-1) === true
    return { rows: [{ id: 'member', username: 'member', name: 'Member', email: allowed ? 'support@example.com' : null }] }
}
mock.module('../src/utils/db.ts', () => ({ default: run }))
mock.module('../src/utils/auth/tokenWrapper.ts', () => ({ default: async (req: FastifyRequest) => ({ valid: req.headers.authorization === 'Bearer valid', id: req.headers.id, impersonating }) }))
const { default: getUser } = await import('../src/handlers/user/get.ts')
const { default: getUsers } = await import('../src/handlers/user/getUsers.ts')
beforeEach(() => { roleChecks = 0; impersonating = false })
async function request(list: boolean, id?: string, token?: string) {
    const reply = { sent: false, code: 200, body: undefined as any, headers: {} as Record<string, string>, header(key: string, value: string) { this.headers[key] = value; return this }, status(code: number) { this.code = code; return this }, send(body: unknown) { this.body = body; this.sent = true; return this } }
    await (list ? getUsers : getUser)({ params: { id: 'member' }, headers: { id, authorization: token }, method: 'GET', url: list ? '/users' : '/user/member' } as unknown as FastifyRequest, reply as unknown as FastifyReply)
    return reply
}
for (const list of [false, true]) {
    test(`${list ? 'list' : 'profile'} exposes email only to validated user administrators`, async () => {
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
test('anonymous and forged administrator headers cannot reveal a profile email', async () => {
    expect((await request(false)).body.email).toBeNull()
    expect((await request(false, 'admin')).body.email).toBeNull()
    expect((await request(false, 'admin', 'Bearer invalid')).body.email).toBeNull()
    expect(roleChecks).toBe(0)
    expect((await request(true)).code).toBe(401)
})
