import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isHanasandOrganizationMember } from '../src/utils/organizations/hanasandMembership'

test('code access requires active membership in the Hanasand organization', async() => {
    const originalFetch = globalThis.fetch
    const requests: { url: string, headers: Headers }[] = []
    try {
        globalThis.fetch = (async(url: unknown, options?: RequestInit) => {
            requests.push({ url: String(url), headers: new Headers(options?.headers) })
            return Response.json({ organizations: [{ id: 'hanasand-id', slug: 'hanasand', name: 'Hanasand', lifecycleStatus: 'active' }] })
        }) as typeof fetch
        assert.equal(await isHanasandOrganizationMember('member-token', 'member-id'), true)
        assert.ok(requests[0].url.endsWith('/organizations'))
        assert.equal(requests[0].headers.get('Authorization'), 'Bearer member-token')
        assert.equal(requests[0].headers.get('id'), 'member-id')

        for (const organization of [
            { id: 'other', slug: 'other', name: 'Hanasand', lifecycleStatus: 'active' },
            { id: 'hanasand-id', slug: 'hanasand', name: 'Hanasand', lifecycleStatus: 'inactive' },
        ]) {
            globalThis.fetch = (async() => Response.json({ organizations: [organization] })) as typeof fetch
            assert.equal(await isHanasandOrganizationMember('member-token', 'member-id'), false)
        }
        globalThis.fetch = (async() => Response.json({ organizations: [] })) as typeof fetch
        assert.equal(await isHanasandOrganizationMember('member-token', 'member-id'), false)
        globalThis.fetch = (async() => Response.json({}, { status: 403 })) as typeof fetch
        assert.equal(await isHanasandOrganizationMember('member-token', 'member-id'), false)
        globalThis.fetch = (async() => Response.json({}, { status: 503 })) as typeof fetch
        await assert.rejects(isHanasandOrganizationMember('member-token', 'member-id'), /membership could not be checked/)
        globalThis.fetch = (async() => Response.json({ organizations: null })) as typeof fetch
        await assert.rejects(isHanasandOrganizationMember('member-token', 'member-id'), /response was invalid/)
    } finally { globalThis.fetch = originalFetch }
})
