import { buildActorIntelligence, containsToyThreatIntelCopy } from '../src/utils/ti/actorIntelligence'
import { buildTiActionability } from '../src/utils/ti/actionability'
import type { TiSearchResponse } from '../src/utils/ti/search'

const fixture: TiSearchResponse = {
    query: 'apt29',
    generatedAt: '2026-06-28T08:00:00.000Z',
    mode: 'live_search',
    status: 'ready',
    summary: 'APT29 is a Russia-linked espionage actor associated with intelligence collection, diplomatic and government targeting, cloud and identity abuse, credential access, and stealthy persistence.',
    confidence: 0.76,
    lastSeen: '2024-01-25T00:00:00.000Z',
    aliases: ['Cozy Bear', 'Midnight Blizzard', 'Nobelium', 'The Dukes'],
    recentActivity: [{
        date: '2024-01-25',
        title: 'Microsoft disclosed Midnight Blizzard email access',
        detail: 'Microsoft disclosed access to corporate email accounts connected to Midnight Blizzard activity.',
        confidence: 0.82,
        sourceIds: ['microsoft'],
        claimType: 'campaign',
        victimName: 'Microsoft corporate email accounts',
        affectedSectors: ['Technology'],
        countries: ['United States'],
        impact: 'Corporate email access reported by vendor disclosure.',
        firstReportedAt: '2024-01-25',
        publisherCount: 1,
    }],
    targets: [{
        sector: 'Government and diplomacy',
        regions: ['United States', 'United Kingdom'],
        rationale: 'Strategic intelligence collection against policy and diplomatic targets.',
        confidence: 0.78,
    }],
    ttps: [{
        name: 'Cloud Accounts',
        attackId: 'T1078.004',
        tactic: 'Defense Evasion / Persistence',
        detail: 'Valid cloud identities and tokens are valuable for mailbox, tenant, and application access.',
        confidence: 0.72,
    }],
    datasets: [],
    sources: [{
        id: 'microsoft',
        name: 'Microsoft',
        type: 'vendor_disclosure',
        provenance: 'https://www.microsoft.com/en-us/security/blog/',
        url: 'https://www.microsoft.com/en-us/security/blog/',
    }],
    notes: [],
    actionability: {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition: 'watchlist_required',
        shouldAlert: false,
        rationale: 'Actor/query relevance is ready to seed organization watchlists, but no backed watchlist match, generated DWM alert, or case ID is attached to this public result.',
        watchlistCandidates: [
            { kind: 'company', value: 'Microsoft', reason: 'Public reporting includes Microsoft email intrusion context.', confidence: 0.78 },
            { kind: 'vendor', value: 'SolarWinds', reason: 'Public reporting includes SolarWinds supply-chain campaign context.', confidence: 0.78 },
        ],
        sourceProvenance: [
            { sourceId: 'microsoft', sourceName: 'Microsoft', provenance: 'https://www.microsoft.com/en-us/security/blog/', confidence: 0.82 },
        ],
        relatedAlerts: [],
        relatedCases: [],
        enrichmentGaps: [{
            id: 'dwm-alert-link',
            title: 'Return generated DWM alert ID',
            severity: 'high',
            detail: 'Case creation is backed by /v1/cases and requires a DWM alert ID.',
            dependency: '/v1/dwm/alerts or /v1/dwm/alerts/rebuild',
        }],
    },
}

const victims = [{
    victim: 'SolarWinds Orion customers and U.S. federal agencies',
    country: 'United States',
    sector: 'Government and software supply chain',
    incident: 'SolarWinds Orion compromise enabled downstream access into government and enterprise environments.',
    timeframe: '2020',
    source: 'public government and vendor reporting',
}]
const profile = buildActorIntelligence(fixture, victims)
const actionability = buildTiActionability(fixture, profile, victims)

assert(profile.actorClass === 'State-linked espionage actor', 'APT29 actor class should be explicit.')
assert(profile.malwareTools.includes('SUNBURST'), 'APT29 should include SUNBURST tooling context.')
assert(profile.campaigns.some(item => /SolarWinds/i.test(item)), 'APT29 should include SolarWinds campaign context.')
assert(profile.targetSectors.some(item => /Government/i.test(item)), 'APT29 should include government targeting context.')
assert(profile.sourceProvenance.length >= 2, 'APT29 should expose source provenance.')
assert(profile.confidenceReasoning.length >= 2, 'APT29 should expose confidence reasoning.')
assert(actionability.sourceProvenance.length >= 1, 'Actionability should expose backed provenance rows.')
assert(actionability.watchlist.payloads.some(item => item.value === 'Microsoft'), 'Actionability should carry watchlist relevance payloads.')
assert(actionability.alertDisposition === 'watchlist_required', 'APT29 fixture should not alert without a backed watchlist match or alert ID.')
assert(actionability.handoffs.caseBlockers.some(item => /DWM alert ID/i.test(item)), 'No-alert fixture should explain missing case dependency.')
assert(actionability.geographyHandoffs.some(item => item.code === 'US' && item.watchlistTerm?.value.includes('SolarWinds')), 'APT29 geography should map country observations to watchlist actions.')
assert(actionability.geographyHandoffs.some(item => item.code === 'RU' && item.role === 'operator' && !item.watchlistTerm), 'Operator-origin geography should remain attribution/enrichment context, not an alert term.')
assert(actionability.sourceClusters.some(item => item.watchlistTerm?.value === 'microsoft.com'), 'Source provenance should map source domains to watchlist action rows.')
assert(actionability.sourceClusters.some(item => /Attach capture ID/i.test(item.enrichmentTask)), 'Source provenance without capture IDs should create enrichment work.')
assert(actionability.exportPayloads.watchlist.schemaVersion === 'ti.public_actor.watchlist_handoff.v1', 'Watchlist handoff should be export-ready.')
assert(Array.isArray(actionability.exportPayloads.watchlist.body.terms), 'Watchlist handoff should carry terms for the product flow.')
assert(actionability.exportPayloads.watchlist.blocked, 'APT29 watchlist handoff should be blocked until org context is present.')
assert(actionability.exportPayloads.alertRebuild.endpoint === '/v1/dwm/alerts/rebuild', 'Alert rebuild handoff should target the backed alert rebuild route.')
assert(Array.isArray(actionability.exportPayloads.case.body.requiredBeforePost), 'Case handoff should expose dependencies before POST.')
assert(actionability.exportPayloads.enrichment.schemaVersion === 'ti.public_actor.enrichment_queue.v1', 'Enrichment queue handoff should be shaped for source/capture work.')
assert(JSON.stringify(actionability.exportPayloads.enrichment.body).includes('capture'), 'Enrichment handoff should include capture/source work.')

const backed = buildTiActionability({
    ...fixture,
    query: 'apt29 microsoft',
    actionability: {
        ...fixture.actionability,
        alertDisposition: 'case_ready',
        shouldAlert: true,
        watchlistMatches: [{
            organizationId: 'org_1',
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
            source: 'DWM alerts API',
        }],
        relatedCases: [{
            id: 'case_1',
            title: 'Microsoft actor relevance',
            status: 'open',
            priority: 'high',
            path: '/v1/cases/case_1?alertId=dwm_alert_1',
        }],
        handoffs: {
            caseCreate: {
                method: 'POST',
                endpoint: '/v1/cases',
                payload: { alertId: 'dwm_alert_1', title: 'Microsoft actor relevance', priority: 'high' },
            },
        },
    },
}, profile, victims)
assert(backed.shouldAlert, 'Backed alert/case fixture should be alertable.')
assert(backed.relatedCases[0]?.id === 'case_1', 'Backed actionability should preserve related case IDs.')
assert(backed.handoffs.casePayload?.alertId === 'dwm_alert_1', 'Backed actionability should produce a case handoff payload.')
assert(backed.exportPayloads.case.body.alertId === 'dwm_alert_1', 'Backed case export should carry the DWM alert ID.')
assert(!backed.exportPayloads.case.blocked, 'Backed case export should be open when case payload has no blockers.')

const quietFixture: TiSearchResponse = {
    ...fixture,
    query: 'quiet-actor',
    summary: 'Quiet actor profile without current customer relevance.',
    confidence: 0.32,
    aliases: [],
    recentActivity: [],
    targets: [],
    ttps: [],
    sources: [],
    actionability: {
        schemaVersion: 'ti.query.actionability.v1',
        alertDisposition: 'not_alertable',
        shouldAlert: false,
        rationale: 'No current source, watchlist, alert, or case data is attached.',
        watchlistCandidates: [],
        relatedAlerts: [],
        relatedCases: [],
        sourceProvenance: [],
        enrichmentGaps: [],
    },
}
const quietProfile = buildActorIntelligence(quietFixture, [])
const quiet = buildTiActionability(quietFixture, quietProfile, [])
assert(!quiet.shouldAlert, 'Quiet actor should not be alertable.')
assert(quiet.relatedAlerts.length === 0 && quiet.relatedCases.length === 0, 'Quiet actor should honestly show no current alert or case.')
assert(quiet.watchlist.state === 'missing_terms', 'Quiet actor should expose missing watchlist terms.')
assert(quiet.watchlist.blockers.some(item => /Authenticated organization ID/i.test(item)), 'Quiet actor should explain missing org/auth context for watchlist actions.')
assert(quiet.exportPayloads.blockers.body.orgRequired === true, 'No-org actor path should export org-required blockers.')
assert(quiet.exportPayloads.watchlist.missing.some(item => /Authenticated organization ID/i.test(item)), 'No-org watchlist export should carry precise blocked dependency.')

assert(containsToyThreatIntelCopy('target signals'), 'Copy guard should catch target signal language.')
assert(containsToyThreatIntelCopy('Named examples'), 'Copy guard should catch named-example language.')
assert(containsToyThreatIntelCopy('country-level target marker'), 'Copy guard should catch internal map marker language.')
assert(containsToyThreatIntelCopy('continent bucket'), 'Copy guard should catch internal geography bucket language.')
assert(containsToyThreatIntelCopy('prompt'), 'Copy guard should catch prompt language.')
assert(containsToyThreatIntelCopy('internal rationale'), 'Copy guard should catch internal rationale language.')
assert(!containsToyThreatIntelCopy(JSON.stringify(profile)), 'Shaped actor intelligence should not contain toy TI copy.')

console.log('[ti-actor-intelligence] actor intelligence shaping and copy guardrails passed')

function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message)
}
