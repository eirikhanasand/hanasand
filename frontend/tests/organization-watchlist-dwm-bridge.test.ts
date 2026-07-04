import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
    buildDwmWatchlistMirrorAlertPreview,
    buildDwmWatchlistMirrorPayload,
    buildDwmWatchlistMirrorPayloads,
    mirrorOrganizationWatchlistToDwmResult,
} from '@/app/api/organizations/_organizationWatchlistDwmBridge'

const organizationWorkspaceSource = readFileSync(new URL('../src/app/organizations/organizationWorkspaceClient.tsx', import.meta.url), 'utf8')
const dwmAnalystPortalSource = readFileSync(new URL('../src/app/dashboard/dwm/dwm-analyst-portal.tsx', import.meta.url), 'utf8')

test('organization workspace exposes destination lifecycle controls safely', () => {
    assert.match(organizationWorkspaceSource, /validDestinationUrl\(url\)/, 'destination save should validate URL shape before dry-run.')
    assert.match(organizationWorkspaceSource, /createSavedDestination/, 'organization settings should allow direct destination creation.')
    assert.match(organizationWorkspaceSource, /data-org-destination-create='true'/, 'saved destinations should expose a compact create control.')
    assert.match(organizationWorkspaceSource, /marker='data-org-destination-busy'/, 'destination lifecycle actions should show an in-panel loading state.')
    assert.match(organizationWorkspaceSource, /Adding destination/, 'destination create should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /Testing destination/, 'destination test should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /Removing destination/, 'destination delete should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /marker='data-org-invite-busy'/, 'invite actions should show an in-panel loading state.')
    assert.match(organizationWorkspaceSource, /Sending invites/, 'invite create should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /Revoking invite/, 'invite revoke should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /marker='data-org-member-busy'/, 'member actions should show an in-panel loading state.')
    assert.match(organizationWorkspaceSource, /Updating member role/, 'member role changes should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /Removing member/, 'member removal should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /marker='data-org-watchlist-busy'/, 'watchlist actions should show an in-panel loading state.')
    assert.match(organizationWorkspaceSource, /Adding watchlist term/, 'watchlist creation should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /Saving watchlist term/, 'watchlist edits should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /Cleaning archived watchlists/, 'watchlist cleanup should expose a concrete loading label.')
    assert.match(organizationWorkspaceSource, /data-org-activity-copy='true'/, 'activity rail should expose selected-context copy.')
    assert.match(organizationWorkspaceSource, /navigator\.clipboard\.writeText/, 'activity copy should use the browser clipboard.')
    assert.match(organizationWorkspaceSource, /selectedContextRows\(selectedSubject, organization, bundle\)/, 'activity copy should include selected row context.')
    assert.match(organizationWorkspaceSource, /Activity copied\./, 'activity copy should expose a compact success state.')
    assert.match(organizationWorkspaceSource, /DestinationDeliverySummary/, 'saved destination rows should include delivery history context.')
    assert.match(organizationWorkspaceSource, /latestDeliveryForDestination\(destination, deliveries\)/, 'saved destination rows should resolve latest delivery by destination.')
    assert.match(organizationWorkspaceSource, /data-org-destination-latest='true'/, 'saved destination delivery history should expose a stable marker.')
    assert.match(organizationWorkspaceSource, /settingsValidationMessage\(settingsDraft\)/, 'organization settings should validate before saving.')
    assert.match(organizationWorkspaceSource, /data-org-settings-busy/, 'organization settings should expose save progress.')
    assert.match(organizationWorkspaceSource, /Retention days must be between 30 and 3650\./, 'retention policy should have bounded validation.')
    assert.match(organizationWorkspaceSource, /data-org-scope-copy='true'/, 'scope columns should expose route copy controls.')
    assert.match(organizationWorkspaceSource, /Copy \$\{title\} route/, 'scope copy controls should describe the selected org route.')
    assert.match(organizationWorkspaceSource, /Route copied\./, 'scope copy controls should expose a compact success state.')
    assert.match(organizationWorkspaceSource, /\/api\/organizations\/\$\{encodeURIComponent\(selectedOrganization\.id\)\}\/webhooks`,/, 'destination creation should use the org-scoped destination proxy.')
    assert.match(organizationWorkspaceSource, /method: 'POST'/, 'destination creation should use POST through the frontend org proxy.')
    assert.match(organizationWorkspaceSource, /endpointUrl: url/, 'destination creation should send the endpoint only to the backend proxy.')
    assert.match(organizationWorkspaceSource, /webhookUrl: url/, 'destination creation should preserve legacy backend URL compatibility.')
    assert.match(organizationWorkspaceSource, /Destination added\./, 'destination creation should return a concrete operator result.')
    assert.match(organizationWorkspaceSource, /\/api\/organizations\/\$\{encodeURIComponent\(selectedOrganization\.id\)\}\/webhooks\/\$\{encodeURIComponent\(destination\.id\)\}/, 'saved destination updates should use the org-scoped destination proxy.')
    assert.match(organizationWorkspaceSource, /method: 'PATCH'/, 'saved destination edits should use PATCH through the frontend org proxy.')
    assert.match(organizationWorkspaceSource, /aria-label='Edit destination'/, 'saved destinations should expose an edit action.')
    assert.match(organizationWorkspaceSource, /Disable/, 'active destinations should expose disable action.')
    assert.match(organizationWorkspaceSource, /Enable/, 'paused destinations should expose enable action.')
    assert.match(organizationWorkspaceSource, /latestDeliveryForDestination\(destination, deliveries\)/, 'saved destination rows should derive the latest delivery from the ledger.')
    assert.match(organizationWorkspaceSource, /data-org-destination-latest='true'/, 'saved destination rows should show the latest test or replay result.')
    assert.match(organizationWorkspaceSource, /Last \{delivery\.dryRun \? 'test' : 'delivery'\}/, 'saved destination rows should distinguish tests from live delivery attempts.')
    assert.match(organizationWorkspaceSource, /Trace: \{deliveryTraceLabel\(delivery\)\}/, 'saved destination rows should expose audit or request trace labels.')
    assert.match(organizationWorkspaceSource, /delivery\.nextRetryAt \? formatDate\(delivery\.nextRetryAt\)/, 'saved destination rows should expose retry timing when present.')
    assert.match(organizationWorkspaceSource, /data-org-delivery-history='true'/, 'organization workspace should expose persisted delivery history.')
    assert.match(organizationWorkspaceSource, /deliveryMatchesSubject\(delivery, selectedSubject\)/, 'delivery history should filter by the selected org row.')
    assert.match(organizationWorkspaceSource, /nextRetryAt/, 'delivery history should show retry scheduling when present.')
    assert.match(organizationWorkspaceSource, /replayDelivery/, 'delivery history should expose a replay action.')
    assert.match(organizationWorkspaceSource, /canReplayDelivery\(delivery\)/, 'delivery replay should require enough destination and alert context.')
    assert.match(organizationWorkspaceSource, /requestJson<DeliveryResult>\('\/api\/dwm\/webhooks\/deliver'/, 'history replay should use the existing DWM delivery route.')
    assert.match(organizationWorkspaceSource, /dryRun: true,[\s\S]*replay: true/, 'history replay should stay no-network by default.')
    assert.match(organizationWorkspaceSource, /auditEventId\?: string/, 'delivery rows should preserve audit event ids.')
    assert.match(organizationWorkspaceSource, /deliveryTraceLabel\(delivery\)/, 'delivery history should expose a traceable audit or request id.')
    assert.match(organizationWorkspaceSource, /normalizedDeliveryRows\(payload\)/, 'organization delivery history should merge raw delivery rows with audit-linked ledger rows.')
    assert.match(organizationWorkspaceSource, /deliveryLedger/, 'organization delivery history should consume backend ledger rows with audit ids.')
    assert.match(organizationWorkspaceSource, /auditEventId: row\.auditEventId \|\| cleanString\(enriched\.auditEventId\)/, 'delivery history should prefer linked audit event ids when available.')
    assert.match(organizationWorkspaceSource, /delivery\.caseId,[\s\S]*delivery\.actionId,[\s\S]*\.\.\.\(delivery\.watchlistItemIds \|\| \[\]\)/, 'activity rows should connect delivery evidence to destination, watchlist, alert, and case selections.')
    assert.match(organizationWorkspaceSource, /activity\.filter\(item => item\.subjectId === subject\.id \|\| item\.relatedSubjectIds\?\.includes\(subject\.id\)/, 'selected activity should show related delivery rows across org alert, case, watchlist, and destination context.')
    assert.match(organizationWorkspaceSource, /\/dashboard\/dwm\/cases\/\$\{encodeURIComponent\(delivery\.caseId\)\}/, 'delivery history should link case context.')
    assert.match(organizationWorkspaceSource, /input\.focus === 'destinations' \|\| input\.focus === 'webhooks'/, 'DWM destination links should focus saved destinations, including legacy webhook links.')
    assert.match(dwmAnalystPortalSource, /&focus=destinations/, 'DWM delivery panel should route operators to destination management.')
    assert.doesNotMatch(dwmAnalystPortalSource, /&focus=webhooks/, 'DWM delivery panel should not use the old webhook focus value.')
    assert.doesNotMatch(organizationWorkspaceSource, /token=[^'"]+|discord-secret|webhook secret/i, 'workspace source should not hard-code webhook secrets.')
})

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

test('mirrors org watchlist save into DWM alert rebuild and returns alert delta', async () => {
    const calls: Array<{ url: string, method: string, body?: unknown, headers: Record<string, string> }> = []
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = input instanceof Request ? input.url : String(input)
        const method = init?.method || (input instanceof Request ? input.method : 'GET')
        const headers = headersObject(init?.headers)
        const body = init?.body ? JSON.parse(String(init.body)) : undefined
        calls.push({ url, method, body, headers })
        if (url === 'http://scraper.local/v1/dwm/watchlists') {
            assert.deepEqual(body, {
                id: 'org_watch_item_acme_domain',
                tenantId: 'org_acme',
                organizationId: 'org_acme',
                name: 'Org watchlist - acme.com',
                status: 'active',
                terms: [{ id: 'watch_item_acme_domain', value: 'acme.com', kind: 'domain' }],
                reason: 'organization_watchlist_saved',
            })
            return Response.json({
                watchlist: { id: 'org_watch_item_acme_domain' },
                alertRebuild: {
                    savedAlertCount: 1,
                    alertIds: ['alert_org_acme'],
                    sourceFamilies: ['telegram_public'],
                    matchedTerms: ['acme.com'],
                },
            }, { status: 201 })
        }
        if (url === 'http://scraper.local/v1/dwm/alerts/alert_org_acme?tenantId=org_acme&organizationId=org_acme') {
            return Response.json({
                alert: {
                    id: 'alert_org_acme',
                    alertDetailPath: '/v1/dwm/alerts/alert_org_acme?organizationId=org_acme',
                    sourceFamily: 'telegram_public',
                    matchedTerm: { value: 'acme.com' },
                    recommendedRoute: 'identity_response',
                    evidence: [{ excerpt: 'Telegram post references acme.com credentials.' }],
                    evidenceSummary: { evidenceCount: 1, lastObservedAt: '2026-06-27T21:11:00.000Z' },
                },
            })
        }
        return Response.json({ error: 'unexpected fetch', url }, { status: 500 })
    }) as typeof fetch

    const mirrorPayloads = buildDwmWatchlistMirrorPayloads({
        organizationId: 'org_acme',
        organizationPayload: {
            watchlistItem: {
                id: 'watch_item_acme_domain',
                kind: 'domain',
                value: 'acme.com',
                status: 'active',
            },
        },
    })
    const result = await mirrorOrganizationWatchlistToDwmResult({
        base: 'http://scraper.local',
        organizationId: 'org_acme',
        mirrorPayloads,
        authHeaders: { authorization: 'Bearer user-token', id: 'user-1' },
        fetchImpl,
    })

    assert.equal(result.ok, true)
    assert.equal(result.savedAlertCount, 1)
    assert.deepEqual(result.alertIds, ['alert_org_acme'])
    assert.deepEqual(result.sourceFamilies, ['telegram_public'])
    assert.deepEqual(result.matchedTerms, ['acme.com'])
    assert.deepEqual(result.firstAlert, {
        id: 'alert_org_acme',
        detailRoute: '/v1/dwm/alerts/alert_org_acme?organizationId=org_acme',
        sourceFamily: 'telegram_public',
        matchedTerm: 'acme.com',
        severity: undefined,
        recommendedRoute: 'identity_response',
        evidenceCount: 1,
        evidenceExcerpt: 'Telegram post references acme.com credentials.',
        firstSeenAt: undefined,
        lastSeenAt: '2026-06-27T21:11:00.000Z',
    })
    assert.equal(calls[0].headers.authorization, 'Bearer user-token')
    assert.equal(calls[0].headers['x-organization-id'], 'org_acme')
    assert.equal(calls[1].headers.authorization, 'Bearer user-token')
    assert.equal(calls[1].headers['x-tenant-id'], 'org_acme')
})

function headersObject(value: HeadersInit | undefined) {
    return Object.fromEntries(new Headers(value).entries())
}
