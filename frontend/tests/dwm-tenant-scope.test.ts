import { strict as assert } from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'node:test'
import { dwmOrganizationMutationDenial, dwmStorageScope, resolveDwmRequestScope, withDwmRequestScope } from '../src/app/api/dwm/_tiProxy'

describe('DWM tenant scope', () => {
    test('derives a personal tenant from the authenticated identity', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams('tenantId=another-tenant'),
            headers: new Headers({ 'x-tenant-id': 'another-tenant' }),
            body: { tenantId: 'another-tenant' },
        })

        assert.deepEqual(scope, { tenantId: 'user-123' })
    })

    test('uses one consistent organization scope for membership verification', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams('organizationId=org-456'),
            headers: new Headers({ 'x-organization-id': 'org-456' }),
            body: { organizationId: 'org-456', orgId: 'org-456' },
        })

        assert.deepEqual(scope, { tenantId: 'org-456', organizationId: 'org-456' })
        assert.deepEqual(dwmStorageScope(scope), { tenantId: 'org-456' })
    })

    test('rejects conflicting organization scopes', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams('organizationId=org-456'),
            headers: new Headers(),
            body: { orgId: 'org-789' },
        })

        assert.deepEqual(scope, {
            tenantId: 'user-123',
            error: 'Organization scope is inconsistent across the request.',
        })
    })

    test('verifies and rewrites scope inside evidence-ingest items', () => {
        const scope = resolveDwmRequestScope({
            identityId: 'user-123',
            params: new URLSearchParams(),
            headers: new Headers(),
            body: { items: [{ tenantId: 'another-tenant', organizationId: 'org-456' }] },
        })

        assert.deepEqual(scope, { tenantId: 'org-456', organizationId: 'org-456' })
        assert.deepEqual(withDwmRequestScope({ items: [{ tenantId: 'another-tenant', organizationId: 'org-456', actor: 'Actor' }] }, dwmStorageScope(scope)), {
            tenantId: 'org-456',
            items: [{ tenantId: 'org-456', actor: 'Actor' }],
        })
    })

    test('keeps organization mutations active and role scoped', () => {
        assert.equal(dwmOrganizationMutationDenial({ lifecycleStatus: 'active', role: 'admin' }), null)
        assert.equal(dwmOrganizationMutationDenial({ lifecycleStatus: 'active', role: 'member' }), null)
        assert.deepEqual(dwmOrganizationMutationDenial({ lifecycleStatus: 'active', role: 'viewer' }), {
            status: 403,
            error: { code: 'organization_access_denied', message: 'Your organization role cannot change DWM data.' },
        })
        assert.equal(dwmOrganizationMutationDenial({ lifecycleStatus: 'archived', role: 'owner' })?.status, 409)
    })

    test('keeps the legacy URL as a redirect without retaining sample pages', () => {
        const config = readFileSync(new URL('../next.config.js', import.meta.url), 'utf8')

        assert.match(config, /source: '\/solutions\/dwm',[\s\S]*destination: '\/dwm'/)
        assert.equal(existsSync(new URL('../src/app/solutions/dwm/page.tsx', import.meta.url)), false)
        assert.equal(existsSync(new URL('../src/app/solutions/dwm/pageClient.tsx', import.meta.url)), false)
        assert.equal(existsSync(new URL('../src/app/dwm/pageClient.tsx', import.meta.url)), false)
    })

    test('renders only persisted DWM workflow history', () => {
        const portal = readFileSync(new URL('../src/app/dashboard/dwm/dwm-analyst-portal.tsx', import.meta.url), 'utf8')
        const actions = readFileSync(new URL('../src/app/dashboard/dwm/dwm-workflow-actions.tsx', import.meta.url), 'utf8')
        const readinessRoute = readFileSync(new URL('../src/app/api/dwm/alerts/generation-readiness/route.ts', import.meta.url), 'utf8')
        const exposureQueueRoute = readFileSync(new URL('../src/app/api/dwm/exposure-queue/route.ts', import.meta.url), 'utf8')
        const deliveryRoute = readFileSync(new URL('../src/app/api/dwm/webhooks/deliver/route.ts', import.meta.url), 'utf8')
        const deliveryTestRoute = readFileSync(new URL('../src/app/api/dwm/webhooks/test/route.ts', import.meta.url), 'utf8')

        assert.doesNotMatch(portal, /hanasand:dwm-case-state/)
        assert.doesNotMatch(portal, /new Date\(\)\.toISOString\(\)/)
        assert.doesNotMatch(portal, /title: 'Evidence decision'/)
        assert.match(portal, /const events = alert\.workflowEvents \?\? \[\]/)
        assert.match(portal, /setLocalDeliveries\(deliveries\)/)
        assert.match(portal, /key=\{`\$\{tenantId\}:\$\{snapshot\.watchlist/)
        assert.doesNotMatch(actions, /publishedAt: new Date\(\)\.toISOString\(\)/)
        assert.doesNotMatch(actions, /at: new Date\(\)\.toISOString\(\)/)
        assert.doesNotMatch(readinessRoute, /productProgress|ProofLedger|tenantId.*default/)
        assert.doesNotMatch(exposureQueueRoute, /generatedAt: new Date|status: 'checking'/)
        assert.doesNotMatch(deliveryRoute, /clean\(body\.tenantId\)/)
        assert.match(deliveryRoute, /dryRun: body\.dryRun === true/)
        assert.match(deliveryTestRoute, /dryRun: true, live: false/)
        assert.match(portal, /setRefreshVersion\(version => version \+ 1\)/)
        assert.match(portal, /pendingInitialAlertId/)
        assert.match(actions, /onChanged\?\.\(\)/)
    })
})
