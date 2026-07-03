import { strict as assert } from 'node:assert'
import test from 'node:test'
import {
    buildDwmWatchlistMirrorPayload,
    buildDwmWatchlistMirrorPayloads,
} from '@/app/api/organizations/_organizationWatchlistDwmBridge'

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
    assert.equal(paused?.reason, 'organization_watchlist_lifecycle_updated')
    assert.deepEqual(paused?.terms, [{ id: 'watch_item_paused', value: 'Okta', kind: 'vendor' }])
})

test('builds lifecycle DWM mirror payloads for archived org watchlist cleanup', () => {
    const mirrors = buildDwmWatchlistMirrorPayloads({
        organizationId: 'org_acme',
        organizationPayload: {
            archivedItems: [
                {
                    id: 'watch_item_old_domain',
                    kind: 'domain',
                    value: 'old.acme.com',
                    status: 'archived',
                },
                {
                    id: 'watch_item_retired_vendor',
                    kind: 'vendor',
                    value: 'RetiredVendor',
                    status: 'archived',
                },
            ],
        },
    })

    assert.deepEqual(mirrors.map(item => ({
        id: item.id,
        status: item.status,
        reason: item.reason,
        term: item.terms[0],
    })), [
        {
            id: 'org_watch_item_old_domain',
            status: 'archived',
            reason: 'organization_watchlist_lifecycle_updated',
            term: { id: 'watch_item_old_domain', value: 'old.acme.com', kind: 'domain' },
        },
        {
            id: 'org_watch_item_retired_vendor',
            status: 'archived',
            reason: 'organization_watchlist_lifecycle_updated',
            term: { id: 'watch_item_retired_vendor', value: 'RetiredVendor', kind: 'vendor' },
        },
    ])
})
