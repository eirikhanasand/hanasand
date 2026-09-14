import { afterEach, expect, mock, test } from 'bun:test'
import { NextRequest } from 'next/server'
import { readWorkspace, cleanWorkspaceUrl, workspaceShareUrl, WORKSPACE_COOKIE } from '../src/utils/organizations/workspace'
let cookieValues: Record<string, string> = { id: 'user-one' }
mock.module('next/headers', () => ({ cookies: async () => ({ get: (key: string) => cookieValues[key] ? { value: cookieValues[key] } : undefined }) }))
mock.module('../src/utils/proxy/requireApiSession', () => ({ default: async () => ({ identity: { id: 'user-one', token: 'fixture-token' } }) }))
mock.module('../src/utils/auth/authApiUrl', () => ({ authApiUrl: () => 'https://auth.example.test' }))
const { POST, GET } = await import('../src/app/api/workspace-organization/route')
const realFetch = globalThis.fetch
const request = (org: string, origin = 'https://hanasand.com') => new NextRequest('https://hanasand.com/api/workspace-organization', { method: 'POST', headers: { origin, host: 'hanasand.com', 'content-type': 'application/json' }, body: JSON.stringify({ org }) })
afterEach(() => { globalThis.fetch = realFetch; cookieValues = { id: 'user-one' } })
test('shared URLs use org, retain the selected record and filters, and normal URLs are clean', () => {
    const original = 'https://hanasand.com/cases/case-one?organizationId=org-one&tenantId=org-one&alertId=event-one#evidence'
    expect(cleanWorkspaceUrl(original)).toBe('/cases/case-one?alertId=event-one#evidence')
    expect(workspaceShareUrl(original)).toBe('https://hanasand.com/cases/case-one?alertId=event-one&org=org-one#evidence')
    expect(workspaceShareUrl('/mill/rules', 'org-two')).toBe('https://hanasand.com/mill/rules?org=org-two')
})
test('workspace cookies are bound to the signed-in identity', () => {
    const value = JSON.stringify({ userId: 'user-one', organizationId: 'org-one', name: 'One' })
    expect(readWorkspace(value, 'user-one')?.organizationId).toBe('org-one')
    expect(readWorkspace(value, 'user-two')).toBeNull()
    expect(readWorkspace('invalid', 'user-one')).toBeNull()
})
test('validates membership and stores a single secure HttpOnly cookie', async () => {
    globalThis.fetch = mock(async () => Response.json({ organization: { id: 'org-one', name: 'One', status: 'active' } })) as unknown as typeof fetch
    const response = await POST(request('org-one'))
    expect(response.status).toBe(200)
    const saved = response.cookies.get(WORKSPACE_COOKIE)!
    expect(JSON.parse(saved.value)).toMatchObject({ userId: 'user-one', organizationId: 'org-one', name: 'One' })
    expect(saved.httpOnly).toBe(true); expect(saved.secure).toBe(true); expect(saved.sameSite).toBe('lax')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
})
test('denied, inactive and unavailable organizations never replace the workspace cookie', async () => {
    for (const status of [403, 404, 503]) {
        globalThis.fetch = mock(async () => Response.json({}, { status })) as unknown as typeof fetch
        const response = await POST(request('foreign-org'))
        expect(response.status).toBe(status)
        expect(response.cookies.get(WORKSPACE_COOKIE)).toBeUndefined()
    }
    globalThis.fetch = mock(async () => Response.json({ organization: { id: 'org-one', name: 'One', status: 'suspended' } })) as unknown as typeof fetch
    expect((await POST(request('org-one'))).status).toBe(403)
})
test('rejects cross-site switching and supports returning to personal workspace', async () => {
    expect((await POST(request('org-one', 'https://other.example'))).status).toBe(403)
    const response = await POST(request(''))
    expect((await response.json()).workspace.organizationId).toBe('')
})
test('reading workspace state does not write a competing cookie', async () => {
    cookieValues[WORKSPACE_COOKIE] = JSON.stringify({ userId: 'user-one', organizationId: 'org-one', name: 'One' })
    const response = await GET(new NextRequest('https://hanasand.com/api/workspace-organization'))
    expect((await response.json()).workspace.organizationId).toBe('org-one')
    expect(response.cookies.get(WORKSPACE_COOKIE)).toBeUndefined()
})
