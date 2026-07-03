import { strict as assert } from 'node:assert'
import test from 'node:test'
import { buildDwmWatchlistMirrorPayload } from '@/app/api/organizations/_organizationWatchlistDwmBridge'

test('builds DWM mirror payloads for org watchlist mutations', () => {
    const mirror = buildDwmWatchlistMirrorPayload({
        organizationId: 'org_acme',
        watchlistItem: {
            id: 'watch_item_acme_domain',
            kind: 'domain',
            value: 'acme.com',
            status: 'active',
        },
    })

    assert.deepEqual(mirror, {
        id: 'org_watch_item_acme_domain',
        tenantId: 'org_acme',
        organizationId: 'org_acme',
        name: 'Org watchlist - acme.com',
        status: 'active',
        terms: [{ id: 'watch_item_acme_domain', value: 'acme.com', kind: 'domain' }],
        reason: 'organization_watchlist_saved',
    })

    assert.equal(buildDwmWatchlistMirrorPayload({ organizationId: 'org_acme', watchlistItem: { id: 'watch_item_empty', value: '' } }), null)

    const paused = buildDwmWatchlistMirrorPayload({
        organizationId: 'org_acme',
        watchlistItem: {
            id: 'watch_item_paused',
            kind: 'vendor',
            value: 'Okta',
            status: 'paused',
        },
    })

    assert.equal(paused?.status, 'paused')
    assert.deepEqual(paused?.terms, [{ id: 'watch_item_paused', value: 'Okta', kind: 'vendor' }])
})
