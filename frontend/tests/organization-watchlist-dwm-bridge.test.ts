import { strict as assert } from 'node:assert'
import test from 'node:test'
import {
    buildDwmWatchlistMirrorAlertPreview,
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

test('summarizes mirrored DWM alert detail for organization watchlist feedback', () => {
    const preview = buildDwmWatchlistMirrorAlertPreview({
        alert: {
            id: 'alert_org_acme',
            alertDetailPath: '/v1/dwm/alerts/alert_org_acme?organizationId=org_acme',
            sourceFamily: 'telegram_public',
            matchedTerm: { value: 'acme.com' },
            severity: 'high',
            recommendedRoute: 'identity_response',
            evidence: [{ excerpt: 'Telegram post references acme.com credentials.' }],
            evidenceSummary: {
                evidenceCount: 2,
                firstObservedAt: '2026-06-27T21:02:00.000Z',
                lastObservedAt: '2026-06-27T21:11:00.000Z',
            },
        },
    })

    assert.deepEqual(preview, {
        id: 'alert_org_acme',
        detailRoute: '/v1/dwm/alerts/alert_org_acme?organizationId=org_acme',
        sourceFamily: 'telegram_public',
        matchedTerm: 'acme.com',
        severity: 'high',
        recommendedRoute: 'identity_response',
        evidenceCount: 2,
        evidenceExcerpt: 'Telegram post references acme.com credentials.',
        firstSeenAt: '2026-06-27T21:02:00.000Z',
        lastSeenAt: '2026-06-27T21:11:00.000Z',
    })
})
