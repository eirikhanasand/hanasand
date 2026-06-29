import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { buildTiActionability } from '../src/utils/ti/actionability'
import type { TiSearchResponse } from '../src/utils/ti/search'

const sourceBackedFixture: TiSearchResponse = {
    query: 'apt29 microsoft',
    generatedAt: '2026-06-29T08:00:00.000Z',
    mode: 'live_search',
    status: 'ready',
    summary: 'APT29 reporting includes Microsoft identity and mailbox access context with customer watchlist relevance.',
    confidence: 0.82,
    lastSeen: '2026-06-29T00:00:00.000Z',
    aliases: ['Midnight Blizzard', 'Nobelium'],
    recentActivity: [{
        date: '2026-06-29',
        title: 'Microsoft identity activity retained for customer relevance',
        detail: 'Source reporting connects the actor profile to Microsoft identity access and customer watchlist review.',
        confidence: 0.84,
        sourceIds: ['microsoft'],
        claimType: 'campaign',
        victimName: 'Microsoft',
        affectedSectors: ['Technology'],
        countries: ['United States'],
        firstReportedAt: '2026-06-29',
        publisherCount: 1,
    }],
    targets: [],
    ttps: [],
    datasets: [],
    sources: [{
        id: 'microsoft',
        name: 'Microsoft',
        type: 'vendor_disclosure',
        provenance: 'https://www.microsoft.com/en-us/security/blog/',
        url: 'https://www.microsoft.com/en-us/security/blog/',
    }],
    notes: [],
    actorIntelligence: {
        actorClass: 'State-linked espionage actor',
        structuredProvenance: [{
            sourceId: 'microsoft',
            sourceName: 'Microsoft',
            provenance: 'https://www.microsoft.com/en-us/security/blog/',
            captureId: 'capture_1',
            reportDate: '2026-06-29',
            confidence: 0.84,
            shownBecause: 'Microsoft reporting backs the watchlist and alert handoff context.',
        }],
        malwareTools: ['Cloud identity tooling'],
        campaigns: ['Microsoft identity access reporting'],
        geographies: ['United States'],
    },
    actionability: {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition: 'case_ready',
        shouldAlert: true,
        watchlistCandidates: [{ kind: 'company', value: 'Microsoft', reason: 'Source reporting names Microsoft identity activity.', confidence: 0.84 }],
        watchlistMatches: [{
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            watchlistId: 'watchlist_1',
            watchlistItemId: 'watch_1',
            kind: 'company',
            value: 'Microsoft',
            route: 'organization_watchlist',
            casePath: '/dashboard/dwm?organizationId=org_1&watchlistItemId=watch_1',
        }],
        relatedAlerts: [{
            id: 'dwm_alert_1',
            title: 'Microsoft actor relevance matched watchlist',
            status: 'pending_review',
            severity: 'high',
            caseIdCandidate: 'case_1',
            casePath: '/v1/cases/case_1?alertId=dwm_alert_1',
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            dedupeKey: 'apt29:microsoft',
            recommendedRoute: 'analyst_review',
            captureIds: ['capture_1'],
            evidenceCount: 2,
            webhookDestinationIds: ['webhook_1'],
            deliveryReadinessContext: {
                schemaVersion: 'dwm.alert_delivery_persistence.v1',
                state: 'ready',
                ready: true,
                blockerCodes: [],
                casePath: '/v1/cases/case_1?alertId=dwm_alert_1',
                selectedCaptureIds: ['capture_1'],
                webhookDestinationIds: ['webhook_1'],
            },
        }],
        relatedCases: [{
            id: 'case_1',
            title: 'Microsoft actor relevance',
            status: 'open',
            priority: 'high',
            path: '/v1/cases/case_1?alertId=dwm_alert_1',
        }],
        relatedWebhookDestinations: [{ id: 'webhook_1', name: 'SOC intake', status: 'active', path: '/dashboard/dwm' }],
        sourceProvenance: [{
            sourceId: 'microsoft',
            sourceName: 'Microsoft',
            provenance: 'https://www.microsoft.com/en-us/security/blog/',
            captureId: 'capture_1',
            confidence: 0.84,
        }],
        handoffs: {
            caseCreate: {
                method: 'POST',
                endpoint: '/v1/cases',
                payload: { alertId: 'dwm_alert_1', title: 'Microsoft actor relevance', priority: 'high' },
            },
        },
    },
}

const actor = buildActorIntelligence(sourceBackedFixture, [])
const actionability = buildTiActionability(sourceBackedFixture, actor, [])

assert(actionability.orgRelevance.schemaVersion === 'ti.public_actor.org_relevance.v1', 'Org relevance proof should be versioned.')
assert(actionability.orgRelevance.state === 'ready', 'Org relevance should be ready when source, watchlist, alert, case, and capture refs are present.')
assert(actionability.orgRelevance.organizationRefs.some(ref => ref.organizationId === 'org_1' && ref.watchlistId === 'watchlist_1' && ref.watchlistItemId === 'watch_1'), 'Org relevance should preserve watchlist identity.')
assert(actionability.orgRelevance.candidateTerms.some(term => term.value === 'Microsoft' && term.matched && term.sourceEvidenceRefs.includes('capture_1')), 'Org relevance should link candidate terms to capture/source refs.')
assert(actionability.orgRelevance.sourceEvidence.some(source => source.sourceId === 'microsoft' && source.captureId === 'capture_1' && source.supportsTerms.includes('Microsoft')), 'Org relevance should preserve source evidence and supported terms.')
assert(actionability.orgRelevance.alertCaseRefs.some(ref => ref.alertId === 'dwm_alert_1' && ref.casePath === '/v1/cases/case_1?alertId=dwm_alert_1' && ref.captureIds.includes('capture_1') && ref.webhookDestinationIds.includes('webhook_1')), 'Org relevance should preserve alert, case, capture, and webhook refs.')
assert(actionability.orgRelevance.freshness.stale === false && actionability.orgRelevance.freshness.lastSeen === '2026-06-29T00:00:00.000Z', 'Org relevance should expose actor freshness for deploy-gate checks.')
assert(actionability.orgRelevance.sourceEvidence.some(source => source.sourceId === 'microsoft' && source.reportDate === '2026-06-29' && source.shownBecause && source.confidence === 0.84), 'Org relevance should carry source date, confidence, and provenance reason.')
assert(actionability.orgRelevance.affectedEntities.vendors.some(entity => entity.value === 'Microsoft' && entity.matched && entity.watchlistItemIds.includes('watch_1') && entity.alertIds.includes('dwm_alert_1')), 'Org relevance should expose affected vendor relevance.')
assert(actionability.orgRelevance.affectedEntities.domains.some(entity => entity.value === 'microsoft.com' && entity.sourceFamily === 'source_capture' && entity.provenanceRefs.includes('capture_1')), 'Org relevance should expose source-backed affected domains.')
assert(actionability.orgRelevance.affectedEntities.regions.some(entity => entity.value === 'United States' && entity.sourceFamily === 'geography'), 'Org relevance should expose affected regions from actor and activity context.')
assert(actionability.orgRelevance.handoffRows.some(row => row.kind === 'watchlist_match' && row.state === 'ready' && row.ownerLane === 'org' && row.sourceFamily === 'watchlist' && row.watchlistItemId === 'watch_1'), 'Org relevance should expose a ready watchlist row.')
assert(actionability.orgRelevance.handoffRows.some(row => row.kind === 'watchlist_match' && row.evidence.sourceName === 'Microsoft' && row.evidence.reportDate === '2026-06-29' && row.evidence.confidence === 0.84 && row.evidence.captureId === 'capture_1'), 'Watchlist rows should carry source-backed evidence metadata.')
assert(actionability.orgRelevance.handoffRows.some(row => row.kind === 'source_evidence' && row.state === 'ready' && row.ownerLane === 'source' && row.sourceFamily === 'vendor_disclosure' && row.captureIds.includes('capture_1')), 'Org relevance should expose source evidence rows with source family.')
assert(actionability.orgRelevance.handoffRows.some(row => row.kind === 'source_evidence' && row.evidence.sourceId === 'microsoft' && row.evidence.summary.includes('Microsoft reporting backs')), 'Source rows should explain why evidence is shown.')
assert(actionability.orgRelevance.handoffRows.some(row => row.kind === 'alert_case' && row.state === 'ready' && row.ownerLane === 'case' && row.alertId === 'dwm_alert_1' && row.casePath === '/v1/cases/case_1?alertId=dwm_alert_1'), 'Org relevance should expose alert and case handoff rows.')
assert(actionability.orgRelevance.handoffRows.some(row => row.kind === 'webhook_delivery' && row.state === 'ready' && row.ownerLane === 'webhook' && row.webhookDestinationIds.includes('webhook_1')), 'Org relevance should expose webhook handoff rows.')
assert(actionability.orgRelevance.handoffRows.every(row => row.sourceFamily && Array.isArray(row.provenanceRefs) && Array.isArray(row.blockers) && row.evidence.summary), 'Every org relevance row should carry source family, provenance refs, evidence metadata, and typed blockers.')
assert(actionability.orgRelevance.handoffRoutes.alertRebuild === '/v1/dwm/alerts/rebuild' && actionability.orgRelevance.handoffRoutes.case === '/v1/cases', 'Org relevance should carry stable downstream routes.')
assert(JSON.stringify(actionability.actionPayloads.payloads.watchlistAdd.body.orgRelevance).includes('watchlist_1'), 'Watchlist action payload should include org relevance proof.')
assert(JSON.stringify(actionability.actionPayloads.payloads.caseHandoff.body.orgRelevance).includes('dwm_alert_1'), 'Case action payload should include org relevance proof.')
assert(JSON.stringify(actionability.actionPayloads.payloads.webhookDelivery.body.orgRelevance).includes('webhook_1'), 'Webhook action payload should include org relevance proof.')
assert(JSON.stringify(actionability.actionPayloads.payloads.analystHandoffBundle.body.orgRelevance).includes('capture_1'), 'Analyst handoff bundle should include source-backed relevance proof.')

const quietFixture: TiSearchResponse = {
    query: 'quiet actor',
    generatedAt: '2026-06-29T08:00:00.000Z',
    mode: 'live_search',
    status: 'ready',
    summary: 'No customer relevance is attached.',
    confidence: 0.2,
    lastSeen: '2026-06-29T00:00:00.000Z',
    aliases: [],
    recentActivity: [],
    targets: [],
    ttps: [],
    datasets: [],
    sources: [],
    notes: [],
    actorIntelligence: { structuredProvenance: [] },
    actionability: {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition: 'not_alertable',
        shouldAlert: false,
        watchlistCandidates: [],
        watchlistMatches: [],
        relatedAlerts: [],
        relatedCases: [],
        relatedWebhookDestinations: [],
        sourceProvenance: [],
        enrichmentGaps: [],
    },
}
const quiet = buildTiActionability(quietFixture, buildActorIntelligence(quietFixture, []), [])

assert(quiet.orgRelevance.state === 'blocked', 'Sparse actor results should not invent org relevance.')
assert(quiet.orgRelevance.organizationRefs.length === 0 && quiet.orgRelevance.sourceEvidence.length === 0 && quiet.orgRelevance.alertCaseRefs.length === 0, 'Sparse org relevance should stay empty.')
assert(quiet.orgRelevance.handoffRows.some(row => row.state === 'blocked' && row.ownerLane === 'source' && row.blockers.some(blocker => blocker.code === 'missing_source_provenance')), 'Sparse org relevance should expose source collection blockers.')
assert(quiet.orgRelevance.handoffRows.some(row => row.state === 'blocked' && row.ownerLane === 'alert' && row.blockers.some(blocker => blocker.code === 'missing_alert')), 'Sparse org relevance should expose alert handoff blockers.')
assert(quiet.orgRelevance.handoffRows.every(row => row.evidence.summary && !row.evidence.sourceId && !row.evidence.captureId), 'Sparse rows should expose blocker evidence summaries without fake source or capture IDs.')

for (const phrase of ['control room', 'how this feeds', 'signal', 'named examples', 'dashboard slop', 'acceptance criteria']) {
    assert(!JSON.stringify(actionability.orgRelevance).toLowerCase().includes(phrase), `Org relevance proof should not include prompt-shaped copy: ${phrase}.`)
    assert(!JSON.stringify(actionability.actionPayloads).toLowerCase().includes(phrase), `Action payloads should not include prompt-shaped copy: ${phrase}.`)
}

console.log('[ti-org-relevance] source-backed org relevance handoff passed')

function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message)
}
