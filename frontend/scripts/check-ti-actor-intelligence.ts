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
            confidence: 0.82,
            shownBecause: 'Microsoft disclosure is the source basis for the returned activity and watchlist relevance.',
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
const actorIntelligenceSource = readFileSync(new URL('../src/utils/ti/actorIntelligence.ts', import.meta.url), 'utf8')
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
assert(actionability.orgRelevance.sourceCoverage.some(item => item.status === 'missing_capture'), 'Org relevance should expose source coverage capture gaps.')
assert(actionability.orgRelevance.enrichmentGaps.some(item => item.code === 'stale_evidence'), 'Org relevance should expose stale evidence gaps.')
assert(actionability.orgRelevance.handoffRows.some(row => row.rowId === 'org-gap:stale_evidence:freshness.lastSeen'), 'Org relevance gaps should be visible as handoff rows.')
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
assert(actionability.actionPayloads.payloads.webhookDelivery.route === '/v1/dwm/webhooks/deliver', 'Webhook action export should point to the delivery route.')
assert(actionability.actionPayloads.payloads.webhookDelivery.blockedBy.some(blocker => blocker.code === 'missing_webhook_destination' && blocker.ownerLane === 'webhook'), 'Webhook action export should carry destination blockers.')
assert(actionability.actionPayloads.payloads.analystHandoffBundle.body.schemaVersion === 'hanasand.analyst_handoff.consumer.v1', 'Analyst bundle export should align to the authenticated consumer schema.')
assert(actionability.actionPayloads.payloads.sourceEnrichment.route === '/dashboard/ti/enrichment', 'Source enrichment action export should point to source enrichment work.')
assert(actionability.actionPayloads.payloads.sourceEnrichment.blockedBy.some(blocker => blocker.code === 'missing_capture' && blocker.ownerLane === 'source'), 'Source enrichment export should carry missing capture blockers.')
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
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('selectedPayload'), 'Dashboard consumer contract should document selectedPayload.')
assert(PUBLIC_TI_HANDOFF_DASHBOARD_CONSUMER_FIELDS.includes('sourceRequests'), 'Dashboard consumer contract should document sourceRequests.')
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
assert(!backed.exportPayloads.case.blocked, 'Backed case export should be open when case payload has no blockers.')
assert(backed.createAlertHandoff.ready, 'Backed alert handoff should be ready when watchlist context exists.')
assert(backed.caseHandoff.ready, 'Backed case handoff should be ready when case payload has no blockers.')
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
assert(quietProfile.sourceCoverage.totalRows >= 1, 'Sparse actor should still summarize returned source coverage.')
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
assert(pageClientSource.includes('Console handoff'), 'Public TI page should use professional console handoff language.')
assert(pageClientSource.includes('Decision flow'), 'Public TI page should expose a compact decision flow.')
assert(pageClientSource.includes('Handoff readiness'), 'Public TI page should expose consumer-ready workflow state.')
assert(pageClientSource.includes('data-ti-handoff-evidence-matrix'), 'Public TI page should expose handoff evidence for backed action review.')
assert(pageClientSource.includes('Handoff evidence'), 'Public TI page should label backed action evidence in analyst language.')
assert(pageClientSource.includes('data-ti-source-activation'), 'Public TI page should expose source activation review actions when returned.')
assert(pageClientSource.includes('Source Activation'), 'Public TI page should label source activation review in analyst language.')
assert(pageClientSource.includes('Action exports'), 'Public TI page should expose validated action exports.')
assert(pageClientSource.includes('Validated request bodies for authenticated review'), 'Public TI page should explain copy-only action exports professionally.')
assert(pageClientSource.includes('data-ti-section-rail'), 'Public TI page should expose a section rail for analyst scanning.')
assert(pageClientSource.includes('Evidence ordered by severity, confidence, and recency.'), 'Public TI activity queue should explain backed ordering.')
assert(pageClientSource.includes('Matched watchlists'), 'Public TI evidence fit should show matched organization watchlists when present.')
assert(pageClientSource.includes('Open console'), 'Public TI page should route analysts to the authenticated console without internal lane names.')
assert(pageClientSource.includes('Case handoff'), 'Public TI page should summarize case handoff state instead of dumping raw JSON.')
assert(pageClientSource.includes('data-ti-source-coverage'), 'Public TI dossier should expose source coverage for render checks.')
assert(pageClientSource.includes('Source coverage'), 'Public TI dossier should summarize source coverage.')
assert(pageClientSource.includes('data-ti-freshness-gate'), 'Public TI dossier should expose a freshness gate for source and handoff readiness.')
assert(pageClientSource.includes('Freshness gate'), 'Public TI dossier should label freshness readiness in analyst language.')
assert(pageClientSource.includes('data-ti-technique-coverage'), 'Public TI dossier should expose technique coverage for render checks.')
assert(pageClientSource.includes('data-ti-campaign-timeline'), 'Public TI dossier should expose campaign timeline for render checks.')
assert(pageClientSource.includes('source gap'), 'Public TI enrichment statuses should use source-gap language instead of implementation labels.')
assert(pageClientSource.includes('Readiness'), 'Public TI page should expose backed readiness and degraded states.')
assert(pageClientSource.includes('Backed IDs, blockers, and next handoff owner'), 'Public TI page should describe backed readiness without prompt-shaped language.')
assert(pageClientSource.includes('data-ti-org-actor-identity'), 'Public TI org relevance should render actor identity fields.')
assert(pageClientSource.includes('data-ti-org-source-coverage'), 'Public TI org relevance should render source coverage fields.')
assert(pageClientSource.includes('data-ti-watchlist-intersections'), 'Public TI org relevance should render customer watchlist intersections.')
assert(pageClientSource.includes('Watchlist intersections'), 'Public TI org relevance should label watchlist intersections directly.')
assert(pageClientSource.includes('data-ti-org-enrichment-gaps'), 'Public TI org relevance should render enrichment gaps.')
assert(pageClientSource.includes('Actor identity'), 'Public TI org relevance should label actor identity without implementation wording.')
assert(pageClientSource.includes('Enrichment needed'), 'Public TI org relevance should expose collection/enrichment gaps.')
for (const section of ['Overview', 'Activity', 'Targeting', 'Infrastructure', 'Sources', 'Evidence', 'Watchlist Relevance', 'Related alerts/cases', 'Collection Gaps', 'Actions']) {
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
assert(pageClientSource.includes('Queue enrichment'), 'Public TI decision flow should include enrichment routing.')
assert(!pageClientSource.includes('Ready for ${'), 'Public TI visible copy should not expose endpoint-shaped ready labels.')
assert(!pageClientSource.includes('API result data is live'), 'Public TI queue should not expose implementation-literal API copy.')
assert(!pageClientSource.includes('Open DWM workbench'), 'Public TI action labels should not expose internal product-lane naming.')
assert(!pageClientSource.includes('Case payload'), 'Public TI page should not expose raw payload labels as analyst-facing copy.')
assert(!pageClientSource.includes('API work'), 'Public TI enrichment labels should not expose implementation-literal API work copy.')
assert(pageClientSource.includes('whitespace-nowrap'), 'Public TI action buttons should prevent stacked action text.')
assert(pageClientSource.includes('break-all font-mono'), 'Public TI source/provenance rows should wrap long technical values.')
assert(pageClientSource.includes('data-ti-geo-provenance'), 'Public TI map rows should expose geography provenance for render checks.')
assert(pageClientSource.includes('data-ti-artifact-workflow-readiness'), 'Selected artifacts should expose workflow readiness for alert/case handoff checks.')
assert(pageClientSource.includes('data-ti-evidence-priority'), 'Selected evidence should expose backed priority proof.')
assert(pageClientSource.includes('dark:border-[#273244]'), 'Public TI dense intelligence panels should have dark-mode border guardrails.')
assert(pageClientSource.includes('grid-cols-[minmax(0,1fr)]'), 'Public TI selected intelligence stack should constrain mobile grid width.')
assert(pageClientSource.includes('flex flex-wrap items-center justify-end gap-1.5 sm:shrink-0'), 'Public TI action clusters should wrap complete controls on narrow widths.')

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
