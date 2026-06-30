import { buildTiActionability } from '../src/utils/ti/actionability'
import { sanitizeTiResultForPublicPage } from '../src/app/ti/publicResult'
import { buildActorIntelligence } from '../src/utils/ti/actorIntelligence'
import { victimObservationsFor } from '../src/utils/ti/actorProfile'
import type { TiSearchResponse } from '../src/utils/ti/search'

const apt29 = (() => {
    const result = apt29Result()
    const victims = victimObservationsFor(result)
    const actor = buildActorIntelligence(result, victims)
    return buildTiActionability(result, actor, victims)
})()

assert(apt29.orgRelevance.actorIdentity.canonicalName === 'APT29', 'APT29 relevance should carry canonical actor name.')
assert(apt29.orgRelevance.actorIdentity.aliases.includes('Midnight Blizzard'), 'APT29 relevance should carry actor aliases.')
assert(apt29.orgRelevance.actorIdentity.aliases.includes('Nobelium'), 'APT29 relevance should carry alternate names.')
assert(apt29.orgRelevance.actorIdentity.actorClass === 'State-linked espionage actor', 'APT29 relevance should carry actor class.')
assert(apt29.orgRelevance.actorIdentity.sectors.includes('Technology and cloud services'), 'APT29 relevance should carry backed target sectors.')
assert(apt29.orgRelevance.actorIdentity.regions.includes('United States'), 'APT29 relevance should carry backed target regions.')
assert(apt29.orgRelevance.sourceCoverage.some(source =>
    source.sourceId === 'src_microsoft_midnight_blizzard'
    && source.sourceFamily === 'vendor_disclosure'
    && source.status === 'capture_ready'
    && source.captureId === 'capture_microsoft_apt29_2024'
    && source.supportsTerms.includes('microsoft.com')
), 'APT29 relevance should carry source family, capture, and supported watchlist term.')
assert(apt29.orgRelevance.enrichmentGaps.length === 0, 'APT29 relevance should have no enrichment gaps when actor, source, and org data are present.')
assert(apt29.orgRelevance.watchlistIntersections.some(item =>
    item.kind === 'domain'
    && item.value === 'microsoft.com'
    && item.state === 'ready'
    && item.organizationId === 'org_acme'
    && item.watchlistId === 'watchlist_acme_vendors'
    && item.watchlistItemId === 'item_microsoft'
    && item.alertIds.includes('alert_apt29_microsoft')
    && item.casePaths.includes('/dashboard/dwm/cases/case_apt29_microsoft')
    && item.captureIds.includes('capture_microsoft_apt29_2024')
    && item.webhookDestinationIds.includes('webhook_security_ops')
    && item.sourceFamilies.includes('vendor_disclosure')
    && item.recommendedAction === 'open_case'
), 'APT29 relevance should carry backed org/watchlist/source/alert/case intersections.')
assert(apt29.orgRelevance.handoffRows.some(row => row.kind === 'alert_case' && row.alertId === 'alert_apt29_microsoft'), 'APT29 relevance should expose linked alert/case handoff rows.')
assert(readObject(apt29.actionPayloads.payloads.analystHandoffBundle.body.orgRelevance).actorIdentity, 'Analyst handoff bundle should include org relevance actor identity.')
assert(readArray(readObject(apt29.actionPayloads.payloads.analystHandoffBundle.body.orgRelevance).sourceCoverage).some(item => readObject(item).status === 'capture_ready'), 'Analyst handoff bundle should include source coverage readiness.')
assert(readArray(readObject(apt29.actionPayloads.payloads.analystHandoffBundle.body.orgRelevance).watchlistIntersections).some(item => readObject(item).recommendedAction === 'open_case'), 'Analyst handoff bundle should include org watchlist intersections.')

const sanitizedApt29Result = sanitizeTiResultForPublicPage(apt29Result())
assert(sanitizedApt29Result, 'Public /ti result sanitizer should return a result.')
assert(sanitizedApt29Result?.actorIntelligence?.structuredProvenance?.some(row =>
    row.sourceId === 'src_microsoft_midnight_blizzard'
    && row.captureId === 'capture_microsoft_apt29_2024'
    && row.parserStatus === undefined
    && row.provenance === 'https://www.microsoft.com/en-us/security/blog/'
), 'Public /ti result sanitizer should preserve structured actor provenance for first render.')
assert(sanitizedApt29Result.actionability?.sourceProvenance?.some(row =>
    row.sourceId === 'src_microsoft_midnight_blizzard'
    && row.captureId === 'capture_microsoft_apt29_2024'
), 'Public /ti result sanitizer should preserve source provenance rows.')
assert(sanitizedApt29Result.actionability?.watchlistMatches?.some(match =>
    match.organizationId === 'org_acme'
    && match.watchlistItemId === 'item_microsoft'
    && match.casePath === '/dashboard/dwm/cases/case_apt29_microsoft'
), 'Public /ti result sanitizer should preserve backed watchlist and case routing.')
assert(sanitizedApt29Result.actionability?.handoffs?.alertRebuild?.endpoint === '/v1/dwm/alerts/rebuild', 'Public /ti result sanitizer should preserve alert rebuild handoff route.')
const sanitizedVictims = victimObservationsFor(sanitizedApt29Result)
const sanitizedActor = buildActorIntelligence(sanitizedApt29Result, sanitizedVictims)
const sanitizedActionability = buildTiActionability(sanitizedApt29Result, sanitizedActor, sanitizedVictims)
assert(sanitizedActor.sourceCoverage.captureRows > 0, 'Sanitized /ti result should still produce capture-backed source coverage.')
assert(sanitizedActor.malwareTools.length > 0, 'Sanitized /ti result should still carry actor tools and malware facts.')
assert(sanitizedActionability.orgRelevance.watchlistIntersections.some(item =>
    item.state === 'ready'
    && item.recommendedAction === 'open_case'
    && item.sourceFamilies.includes('vendor_disclosure')
), 'Sanitized /ti result should still produce alert and case-ready watchlist relevance.')
assert(sanitizedActionability.createAlertHandoff.ready, 'Sanitized /ti result should keep alert handoff ready.')
assert(sanitizedActionability.caseHandoff.ready, 'Sanitized /ti result should keep case handoff ready.')

const blocked = (() => {
    const result: TiSearchResponse = {
        query: 'Unattributed Cluster',
        generatedAt: '2026-06-29T00:00:00.000Z',
        mode: 'seeded',
        status: 'partial',
        summary: 'Unattributed activity was returned without enough source-backed actor context.',
        confidence: 0.34,
        lastSeen: '2025-01-01T00:00:00.000Z',
        aliases: [],
        recentActivity: [],
        targets: [],
        ttps: [],
        datasets: [],
        sources: [],
        notes: [],
        actionability: {
            schemaVersion: 'ti.query.actionability.v1',
            watchlistCandidates: [],
            watchlistMatches: [],
            relatedAlerts: [],
            relatedCases: [],
            sourceProvenance: [],
            enrichmentGaps: [],
        },
    }
    const victims = victimObservationsFor(result)
    const actor = buildActorIntelligence(result, victims)
    return buildTiActionability(result, actor, victims)
})()
const gapCodes = blocked.orgRelevance.enrichmentGaps.map(gap => gap.code).sort()

assert(blocked.orgRelevance.state === 'blocked', 'Incomplete actor relevance should be blocked.')
assert(blocked.orgRelevance.actorIdentity.aliases.length === 0, 'Incomplete actor relevance should expose missing aliases.')
assert(blocked.orgRelevance.sourceCoverage.length === 0, 'Incomplete actor relevance should expose missing source coverage.')
assert(blocked.orgRelevance.watchlistIntersections.length === 0, 'Incomplete actor relevance should not invent org watchlist intersections.')
assert(JSON.stringify(gapCodes) === JSON.stringify([
    'missing_actor_aliases',
    'missing_provenance',
    'missing_source_coverage',
    'missing_target_regions',
    'missing_target_sectors',
    'stale_evidence',
]), 'Incomplete actor relevance should expose typed enrichment gap codes.')
assert(blocked.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:missing_actor_aliases:actorIdentity.aliases'), 'Missing alias gap should be visible as a handoff row.')
assert(blocked.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:missing_source_coverage:sourceCoverage'), 'Missing source coverage gap should be visible as a handoff row.')
assert(blocked.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:stale_evidence:freshness.lastSeen'), 'Stale evidence gap should be visible as a handoff row.')

function apt29Result(): TiSearchResponse {
    return {
        query: 'APT29',
        generatedAt: '2026-06-29T00:00:00.000Z',
        mode: 'seeded',
        status: 'ready',
        runId: 'run_apt29_org_relevance',
        summary: 'APT29 has public reporting tied to Microsoft cloud and identity intrusions.',
        confidence: 0.86,
        lastSeen: '2026-06-01T00:00:00.000Z',
        aliases: ['Midnight Blizzard', 'Nobelium'],
        recentActivity: [{
            date: '2024-01-25',
            title: 'Microsoft disclosed Midnight Blizzard access to corporate email',
            detail: 'Microsoft reported access to corporate email accounts by Midnight Blizzard.',
            confidence: 0.84,
            sourceIds: ['src_microsoft_midnight_blizzard'],
            claimType: 'victim_claim',
            victimName: 'Microsoft corporate email accounts',
            affectedSectors: ['Technology and cloud services'],
            countries: ['United States'],
            impact: 'Cloud identity and email exposure.',
            firstReportedAt: '2024-01-25',
        }],
        targets: [{
            sector: 'Technology and cloud services',
            regions: ['United States'],
            rationale: 'Vendor reporting describes APT29 activity against corporate cloud and email systems.',
            confidence: 0.84,
        }],
        ttps: [{
            name: 'Valid Accounts',
            attackId: 'T1078',
            tactic: 'Initial Access',
            detail: 'Public reporting describes credential and token access paths.',
            confidence: 0.8,
        }],
        datasets: [],
        sources: [{
            id: 'src_microsoft_midnight_blizzard',
            name: 'Microsoft Threat Intelligence',
            type: 'vendor_disclosure',
            provenance: 'https://www.microsoft.com/en-us/security/blog/',
            url: 'https://www.microsoft.com/en-us/security/blog/',
        }],
        notes: [],
        actionability: {
            schemaVersion: 'ti.query.actionability.v1',
            alertDisposition: 'case_ready',
            shouldAlert: true,
            watchlistCandidates: [{
                kind: 'domain',
                value: 'microsoft.com',
                reason: 'Microsoft is directly named in the actor evidence.',
                confidence: 0.84,
            }],
            watchlistMatches: [{
                tenantId: 'tenant_acme',
                organizationId: 'org_acme',
                watchlistId: 'watchlist_acme_vendors',
                watchlistItemId: 'item_microsoft',
                kind: 'domain',
                value: 'microsoft.com',
                route: '/dashboard/dwm/watchlists/watchlist_acme_vendors',
                casePath: '/dashboard/dwm/cases/case_apt29_microsoft',
            }],
            relatedAlerts: [{
                id: 'alert_apt29_microsoft',
                title: 'APT29 public reporting matched microsoft.com watchlist item',
                status: 'open',
                severity: 'high',
                caseIdCandidate: 'case_apt29_microsoft',
                casePath: '/dashboard/dwm/cases/case_apt29_microsoft',
                tenantId: 'tenant_acme',
                organizationId: 'org_acme',
                captureIds: ['capture_microsoft_apt29_2024'],
                webhookDestinationIds: ['webhook_security_ops'],
            }],
            relatedCases: [{
                id: 'case_apt29_microsoft',
                title: 'APT29 Microsoft vendor exposure review',
                status: 'open',
                priority: 'high',
                path: '/dashboard/dwm/cases/case_apt29_microsoft',
            }],
            sourceProvenance: [{
                sourceId: 'src_microsoft_midnight_blizzard',
                sourceName: 'Microsoft Threat Intelligence',
                provenance: 'https://www.microsoft.com/en-us/security/blog/',
                captureId: 'capture_microsoft_apt29_2024',
                confidence: 0.84,
            }],
            enrichmentGaps: [],
            handoffs: {
                watchlist: {
                    method: 'POST',
                    endpoint: '/v1/dwm/watchlists',
                    payloads: [{ kind: 'domain', value: 'microsoft.com', notes: 'APT29: Microsoft vendor exposure.' }],
                    missing: [],
                },
                alertRebuild: {
                    method: 'POST',
                    endpoint: '/v1/dwm/alerts/rebuild',
                    missing: [],
                },
                caseCreate: {
                    method: 'POST',
                    endpoint: '/v1/cases',
                    payload: {
                        alertId: 'alert_apt29_microsoft',
                        title: 'APT29 Microsoft vendor exposure review',
                        priority: 'high',
                    },
                    missing: [],
                },
                webhookDelivery: {
                    method: 'POST',
                    endpoint: '/v1/dwm/webhooks/deliver',
                    payload: {
                        alertId: 'alert_apt29_microsoft',
                        destinationId: 'webhook_security_ops',
                    },
                    missing: [],
                },
            },
        },
        actorIntelligence: {
            actorClass: 'State-linked espionage actor',
            attribution: 'Russia-linked SVR/APT29 activity in public government and vendor reporting',
            firstSeen: 'Late-2000s public reporting',
            lastSeen: '2026-06-01T00:00:00.000Z',
            motivation: ['Strategic intelligence collection'],
            targetSectors: ['Technology and cloud services'],
            geographies: ['United States'],
            confidence: 0.86,
            confidenceReasoning: ['Microsoft vendor reporting and government advisories support this actor profile.'],
            sourceProvenance: ['https://www.microsoft.com/en-us/security/blog/'],
            structuredProvenance: [{
                sourceId: 'src_microsoft_midnight_blizzard',
                sourceName: 'Microsoft Threat Intelligence',
                provenance: 'https://www.microsoft.com/en-us/security/blog/',
                reportDate: '2024-01-25',
                captureId: 'capture_microsoft_apt29_2024',
                confidence: 0.84,
                shownBecause: 'Microsoft is a matched customer vendor and the disclosure names Midnight Blizzard activity.',
            }],
        },
    }
}

function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
}

function readObject(value: unknown): Record<string, unknown> {
    assert(Boolean(value) && typeof value === 'object' && !Array.isArray(value), 'Expected object value.')
    return value as Record<string, unknown>
}

function readArray(value: unknown): unknown[] {
    assert(Array.isArray(value), 'Expected array value.')
    return value
}
