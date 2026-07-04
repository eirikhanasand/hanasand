import { readFileSync } from 'node:fs'
import { buildActorIntelligence, containsToyThreatIntelCopy } from '../src/utils/ti/actorIntelligence'
import { actorGeoProfile, victimObservationsFor } from '../src/utils/ti/actorProfile'
import { buildTiActionability } from '../src/utils/ti/actionability'
import {
    PUBLIC_TI_HANDOFF_ACTIONS,
    PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS,
    PUBLIC_TI_HANDOFF_SCHEMA_VERSION,
    buildActorArtifactHandoffs,
    buildActorArtifacts,
    decodePublicTiHandoffFromUrl,
    decodePublicTiHandoffPayload,
    encodeHandoffPayload,
    nextActorArtifactId,
    validatePublicTiHandoffPayload,
} from '../src/utils/ti/actorWorkbench'
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
    actorIntelligence: {
        indicators: ['SUNBURST supply-chain activity', 'Cloud mailbox access'],
        structuredProvenance: [{
            sourceId: 'microsoft',
            sourceName: 'Microsoft',
            provenance: 'https://www.microsoft.com/en-us/security/blog/',
            reportDate: '2024-01-25',
            sourceRequestId: 'src_req_microsoft_2024_01',
            sourceFamily: 'vendor_disclosure',
            parserStatus: 'partial',
            lastCollectedAt: '2024-01-26',
            confidence: 0.82,
            shownBecause: 'Microsoft disclosure is the evidence strength for observed activity and watchlist relevance.',
        }],
    },
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
            { sourceId: 'microsoft', sourceName: 'Microsoft', provenance: 'https://www.microsoft.com/en-us/security/blog/', confidence: 0.82, sourceRequestId: 'src_req_microsoft_2024_01', sourceFamily: 'vendor_disclosure', parserStatus: 'partial', lastCollectedAt: '2024-01-26', reportDate: '2024-01-25' },
        ],
        relatedAlerts: [],
        relatedCases: [],
        enrichmentGaps: [{
            id: 'dwm-alert-link',
            title: 'Return generated DWM alert ID',
            severity: 'high',
            detail: 'Case creation is backed by /v1/cases and requires a DWM alert ID.',
            dependency: '/v1/dwm/alerts or /v1/dwm/alerts/rebuild',
            route: '/dashboard/dwm',
            sourceFamily: 'alert',
            requestedFields: ['relatedAlerts[].id', 'relatedAlerts[].casePath'],
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
    sourceIds: ['cisa', 'solarwinds-public-reporting'],
    provenanceRefs: ['CISA and allied government SVR/APT29 advisories', 'Public SolarWinds and vendor incident reporting'],
    reportDate: '2020',
    confidence: 0.82,
}]
const profile = buildActorIntelligence(fixture, victims)
const actionability = buildTiActionability(fixture, profile, victims)
const artifacts = buildActorArtifacts(fixture, profile, victims, actionability)
const fullPublicVictims = victimObservationsFor(fixture)
const fullPublicProfile = buildActorIntelligence(fixture, fullPublicVictims)
const fullPublicActionability = buildTiActionability(fixture, fullPublicProfile, fullPublicVictims)
const geo = actorGeoProfile(fixture)
const pageClientSource = readFileSync(new URL('../src/app/ti/pageClient.tsx', import.meta.url), 'utf8')
const globalStylesSource = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8')
const actorIntelligenceSource = readFileSync(new URL('../src/utils/ti/actorIntelligence.ts', import.meta.url), 'utf8')
const actionabilitySource = readFileSync(new URL('../src/utils/ti/actionability.ts', import.meta.url), 'utf8')
const actorProfileSource = readFileSync(new URL('../src/utils/ti/actorProfile.ts', import.meta.url), 'utf8')
const actorWorkbenchSource = readFileSync(new URL('../src/utils/ti/actorWorkbench.ts', import.meta.url), 'utf8')
const dashboardWorkbenchPageSource = readFileSync(new URL('../src/app/dashboard/ti/workbench/page.tsx', import.meta.url), 'utf8')
const operatorConsoleModelSource = readFileSync(new URL('../src/app/dashboard/operatorConsoleModel.ts', import.meta.url), 'utf8')
const apiSearchSource = readFileSync(new URL('../../api/src/utils/ti/search.ts', import.meta.url), 'utf8')
const bannedUiCopy = [
    'how this feeds',
    'control room',
    'target signal',
    'signal language',
    'named examples',
    'authenticated bridge',
    'copy handoff payloads',
    'geography to action',
    'provenance to action',
    'related backed objects',
    'backed objects',
    'contract',
    'acceptance criteria',
    'dashboard slop',
    'api result data is live',
    'case payload',
    'mode live',
    'open dwm workbench',
    'api work',
    'console/api workflow',
]
const brightDarkSurfaceTokens = [
    'border-white/10',
    'bg-white/10',
    'dark:border-white',
    'dark:bg-white',
]
const publicTiImplementationPhrases = [
    'API activity result',
    'TI search API',
    'search API',
    'actionability contract',
    'built-in actor enrichment fallback',
    'watchlistMatches',
    'actorIntelligence.malwareTools',
]
const backendResultVerb = ['return', 'ed'].join('')
const publicTiBackendEmptyStatePatterns = [
    new RegExp(`What\\s+${backendResultVerb}`, 'i'),
    new RegExp(`\\b${backendResultVerb} observations\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} actor profile\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} as evidence\\b`, 'i'),
    new RegExp(`\\bNo\\s+[A-Za-z][A-Za-z /-]{0,80}\\s+${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bwas\\s+${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bnot\\s+${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bnone\\s+${backendResultVerb}\\b`, 'i'),
    /\bexpanded for review\b/i,
    new RegExp(`\\b${backendResultVerb} profile\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} by\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} for\\b`, 'i'),
    new RegExp(`\\bsource result[^.]*${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bSource actions ${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} source\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} current\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} sources\\b`, 'i'),
    new RegExp(`\\bOpen the ${backendResultVerb} source\\b`, 'i'),
]

assert(profile.actorClass === 'State-linked espionage actor', 'APT29 actor class should be explicit.')
assert(profile.malwareTools.includes('SUNBURST'), 'APT29 should include SUNBURST tooling context.')
assert(profile.campaigns.some(item => /SolarWinds/i.test(item)), 'APT29 should include SolarWinds campaign context.')
assert(profile.campaignTimeline.some(item => /Microsoft disclosed/i.test(item.title) && item.firstReportedAt === '2024-01-25' && item.sourceIds.includes('microsoft') && item.provenanceRefs.length), 'APT29 should expose source-backed campaign timeline rows.')
assert(profile.campaignTimeline.every(item => item.title && item.firstReportedAt && item.confidence > 0 && item.freshness), 'Campaign timeline rows should carry date, confidence, and freshness state.')
assert(profile.indicators.some(item => /SUNBURST/i.test(item)), 'APT29 should expose indicator context.')
assert(profile.techniqueCoverage.some(item => item.attackId === 'T1078.004' && item.sourceIds.includes('microsoft') && item.missing.includes('captureId')), 'APT29 should expose source-backed technique coverage and capture gaps.')
assert(profile.techniqueCoverage.every(item => item.name && item.tactic && item.detail && item.provenanceRefs.length), 'Technique coverage should carry tactic, detail, and provenance context.')
assert(profile.targetSectors.some(item => /Government/i.test(item)), 'APT29 should include government targeting context.')
assert(profile.sourceProvenance.length >= 2, 'APT29 should expose source provenance.')
assert(profile.provenanceRows.some(item => item.sourceName === 'Microsoft' && item.reportDate === '2024-01-25' && item.shownBecause), 'APT29 should expose structured source/date/confidence provenance.')
assert(profile.provenanceRows.some(item => item.sourceRequestId === 'src_req_microsoft_2024_01' && item.parserStatus === 'partial' && item.lastCollectedAt === '2024-01-26'), 'Actor provenance should preserve source request and parser metadata from upstream enrichment.')
assert(profile.provenanceRows.every(item => item.sourceName && item.provenance && item.shownBecause), 'Every actor provenance row should explain why it is shown.')
assert(profile.sourceCoverage.totalRows >= profile.provenanceRows.length, 'APT29 source coverage should account for provenance rows.')
assert(profile.sourceCoverage.datedRows >= 1, 'APT29 source coverage should count dated provenance rows.')
assert(profile.sourceCoverage.sourceFamilies.some(item => item.family === 'vendor_disclosure'), 'APT29 source coverage should classify vendor disclosures.')
assert(profile.sourceCoverage.sourceFamilies.some(item => item.family === 'government_advisory'), 'APT29 source coverage should classify government advisories.')
assert(profile.sourceCoverage.stale, 'APT29 source coverage should require review when newest report evidence is stale.')
assert(profile.sourceCoverage.missing.includes('sourceProvenance[].captureId'), 'APT29 source coverage should expose missing capture references.')
assert(profile.freshness.stale, 'APT29 stale public evidence should be explicitly freshness-gated.')
assert(profile.confidenceReasoning.length >= 2, 'APT29 should expose confidence reasoning.')
assert(actionability.sourceProvenance.length >= 1, 'Actionability should expose backed provenance rows.')
assert(actionability.watchlist.payloads.some(item => item.value === 'Microsoft'), 'Actionability should carry watchlist relevance payloads.')
assert(actionability.watchlistRelevance.schemaVersion === 'ti.public_actor.watchlist_relevance.v1', 'Actionability should expose explicit watchlist relevance fields.')
assert(actionability.watchlistRelevance.terms.some(item => item.value === 'Microsoft'), 'Watchlist relevance should include backed candidate terms.')
assert(actionability.orgRelevance.actorIdentity.canonicalName === 'apt29', 'Org relevance should carry canonical actor identity.')
assert(actionability.orgRelevance.actorIdentity.aliases.includes('Midnight Blizzard'), 'Org relevance should carry actor aliases.')
assert(actionability.orgRelevance.actorIdentity.sectors.some(item => /Government/i.test(item)), 'Org relevance should carry source-backed sectors.')
assert(actionability.orgRelevance.actorIdentity.regions.includes('United States'), 'Org relevance should carry source-backed regions.')
assert(actionability.orgRelevance.sourceCoverage.some(item => item.sourceName === 'Microsoft' && item.sourceFamily === 'vendor_disclosure'), 'Org relevance should carry source family coverage.')
assert(actionability.orgRelevance.sourceCoverage.some(item => item.sourceRequestId === 'src_req_microsoft_2024_01' && item.parserStatus === 'partial' && item.lastCollectedAt === '2024-01-26'), 'Org relevance source coverage should preserve source request, parser, and collection metadata.')
assert(actionability.orgRelevance.sourceCoverage.some(item => item.status === 'missing_capture'), 'Org relevance should expose source coverage capture gaps.')
assert(actionability.orgRelevance.enrichmentGaps.some(item => item.code === 'stale_evidence'), 'Org relevance should expose stale evidence gaps.')
assert(actionability.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:stale_evidence:freshness.lastSeen'), 'Org relevance gaps should be visible as handoff rows.')
assert(actionability.sourceHealthQueue.schemaVersion === 'ti.public_actor.source_health_queue.v1', 'Source health queue should be a versioned actionability contract.')
assert(actionability.sourceHealthQueue.summary.total === actionability.sourceHealthQueue.rows.length, 'Source health queue summary should match the modeled rows.')
assert(actionability.sourceHealthQueue.rows.some(item => item.sourceRequestId === 'src_req_microsoft_2024_01' && item.parserStatus === 'partial' && item.sourceFamily === 'vendor_disclosure'), 'Source health queue should preserve source request, parser, and source family metadata.')
assert(actionability.sourceHealthQueue.rows.some(item => item.requestedFields.includes('sourceProvenance[].captureId')), 'Source health queue should expose capture enrichment requirements.')
assert(actionability.sourceEnrichmentIntake.schemaVersion === 'ti.public_actor.source_enrichment_intake.v1', 'Source enrichment intake should be a versioned actionability contract.')
assert(actionability.sourceEnrichmentIntake.summary.total === actionability.sourceEnrichmentIntake.items.length, 'Source enrichment intake summary should match intake items.')
assert(actionability.sourceEnrichmentIntake.items.some(item => item.sourceRequestId === 'src_req_microsoft_2024_01' && item.recommendedAction === 'track_source_request'), 'Source enrichment intake should preserve queued source request workflow.')
assert(actionability.sourceEnrichmentIntake.items.some(item => item.requestedFields.includes('sourceProvenance[].captureId') && item.blockedBy.some(blocker => blocker.code === 'missing_capture')), 'Source enrichment intake should carry capture blockers and requested fields.')
assert(actionability.actorEnrichmentCoverage.schemaVersion === 'ti.public_actor.actor_enrichment_coverage_export.v1', 'Actor enrichment coverage should expose a versioned public TI export.')
assert(actionability.actorEnrichmentCoverage.sourceContractSchemaVersion === 'ti.source_provenance_actor_enrichment_coverage_export.v1', 'Actor enrichment coverage should align to the source provenance coverage export contract.')
assert(actionability.actorEnrichmentCoverage.coverageRows.some(item => item.field === 'sourceProvenance' && item.blockerCodes.includes('coverage_pending')), 'Actor enrichment coverage should preserve source provenance coverage blockers.')
assert(actionability.actorEnrichmentCoverage.consumers.some(item => item.consumer === 'sourceOps' && item.route.path === '/dashboard/ti/enrichment'), 'Actor enrichment coverage should route source-owned coverage work to enrichment intake.')
assert(actionability.actorEnrichmentCoverage.safeOutput.liveNetworkScrapeStarted === false, 'Actor enrichment coverage export should be dry-run and safe for public TI.')
assert(actionability.actorEnrichmentConsumerReadiness.schemaVersion === 'ti.public_actor.actor_enrichment_consumer_readiness_receipt.v1', 'Actor enrichment consumer readiness should expose a versioned public TI receipt.')
assert(actionability.actorEnrichmentConsumerReadiness.sourceContractSchemaVersion === 'ti.source_provenance_actor_enrichment_consumer_readiness_receipt.v1', 'Actor enrichment consumer readiness should align to the source provenance receipt contract.')
assert(actionability.actorEnrichmentConsumerReadiness.rows.some(item => item.consumer === 'alertGeneration' && item.route === '/v1/dwm/alerts/rebuild'), 'Actor enrichment consumer readiness should expose alert-generation routing.')
assert(actionability.actorEnrichmentConsumerReadiness.rows.some(item => item.consumer === 'sourceOps' && item.state === 'action_required'), 'Actor enrichment consumer readiness should preserve source-ops action state.')
assert(actionability.actorEnrichmentConsumerReadiness.safeOutput.crossOrgDataIncluded === false && actionability.actorEnrichmentConsumerReadiness.safeOutput.liveNetworkScrapeStarted === false, 'Actor enrichment consumer readiness should remain safe and no-mutation.')
assert(actionability.alertGenerationReadiness.schemaVersion === 'ti.public_actor.alert_generation_readiness_export.v1', 'Public TI should expose a versioned alert-generation readiness export.')
assert(actionability.alertGenerationReadiness.sourceSchemaVersion === 'dwm.alert_generation_readiness.v1', 'Alert-generation readiness export should align to the DWM readiness contract.')
assert(actionability.alertGenerationReadiness.route === '/api/dwm/alerts/generation-readiness' && actionability.alertGenerationReadiness.sourceRoute === '/v1/dwm/alerts/generation-readiness', 'Alert-generation readiness should carry frontend and source readiness routes.')
assert(actionability.alertGenerationReadiness.candidateCount >= actionability.watchlistRelevance.terms.length, 'Alert-generation readiness should count watchlist candidates.')
assert(actionability.alertGenerationReadiness.blockers.some(item => item.code === 'missing_generation_evidence_window'), 'APT29 alert-generation readiness should stay blocked until capture evidence window exists.')
assert(actionability.alertGenerationReadiness.safeOutput.metadataOnly && !actionability.alertGenerationReadiness.safeOutput.liveNetworkFetch, 'Alert-generation readiness should be metadata-only and no-mutation.')
assert(actionability.caseReviewIntake.schemaVersion === 'ti.public_actor.case_review_intake.v1', 'Case review intake should be a versioned actionability contract.')
assert(actionability.caseReviewIntake.summary.total === actionability.caseReviewIntake.items.length, 'Case review intake summary should match intake items.')
assert(actionability.caseReviewIntake.items.some(item => item.blockedBy.some(blocker => blocker.code === 'missing_alert') && item.recommendedAction === 'attach_capture'), 'Case review intake should expose missing alert/capture workflow before case creation.')
assert(actionability.caseReviewIntake.items.every(item => item.evidenceRowId && item.reasons.length && item.sourceIds.length), 'Case review intake should preserve prioritized evidence reasons and source references.')
assert(actionability.caseReplayReadiness.schemaVersion === 'ti.public_actor.case_action_replay_readiness.v1', 'Case replay readiness should expose a versioned public TI contract.')
assert(actionability.caseReplayReadiness.sourceContractSchemaVersion === 'dwm.case_action_replay_export.v1', 'Case replay readiness should align to the backend replay export contract.')
assert(actionability.caseReplayReadiness.routeTemplate === '/v1/cases/:caseId/action-replay-export', 'Case replay readiness should preserve the backend route template.')
assert(actionability.caseReplayReadiness.rows.some(item => item.blockerCodes.includes('missing_case_route') && item.replayPlan.metadataOnly), 'Case replay readiness should block missing case routes without mutation.')
assert(actionability.caseReplayReadiness.safeOutput.metadataOnly && !actionability.caseReplayReadiness.safeOutput.liveMutation, 'Case replay readiness should remain metadata-only.')
assert(actionability.createAlertHandoff.kind === 'create_alert' && actionability.createAlertHandoff.endpoint === '/v1/dwm/alerts/rebuild', 'Actionability should expose explicit alert handoff fields.')
assert(actionability.createAlertHandoff.backedRoute === '/dashboard/dwm', 'Alert handoff should point to the backed DWM route even when blocked.')
assert(actionability.caseHandoff.kind === 'case' && actionability.caseHandoff.endpoint === '/v1/cases', 'Actionability should expose explicit case handoff fields.')
assert(actionability.caseHandoff.blocked && actionability.caseHandoff.missing.some(item => /DWM alert ID/i.test(item)), 'Blocked case handoff should expose missing alert dependency.')
assert(actionability.webhookDeliveryHandoff.kind === 'webhook_delivery' && actionability.webhookDeliveryHandoff.endpoint === '/v1/dwm/webhooks/deliver', 'Actionability should expose explicit webhook delivery fields.')
assert(actionability.webhookDeliveryHandoff.blocked && actionability.webhookDeliveryHandoff.missing.some(item => /webhook destination/i.test(item)), 'Blocked webhook delivery should expose missing destination dependency.')
assert(actionability.consumerReadiness.schemaVersion === 'ti.public_actor.consumer_readiness.v1', 'Actionability should expose consumer readiness for authenticated workflow lanes.')
assert(actionability.consumerReadiness.consumerSchemaVersion === 'hanasand.analyst_handoff.consumer.v1', 'Consumer readiness should align to the analyst handoff consumer schema.')
assert(actionability.consumerReadiness.stages.some(stage => stage.id === 'publicTi' && stage.request?.path === '/v1/dwm/watchlists'), 'Consumer readiness should include org watchlist create request shape.')
assert(actionability.consumerReadiness.stages.some(stage => stage.id === 'orgWatchlist' && stage.request?.path === '/v1/dwm/alerts/rebuild'), 'Consumer readiness should include alert rebuild request shape.')
assert(actionability.consumerReadiness.stages.some(stage => stage.id === 'caseHandoff' && stage.request?.path === '/v1/cases'), 'Consumer readiness should include case request shape.')
assert(actionability.consumerReadiness.stages.some(stage => stage.id === 'webhookTrigger' && stage.request?.path === '/v1/dwm/webhooks/deliver'), 'Consumer readiness should include webhook dry-run request shape.')
assert(actionability.consumerReadiness.blockers.some(blocker => blocker.code === 'missing_org'), 'Public APT29 readiness should keep org-required blockers explicit.')
assert(actionability.readiness.schemaVersion === 'ti.public_actor.readiness.v1', 'Public TI should expose backed readiness metadata.')
assert(actionability.readiness.state === 'degraded', 'APT29 public result should be usable but degraded until org/capture/alert/case/delivery data is attached.')
assert(actionability.readiness.blockers.some(blocker => blocker.code === 'missing_org' && blocker.ownerLane === 'org' && blocker.route === '/dashboard/dwm'), 'Readiness blockers should route missing org context to the org lane.')
assert(actionability.readiness.blockers.some(blocker => blocker.code === 'missing_capture' && blocker.ownerLane === 'source'), 'Readiness blockers should route missing capture evidence to source work.')
assert(actionability.readiness.blockers.some(blocker => blocker.code === 'missing_webhook_destination' && blocker.ownerLane === 'webhook'), 'Readiness blockers should route missing webhook destinations to webhook work.')
assert(actionability.readiness.blockers.some(blocker => blocker.code === 'stale_provenance' && blocker.ownerLane === 'public-ti'), 'Stale actor evidence should remain a public TI blocker.')
assert(actionability.actionPayloads.schemaVersion === 'ti.public_actor.action_payloads.v1', 'Public TI should expose versioned action exports.')
assert(actionability.actionPayloads.actorId === 'actor:apt29', 'Action exports should carry a stable actor id.')
assert(actionability.actionPayloads.payloads.watchlistAdd.schemaVersion === 'ti.public_actor.action_payload.v1', 'Watchlist action export should carry the action payload schema.')
assert(actionability.actionPayloads.payloads.watchlistAdd.query === 'apt29', 'Watchlist action export should carry the actor query.')
assert(actionability.actionPayloads.payloads.watchlistAdd.route === '/v1/dwm/watchlists', 'Watchlist action export should point to the backed watchlist route.')
assert(actionability.actionPayloads.payloads.watchlistAdd.unavailable, 'APT29 watchlist export should remain unavailable without org context and fresh evidence.')
assert(actionability.actionPayloads.payloads.watchlistAdd.blockedBy.some(blocker => blocker.ownerLane === 'org' && blocker.code === 'missing_org'), 'Watchlist action export should carry org-owned unavailable blockers.')
assert(JSON.stringify(actionability.actionPayloads.payloads.watchlistAdd.body).includes('microsoft'), 'Watchlist action export should include source ids and watch terms.')
assert(actionability.actionPayloads.payloads.caseHandoff.route === '/v1/cases', 'Case action export should point to the case route.')
assert(actionability.actionPayloads.payloads.caseHandoff.unavailable, 'APT29 case export should be unavailable until alert/case context exists.')
assert(actionability.actionPayloads.payloads.caseHandoff.blockedBy.some(blocker => blocker.code === 'missing_alert' && blocker.ownerLane === 'alert'), 'Case action export should carry alert-owned blockers.')
assert(JSON.stringify(actionability.actionPayloads.payloads.caseHandoff.body).includes('ti.public_actor.case_review_intake.v1'), 'Case action export should carry the modeled case review intake.')
assert(JSON.stringify(actionability.actionPayloads.payloads.caseHandoff.body).includes('ti.public_actor.case_action_replay_readiness.v1'), 'Case action export should carry case replay readiness.')
assert(actionability.actionPayloads.payloads.webhookDelivery.route === '/v1/dwm/webhooks/deliver', 'Webhook action export should point to the delivery route.')
assert(actionability.actionPayloads.payloads.webhookDelivery.blockedBy.some(blocker => blocker.code === 'missing_webhook_destination' && blocker.ownerLane === 'webhook'), 'Webhook action export should carry destination blockers.')
assert(actionability.actionPayloads.payloads.analystHandoffBundle.body.schemaVersion === 'hanasand.analyst_handoff.consumer.v1', 'Analyst bundle export should align to the authenticated consumer schema.')
assert(actionability.actionPayloads.payloads.sourceEnrichment.route === '/dashboard/ti/enrichment', 'Source enrichment action export should point to source enrichment work.')
assert(actionability.actionPayloads.payloads.sourceEnrichment.blockedBy.some(blocker => blocker.code === 'missing_capture' && blocker.ownerLane === 'source'), 'Source enrichment export should carry missing capture blockers.')
assert(JSON.stringify(actionability.actionPayloads.payloads.sourceEnrichment.body).includes('ti.public_actor.source_health_queue.v1'), 'Source enrichment export should carry the modeled source-health queue.')
assert(JSON.stringify(actionability.actionPayloads.payloads.sourceEnrichment.body).includes('ti.public_actor.source_enrichment_intake.v1'), 'Source enrichment export should carry the modeled source-enrichment intake.')
assert(actionability.enrichmentGapQueue.some(item => item.route === '/dashboard/dwm' && item.sourceFamily === 'alert' && item.requestedFields.includes('relatedAlerts[].id')), 'Enrichment gaps should carry route, source family, and requested fields.')
assert(actionability.exportPayloads.enrichment.backedRoute === '/dashboard/ti/enrichment', 'Enrichment package should point to the backed enrichment route.')
assert(actionability.alertDisposition === 'watchlist_required', 'APT29 fixture should not alert without a backed watchlist match or alert ID.')
assert(actionability.handoffs.caseBlockers.some(item => /DWM alert ID/i.test(item)), 'No-alert fixture should explain missing case dependency.')
assert(actionability.geographyHandoffs.some(item => item.code === 'US' && item.watchlistTerm?.value.includes('SolarWinds')), 'APT29 geography should map country observations to watchlist actions.')
assert(actionability.geographyHandoffs.some(item => item.code === 'US' && item.evidenceRows.some(row => row.sourceIds.includes('cisa') && row.reportDate === '2020' && row.confidence === 0.82)), 'APT29 geography should carry source IDs, report dates, and confidence for target observations.')
assert(fullPublicActionability.geographyHandoffs.some(item => item.code === 'DE' && item.evidenceRows.some(row => row.provenanceRefs.some(ref => /government SVR/i.test(ref)))), 'APT29 full public geography should carry provenance references for European government targeting.')
assert(actionability.geographyHandoffs.some(item => item.code === 'RU' && item.role === 'operator' && !item.watchlistTerm), 'Operator-origin geography should remain attribution/enrichment context, not an alert term.')
assert(actionability.geographyHandoffs.some(item => item.code === 'RU' && item.role === 'operator' && item.evidenceRows.some(row => row.sourceIds.includes('svr-attribution'))), 'Operator-origin geography should carry attribution provenance instead of becoming a target condition.')
assert(actionability.evidencePriority.length >= 1, 'APT29 should expose backed evidence priority rows.')
assert(actionability.evidencePriority.every(item => item.schemaVersion === 'ti.public_actor.evidence_priority.v1' && item.rowId && item.score >= 0 && item.score <= 100), 'Evidence priority rows should be versioned and bounded.')
assert(actionability.evidencePriority.some(item => item.watchlistTerms.length && item.sourceIds.length && item.reasons.some(reason => /capture|alert|watchlist/i.test(reason))), 'Evidence priority should explain watchlist/source/capture/alert readiness.')
assert(actionability.evidencePriority.some(item => item.state === 'review' && item.blockers.some(blocker => blocker.code === 'missing_capture' || blocker.code === 'stale_provenance')), 'APT29 priority should keep source/freshness blockers visible.')
assert(geo.points.some(item => item.code === 'RU' && item.role === 'operator'), 'APT29 map should include country-level operator attribution.')
assert(geo.points.some(item => item.code === 'US' && item.role === 'target'), 'APT29 map should include country-level target observations.')
assert(!geo.points.some(item => /europe|continent|global/i.test(item.label)), 'APT29 map should reject broad region buckets.')
assert(actionability.sourceClusters.some(item => item.watchlistTerm?.value === 'microsoft.com'), 'Source provenance should map source domains to watchlist action rows.')
assert(actionability.sourceClusters.some(item => /Attach capture ID/i.test(item.enrichmentTask)), 'Source provenance without capture IDs should create enrichment work.')
assert(actionability.exportPayloads.watchlist.schemaVersion === 'ti.public_actor.watchlist_handoff.v1', 'Watchlist handoff should be export-ready.')
assert(Array.isArray(actionability.exportPayloads.watchlist.body.terms), 'Watchlist handoff should carry terms for the product flow.')
assert(actionability.exportPayloads.watchlist.blocked, 'APT29 watchlist handoff should be blocked until org context is present.')
assert(actionability.exportPayloads.alertRebuild.endpoint === '/v1/dwm/alerts/rebuild', 'Alert rebuild handoff should target the backed alert rebuild route.')
assert(Array.isArray(actionability.exportPayloads.case.body.requiredBeforePost), 'Case handoff should expose dependencies before POST.')
assert(actionability.exportPayloads.webhookDelivery.schemaVersion === 'ti.public_actor.webhook_delivery_handoff.v1', 'Webhook delivery handoff should be export-ready.')
assert(Array.isArray(actionability.exportPayloads.webhookDelivery.body.requiredBeforePost), 'Webhook delivery should expose dependencies before POST.')
assert(actionability.exportPayloads.enrichment.schemaVersion === 'ti.public_actor.enrichment_queue.v1', 'Enrichment queue handoff should be shaped for source/capture work.')
assert(JSON.stringify(actionability.exportPayloads.enrichment.body).includes('capture'), 'Enrichment handoff should include capture/source work.')
assert(artifacts.some(item => item.kind === 'country' && item.label === 'United States' && item.watchlistTerms.some(term => /SolarWinds/i.test(term.value))), 'APT29 artifact workbench should turn geography into watchlist-relevant evidence.')
assert(artifacts.some(item => item.kind === 'country' && item.label === 'United States' && item.provenance.some(row => /source cisa/i.test(row)) && item.evidence.some(row => /2020/.test(row))), 'APT29 country artifacts should carry source IDs and report dates into the selected workbench.')
assert(artifacts.some(item => item.kind === 'tool' && item.label === 'SUNBURST'), 'APT29 artifact workbench should expose malware/tool artifacts.')
assert(artifacts.some(item => item.kind === 'campaign' && /SolarWinds/i.test(item.label)), 'APT29 artifact workbench should expose campaign artifacts.')
const usArtifact = artifacts.find(item => item.kind === 'country' && item.label === 'United States')
assert(usArtifact?.provenance.length, 'Selected artifact should expose provenance.')
const usHandoffs = usArtifact ? buildActorArtifactHandoffs(fixture, usArtifact, actionability) : null
assert(usHandoffs?.watchlist.body.selectedArtifact, 'Selected artifact watchlist handoff should carry selectedArtifact context.')
assert(JSON.stringify(usHandoffs?.case.body).includes('selectedArtifact'), 'Selected artifact case handoff should carry selectedArtifact context.')
assert(JSON.stringify(usHandoffs?.enrichment.body).includes('United States'), 'Selected artifact enrichment handoff should carry artifact-specific task context.')
assert(usArtifact?.readiness.state === 'stale', 'APT29 fixture should gate stale artifact evidence instead of claiming alert-ready status.')
assert(usHandoffs?.authBridge.schemaVersion === 'ti.public_actor.authenticated_bridge.v1', 'Selected artifact should export an authenticated bridge contract.')
assert(usHandoffs?.authBridge.orgRequired, 'Public artifact handoff should keep organization scope explicit.')
assert(usHandoffs?.authBridge.stale, 'Authenticated bridge should carry stale evidence state.')
assert(usHandoffs?.authBridge.links.watchlist.href.includes('/dashboard/dwm?handoff=public-ti'), 'Watchlist bridge should deep-link into the authenticated dashboard.')
assert(usHandoffs?.authBridge.links.watchlist.intent === PUBLIC_TI_HANDOFF_ACTIONS.watchlist, 'Watchlist bridge should use a stable action name.')
assert(usHandoffs?.authBridge.payload.schemaVersion === PUBLIC_TI_HANDOFF_SCHEMA_VERSION, 'Default bridge payload should carry the exported schema version.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].selectedPayload.route === 'case', 'Case bridge payload should select the case export payload.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].selectedPayload.route === 'alert_rebuild', 'Alert bridge payload should select the alert rebuild export payload.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].missing.some(item => /DWM alert ID/i.test(item)), 'Artifact case readiness should expose the alert dependency.')
assert(usHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].missing.some(item => /organization/i.test(item)), 'Artifact alert rebuild readiness should expose the organization dependency.')
const decodedWatchlist = usHandoffs ? decodePublicTiHandoffFromUrl(usHandoffs.authBridge.links.watchlist.href) : null
assert(decodedWatchlist?.ok, 'Watchlist deep-link payload should decode through the exported contract parser.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.artifact.label === 'United States', 'Deep-link payload should decode selected artifact context.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist, 'Decoded watchlist payload should preserve the action.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.orgRequired, 'Decoded APT29 payload should keep org-required blocker state.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequired, 'Decoded APT29 payload should keep source-required blocker state.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.stale, 'Decoded APT29 payload should keep stale-evidence blocker state.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.blockers.some(blocker => blocker.code === 'stale_evidence'), 'Decoded APT29 payload should carry stable blocker codes.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequests.some(source => source.missing.includes('captureId or source request ID')), 'Decoded APT29 payload should expose missing capture/source request IDs.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequests.every(source => source.ownerLane === 'source' && source.route === '/dashboard/ti/enrichment' && source.sourceFamily === 'source_capture'), 'Decoded APT29 source requests should carry source owner, route, and family.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.sourceRequests.some(source => source.requestedFields?.includes('sourceProvenance[].captureId') && source.requestedFields?.includes('sourceProvenance[].sourceRequestId')), 'Decoded APT29 source requests should carry requested source/capture fields.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.length === 4, 'Decoded APT29 payload should expose per-action readiness for watchlist, alert, case, and enrichment.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.some(item => item.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist && item.selected && item.ownerLane === 'org' && item.blockerCodes.includes('org_required')), 'Decoded APT29 watchlist readiness should carry selected action, org owner, and blocker code.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.some(item => item.action === PUBLIC_TI_HANDOFF_ACTIONS.case && item.endpoint === '/v1/cases' && item.blockerCodes.includes('stale_evidence')), 'Decoded APT29 case readiness should carry case endpoint and stale-evidence blocker.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.actionReadiness.every(item => typeof item.sourceRequestCount === 'number' && item.sourceRequestCount === decodedWatchlist.payload.sourceRequests.length), 'Decoded APT29 action readiness should carry source request counts for dashboard consumers.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.evidenceRefs?.captureIds.length === 0, 'Decoded APT29 payload should not invent capture IDs when source captures are missing.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.evidenceRefs?.watchlistTerms.some(term => term === 'company:Microsoft'), 'Decoded APT29 payload should carry selected watchlist terms as evidence refs.')
assert(decodedWatchlist?.ok && decodedWatchlist.payload.evidenceRefs?.endpoints.includes('/v1/cases'), 'Decoded APT29 payload should carry case endpoint refs for downstream consumers.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('selectedPayload'), 'Dashboard consumer contract should document selectedPayload.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('sourceRequests'), 'Dashboard consumer contract should document sourceRequests.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('sourceRequests[].requestedFields'), 'Dashboard consumer contract should document source request field metadata.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('actionReadiness'), 'Dashboard consumer contract should document actionReadiness.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('actionReadiness[].blockerCodes'), 'Dashboard consumer contract should document action readiness blocker codes.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('evidenceRefs.captureIds'), 'Dashboard consumer contract should document evidence capture refs.')
const legacyDecoded = usHandoffs ? decodePublicTiHandoffPayload(encodeHandoffPayload({
    artifact: usHandoffs.authBridge.payload.artifact,
    watchlist: usHandoffs.watchlist,
    alertRebuild: usHandoffs.alertRebuild,
    case: usHandoffs.case,
    enrichment: usHandoffs.enrichment,
}), 'watchlist') : null
assert(legacyDecoded?.ok && legacyDecoded.payload.action === PUBLIC_TI_HANDOFF_ACTIONS.watchlist, 'Legacy bridge payloads should migrate to the stable watchlist action.')
const missingPayload = decodePublicTiHandoffPayload(null)
assert(!missingPayload.ok && missingPayload.code === 'missing_payload', 'Decoder should return missing_payload for absent payloads.')
const malformedPayload = decodePublicTiHandoffPayload('%7Bbad', 'watchlist')
assert(!malformedPayload.ok && malformedPayload.code === 'malformed_json', 'Decoder should return malformed_json for bad JSON.')
assert(validatePublicTiHandoffPayload({ schemaVersion: PUBLIC_TI_HANDOFF_SCHEMA_VERSION, action: 'unknown', query: 'apt29', artifact: {} }).ok === false, 'Validator should reject unsupported actions.')
assert(validatePublicTiHandoffPayload({ schemaVersion: 'ti.public_actor.authenticated_bridge.v0', action: PUBLIC_TI_HANDOFF_ACTIONS.watchlist }).ok === false, 'Validator should reject unsupported schema versions.')
assert(JSON.parse(decodeURIComponent(encodeHandoffPayload({ artifactId: 'artifact:test' }))).artifactId === 'artifact:test', 'Handoff payload encoding should round-trip.')
assert(nextActorArtifactId(artifacts, artifacts[0]?.id, 'next') === artifacts[1]?.id, 'Keyboard helper should move to next artifact.')
assert(nextActorArtifactId(artifacts, artifacts[0]?.id, 'previous') === artifacts[artifacts.length - 1]?.id, 'Keyboard helper should wrap to previous artifact.')

const backed = buildTiActionability({
    ...fixture,
    query: 'apt29 microsoft',
    actionability: {
        ...fixture.actionability,
        alertDisposition: 'case_ready',
        shouldAlert: true,
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
            source: 'DWM alerts API',
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            dedupeKey: 'apt29:microsoft',
            recommendedRoute: 'analyst_review',
            captureIds: ['capture_1'],
            evidenceCount: 2,
            webhookDestinationIds: ['webhook_1'],
        }],
        relatedCases: [{
            id: 'case_1',
            title: 'Microsoft actor relevance',
            status: 'open',
            priority: 'high',
            path: '/v1/cases/case_1?alertId=dwm_alert_1',
        }],
        relatedWebhookDestinations: [{
            id: 'webhook_1',
            name: 'SOC incident intake',
            status: 'active',
            path: '/dashboard/dwm',
        }],
        sourceProvenance: [
            { sourceId: 'microsoft', sourceName: 'Microsoft', provenance: 'https://www.microsoft.com/en-us/security/blog/', confidence: 0.82, captureId: 'capture_1' },
        ],
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
assert(!backed.exportPayloads.case.blocked, 'Backed case export should be open when the case draft has no blockers.')
assert(backed.createAlertHandoff.ready, 'Backed alert handoff should be ready when watchlist context exists.')
assert(backed.caseHandoff.ready, 'Backed case handoff should be ready when the case draft has no blockers.')
assert(backed.caseHandoff.backedRoute === '/v1/cases/case_1?alertId=dwm_alert_1', 'Backed case handoff should preserve the open case route.')
assert(backed.webhookDeliveryHandoff.ready, 'Backed webhook delivery should be ready when alert, capture, and destination context exists.')
assert(backed.exportPayloads.webhookDelivery.body.alertId === 'dwm_alert_1', 'Backed webhook delivery should carry the DWM alert ID.')
assert(JSON.stringify(backed.exportPayloads.webhookDelivery.body).includes('webhook_1'), 'Backed webhook delivery should carry destination IDs.')
assert(backed.readiness.backedIds.organizationIds.includes('org_1'), 'Backed readiness should carry organization IDs.')
assert(backed.readiness.backedIds.watchlistIds.includes('watchlist_1'), 'Backed readiness should carry watchlist IDs.')
assert(backed.readiness.backedIds.alertIds.includes('dwm_alert_1'), 'Backed readiness should carry alert IDs.')
assert(backed.readiness.backedIds.casePaths.includes('/v1/cases/case_1?alertId=dwm_alert_1'), 'Backed readiness should carry case paths.')
assert(backed.readiness.backedIds.captureIds.includes('capture_1'), 'Backed readiness should carry capture IDs.')
assert(backed.readiness.backedIds.webhookDestinationIds.includes('webhook_1'), 'Backed readiness should carry webhook destination IDs.')
assert(backed.orgRelevance.watchlistIntersections.some(item =>
    item.value === 'Microsoft'
    && item.state === 'ready'
    && item.organizationId === 'org_1'
    && item.watchlistId === 'watchlist_1'
    && item.watchlistItemId === 'watch_1'
    && item.alertIds.includes('dwm_alert_1')
    && item.casePaths.includes('/v1/cases/case_1?alertId=dwm_alert_1')
    && item.captureIds.includes('capture_1')
    && item.webhookDestinationIds.includes('webhook_1')
    && item.recommendedAction === 'open_case'
), 'Backed org relevance should carry customer watchlist/source/alert/case intersections.')
assert(JSON.stringify(backed.actionPayloads.payloads.analystHandoffBundle.body).includes('watchlistIntersections'), 'Backed analyst handoff should export watchlist intersections.')
assert(backed.readiness.blockers.some(blocker => blocker.code === 'unavailable_contract' && blocker.ownerLane === 'entitlement'), 'Backed readiness should call out missing entitlement readiness when org context exists.')
assert(backed.consumerReadiness.ready, 'Backed consumer readiness should be ready when watchlist, alert, case, capture, and webhook context exist.')
assert(backed.consumerReadiness.stages.every(stage => stage.state === 'ready'), 'Backed consumer readiness stages should all be ready.')
assert(backed.consumerReadiness.bundlePreview.stages.orgWatchlist?.request?.body.watchlistId === 'watchlist_1', 'Consumer readiness should carry persisted watchlist ID for alert rebuild.')
assert(backed.consumerReadiness.bundlePreview.stages.webhookTrigger?.request?.body.idempotencyKey, 'Webhook consumer readiness should carry idempotency key.')
assert(backed.actionPayloads.payloads.watchlistAdd.body.backedIds && JSON.stringify(backed.actionPayloads.payloads.watchlistAdd.body.backedIds).includes('watchlist_1'), 'Backed watchlist action export should carry persisted watchlist IDs.')
assert(JSON.stringify(backed.actionPayloads.payloads.caseHandoff.body).includes('dwm_alert_1'), 'Backed case action export should carry related alert IDs.')
assert(JSON.stringify(backed.actionPayloads.payloads.webhookDelivery.body).includes('webhook_1'), 'Backed webhook action export should carry destination IDs.')
assert(backed.actionPayloads.payloads.webhookDelivery.blockedBy.some(blocker => blocker.code === 'unavailable_contract' && blocker.ownerLane === 'webhook'), 'Backed webhook action export should be honest when delivery readiness context is missing.')
assert(backed.actionPayloads.payloads.analystHandoffBundle.blockedBy.some(blocker => blocker.ownerLane === 'entitlement'), 'Backed analyst bundle should include entitlement-owned blockers when entitlement readiness is absent.')

const entitlementBlocked = buildTiActionability({
    ...fixture,
    query: 'apt29 entitlement blocked',
    actionability: {
        ...fixture.actionability,
        watchlistMatches: [{
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            watchlistId: 'watchlist_1',
            watchlistItemId: 'watch_1',
            kind: 'company',
            value: 'Microsoft',
        }],
        sourceProvenance: [
            { sourceId: 'microsoft', sourceName: 'Microsoft', provenance: 'https://www.microsoft.com/en-us/security/blog/', confidence: 0.82, captureId: 'capture_1' },
        ],
        relatedAlerts: [{
            id: 'dwm_alert_1',
            title: 'Microsoft actor relevance matched watchlist',
            status: 'pending_review',
            severity: 'high',
            tenantId: 'tenant_1',
            organizationId: 'org_1',
            captureIds: ['capture_1'],
            webhookDestinationIds: ['webhook_1'],
            deliveryReadinessContext: {
                schemaVersion: 'dwm.alert_delivery_persistence.v1',
                state: 'blocked',
                ready: false,
                blockerCodes: ['entitlement_denied'],
                selectedCaptureIds: ['capture_1'],
                webhookDestinationIds: ['webhook_1'],
                entitlement: { status: 'active', blockedReasons: ['alert_rebuilds_today'] },
            },
        }],
        relatedWebhookDestinations: [{ id: 'webhook_1', name: 'SOC incident intake', status: 'active' }],
        entitlementReadiness: {
            schemaVersion: 'dwm.entitlement_readiness.v1',
            actions: {
                alert_rebuild: {
                    ownerLane: 'alert-workflow',
                    status: 'blocked',
                    blockerCodes: ['alert_rebuilds_today'],
                    route: '/v1/dwm/alerts/rebuild',
                    dashboardText: 'This organization has reached the alert rebuild limit.',
                    helpdeskText: 'Raise the alert rebuild limit or retry after the daily window resets.',
                },
            },
        },
    },
}, profile, victims)
assert(entitlementBlocked.readiness.blockers.some(blocker => blocker.code === 'entitlement_blocked' && blocker.ownerLane === 'entitlement' && blocker.source === 'entitlement_readiness'), 'Entitlement readiness should surface entitlement-owned blockers.')
assert(entitlementBlocked.readiness.blockers.some(blocker => blocker.code === 'entitlement_blocked' && blocker.source === 'delivery_readiness'), 'Delivery readiness entitlement denials should be preserved.')

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
const quietArtifacts = buildActorArtifacts(quietFixture, quietProfile, [], quiet)
assert(!quiet.shouldAlert, 'Quiet actor should not be alertable.')
assert(quiet.relatedAlerts.length === 0 && quiet.relatedCases.length === 0, 'Quiet actor should honestly show no current alert or case.')
assert(quiet.watchlist.state === 'missing_terms', 'Quiet actor should expose missing watchlist terms.')
assert(quiet.watchlist.blockers.some(item => /Authenticated organization ID/i.test(item)), 'Quiet actor should explain missing org/auth context for watchlist actions.')
assert(quiet.exportPayloads.blockers.body.orgRequired === true, 'No-org actor path should export org-required blockers.')
assert(quiet.exportPayloads.watchlist.missing.some(item => /Authenticated organization ID/i.test(item)), 'No-org watchlist export should carry precise blocked dependency.')
assert(quiet.watchlistRelevance.state === 'missing_terms', 'Unknown actor should expose missing watchlist relevance without fake terms.')
assert(quiet.createAlertHandoff.blocked, 'Unknown actor should block alert handoff.')
assert(quiet.caseHandoff.blocked, 'Unknown actor should block case handoff.')
assert(quiet.webhookDeliveryHandoff.blocked, 'Unknown actor should block webhook delivery handoff.')
assert(!quiet.consumerReadiness.ready, 'Unknown actor should block consumer readiness.')
assert(quiet.consumerReadiness.blockers.some(blocker => blocker.code === 'missing_watchlist_term'), 'Unknown actor should expose missing watchlist term blocker.')
assert(quiet.readiness.state === 'blocked', 'Unknown actor should be blocked rather than fake-actionable.')
assert(quiet.readiness.blockers.some(blocker => blocker.code === 'missing_source_provenance' && blocker.ownerLane === 'source'), 'Unknown actor should expose missing source provenance owner.')
assert(quiet.readiness.blockers.some(blocker => blocker.code === 'missing_org_watchlist' && blocker.ownerLane === 'org'), 'Unknown actor should expose missing watchlist owner.')
assert(quiet.actionPayloads.actorId === 'actor:quiet-actor', 'Unknown actor action exports should still carry a stable actor id.')
assert(quiet.actionPayloads.payloads.watchlistAdd.unavailable, 'Unknown actor watchlist export should be unavailable rather than fake-actionable.')
assert(quiet.actionPayloads.payloads.watchlistAdd.blockedBy.some(blocker => blocker.ownerLane === 'org'), 'Unknown actor watchlist export should carry org-owned blockers.')
assert(quiet.actionPayloads.payloads.caseHandoff.blockedBy.some(blocker => blocker.ownerLane === 'alert'), 'Unknown actor case export should carry alert-owned blockers.')
assert(quiet.actionPayloads.payloads.sourceEnrichment.blockedBy.some(blocker => blocker.ownerLane === 'source'), 'Unknown actor source export should carry source-owned blockers.')
assert(quietArtifacts.length === 0, 'Sparse actor path should not invent selectable artifacts.')
assert(quietProfile.campaignTimeline.length === 0, 'Sparse actor should not invent campaign timeline rows.')
assert(quietProfile.techniqueCoverage.length === 0, 'Sparse actor should not invent technique coverage.')
assert(quietProfile.sourceCoverage.totalRows >= 1, 'Sparse actor should still summarize source coverage.')
assert(quietProfile.sourceCoverage.missing.includes('sourceProvenance[].captureId'), 'Sparse actor source coverage should expose missing capture references.')
assert(quiet.evidencePriority.some(item => item.rowId === 'collection-searching' && item.state === 'blocked'), 'Sparse actor should expose blocked evidence priority for collection rows.')
assert(quiet.evidencePriority.every(item => item.blockers.some(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'org' || blocker.ownerLane === 'alert')), 'Sparse priority rows should carry typed owner blockers.')
assert(nextActorArtifactId(quietArtifacts, undefined, 'next') === '', 'Keyboard helper should stay empty for sparse actor artifacts.')
for (const phrase of bannedUiCopy) {
    assert(!pageClientSource.toLowerCase().includes(phrase), `Public TI page should not render prompt-shaped/internal copy: ${phrase}.`)
}
for (const token of brightDarkSurfaceTokens) {
    assert(!pageClientSource.includes(token), `Public TI dense dark surfaces should not use bright dark-mode token: ${token}.`)
}
for (const phrase of publicTiImplementationPhrases) {
    assert(!pageClientSource.includes(phrase), `Public TI page should not expose implementation wording: ${phrase}.`)
    assert(!actorIntelligenceSource.includes(phrase), `Public TI actor intelligence fallbacks should not expose implementation wording: ${phrase}.`)
}
for (const pattern of publicTiBackendEmptyStatePatterns) {
    assert(!pattern.test(pageClientSource), `Public TI empty states should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actorIntelligenceSource), `Public TI actor intelligence should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actionabilitySource), `Public TI actionability should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actorProfileSource), `Public TI actor geography should not expose backend-shaped copy: ${pattern}.`)
    assert(!pattern.test(actorWorkbenchSource), `Public TI actor workbench should not expose backend-shaped copy: ${pattern}.`)
}
for (const [label, source] of [
    ['page client', pageClientSource],
    ['actor intelligence', actorIntelligenceSource],
    ['actionability', actionabilitySource],
    ['actor profile', actorProfileSource],
    ['actor workbench', actorWorkbenchSource],
    ['api search fallback', apiSearchSource],
] as const) {
    const legacySourceWording = new RegExp(`\\bsource ${'basis'}\\b`, 'i')
    assert(!legacySourceWording.test(source), `Public TI ${label} should use evidence-strength language instead of legacy source wording.`)
}
assert(pageClientSource.includes('Console actions'), 'Public TI page should use professional console action language.')
assert(pageClientSource.includes('Decision flow'), 'Public TI page should expose a compact decision flow.')
assert(pageClientSource.includes('Review status'), 'Public TI page should expose consumer-ready workflow state.')
assert(pageClientSource.includes('data-ti-consumer-readiness'), 'Public TI page should expose consumer readiness rows for render checks.')
assert(pageClientSource.includes('data-ti-consumer-field-readiness'), 'Public TI consumer readiness should expose required field readiness chips.')
assert(pageClientSource.includes('{stage.request.method} {consumerRequestPathLabel(stage.request.path)}'), 'Public TI consumer readiness should show backed request method and an analyst-safe route label.')
assert(pageClientSource.includes('org alert state'), 'Public TI consumer route labels should avoid raw internal endpoint wording.')
assert(pageClientSource.includes('{stage.payload.provenance.length} source reference'), 'Public TI consumer readiness should show stage source-reference counts.')
assert(pageClientSource.includes('idempotencyKey'), 'Public TI webhook readiness should show delivery idempotency readiness.')
assert(pageClientSource.includes('watchlistItemIds'), 'Public TI alert readiness should show persisted watchlist item readiness.')
assert(pageClientSource.includes('data-ti-handoff-evidence-matrix'), 'Public TI page should expose handoff evidence for backed action review.')
assert(pageClientSource.includes('Review evidence'), 'Public TI page should label backed action evidence in analyst language.')
assert(pageClientSource.includes('data-ti-source-activation'), 'Public TI page should expose source activation review actions when available.')
assert(pageClientSource.includes('Source Activation'), 'Public TI page should label source activation review in analyst language.')
assert(pageClientSource.includes('Action exports'), 'Public TI page should expose validated action exports.')
assert(pageClientSource.includes('Action packages for authenticated review'), 'Public TI page should explain copy-only action exports professionally.')
assert(pageClientSource.includes('data-ti-action-export-summary'), 'Public TI action exports should expose compact operational summaries.')
assert(pageClientSource.includes('actionability.alertGenerationReadiness.candidateCount'), 'Public TI action exports should summarize alert-generation readiness.')
assert(pageClientSource.includes('evidence window pending'), 'Public TI action exports should show evidence-window readiness without internal wording.')
assert(pageClientSource.includes('ti.public_actor.selected_alert_action_plan.v1'), 'Selected evidence should export a versioned alert action plan.')
assert(pageClientSource.includes('data-ti-selected-alert-action-plan'), 'Selected evidence should render a stable alert action plan hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Alert action plan\''), 'Selected alert plan should expose a copyable request packet.')
assert(pageClientSource.includes('selectedAlertActionPlanFor(result, selected, actionability'), 'Selected alert plan should consume selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.alertGenerationReadiness.readyForCustomerDelivery'), 'Selected alert plan should preserve alert readiness state.')
assert(pageClientSource.includes('data-ti-selected-alert-evidence'), 'Selected alert plan should render source-backed alert evidence rows.')
assert(pageClientSource.includes('data-ti-selected-alert-replay'), 'Selected alert plan should render case replay readiness rows.')
assert(pageClientSource.includes('actionability.orgRelevance.handoffRows.filter'), 'Selected alert plan should consume org relevance handoff rows.')
assert(pageClientSource.includes('actionability.caseReplayReadiness.rows.filter'), 'Selected alert plan should consume case replay readiness rows.')
assert(pageClientSource.includes('evidenceRows: activeAlertHandoffRows.slice'), 'Selected alert plan should preserve alert evidence rows in the export.')
assert(pageClientSource.includes('replayRows: activeReplayRows.slice'), 'Selected alert plan should preserve replay linkage in the export.')
assert(pageClientSource.includes('ti.public_actor.selected_delivery_readiness.v1'), 'Selected evidence should export a versioned delivery readiness packet.')
assert(pageClientSource.includes('data-ti-selected-delivery-readiness'), 'Selected evidence should render a stable delivery readiness hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Delivery status\''), 'Selected delivery readiness should expose a copyable packet.')
assert(pageClientSource.includes('selectedDeliveryReadinessPlanFor(result, selected, actionability'), 'Selected delivery readiness should be built from selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.webhookDeliveryHandoff.ready'), 'Selected delivery readiness should preserve webhook delivery readiness.')
assert(pageClientSource.includes('actionability.consumerReadiness.stages.find(stage => stage.id === \'webhookTrigger\')'), 'Selected delivery readiness should consume authenticated delivery stage readiness.')
assert(pageClientSource.includes('alert.deliveryReadinessContext'), 'Selected delivery readiness should consume alert delivery persistence context.')
assert(pageClientSource.includes('ti.public_actor.selected_watchlist_plan.v1'), 'Selected evidence should export a versioned watchlist plan.')
assert(pageClientSource.includes('data-ti-selected-watchlist-plan'), 'Selected evidence should render a stable watchlist plan hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Watchlist plan\''), 'Selected watchlist plan should expose a copyable request packet.')
assert(pageClientSource.includes('selectedWatchlistPlanFor(result, selected, actionability'), 'Selected watchlist plan should consume selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.orgRelevance.watchlistIntersections.filter'), 'Selected watchlist plan should consume org watchlist intersections.')
assert(pageClientSource.includes('data-ti-selected-watchlist-relevance'), 'Selected watchlist plan should render selected relevance rows.')
assert(pageClientSource.includes('data-ti-selected-watchlist-evidence'), 'Selected watchlist plan should render source-backed evidence rows.')
assert(pageClientSource.includes('data-ti-selected-watchlist-handoff-rows'), 'Selected watchlist plan should render org/source/case handoff rows.')
assert(pageClientSource.includes('actionability.orgRelevance.handoffRows.filter'), 'Selected watchlist plan should consume org relevance handoff rows.')
assert(pageClientSource.includes('evidenceRows: sourceEvidence.slice'), 'Selected watchlist plan should preserve source evidence metadata.')
assert(pageClientSource.includes('blockerOwners'), 'Selected watchlist plan should preserve responsible blocker owners.')
assert(pageClientSource.includes('readinessOwnerLabel(item.ownerLane)'), 'Selected watchlist handoff rows should render owner lanes in analyst language.')
assert(pageClientSource.includes('actionability.orgRelevance.candidateTerms.filter'), 'Selected watchlist relevance should consume candidate terms.')
assert(pageClientSource.includes('fit: term.matched ? \'matched\''), 'Selected watchlist relevance should distinguish matched, near, and blocked terms.')
assert(pageClientSource.includes('alertable'), 'Selected watchlist relevance should expose alertability state.')
assert(pageClientSource.includes('source.supportsTerms'), 'Selected watchlist relevance should tie rows to source-supported terms.')
assert(pageClientSource.includes('actionability.exportPayloads.watchlist'), 'Selected watchlist plan should preserve backed watchlist handoff state.')
assert(pageClientSource.includes('ti.public_actor.selected_enrichment_triage.v1'), 'Selected evidence should export a versioned enrichment triage packet.')
assert(pageClientSource.includes('data-ti-selected-enrichment-triage'), 'Selected evidence should render a stable enrichment triage hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Review packet\''), 'Selected enrichment triage should expose a copyable packet.')
assert(pageClientSource.includes('selectedEnrichmentTriageFor(result, selected, actionability'), 'Selected enrichment triage should consume selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.sourceHealthQueue.rows.filter'), 'Selected enrichment triage should consume source health rows.')
assert(pageClientSource.includes('actionability.sourceEnrichmentIntake.items.filter'), 'Selected enrichment triage should consume source enrichment intake items.')
assert(pageClientSource.includes('actionability.caseReviewIntake.summary.total'), 'Case action exports should summarize case review intake.')
assert(pageClientSource.includes('actionability.sourceEnrichmentIntake.summary.total'), 'Source action exports should summarize source enrichment intake.')
assert(pageClientSource.includes('data-ti-actor-summary-grid'), 'Actor overview should render a compact summary grid instead of a dense status table.')
assert(pageClientSource.includes('ActorSummaryFact'), 'Actor overview should use reusable summary facts for type, targets, methods, and source coverage.')
assert(!pageClientSource.includes('sourceHealthChipClass(row.tone)'), 'Actor overview should not attach a status chip to every summary row.')
assert(pageClientSource.includes('data-ti-section-rail'), 'Public TI page should expose a section rail for analyst scanning.')
assert(pageClientSource.includes('id=\'ti-selected-evidence\''), 'Public TI page should render one primary selected-evidence detail surface.')
assert(!pageClientSource.includes('data-ti-top-selected-evidence'), 'Public TI page should not duplicate selected evidence in the hero.')
assert(!pageClientSource.includes('TopSelectedEvidencePanel'), 'Public TI page should not keep a duplicate selected-evidence hero component.')
assert(pageClientSource.includes('filteredWorkItems.slice(0, 3)'), 'Public TI default queue should stay capped to three rows before expansion.')
assert(!pageClientSource.includes('TopEvidenceQueuePreview'), 'Public TI hero should not duplicate the activity queue beside selected detail.')
assert(pageClientSource.includes('text-white transition hover:bg-ui-raised'), 'Public TI search submit should render visible text on the dark button.')
assert(pageClientSource.includes('data-ti-actor-workspace-rail'), 'Public TI should render the selected evidence/action rail in the first viewport.')
assert(pageClientSource.includes('data-ti-desktop-action-first-grid'), 'Public TI desktop first viewport should use an action-first grid instead of summary-card whitespace.')
assert(pageClientSource.includes('data-ti-compact-actor-fact-bar'), 'Public TI first viewport should keep actor facts compact instead of card-like summary blocks.')
assert(pageClientSource.includes('2xl:grid-cols-[minmax(260px,0.5fr)_minmax(680px,1.25fr)_minmax(220px,0.35fr)]'), 'Public TI desktop grid should give selected evidence/actions the primary width and keep geography narrow.')
assert(pageClientSource.includes('data-ti-selected-action-rail'), 'Public TI should keep selected evidence actions primary in the first viewport.')
assert(pageClientSource.includes('ContinuityRow'), 'Public TI selected action rail should render compact continuity rows instead of nested metric cards.')
assert(pageClientSource.includes('data-ti-auth-continuity-refs'), 'Public TI selected action rail should expose authenticated continuity refs for captures, alerts, cases, watchlist, and destinations.')
assert(pageClientSource.includes('selectedContinuityRefs'), 'Public TI selected action rail should derive authenticated continuity refs from selected watchlist/alert/case/delivery plans.')
assert(pageClientSource.includes('ContinuityRefChip'), 'Public TI selected action rail should make backed continuity refs directly actionable.')
assert(pageClientSource.includes('if (refItem.href) return <a href={refItem.href}'), 'Public TI continuity refs should link to authenticated routes when backed routes exist.')
assert(pageClientSource.includes('captureCount === 0'), 'Public TI selected action rail should surface missing capture evidence instead of only candidate counters.')
assert(pageClientSource.includes('data-ti-continuity-gaps=\'true\''), 'Public TI selected action rail should expose compact handoff gaps in the first viewport.')
assert(pageClientSource.includes('selectedContinuityGaps'), 'Public TI selected action rail should derive handoff gaps from selected source/watchlist/alert/case/delivery state.')
assert(pageClientSource.includes('shortContinuityGap'), 'Public TI selected handoff gaps should be compacted into analyst-native labels.')
assert(pageClientSource.includes('Missing links'), 'Public TI selected action rail should use analyst-facing missing-link copy.')
assert(pageClientSource.includes('alert reviews'), 'Public TI alert counters should read as review workflow state.')
assert(pageClientSource.includes('case reviews'), 'Public TI case counters should read as review workflow state.')
assert(pageClientSource.includes('data-ti-geo-subordinate'), 'Public TI should keep geography subordinate to selected evidence and actions.')
assert(pageClientSource.indexOf('<SelectedEvidenceRail') < pageClientSource.indexOf('data-ti-geo-subordinate'), 'Public TI should keep selected actions before geography.')
assert(pageClientSource.includes('sourceRows = compact ? []'), 'Compact geography fallback should not stack source cards in the first viewport.')
assert(pageClientSource.includes('MapCoverageFallback regions={regionalAreas} actor={actor} actionability={actionability} compact={compact}'), 'Geography fallback should respect compact first-viewport rendering.')
assert(pageClientSource.includes('label: \'Alert context\''), 'Public TI top stats should show alert context instead of dead related-alert counters.')
assert(!pageClientSource.includes('label: \'Related alerts\''), 'Public TI top stats should not render a dead related-alerts zero counter.')
assert(pageClientSource.includes('capture evidence needed'), 'Actor source coverage should turn missing captures into an operational source requirement.')
assert(pageClientSource.includes('alert candidates'), 'Public TI alert summaries should show candidate workflow state when no alert is linked.')
assert(pageClientSource.includes('case candidates'), 'Public TI case summaries should show case candidate workflow state when no case is linked.')
assert(pageClientSource.includes('data-ti-selected-console-links'), 'Public TI action strip should expose selected evidence links into authenticated workflows.')
assert(pageClientSource.includes('data-ti-mobile-console-links'), 'Public TI mobile workbar should expose selected evidence links into authenticated workflows.')
assert(pageClientSource.includes('selectedConsoleLinksFor(result, selected'), 'Public TI selected action links should be derived from the selected evidence context.')
assert(pageClientSource.includes('selectedArtifactHandoffs'), 'Public TI authenticated action links should carry selected artifact handoff payloads.')
assert(pageClientSource.includes('compactPublicTiHandoffPayload(payload)'), 'Public TI authenticated action links should compact rich payloads before putting them in the URL.')
assert(pageClientSource.includes('encodeHandoffPayload(urlPayload)'), 'Public TI authenticated action links should preserve the versioned handoff payload.')
assert(pageClientSource.includes('search.set(\'intent\', payload.action)'), 'Public TI authenticated action links should preserve the selected handoff intent.')
assert(pageClientSource.includes('authenticatedPublicTiHref'), 'Public TI authenticated action links should preserve handoff query context.')
assert(pageClientSource.includes('search.set(\'handoff\', \'public-ti\')'), 'Public TI authenticated action links should identify public TI handoff context.')
assert(dashboardWorkbenchPageSource.includes('decodePublicTiHandoffPayload'), 'Authenticated TI workbench should decode public TI handoff payloads from the route.')
assert(dashboardWorkbenchPageSource.includes('buildPublicTiHandoffCase'), 'Authenticated TI workbench should materialize public TI handoff payloads as selected workbench items.')
assert(dashboardWorkbenchPageSource.includes('initialSelectedId={initialSelectedId}'), 'Authenticated TI workbench should select the public TI handoff item when opened from the public page.')
assert(operatorConsoleModelSource.includes('actionReadiness: payload.actionReadiness'), 'Public TI handoff receiver should preserve action readiness for authenticated action rails.')
assert(pageClientSource.includes('SelectedEvidenceContextTable'), 'Selected evidence should keep the dense source context table in the primary detail surface.')
assert(pageClientSource.includes('data-ti-actions'), 'Selected evidence should keep the backed action rail in the primary detail surface.')
assert(pageClientSource.includes('selectedCaseOwnership'), 'Selected evidence should preserve case ownership context for backed actions.')
assert(pageClientSource.includes('Evidence ordered by severity, source strength, and recency.'), 'Public TI activity queue should explain backed ordering.')
assert(pageClientSource.includes('Matched watchlists'), 'Public TI evidence fit should show matched organization watchlists when present.')
assert(pageClientSource.includes('Open console'), 'Public TI page should route analysts to the authenticated console without internal lane names.')
assert(pageClientSource.includes('Case handoff'), 'Public TI page should summarize case handoff state instead of dumping raw JSON.')
assert(pageClientSource.includes('data-ti-related-record-export'), 'Related alert/case rows should expose row-level handoff exports.')
assert(pageClientSource.includes('ti.public_actor.related_record_handoff.v1'), 'Related alert/case rows should export versioned handoff payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Related record\''), 'Related alert/case rows should expose copyable record payloads.')
assert(pageClientSource.includes('relatedRecordHandoffPayloadFor(record, actionability, query)'), 'Related record exports should preserve actionability, provenance, and readiness state.')
assert(pageClientSource.includes('data-ti-case-review-intake'), 'Related alert/case empty state should expose case review intake candidates.')
assert(pageClientSource.includes('actionability.caseReviewIntake.summary.total'), 'Related alert/case rail should summarize case review candidates.')
assert(pageClientSource.includes('actionability.caseReplayReadiness.summary.ready'), 'Related alert/case rail should summarize case replay readiness.')
assert(pageClientSource.includes('data-ti-case-replay-readiness'), 'Related alert/case rail should expose a stable render hook for case replay readiness.')
assert(pageClientSource.includes('ti.public_actor.case_review_candidate.v1'), 'Case review intake should export row-level case candidate payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Case candidate\''), 'Case review intake should expose copyable case candidate payloads.')
assert(pageClientSource.includes('caseReviewCandidatePayloadFor(item, query)'), 'Case candidate exports should preserve query and evidence row context.')
assert(pageClientSource.includes('ti.public_actor.case_replay_candidate_export.v1'), 'Case review intake should export versioned replay candidate payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Replay export\''), 'Case review intake should expose copyable replay exports.')
assert(pageClientSource.includes('caseReplayCandidatePayloadFor(item, actionability)'), 'Replay candidate exports should preserve actionability and case replay state.')
assert(pageClientSource.includes('ti.public_actor.case_action_trail.v1'), 'Selected review should export a versioned case action trail.')
assert(pageClientSource.includes('data-ti-case-action-trail'), 'Selected review should render a stable case action trail hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Case action trail\''), 'Selected review should expose a copyable case action trail.')
assert(pageClientSource.includes('selectedCaseActionTrailFor(result, selected, actionability'), 'Case action trail should be built from the selected evidence and backed actionability state.')
assert(pageClientSource.includes('caseReplayReadiness.rows'), 'Case action trail should consume case replay readiness rows.')
assert(pageClientSource.includes('ti.public_actor.selected_case_ownership.v1'), 'Selected review should export a versioned case ownership packet.')
assert(pageClientSource.includes('data-ti-selected-case-ownership'), 'Selected review should render a stable case ownership hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Case ownership\''), 'Selected case ownership should expose a copyable packet.')
assert(pageClientSource.includes('selectedCaseOwnershipFor(result, selected, actionability'), 'Selected case ownership should be built from selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.caseReviewIntake.items.filter'), 'Selected case ownership should consume case review intake rows.')
assert(pageClientSource.includes('actionability.caseReplayReadiness.rows.filter'), 'Selected case ownership should consume case replay readiness rows.')
assert(pageClientSource.includes('actionability.consumerReadiness.stages.find(stage => stage.id === \'caseHandoff\')'), 'Selected case ownership should consume authenticated case handoff readiness.')
assert(pageClientSource.includes('actionability.relatedAlerts.filter'), 'Selected case ownership should preserve related alert refs.')
assert(pageClientSource.includes('actionability.relatedCases.filter'), 'Selected case ownership should preserve related case refs.')
assert(pageClientSource.includes('ti.public_actor.selected_case_create_request.v1'), 'Selected evidence should export a versioned case create request.')
assert(pageClientSource.includes('data-ti-selected-case-create-request'), 'Selected evidence should render a stable case create request hook.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Case create request\''), 'Selected case create request should expose a copyable request.')
assert(pageClientSource.includes('selectedCaseCreateRequestFor(result, selected, actorIntel, actionability'), 'Selected case create request should consume selected evidence, actor intelligence, and backed actionability state.')
assert(pageClientSource.includes('actionability.actionPayloads.payloads.caseHandoff'), 'Selected case create request should preserve the backed case handoff request body.')
assert(pageClientSource.includes('caseStage?.request?.path ?? actionability.caseHandoff.endpoint'), 'Selected case create request should preserve the authenticated case route.')
assert(pageClientSource.includes('data-ti-selected-case-create-readiness'), 'Selected case create request should render case review and replay readiness rows.')
assert(pageClientSource.includes('actionability.caseReviewIntake.items.filter'), 'Selected case create request should consume case review intake rows.')
assert(pageClientSource.includes('actionability.caseReplayReadiness.rows.find'), 'Selected case create request should consume case replay readiness rows.')
assert(pageClientSource.includes('caseReviewRows,'), 'Selected case create request should preserve case review rows in the exported request.')
assert(pageClientSource.includes('readinessOwnerLabel(row.ownerLane)'), 'Selected case create request should show the responsible owner lane.')
assert(pageClientSource.includes('row.replay.exportRoute'), 'Selected case create request should expose replay export routes when available.')
assert(pageClientSource.includes('reportDate: row.reportDate'), 'Selected case create request should preserve source report dates for provenance.')
assert(pageClientSource.includes('SelectedCaseSourceRow'), 'Selected case create request should use a typed source provenance row.')
assert(pageClientSource.includes('caseSourceRowFor'), 'Selected case create request should normalize source evidence rows before export.')
assert(pageClientSource.includes('stableEvidenceFingerprint'), 'Selected case create request should attach stable provenance fingerprints for downstream case review.')
assert(pageClientSource.includes('provenanceRefs: row.provenanceRefs'), 'Selected case draft should preserve source provenance reference IDs.')
assert(pageClientSource.includes('provenanceFingerprint: row.provenanceFingerprint'), 'Selected case draft should preserve source provenance fingerprints.')
assert(pageClientSource.includes('data-ti-selected-case-provenance-fingerprints'), 'Selected case create request should render provenance fingerprint proof.')
assert(pageClientSource.includes('provenanceFingerprints: unique(['), 'Selected case create request should export dedupe fingerprints at request level.')
assert(pageClientSource.includes('selectedCaseWatchlistBasisFor'), 'Selected case create request should include selected watchlist relevance context.')
assert(pageClientSource.includes('data-ti-selected-case-watchlist-basis'), 'Selected case create request should render watchlist basis and replay linkage.')
assert(pageClientSource.includes('watchlistBasis,'), 'Selected case create request should export watchlist basis in the request body.')
assert(pageClientSource.includes('actionReplay,'), 'Selected case create request should export case action replay linkage in the request body.')
assert(pageClientSource.includes('request.actionReplay.rows.filter(row => row.ready)'), 'Selected case create request should show replay-ready row counts.')
assert(pageClientSource.includes('request.watchlistBasis.matchReason'), 'Selected case create request should show why selected evidence belongs to watchlist or case review.')
assert(pageClientSource.includes('selectedCaseActorContextFor'), 'Selected case create request should include actor intelligence context.')
assert(pageClientSource.includes('data-ti-selected-case-actor-context'), 'Selected case create request should render actor context for case review.')
assert(pageClientSource.includes('actorContext,'), 'Selected case create request should export actor context in the request body.')
assert(pageClientSource.includes('actor.techniqueCoverage.slice'), 'Selected case actor context should preserve technique coverage rows.')
assert(pageClientSource.includes('actor.campaignTimeline.slice'), 'Selected case actor context should preserve campaign timeline rows.')
assert(pageClientSource.includes('actionability.enrichmentGapQueue.slice'), 'Selected case actor context should preserve enrichment gaps.')
assert(pageClientSource.includes('request.actorContext.sourceCoverage.totalRows'), 'Selected case actor context should show source coverage in the UI.')
assert(pageClientSource.includes('data-ti-source-coverage'), 'Public TI dossier should expose source coverage for render checks.')
assert(pageClientSource.includes('Source coverage'), 'Public TI dossier should summarize source coverage.')
assert(pageClientSource.includes('data-ti-provenance-artifact-export'), 'Public TI provenance rows should expose stable artifact export hooks.')
assert(pageClientSource.includes('ti.public_actor.provenance_artifact.v1'), 'Public TI provenance rows should export versioned source artifacts.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Provenance artifact\''), 'Public TI provenance rows should expose copyable source artifacts.')
assert(pageClientSource.includes('provenanceArtifactPayloadFor(row, actor, actionability, query)'), 'Provenance artifacts should preserve actor, actionability, and query context.')
assert(pageClientSource.includes('watchlistIntersections'), 'Provenance artifacts should carry watchlist relevance intersections when available.')
assert(pageClientSource.includes('sourceEnrichmentIntake: {'), 'Provenance artifacts should carry source enrichment intake state.')
assert(pageClientSource.includes('data-ti-freshness-gate'), 'Public TI dossier should expose source and handoff status for render checks.')
assert(pageClientSource.includes('Evidence status'), 'Public TI dossier should label source status in analyst language.')
assert(pageClientSource.includes('ti.public_actor.freshness_review.v1'), 'Evidence status should export a versioned source freshness review payload.')
assert(pageClientSource.includes('data-ti-freshness-review-export'), 'Evidence status should expose a stable render hook for the review export.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Freshness review\''), 'Evidence status should expose copyable source freshness review packets.')
assert(pageClientSource.includes('freshnessReviewPayloadFor(actor, actionability, query'), 'Freshness exports should preserve actor, actionability, and query context.')
assert(pageClientSource.includes('sourceEnrichmentIntake: {'), 'Freshness exports should carry source enrichment intake state.')
assert(pageClientSource.includes('sourceHealthQueue: {'), 'Freshness exports should carry source health queue state.')
assert(pageClientSource.includes('data-ti-technique-coverage'), 'Public TI dossier should expose technique coverage for render checks.')
assert(pageClientSource.includes('data-ti-technique-coverage-export'), 'Technique coverage rows should expose backed activity exports for render checks.')
assert(pageClientSource.includes('ti.public_actor.technique_coverage.v1'), 'Technique coverage rows should export versioned technique payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Technique coverage\''), 'Technique coverage rows should expose copyable technique payloads.')
assert(pageClientSource.includes('techniqueCoveragePayloadFor(item)'), 'Technique coverage exports should preserve ATT&CK, provenance, freshness, source refs, capture refs, and blockers.')
assert(pageClientSource.includes('data-ti-campaign-timeline'), 'Public TI dossier should expose campaign timeline for render checks.')
assert(pageClientSource.includes('data-ti-campaign-activity-export'), 'Campaign timeline rows should expose backed activity exports for render checks.')
assert(pageClientSource.includes('ti.public_actor.campaign_activity.v1'), 'Campaign timeline rows should export versioned activity payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Campaign activity\''), 'Campaign timeline rows should expose copyable campaign activity payloads.')
assert(pageClientSource.includes('campaignActivityPayloadFor(item)'), 'Campaign timeline exports should preserve provenance, freshness, sectors, countries, and blockers.')
assert(pageClientSource.includes('attach_to_case_review'), 'Campaign timeline payloads should be shaped for case review when evidence is complete.')
assert(pageClientSource.includes('source question'), 'Public TI enrichment statuses should use source-question language instead of implementation labels.')
assert(pageClientSource.includes('Review status'), 'Public TI page should expose backed readiness and degraded states in plain language.')
assert(pageClientSource.includes('Linked records, follow-up fields, and next action'), 'Public TI page should describe backed status without prompt-shaped language.')
assert(pageClientSource.includes('data-ti-org-actor-identity'), 'Public TI org relevance should render actor identity fields.')
assert(pageClientSource.includes('data-ti-org-source-coverage'), 'Public TI org relevance should render source coverage fields.')
assert(pageClientSource.includes('data-ti-watchlist-intersections'), 'Public TI org relevance should render customer watchlist intersections.')
assert(pageClientSource.includes('Watchlist intersections'), 'Public TI org relevance should label watchlist intersections directly.')
assert(pageClientSource.includes('ti.public_actor.watchlist_intersection_request.v1'), 'Watchlist intersections should export versioned request payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Watchlist intersection\''), 'Watchlist intersections should expose copyable org/watchlist handoff requests.')
assert(pageClientSource.includes('watchlistIntersectionPayloadFor(item)'), 'Watchlist intersection exports should preserve backed org, alert, case, and source refs.')
assert(pageClientSource.includes('data-ti-watchlist-term-requests'), 'Watchlist relevance should render row-level watchlist term requests.')
assert(pageClientSource.includes('ti.public_actor.watchlist_term_request.v1'), 'Watchlist terms should export versioned add/monitor requests.')
assert(pageClientSource.includes('ti.public_actor.watchlist_source_intake.v1'), 'Watchlist term exports should include a typed source-lane intake bundle.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Watchlist term request\''), 'Watchlist terms should expose copyable add/monitor request payloads.')
assert(pageClientSource.includes('watchlistTermRequestPayloadFor(term, watchlist, actionability, query)'), 'Watchlist term exports should preserve query, route, blockers, provenance, and related refs.')
assert(pageClientSource.includes('sourceHealthRows'), 'Watchlist term exports should include matching source-health rows for enrichment handoff.')
assert(pageClientSource.includes('sourceEnrichmentIntake.items.filter'), 'Watchlist term exports should include source enrichment intake items.')
assert(pageClientSource.includes('requestedFields: unique(sourceIntakeItems.flatMap'), 'Watchlist term exports should expose requested enrichment fields.')
assert(pageClientSource.includes('data-ti-org-enrichment-gaps'), 'Public TI org relevance should render enrichment gaps.')
assert(pageClientSource.includes('Actor identity'), 'Public TI org relevance should label actor identity without implementation wording.')
assert(pageClientSource.includes('Profile data to review'), 'Public TI org relevance should expose collection/enrichment gaps.')
assert(pageClientSource.includes('data-ti-collection-gap-intake'), 'Source questions should expose structured intake rows.')
assert(pageClientSource.includes('data-ti-collection-gap-task-export'), 'Collection gap rows should expose row-level task exports.')
assert(pageClientSource.includes('ti.public_actor.collection_gap_task.v1'), 'Collection gap rows should export versioned source-lane task payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Collection gap task\''), 'Collection gap rows should expose copyable task payloads.')
assert(pageClientSource.includes('collectionGapTaskPayloadFor(task, intake)'), 'Collection gap task exports should be built from the source enrichment intake model.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Source enrichment intake\''), 'Source questions should export source enrichment intake for authenticated review.')
assert(pageClientSource.includes('intake.summary.sourceRequests'), 'Source questions should summarize source request intake.')
assert(pageClientSource.includes('task.requestedFields?.slice'), 'Source questions should show requested enrichment fields without raw payload dumping.')
assert(pageClientSource.includes('sourceRequestRouteLabel(task.route)'), 'Source questions should show analyst-native route labels.')
for (const section of ['Overview', 'Activity', 'Targeting', 'Infrastructure', 'Sources', 'Evidence', 'Watchlist Relevance', 'Related alerts/cases', 'Open source questions', 'Actions']) {
    assert(pageClientSource.toLowerCase().includes(section.toLowerCase()), `Public TI page should expose analyst-native section: ${section}.`)
}
for (const oldLabel of ['Priority Queue', 'Actor Profile', 'Reported Victims and Targets', 'Observed Tradecraft', 'Alert Packet', 'Workflow', 'Company Exposure', 'Monitoring Coverage', 'Monitoring Mix', 'Sources Used', 'Enrichment Queue']) {
    assert(!pageClientSource.includes(`title='${oldLabel}'`) && !pageClientSource.includes(`title="${oldLabel}"`) && !pageClientSource.includes(`>${oldLabel}<`), `Public TI page should not use legacy/demo-like section label: ${oldLabel}.`)
}
assert(pageClientSource.includes('Review sources'), 'Public TI decision flow should start with source review.')
assert(pageClientSource.includes('Prepare watchlist'), 'Public TI decision flow should include watchlist preparation.')
assert(pageClientSource.includes('Rebuild alerts'), 'Public TI decision flow should include alert rebuild.')
assert(pageClientSource.includes('Open case'), 'Public TI decision flow should include case routing.')
assert(pageClientSource.includes('Deliver webhook'), 'Public TI decision flow should include webhook delivery readiness.')
assert(pageClientSource.includes('Review profile updates'), 'Public TI decision flow should include enrichment routing.')
assert(!pageClientSource.includes('Ready for ${'), 'Public TI visible copy should not expose endpoint-shaped ready labels.')
assert(!pageClientSource.includes('API result data is live'), 'Public TI queue should not expose implementation-literal API copy.')
assert(!pageClientSource.includes('Open DWM workbench'), 'Public TI action labels should not expose internal product-lane naming.')
assert(!pageClientSource.includes('Case payload'), 'Public TI page should not expose raw payload labels as analyst-facing copy.')
assert(!pageClientSource.includes('API work'), 'Public TI enrichment labels should not expose implementation-literal API work copy.')
assert(pageClientSource.includes('whitespace-nowrap'), 'Public TI action buttons should prevent stacked action text.')
assert(pageClientSource.includes('break-all font-mono'), 'Public TI source/provenance rows should wrap long technical values.')
assert(pageClientSource.includes('data-ti-geo-provenance'), 'Public TI map rows should expose geography provenance for render checks.')
assert(pageClientSource.includes('data-ti-geo-context-actions'), 'Public TI country rows should expose geography actionability for render checks.')
assert(pageClientSource.includes('ti.public_actor.geography_context.v1'), 'Public TI country rows should export versioned geography context payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Geography context\''), 'Public TI country rows should expose copyable geography context payloads.')
assert(pageClientSource.includes('basis: \'country_source_coverage\''), 'Public TI map payloads should describe country-level source coverage without implying point precision.')
assert(pageClientSource.includes('Operator attribution'), 'Public TI map legend should use analyst-native attribution language.')
assert(pageClientSource.includes('compact ? \'h-60\' : \'h-80\''), 'Public TI compact map should stay subordinate to selected evidence in the first viewport.')
assert(!pageClientSource.includes('Country-Level Actor Map'), 'Public TI map title should avoid dashboard/report language.')
assert(pageClientSource.includes('data-ti-artifact-workflow-readiness'), 'Selected artifacts should expose workflow readiness for alert/case handoff checks.')
assert(pageClientSource.includes('data-ti-selected-artifact-export'), 'Selected artifacts should expose a compact artifact export for render checks.')
assert(pageClientSource.includes('ti.public_actor.selected_artifact.v1'), 'Selected artifact export should carry a versioned payload schema.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Selected detail\''), 'Selected artifact workbench should expose a copyable artifact payload.')
assert(pageClientSource.includes('selectedArtifactPayloadFor(artifact, handoffs)'), 'Selected artifact export should be built from selected artifact handoffs.')
assert(pageClientSource.includes('actionReadiness = Object.values(bridge.payloads)'), 'Selected artifact export should preserve per-action readiness from the authenticated bridge.')
assert(pageClientSource.includes('selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>'), 'Staged handoffs should preserve the selected actor artifact payload.')
assert(pageClientSource.includes('selectedArtifactPayloadFor(selectedArtifact, selectedArtifactHandoffs)'), 'Staged handoffs should include the currently selected actor artifact context.')
assert(pageClientSource.includes('selectedArtifact.readiness.blockers'), 'Staged handoffs should block on selected artifact readiness blockers.')
assert(pageClientSource.includes('item.selectedArtifact.artifact.kind'), 'Staged handoff rows should show the selected artifact kind.')
assert(pageClientSource.includes('data-ti-artifact-source-requests'), 'Selected artifacts should expose source request rows for case and alert evidence checks.')
assert(pageClientSource.includes('bridge.payload.sourceRequests'), 'Selected artifact source request rows should come from the versioned bridge payload.')
assert(pageClientSource.includes('capture needed'), 'Selected artifact source request rows should show missing capture state honestly.')
assert(pageClientSource.includes('sourceRequestFamilyLabel'), 'Selected artifact source requests should show source family in analyst language.')
assert(pageClientSource.includes('sourceRequestRouteLabel'), 'Selected artifact source requests should show source queue routing in analyst language.')
assert(pageClientSource.includes('row.payload.actionReadiness.find'), 'Selected artifact workflow rows should consume versioned action readiness metadata.')
assert(pageClientSource.includes('actionOwnerLabel(row.readiness.ownerLane)'), 'Selected artifact workflow rows should show analyst-native action responsibility.')
assert(pageClientSource.includes('data-ti-artifact-reference-summary'), 'Selected artifacts should expose a compact backed reference summary.')
assert(pageClientSource.includes('artifactReferenceChips(bridge.payload.evidenceRefs)'), 'Selected artifact reference summary should come from versioned payload evidence refs.')
assert(pageClientSource.includes('ti.public_actor.selected_review_handoff.v1'), 'Selected finding review should export a versioned review handoff payload.')
assert(pageClientSource.includes('data-ti-selected-review-handoff'), 'Selected finding review package should render in the session notes workflow.')
assert(pageClientSource.includes('sessionLocal: true'), 'Selected finding review payload should mark public-page notes as session-local.')
assert(pageClientSource.includes('data-ti-local-relevance'), 'Selected finding review should expose session-local relevance marking.')
assert(pageClientSource.includes('localRelevance'), 'Selected review handoff should export local relevance state for case/watchlist review.')
assert(pageClientSource.includes('caseIntent'), 'Selected relevance mark should carry case/watchlist/source intent.')
assert(pageClientSource.includes('ti.public_actor.selected_case_draft.v1'), 'Selected evidence should export a versioned case draft.')
assert(pageClientSource.includes('data-ti-selected-case-draft'), 'Selected evidence should render a session-local case draft.')
assert(pageClientSource.includes('data-ti-selected-case-provenance'), 'Selected case draft should render the source provenance rows before staging.')
assert(pageClientSource.includes('handoffMissingLabel(row.missing)'), 'Selected case draft should show missing source/capture requirements in analyst language.')
assert(pageClientSource.includes('confidence: row.confidence'), 'Selected case draft payload should preserve source confidence for case review.')
assert(pageClientSource.includes('selectedCaseDraftFor'), 'Selected case draft should be built from selected evidence, relevance, source drilldown, and case readiness.')
assert(pageClientSource.includes('ti.public_actor.staged_handoff_bundle.v1'), 'Selected evidence should export a session-local staged handoff bundle.')
assert(pageClientSource.includes('data-ti-staged-handoff-queue'), 'Public TI should render a session-local staged handoff queue.')
assert(pageClientSource.includes('data-ti-staged-handoff-readiness'), 'Staged handoffs should show review/source/case readiness before bundle copy.')
assert(pageClientSource.includes('stagedReadinessChips(item)'), 'Staged handoff readiness should come from the staged review, source, and case payloads.')
assert(pageClientSource.includes('stagedHandoffFor'), 'Staged handoffs should combine review, source drilldown, case draft, ownership, case create request, watchlist, alert, delivery, enrichment, and action trail payloads.')
assert(pageClientSource.includes('caseOwnership: SelectedCaseOwnershipPlan'), 'Staged handoffs should carry selected case ownership readiness.')
assert(pageClientSource.includes('caseCreateRequest: SelectedCaseCreateRequest'), 'Staged handoffs should carry the full selected case create request.')
assert(pageClientSource.includes('watchlistPlan: SelectedWatchlistPlan'), 'Staged handoffs should carry selected watchlist relevance readiness.')
assert(pageClientSource.includes('alertPlan: SelectedAlertActionPlan'), 'Staged handoffs should carry selected alert-generation readiness.')
assert(pageClientSource.includes('deliveryPlan: SelectedDeliveryReadinessPlan'), 'Staged handoffs should carry selected delivery readiness.')
assert(pageClientSource.includes('enrichmentTriage: SelectedEnrichmentTriage'), 'Staged handoffs should carry selected enrichment triage.')
assert(pageClientSource.includes('caseActionTrail: CaseActionTrailPayload'), 'Staged handoffs should carry selected case action trail metadata.')
assert(pageClientSource.includes('caseCreateRequest.actorContext.techniques.length'), 'Staged handoffs should preserve actor context coverage for case review.')
assert(pageClientSource.includes('caseCreateRequest.watchlistBasis.ready'), 'Staged handoffs should preserve watchlist readiness for case review.')
assert(pageClientSource.includes('caseCreateRequest.actionReplay.rows.some'), 'Staged handoffs should preserve action replay readiness for case review.')
assert(pageClientSource.includes('alertPlan.readiness.matchedCandidateCount'), 'Staged handoff readiness should expose alert candidate readiness.')
assert(pageClientSource.includes('deliveryPlan.summary.destinations'), 'Staged handoff readiness should expose delivery destination readiness.')
assert(pageClientSource.includes('enrichmentTriage.summary.intakeItems'), 'Staged handoff readiness should expose enrichment intake readiness.')
assert(pageClientSource.includes('caseActionTrail.summary.replayable'), 'Staged handoff readiness should expose action trail replayability.')
assert(pageClientSource.includes('caseOwnership.owner.label'), 'Staged handoff readiness should expose the selected case owner lane.')
assert(pageClientSource.includes('if (!selected || !selectedArtifact || !selectedArtifactHandoffs'), 'Stage handoff should require selected actor artifact context.')
assert(pageClientSource.includes('disabled={!reviewHandoff || !caseDraft || !caseOwnership || !caseCreateRequest || !watchlistPlan || !alertPlan || !deliveryPlan || !enrichmentTriage || !caseActionTrail}'), 'Stage handoff should require the full selected workflow context.')
assert(pageClientSource.includes('data-ti-source-health-queue'), 'Public TI should render a source-health queue from source coverage and enrichment gaps.')
assert(actionabilitySource.includes('ti.public_actor.source_health_queue.v1'), 'Source-health queue should expose a versioned actionability payload.')
assert(actionabilitySource.includes('ti.public_actor.source_enrichment_intake.v1'), 'Source enrichment intake should expose a versioned actionability payload.')
assert(actionabilitySource.includes('ti.public_actor.case_review_intake.v1'), 'Case review intake should expose a versioned actionability payload.')
assert(pageClientSource.includes('parserStatus'), 'Source-health rows should expose parser or capture status.')
assert(pageClientSource.includes('requestedFields'), 'Source-health rows should expose requested enrichment fields.')
assert(pageClientSource.includes('actionability.sourceHealthQueue'), 'Source-health rows should be consumed from the actionability model.')
assert(pageClientSource.includes('actionability.sourceEnrichmentIntake'), 'Source-health UI should expose the modeled enrichment intake.')
assert(pageClientSource.includes('actionability.actorEnrichmentCoverage'), 'Source-health UI should expose actor enrichment coverage export state.')
assert(pageClientSource.includes('actionability.actorEnrichmentConsumerReadiness'), 'Source-health UI should expose actor enrichment consumer readiness.')
assert(pageClientSource.includes('data-ti-enrichment-coverage-export'), 'Source-health UI should expose a stable render hook for coverage exports.')
assert(pageClientSource.includes('data-ti-source-consumer-readiness'), 'Source-health UI should expose stable render hooks for source consumer readiness.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Consumer status\''), 'Source-health UI should expose copyable consumer readiness payloads.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Coverage review\''), 'Source-health UI should expose copyable coverage review payloads.')
assert(actionabilitySource.includes('ti.source_provenance_actor_enrichment_coverage_export.v1'), 'Public TI actionability should name the source provenance coverage export contract.')
assert(pageClientSource.includes('ti.public_actor.source_refresh_request.v1'), 'Source-health rows should export versioned refresh requests.')
assert(pageClientSource.includes('data-ti-source-refresh-export'), 'Source-health rows should expose a stable render hook for refresh exports.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Source review request\''), 'Source-health rows should expose copyable enrichment requests.')
assert(pageClientSource.includes('sourceRefreshPayloadFor(row, queue, intake, payload)'), 'Source-health row exports should preserve queue, intake, payload, provenance, and blocker state.')
assert(pageClientSource.includes('matchingIntakeItems'), 'Source-health refresh exports should include matching enrichment intake items.')
assert(pageClientSource.includes('queueSummary: queue.summary'), 'Source-health refresh exports should include queue summary for source ops.')
assert(pageClientSource.includes('enrichmentPayload: payload'), 'Source-health refresh exports should carry the authenticated enrichment payload shape.')
assert(pageClientSource.includes('ti.public_actor.selected_source_drilldown.v1'), 'Selected evidence should export a versioned source drilldown payload.')
assert(pageClientSource.includes('data-ti-selected-source-drilldown'), 'Selected evidence should render source drilldown rows for source/capture review.')
assert(pageClientSource.includes('data-ti-selected-brief'), 'Selected evidence should render a plain-language analyst brief.')
assert(pageClientSource.includes('What happened, why it matters, and what to do next'), 'Selected evidence should translate the row into triage language.')
assert(pageClientSource.includes('Public TI results are metadata-only'), 'Selected evidence brief should state the public TI safety boundary.')
assert(pageClientSource.includes('Verify before customer-facing escalation'), 'Selected evidence brief should be honest when source references lack capture IDs.')
assert(pageClientSource.includes('selectedSourceDrilldownFor'), 'Selected evidence drilldown should be built from the selected queue item and actionability model.')
assert(pageClientSource.includes('ti.public_actor.source_evidence_request.v1'), 'Selected source drilldown rows should export versioned source evidence requests.')
assert(pageClientSource.includes('CopyPayloadButton label=\'Source evidence request\''), 'Selected source drilldown rows should expose copyable source evidence requests.')
assert(pageClientSource.includes('sourceEvidenceRequestPayloadFor(row, drilldown)'), 'Selected source evidence requests should preserve row and selected item context.')
assert(pageClientSource.includes('capture needed'), 'Selected source drilldown should show missing capture state honestly.')
assert(pageClientSource.includes('Source details'), 'Selected evidence should label source drilldown in analyst language.')
assert(pageClientSource.includes('ti.public_actor.selected_enrichment_triage.v1'), 'Selected evidence should export a versioned enrichment triage payload.')
assert(pageClientSource.includes('data-ti-selected-enrichment-triage'), 'Selected evidence should render enrichment triage for source-gap review.')
assert(pageClientSource.includes('data-ti-selected-enrichment-readiness'), 'Selected enrichment triage should expose stable readiness hooks.')
assert(pageClientSource.includes('selectedEnrichmentTriageFor(result, selected, actionability'), 'Selected enrichment triage should be built from selected evidence and backed actionability state.')
assert(pageClientSource.includes('actionability.actorEnrichmentConsumerReadiness.rows.filter'), 'Selected enrichment triage should consume actor enrichment consumer readiness rows.')
assert(pageClientSource.includes('ownerLane: primaryIntakeItem?.ownerLane ?? row.ownerLane'), 'Selected enrichment triage rows should preserve the responsible owner lane.')
assert(pageClientSource.includes('lastChecked: primaryIntakeItem?.evidence.timestamp ?? row.timestamp'), 'Selected enrichment triage rows should preserve source freshness.')
assert(pageClientSource.includes('remediationPath: primaryIntakeItem?.route ?? row.route'), 'Selected enrichment triage rows should preserve the source remediation route.')
assert(pageClientSource.includes('recommendedAction: primaryIntakeItem?.nextAction ?? row.nextAction'), 'Selected enrichment triage rows should preserve the next analyst action.')
assert(pageClientSource.includes('readinessOwnerLabel(row.ownerLane)'), 'Selected enrichment triage should render owner lanes in analyst language.')
assert(pageClientSource.includes('sourceRequestRouteLabel(row.remediationPath)'), 'Selected enrichment triage should render remediation routes in analyst language.')
assert(pageClientSource.includes('actorEnrichmentConsumerLabel(readiness.consumer)'), 'Selected enrichment triage should render consumer readiness in analyst language.')
assert(pageClientSource.includes('data-ti-evidence-priority'), 'Selected evidence should expose backed priority proof.')
assert(pageClientSource.includes('dark:border-ui-border'), 'Public TI dense intelligence panels should have dark-mode border guardrails.')
assert(pageClientSource.includes('grid-cols-[minmax(0,1fr)]'), 'Public TI selected intelligence stack should constrain mobile grid width.')
assert(pageClientSource.includes('flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'), 'Public TI action clusters should wrap complete controls on narrow widths.')
assert(!pageClientSource.includes('truncate font-semibold'), 'Public TI profile stats should wrap values instead of clipping mobile status text.')
assert(pageClientSource.includes('document.body.dataset.publicTiRoute'), 'Public TI route should mark the body for route-scoped render guardrails.')
assert(pageClientSource.includes('min-h-8 min-w-16 max-w-full'), 'Public TI copy/export actions should keep a stable mobile tap target width.')
assert(globalStylesSource.includes('body[data-public-ti-route="true"] nextjs-portal'), 'Public TI should hide dev overlays that can cover mobile evidence during render proof.')
assert(globalStylesSource.includes('body[data-public-ti-route="true"] [data-testid="theme-switch"]'), 'Public TI should keep the header theme switch wider than narrow action thresholds.')

assert(containsToyThreatIntelCopy('target signals'), 'Copy guard should catch target signal language.')
assert(containsToyThreatIntelCopy('Named examples'), 'Copy guard should catch named-example language.')
assert(containsToyThreatIntelCopy('country-level target marker'), 'Copy guard should catch internal map marker language.')
assert(containsToyThreatIntelCopy('continent bucket'), 'Copy guard should catch internal geography bucket language.')
assert(containsToyThreatIntelCopy('prompt'), 'Copy guard should catch prompt language.')
assert(containsToyThreatIntelCopy('internal rationale'), 'Copy guard should catch internal rationale language.')
assert(!containsToyThreatIntelCopy(JSON.stringify(profile)), 'Shaped actor intelligence should not contain toy TI copy.')
assert(!containsToyThreatIntelCopy(JSON.stringify(actionability)), 'Actionability fields should not contain toy TI copy.')
assert(!containsToyThreatIntelCopy(JSON.stringify(quietProfile)), 'Unknown actor profile should not contain toy TI copy.')

console.log('[ti-actor-intelligence] actor intelligence shaping and copy guardrails passed')

function assert(condition: unknown, message: string) {
    if (!condition) throw new Error(message)
}
