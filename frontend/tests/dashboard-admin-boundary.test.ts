import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'
import { proxy } from '../src/proxy'

const root = process.cwd()

test('internal pages are exposed by Hanasand organization access and gated the same way on requests', () => {
    const sidebar = readFileSync(path.join(root, 'src/components/dashboard/dashboardSidebar.tsx'), 'utf8')
    const proxy = readFileSync(path.join(root, 'src/proxy.ts'), 'utf8')
    const guestLinks = navigationLinks(getDashboardNavigation({ id: 'member' }))
    const userRoleLinks = navigationLinks(getDashboardNavigation({
        id: 'role-only-user',
    }))
    const organizationLinks = navigationLinks(getDashboardNavigation({
        id: 'member',
        canViewInternalPages: true, canReviewIntel: true, hasVMs: true,
    }))

    const internalPages = [
        ['/logs', 'Log Dashboard'],
        ['/logs/realtime', 'Realtime'],
        ['/traffic', 'Overview'],
        ['/ti/runs', 'Collection'],
        ['/system/ai', 'AI Metrics'],
        ['/vulnerabilities', 'Vulnerabilities'],
        ['/db', 'Database'],
        ['/db/backups', 'Backups'],
        ['/management/users', 'Users'],
        ['/management/audit', 'Audit Log'],
        ['/management/service-accounts', 'Service Accounts'],
        ['/content/articles', 'Articles'],
        ['/content/thoughts', 'Thoughts'],
    ] as const

    for (const [href, label] of internalPages) {
        assert.equal(guestLinks.some(link => link.href === href), false, `${label} should require organization access.`)
        assert.equal(userRoleLinks.some(link => link.href === href), false, `${label} should not be granted by account roles.`)
        assert.equal(organizationLinks.some(link => link.href === href), true, `${label} should be available to Hanasand owners and editors.`)
    }

    assert(sidebar.includes('access.canViewInternalPages === true'))
    assert(sidebar.includes('canViewHanasandInternalPages(organizations)'))
    assert(proxy.includes('if (!canViewOrganizationInternalPages)'))
    assert(!proxy.includes('roleMatchesStrictPath'), 'Protected page routes must not depend on account roles.')
    assert(proxy.includes('organizationProtectedPaths.find'), 'Protected page routes must be organization-scoped.')
})

test('internal page route accepts Hanasand editors and rejects user-role-only access', async() => {
    const originalFetch = globalThis.fetch
    const tokenById = new Map([['role-only-user', 'token-role-only'], ['hanasand-editor', 'token-org-editor']])
    globalThis.fetch = (async(input: RequestInfo | URL, init?: RequestInit) => {
        const target = new URL(String(input))
        if (target.pathname.includes('/auth/token/')) {
            const id = target.pathname.split('/').pop() || ''
            const token = tokenById.get(id)
            if (!token) return Response.json({}, { status: 401 })
            return Response.json({ token })
        }
        if (target.pathname.endsWith('/management/organizations')) {
            const allowed = new Headers(init?.headers).get('id') === 'hanasand-editor'
            return Response.json({ allowed, canEdit: allowed })
        }
        throw new Error(`Unexpected request ${target}`)
    }) as typeof fetch

    const makeRequest = (id: string, token: string) => new NextRequest('https://hanasand.com/logs/realtime', {
        headers: { cookie: `id=${id}; access_token=${token}; roles=%5B%7B%22id%22%3A%22system_admin%22%7D%5D` },
    })

    try {
        const roleOnlyResponse = await proxy(makeRequest('role-only-user', 'token-role-only'))
        assert.equal(roleOnlyResponse.status, 307)
        assert.equal(new URL(roleOnlyResponse.headers.get('location') || '').searchParams.get('notAllowed'), 'true')

        const editorResponse = await proxy(makeRequest('hanasand-editor', 'token-org-editor'))
        assert.equal(editorResponse.status, 200)
        assert.equal(editorResponse.headers.has('location'), false)
    } finally {
        globalThis.fetch = originalFetch
    }
})
