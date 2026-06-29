import { countryFromValue, type VictimObservation } from './actorProfile'
import type { TiActorIntelligenceProfile } from './actorIntelligence'
import type { TiActionabilityContract, TiSearchResponse } from './search'

export type TiActionabilityModel = {
    alertDisposition: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert: boolean
    rationale: string
    watchlist: {
        state: 'backed_matches' | 'candidate_handoff' | 'missing_terms'
        candidates: WatchlistCandidate[]
        matches: NonNullable<TiActionabilityContract['watchlistMatches']>
        endpoint: string
        payloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
        blockers: string[]
    }
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    geographyHandoffs: GeographyHandoff[]
    sourceClusters: SourceCluster[]
    evidencePriority: PublicTiEvidencePriority[]
    sourceHealthQueue: PublicTiSourceHealthQueue
    watchlistRelevance: WatchlistRelevanceContract
    orgRelevance: PublicTiOrgRelevanceProof
    createAlertHandoff: WorkflowHandoffContract
    caseHandoff: WorkflowHandoffContract
    webhookDeliveryHandoff: WorkflowHandoffContract
    consumerReadiness: ConsumerReadinessContract
    readiness: PublicTiReadinessContract
    actionPayloads: PublicTiActionPayloadSet
    exportPayloads: {
        watchlist: TiHandoffExportPayload
        alertRebuild: TiHandoffExportPayload
        case: TiHandoffExportPayload
        webhookDelivery: TiHandoffExportPayload
        enrichment: TiHandoffExportPayload
        blockers: TiHandoffExportPayload
    }
    handoffs: {
        watchlistEndpoint: string
        alertRebuildEndpoint: string
        caseEndpoint: string
        webhookDeliveryEndpoint: string
        casePayload?: { alertId: string; title?: string; priority?: string; note?: string }
        caseBlockers: string[]
    }
}

export type PublicTiReadinessContract = {
    schemaVersion: 'ti.public_actor.readiness.v1'
    state: 'ready' | 'review' | 'degraded' | 'blocked'
    generatedAt: string
    backedIds: {
        tenantIds: string[]
        organizationIds: string[]
        watchlistIds: string[]
        watchlistItemIds: string[]
        alertIds: string[]
        caseIds: string[]
        casePaths: string[]
        captureIds: string[]
        webhookDestinationIds: string[]
    }
    blockers: PublicTiReadinessBlocker[]
}

export type PublicTiReadinessBlocker = {
    schemaVersion: 'ti.public_actor.readiness_blocker.v1'
    code: 'missing_org' | 'missing_org_watchlist' | 'missing_capture' | 'missing_alert' | 'missing_case_route' | 'missing_webhook_destination' | 'stale_provenance' | 'entitlement_blocked' | 'missing_source_provenance' | 'unavailable_contract'
    stage: 'watchlist' | 'alert' | 'case' | 'webhook' | 'source' | 'entitlement' | 'public_ti'
    ownerLane: 'org' | 'alert' | 'case' | 'webhook' | 'source' | 'entitlement' | 'public-ti'
    field: string
    detail: string
    handoff: string
    route: string
    recoverable: boolean
    source: 'public_result' | 'consumer_readiness' | 'entitlement_readiness' | 'delivery_readiness'
}

export type PublicTiActionPayloadKind = 'watchlist_add' | 'case_handoff' | 'webhook_delivery' | 'analyst_handoff_bundle' | 'source_enrichment'

export type PublicTiActionPayloadSet = {
    schemaVersion: 'ti.public_actor.action_payloads.v1'
    actorId: string
    query: string
    generatedAt: string
    payloads: {
        watchlistAdd: PublicTiActionPayload<'watchlist_add'>
        caseHandoff: PublicTiActionPayload<'case_handoff'>
        webhookDelivery: PublicTiActionPayload<'webhook_delivery'>
        analystHandoffBundle: PublicTiActionPayload<'analyst_handoff_bundle'>
        sourceEnrichment: PublicTiActionPayload<'source_enrichment'>
    }
}

export type PublicTiActionPayload<K extends PublicTiActionPayloadKind = PublicTiActionPayloadKind> = {
    schemaVersion: 'ti.public_actor.action_payload.v1'
    kind: K
    label: string
    actorId: string
    query: string
    generatedAt: string
    method: 'POST'
    route: string
    backedRoute?: string
    ready: boolean
    unavailable: boolean
    blockedBy: PublicTiReadinessBlocker[]
    body: Record<string, unknown>
    provenance: TiHandoffExportPayload['provenance']
}

export type WatchlistRelevanceContract = {
    schemaVersion: 'ti.public_actor.watchlist_relevance.v1'
    state: TiActionabilityModel['watchlist']['state']
    endpoint: string
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidates: WatchlistCandidate[]
    terms: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string; matched: boolean }>
    blockers: string[]
    provenance: TiHandoffExportPayload['provenance']
}

export type PublicTiOrgRelevanceProof = {
    schemaVersion: 'ti.public_actor.org_relevance.v1'
    state: 'ready' | 'review' | 'blocked'
    actorId: string
    query: string
    generatedAt: string
    freshness: {
        generatedAt: string
        lastSeen: string
        stale: boolean
        reason: string
    }
    actorIdentity: PublicTiActorIdentity
    sourceCoverage: PublicTiOrgSourceCoverage[]
    enrichmentGaps: PublicTiOrgRelevanceEnrichmentGap[]
    watchlistIntersections: PublicTiOrgWatchlistIntersection[]
    organizationRefs: Array<{
        tenantId?: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        kind: 'company' | 'domain' | 'vendor'
        value: string
        route?: string
        casePath?: string
    }>
    candidateTerms: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        notes: string
        matched: boolean
        sourceEvidenceRefs: string[]
    }>
    sourceEvidence: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: PublicTiOrgSourceFamily
        parserStatus?: string
        lastCollectedAt?: string
        confidence?: number
        supportsTerms: string[]
        shownBecause: string
    }>
    alertCaseRefs: Array<{
        alertId: string
        casePath?: string
        caseIdCandidate?: string
        organizationId?: string
        tenantId?: string
        captureIds: string[]
        webhookDestinationIds: string[]
    }>
    affectedEntities: {
        vendors: PublicTiAffectedEntity[]
        domains: PublicTiAffectedEntity[]
        regions: PublicTiAffectedEntity[]
    }
    handoffRows: PublicTiOrgRelevanceRow[]
    handoffRoutes: {
        watchlist: '/v1/dwm/watchlists'
        alertRebuild: '/v1/dwm/alerts/rebuild'
        case: '/v1/cases'
        webhookDelivery: '/v1/dwm/webhooks/deliver'
    }
    blockers: PublicTiReadinessBlocker[]
}

export type PublicTiOrgSourceFamily = 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'

export type PublicTiActorIdentity = {
    canonicalName: string
    aliases: string[]
    actorClass: string
    sectors: string[]
    regions: string[]
    motivations: string[]
}

export type PublicTiOrgSourceCoverage = {
    sourceId?: string
    sourceName: string
    sourceFamily: PublicTiOrgSourceFamily
    provenance: string
    captureId?: string
    sourceRequestId?: string
    parserStatus?: string
    confidence?: number
    status: 'capture_ready' | 'public_reference' | 'missing_capture'
    lastCollectedAt?: string
    supportsTerms: string[]
}

export type PublicTiOrgRelevanceEnrichmentGap = {
    code: 'missing_actor_aliases' | 'missing_target_sectors' | 'missing_target_regions' | 'missing_source_coverage' | 'missing_provenance' | 'stale_evidence'
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    field: string
    detail: string
    route: string
    sourceFamily: PublicTiOrgSourceFamily
    recoverable: boolean
}

export type PublicTiOrgWatchlistIntersection = {
    intersectionId: string
    kind: 'company' | 'domain' | 'vendor'
    value: string
    state: 'ready' | 'review' | 'blocked'
    tenantId?: string
    organizationId?: string
    watchlistId?: string
    watchlistItemId?: string
    route: string
    casePath?: string
    sourceEvidenceRefs: string[]
    sourceFamilies: PublicTiOrgSourceFamily[]
    alertIds: string[]
    caseIds: string[]
    casePaths: string[]
    captureIds: string[]
    webhookDestinationIds: string[]
    recommendedAction: 'open_watchlist_item' | 'persist_watchlist_item' | 'rebuild_alerts' | 'open_case' | 'attach_source_evidence'
    blockers: PublicTiReadinessBlocker[]
}

export type PublicTiAffectedEntity = {
    kind: 'vendor' | 'domain' | 'region'
    value: string
    matched: boolean
    sourceFamily: PublicTiOrgSourceFamily
    provenanceRefs: string[]
    watchlistItemIds: string[]
    alertIds: string[]
}

export type PublicTiOrgRelevanceEvidence = {
    sourceId?: string
    sourceName?: string
    provenance?: string
    reportDate?: string
    captureId?: string
    sourceRequestId?: string
    sourceFamily?: PublicTiOrgSourceFamily
    parserStatus?: string
    lastCollectedAt?: string
    confidence?: number
    summary: string
}

export type PublicTiOrgRelevanceRow = {
    rowId: string
    kind: 'watchlist_match' | 'candidate_term' | 'source_evidence' | 'alert_case' | 'webhook_delivery' | 'enrichment_gap'
    state: 'ready' | 'review' | 'blocked'
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    label: string
    action: string
    route: string
    sourceFamily: PublicTiOrgSourceFamily
    provenanceRefs: string[]
    tenantId?: string
    organizationId?: string
    watchlistId?: string
    watchlistItemId?: string
    alertId?: string
    casePath?: string
    captureIds: string[]
    webhookDestinationIds: string[]
    evidence: PublicTiOrgRelevanceEvidence
    blockers: PublicTiReadinessBlocker[]
}

export type WorkflowHandoffContract = {
    schemaVersion: 'ti.public_actor.workflow_handoff.v1'
    kind: 'create_alert' | 'case' | 'webhook_delivery'
    method: 'POST'
    endpoint: string
    ready: boolean
    blocked: boolean
    missing: string[]
    payload: Record<string, unknown>
    backedRoute?: string
    provenance: TiHandoffExportPayload['provenance']
}

export type ConsumerReadinessContract = {
    schemaVersion: 'ti.public_actor.consumer_readiness.v1'
    consumerSchemaVersion: 'hanasand.analyst_handoff.consumer.v1'
    orgTermsExportSchemaVersion: 'organization.watchlist_alert_terms_export.v1'
    webhookAuditSchemaVersion: 'dwm.webhook.audit_event.v1'
    ready: boolean
    generatedAt: string
    stages: ConsumerReadinessStage[]
    blockers: ConsumerReadinessBlocker[]
    bundlePreview: {
        schemaVersion: 'hanasand.analyst_handoff.consumer.v1'
        generatedAt: string
        stages: Record<string, { request?: ConsumerReadinessRequest; missing: string[] }>
    }
}

export type ConsumerReadinessStage = {
    id: 'publicTi' | 'orgWatchlist' | 'caseHandoff' | 'webhookTrigger' | 'enrichment'
    label: string
    state: 'ready' | 'blocked' | 'review'
    detail: string
    route?: string
    request?: ConsumerReadinessRequest
    payload: TiHandoffExportPayload
    missing: string[]
}

export type ConsumerReadinessRequest = {
    method: 'POST'
    path: '/v1/dwm/watchlists' | '/v1/dwm/alerts/rebuild' | '/v1/cases' | '/v1/dwm/webhooks/deliver' | '/dashboard/ti/enrichment'
    body: Record<string, unknown>
}

export type ConsumerReadinessBlocker = {
    code: 'missing_org' | 'missing_provenance' | 'stale_evidence' | 'absent_alert_id' | 'missing_watchlist_term' | 'missing_watchlist_id' | 'missing_watchlist_item' | 'webhook_trigger_contract_mismatch' | 'webhook_audit_contract_mismatch' | 'missing_stage'
    stage: ConsumerReadinessStage['id']
    field: string
    detail: string
    recoverable: boolean
}

export type EnrichmentGapQueueItem = {
    id: string
    title: string
    severity: 'high' | 'medium' | 'low'
    detail: string
    dependency: string
    route: string
    sourceFamily: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator'
    requestedFields: string[]
}

export type PublicTiSourceHealthQueue = {
    schemaVersion: 'ti.public_actor.source_health_queue.v1'
    query: string
    generatedAt: string
    rows: PublicTiSourceHealthRow[]
    summary: {
        total: number
        ready: number
        review: number
        blocked: number
    }
}

export type PublicTiSourceHealthRow = {
    id: string
    sourceName: string
    sourceFamily: PublicTiOrgSourceFamily
    provenance: string
    timestamp: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidence?: number
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    route: string
    requestedFields: string[]
    ownerLane: PublicTiReadinessBlocker['ownerLane']
    nextAction: string
}

type WatchlistCandidate = {
    kind: 'company' | 'domain' | 'vendor'
    value: string
    reason: string
    confidence: number
}

export type GeographyHandoff = {
    code: string
    country: string
    role: 'operator' | 'target'
    observationCount: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
    provenanceSummary: string
    evidenceRows: Array<{
        victim: string
        source: string
        sourceIds: string[]
        provenanceRefs: string[]
        reportDate: string
        confidence: number
    }>
}

export type SourceCluster = {
    sourceName: string
    provenance: string
    captureId?: string
    confidence?: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
}

export type PublicTiEvidencePriority = {
    schemaVersion: 'ti.public_actor.evidence_priority.v1'
    rowId: string
    label: string
    score: number
    state: 'ready' | 'review' | 'blocked'
    reasons: string[]
    nextAction: string
    route?: string
    sourceIds: string[]
    captureIds: string[]
    alertIds: string[]
    casePaths: string[]
    watchlistTerms: string[]
    blockers: PublicTiReadinessBlocker[]
}

export type TiHandoffExportPayload = {
    schemaVersion: 'ti.public_actor.watchlist_handoff.v1' | 'ti.public_actor.alert_rebuild_handoff.v1' | 'ti.public_actor.case_handoff.v1' | 'ti.public_actor.webhook_delivery_handoff.v1' | 'ti.public_actor.enrichment_queue.v1' | 'ti.public_actor.blockers.v1'
    query: string
    generatedAt: string
    route: 'watchlist' | 'alert_rebuild' | 'case' | 'webhook_delivery' | 'enrichment_queue' | 'blocked_dependencies'
    method?: 'POST'
    endpoint?: string
    backedRoute?: string
    blocked: boolean
    missing: string[]
    body: Record<string, unknown>
    provenance: Array<{ sourceName: string; provenance: string; captureId?: string; confidence?: number }>
}

export function buildTiActionability(result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: VictimObservation[]): TiActionabilityModel {
    const contract = result.actionability
    const candidates = normalizeCandidates(contract?.watchlistCandidates, result, actor, victimObservations)
    const matches = contract?.watchlistMatches ?? []
    const relatedAlerts = contract?.relatedAlerts ?? []
    const relatedCases = contract?.relatedCases ?? []
    const sourceProvenance = normalizeSourceProvenance(contract?.sourceProvenance, result)
    const enrichmentGaps = normalizeEnrichmentGaps(contract?.enrichmentGaps, result, actor, sourceProvenance)
    const geographyHandoffs = buildGeographyHandoffs(result, victimObservations, candidates)
    const sourceClusters = buildSourceClusters(sourceProvenance)
    const firstAlert = relatedAlerts[0]
    const watchlistPayloads = contract?.handoffs?.watchlist?.payloads ?? candidates.slice(0, 8).map(candidate => ({
        kind: candidate.kind,
        value: candidate.value,
        notes: `${result.query}: ${candidate.reason}`,
    }))
    const watchlistEndpoint = contract?.handoffs?.watchlist?.endpoint ?? '/api/organizations/:id/watchlists'
    const alertRebuildEndpoint = contract?.handoffs?.alertRebuild?.endpoint ?? '/v1/dwm/alerts/rebuild'
    const caseEndpoint = contract?.handoffs?.caseCreate?.endpoint ?? '/v1/cases'
    const webhookDeliveryEndpoint = contract?.handoffs?.webhookDelivery?.endpoint ?? '/v1/dwm/webhooks/deliver'
    const watchlistBlockers = contract?.handoffs?.watchlist?.missing ?? (matches.length ? [] : ['Authenticated organization ID and member/admin watchlist permission'])
    const casePayload = contract?.handoffs?.caseCreate?.payload ?? (firstAlert ? {
        alertId: firstAlert.id,
        title: firstAlert.title,
        priority: firstAlert.severity,
        note: `Opened from public TI result ${result.query}.`,
    } : undefined)
    const caseDependencyBlockers = contract?.handoffs?.caseCreate?.missing ?? (casePayload ? [] : ['DWM alert ID from /v1/dwm/alerts or /v1/dwm/alerts/rebuild'])
    const caseBlockers = uniqueBy([...caseDependencyBlockers, ...(!matches.length ? watchlistBlockers : [])].map(value => ({ value })), item => item.value).map(item => item.value)
    const alertDisposition = contract?.alertDisposition ?? dispositionFor({ candidates, matches, relatedAlerts, relatedCases, sourceProvenance, enrichmentGaps })
    const shouldAlert = contract?.shouldAlert ?? (alertDisposition === 'ready_for_alert_review' || alertDisposition === 'case_ready')
    const exportPayloads = buildExportPayloads({
        result,
        actor,
        watchlistEndpoint,
        alertRebuildEndpoint,
        caseEndpoint,
        watchlistPayloads,
        watchlistBlockers,
        casePayload,
        caseBlockers,
        webhookDeliveryEndpoint,
        webhookPayload: contract?.handoffs?.webhookDelivery?.payload,
        webhookBlockers: contract?.handoffs?.webhookDelivery?.missing,
        webhookDestinations: contract?.relatedWebhookDestinations ?? [],
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        enrichmentGaps,
        geographyHandoffs,
        sourceClusters,
    })
    const enrichmentGapQueue = buildEnrichmentGapQueue(enrichmentGaps)
    const consumerReadiness = buildConsumerReadiness({
        result,
        actor,
        matches,
        relatedAlerts,
        relatedCases,
        exportPayloads,
        enrichmentGapQueue,
        watchTerms: watchlistPayloads,
        sourceProvenance,
    })
    const readiness = buildPublicTiReadiness({
        result,
        actor,
        matches,
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        contract,
        exportPayloads,
        consumerReadiness,
    })
    const orgRelevance = buildOrgRelevanceProof({
        result,
        actor,
        matches,
        relatedAlerts,
        sourceProvenance,
        enrichmentGaps,
        exportPayloads,
        readiness,
    })
    const evidencePriority = buildEvidencePriority({
        result,
        actor,
        victimObservations,
        readiness,
        orgRelevance,
        sourceProvenance,
        relatedAlerts,
        relatedCases,
    })
    const sourceHealthQueue = buildPublicTiSourceHealthQueue({
        result,
        actor,
        orgRelevance,
        enrichmentGapQueue,
        exportPayloads,
    })
    const actionPayloads = buildPublicTiActionPayloads({
        result,
        actor,
        exportPayloads,
        consumerReadiness,
        readiness,
        orgRelevance,
        sourceProvenance,
        enrichmentGapQueue,
        sourceHealthQueue,
    })

    return {
        alertDisposition,
        shouldAlert,
        rationale: contract?.rationale ?? rationaleFor(alertDisposition, candidates, matches, relatedAlerts, sourceProvenance),
        watchlist: {
            state: matches.length ? 'backed_matches' : candidates.length ? 'candidate_handoff' : 'missing_terms',
            candidates,
            matches,
            endpoint: watchlistEndpoint,
            payloads: watchlistPayloads,
            blockers: watchlistBlockers,
        },
        relatedAlerts,
        relatedCases,
        sourceProvenance,
        enrichmentGaps,
        enrichmentGapQueue,
        geographyHandoffs,
        sourceClusters,
        evidencePriority,
        sourceHealthQueue,
        watchlistRelevance: buildWatchlistRelevance({
            state: matches.length ? 'backed_matches' : candidates.length ? 'candidate_handoff' : 'missing_terms',
            endpoint: watchlistEndpoint,
            matches,
            candidates,
            watchlistPayloads,
            blockers: watchlistBlockers,
            provenance: exportPayloads.watchlist.provenance,
        }),
        orgRelevance,
        createAlertHandoff: buildCreateAlertHandoff(exportPayloads.alertRebuild),
        caseHandoff: buildCaseHandoff(exportPayloads.case),
        webhookDeliveryHandoff: buildWebhookDeliveryHandoff(exportPayloads.webhookDelivery),
        consumerReadiness,
        readiness,
        actionPayloads,
        exportPayloads,
        handoffs: {
            watchlistEndpoint,
            alertRebuildEndpoint,
            caseEndpoint,
            webhookDeliveryEndpoint,
            casePayload,
            caseBlockers,
        },
    }
}

function buildEvidencePriority(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    victimObservations: VictimObservation[]
    readiness: PublicTiReadinessContract
    orgRelevance: PublicTiOrgRelevanceProof
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
}): PublicTiEvidencePriority[] {
    const matchedTerms = input.orgRelevance.candidateTerms.filter(term => term.matched).map(term => `${term.kind}: ${term.value}`)
    const candidateTerms = input.orgRelevance.candidateTerms.map(term => `${term.kind}: ${term.value}`)
    const captureIds = uniqueStrings([
        ...input.sourceProvenance.map(source => source.captureId),
        ...input.orgRelevance.alertCaseRefs.flatMap(ref => ref.captureIds),
    ])
    const alertIds = uniqueStrings(input.relatedAlerts.map(alert => alert.id))
    const casePaths = uniqueStrings([
        ...input.relatedAlerts.map(alert => alert.casePath),
        ...input.relatedCases.map(item => item.path),
    ])
    const sourceIds = uniqueStrings(input.sourceProvenance.map(source => source.sourceId))
    const sharedReasons = [
        matchedTerms.length ? `Matched watchlist context: ${matchedTerms.slice(0, 3).join(', ')}.` : candidateTerms.length ? `Watchlist candidates: ${candidateTerms.slice(0, 3).join(', ')}.` : 'No organization watchlist match is attached.',
        captureIds.length ? `${captureIds.length} capture reference${captureIds.length === 1 ? '' : 's'} attached.` : 'Capture reference is missing.',
        alertIds.length ? `${alertIds.length} related alert${alertIds.length === 1 ? '' : 's'} attached.` : 'No related alert ID is attached.',
        input.actor.freshness.stale ? input.actor.freshness.reason : 'Actor freshness is acceptable for review.',
    ]
    const sharedBlockers = input.readiness.blockers.filter(blocker => [
        'missing_org',
        'missing_org_watchlist',
        'missing_source_provenance',
        'missing_capture',
        'missing_alert',
        'missing_case_route',
        'stale_provenance',
    ].includes(blocker.code))
    const priorityState = (): PublicTiEvidencePriority['state'] => {
        if (!input.sourceProvenance.length || sharedBlockers.some(blocker => blocker.code === 'missing_source_provenance')) return 'blocked'
        if (sharedBlockers.length || input.actor.freshness.stale) return 'review'
        return 'ready'
    }
    const baseScore = (confidence: number, severity: 'critical' | 'high' | 'medium' | 'low') => {
        const severityScore = severity === 'critical' ? 55 : severity === 'high' ? 42 : severity === 'medium' ? 28 : 14
        return severityScore + Math.round(confidence * 30) + (matchedTerms.length ? 12 : 0) + (captureIds.length ? 8 : 0) + (alertIds.length ? 8 : 0) - (input.actor.freshness.stale ? 6 : 0)
    }
    const sourceForActivity = (sourceIdsForRow: string[]) => uniqueStrings([
        ...sourceIdsForRow,
        ...sourceIds,
    ])
    const activityRows = input.result.recentActivity.map((item, index) => {
        const exposure = item.victimName || item.claimType === 'victim_claim' || /victim|leak|claim|stolen|exfiltrat|credential/i.test(`${item.title} ${item.detail}`)
        const severity = exposure ? 'high' : item.confidence >= 0.75 ? 'medium' : 'low'
        return priorityRow({
            rowId: queueRowId('activity', index, item.date, item.title),
            label: item.victimName || item.title,
            score: baseScore(item.confidence, severity),
            state: priorityState(),
            sourceIds: sourceForActivity(item.sourceIds),
            captureIds,
            alertIds,
            casePaths,
            watchlistTerms: matchedTerms.length ? matchedTerms : candidateTerms,
            blockers: sharedBlockers,
            route: casePaths[0] || input.relatedAlerts[0]?.recommendedRoute,
            reasons: [
                `${item.confidence >= 0.75 ? 'High' : 'Review'} confidence activity row.`,
                item.affectedSectors?.length ? `Affected sectors: ${item.affectedSectors.slice(0, 3).join(', ')}.` : 'Affected sector is not returned.',
                ...sharedReasons,
            ],
        })
    })
    const victimRows = input.victimObservations.map((item, index) => priorityRow({
        rowId: queueRowId('victim', index, '', item.victim),
        label: item.victim,
        score: baseScore(item.confidence, /microsoft|solarwinds|federal|government|diplomatic/i.test(`${item.victim} ${item.sector}`) ? 'high' : 'medium'),
        state: priorityState(),
        sourceIds: uniqueStrings([...item.sourceIds, ...sourceIds]),
        captureIds,
        alertIds,
        casePaths,
        watchlistTerms: matchedTerms.length ? matchedTerms : candidateTerms,
        blockers: sharedBlockers,
        route: casePaths[0],
        reasons: [
            `Targeting evidence for ${item.country} and ${item.sector}.`,
            `Source basis: ${item.source}.`,
            ...sharedReasons,
        ],
    }))

    const rows = [...activityRows, ...victimRows]
    if (!rows.length) {
        rows.push(priorityRow({
            rowId: 'collection-searching',
            label: input.result.status === 'searching' ? 'Collection running' : 'No actionable rows returned',
            score: input.sourceProvenance.length ? 35 : 12,
            state: input.sourceProvenance.length ? 'review' : 'blocked',
            sourceIds,
            captureIds,
            alertIds,
            casePaths,
            watchlistTerms: candidateTerms,
            blockers: sharedBlockers,
            reasons: [
                input.sourceProvenance.length ? `${input.sourceProvenance.length} source row${input.sourceProvenance.length === 1 ? '' : 's'} returned.` : 'No source row is attached yet.',
                ...sharedReasons,
            ],
        }))
    }
    return rows.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, 12)
}

function priorityRow(input: Omit<PublicTiEvidencePriority, 'schemaVersion' | 'nextAction'>): PublicTiEvidencePriority {
    return {
        schemaVersion: 'ti.public_actor.evidence_priority.v1',
        ...input,
        score: Math.max(0, Math.min(100, input.score)),
        reasons: uniqueStrings(input.reasons).slice(0, 8),
        nextAction: input.state === 'ready'
            ? 'Open the related console record or prepare customer review.'
            : input.state === 'review'
                ? 'Review missing source, watchlist, alert, or freshness context before routing.'
                : 'Collect source provenance and organization context before routing.',
    }
}

function queueRowId(kind: 'activity' | 'victim', index: number, timestamp: string, label: string) {
    if (kind === 'activity') return `activity-${index}-${timestamp}-${label}`.toLowerCase()
    return `victim-${index}-${label}`.toLowerCase()
}

function buildPublicTiActionPayloads(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    exportPayloads: TiActionabilityModel['exportPayloads']
    consumerReadiness: ConsumerReadinessContract
    readiness: PublicTiReadinessContract
    orgRelevance: PublicTiOrgRelevanceProof
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    sourceHealthQueue: PublicTiSourceHealthQueue
}): PublicTiActionPayloadSet {
    const actorId = actorIdForQuery(input.result.query)
    const sourceIds = uniqueStrings(input.sourceProvenance.map(source => source.sourceId))
    const provenanceIds = input.sourceProvenance.map(source => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        provenance: source.provenance,
        captureId: source.captureId,
        confidence: source.confidence,
    }))
    const commonContext = {
        actorId,
        query: input.result.query,
        actorClass: input.actor.actorClass,
        aliases: input.result.aliases,
        generatedAt: input.result.generatedAt,
        readinessState: input.readiness.state,
        backedIds: input.readiness.backedIds,
        orgRelevance: input.orgRelevance,
        sourceIds,
        provenanceIds,
    }
    const watchlistTerms = readTermArray(input.exportPayloads.watchlist.body.terms)
    const watchlistBlockers = blockersForAction(input.readiness, ['missing_org', 'missing_source_provenance', 'stale_provenance', 'entitlement_blocked', ...(watchlistTerms.length ? [] : ['missing_org_watchlist'] as const)])
    const caseBlockers = blockersForAction(input.readiness, ['missing_org', 'missing_alert', 'missing_capture', 'missing_case_route', 'missing_source_provenance', 'stale_provenance', 'entitlement_blocked'])
    const webhookBlockers = blockersForAction(input.readiness, ['missing_org', 'missing_alert', 'missing_capture', 'missing_webhook_destination', 'missing_source_provenance', 'stale_provenance', 'entitlement_blocked', 'unavailable_contract'])
    const analystBlockers = input.readiness.blockers
    const sourceBlockers = blockersForAction(input.readiness, ['missing_source_provenance', 'missing_capture', 'stale_provenance'])

    return {
        schemaVersion: 'ti.public_actor.action_payloads.v1',
        actorId,
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        payloads: {
            watchlistAdd: actionPayload({
                kind: 'watchlist_add',
                label: 'Watchlist add request',
                actorId,
                result: input.result,
                route: '/v1/dwm/watchlists',
                backedRoute: input.exportPayloads.watchlist.backedRoute,
                body: {
                    ...input.exportPayloads.watchlist.body,
                    ...commonContext,
                    source: 'public_ti',
                    status: 'active',
                },
                provenance: input.exportPayloads.watchlist.provenance,
                blockedBy: watchlistBlockers,
            }),
            caseHandoff: actionPayload({
                kind: 'case_handoff',
                label: 'Case draft request',
                actorId,
                result: input.result,
                route: input.exportPayloads.case.endpoint ?? '/v1/cases',
                backedRoute: input.exportPayloads.case.backedRoute,
                body: {
                    ...input.exportPayloads.case.body,
                    ...commonContext,
                    source: 'public_ti',
                    noMutation: true,
                },
                provenance: input.exportPayloads.case.provenance,
                blockedBy: caseBlockers,
            }),
            webhookDelivery: actionPayload({
                kind: 'webhook_delivery',
                label: 'Webhook dry-run request',
                actorId,
                result: input.result,
                route: input.exportPayloads.webhookDelivery.endpoint ?? '/v1/dwm/webhooks/deliver',
                backedRoute: input.exportPayloads.webhookDelivery.backedRoute,
                body: {
                    ...input.exportPayloads.webhookDelivery.body,
                    ...commonContext,
                    dryRun: true,
                    noMutation: true,
                },
                provenance: input.exportPayloads.webhookDelivery.provenance,
                blockedBy: webhookBlockers,
            }),
            analystHandoffBundle: actionPayload({
                kind: 'analyst_handoff_bundle',
                label: 'Analyst handoff bundle',
                actorId,
                result: input.result,
                route: '/dashboard/dwm',
                backedRoute: '/dashboard/dwm',
                body: {
                    schemaVersion: input.consumerReadiness.consumerSchemaVersion,
                    ...commonContext,
                    stages: input.consumerReadiness.bundlePreview.stages,
                    readiness: input.readiness,
                    actionRoutes: {
                        watchlist: '/v1/dwm/watchlists',
                        alertRebuild: '/v1/dwm/alerts/rebuild',
                        case: '/v1/cases',
                        webhookDelivery: '/v1/dwm/webhooks/deliver',
                        enrichment: '/dashboard/ti/enrichment',
                    },
                },
                provenance: input.exportPayloads.blockers.provenance,
                blockedBy: analystBlockers,
            }),
            sourceEnrichment: actionPayload({
                kind: 'source_enrichment',
                label: 'Source enrichment request',
                actorId,
                result: input.result,
                route: input.exportPayloads.enrichment.backedRoute ?? '/dashboard/ti/enrichment',
                backedRoute: input.exportPayloads.enrichment.backedRoute,
                body: {
                    ...input.exportPayloads.enrichment.body,
                    ...commonContext,
                    tasks: input.enrichmentGapQueue,
                    sourceHealthQueue: input.sourceHealthQueue,
                    noMutation: true,
                },
                provenance: input.exportPayloads.enrichment.provenance,
                blockedBy: sourceBlockers,
            }),
        },
    }
}

function actionPayload<K extends PublicTiActionPayloadKind>(input: {
    kind: K
    label: string
    actorId: string
    result: TiSearchResponse
    route: string
    backedRoute?: string
    body: Record<string, unknown>
    provenance: TiHandoffExportPayload['provenance']
    blockedBy: PublicTiReadinessBlocker[]
}): PublicTiActionPayload<K> {
    const uniqueBlockers = uniqueBy(input.blockedBy, blocker => `${blocker.code}:${blocker.stage}:${blocker.field}`)
    return {
        schemaVersion: 'ti.public_actor.action_payload.v1',
        kind: input.kind,
        label: input.label,
        actorId: input.actorId,
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        method: 'POST',
        route: input.route,
        backedRoute: input.backedRoute,
        ready: uniqueBlockers.length === 0,
        unavailable: uniqueBlockers.length > 0,
        blockedBy: uniqueBlockers,
        body: input.body,
        provenance: input.provenance,
    }
}

function blockersForAction(readiness: PublicTiReadinessContract, codes: PublicTiReadinessBlocker['code'][]): PublicTiReadinessBlocker[] {
    const allowed = new Set(codes)
    return readiness.blockers.filter(blocker => allowed.has(blocker.code))
}

function actorIdForQuery(query: string) {
    return `actor:${query.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown'}`
}

function buildOrgRelevanceProof(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    exportPayloads: TiActionabilityModel['exportPayloads']
    readiness: PublicTiReadinessContract
}): PublicTiOrgRelevanceProof {
    const actorId = actorIdForQuery(input.result.query)
    const sourceEvidence = input.sourceProvenance.map(source => {
        const terms = readTermArray(input.exportPayloads.watchlist.body.terms)
            .filter(term => sourceSupportsTerm(source, term))
            .map(term => String(term.value))
        const actorEvidence = actorEvidenceForSource(input.actor, source)
        return {
            sourceId: source.sourceId,
            sourceName: source.sourceName,
            provenance: source.provenance,
            reportDate: actorEvidence?.reportDate,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceFamily: source.sourceFamily,
            parserStatus: source.parserStatus,
            lastCollectedAt: source.lastCollectedAt,
            confidence: source.confidence,
            supportsTerms: uniqueStrings(terms.length ? terms : readTermArray(input.exportPayloads.watchlist.body.terms).map(term => String(term.value))),
            shownBecause: actorEvidence?.shownBecause ?? 'Returned as evidence for watchlist, alert, or case handoff.',
        }
    })
    const evidenceRefs = sourceEvidence.flatMap(source => [
        source.sourceId,
        source.captureId,
        source.provenance,
    ]).filter((value): value is string => Boolean(value))
    const candidateTerms = readTermArray(input.exportPayloads.watchlist.body.terms).map(term => {
        const value = String(term.value)
        return {
            kind: normalizeKind(String(term.kind)),
            value,
            notes: typeof term.notes === 'string' ? term.notes : '',
            matched: input.matches.some(match => match.kind === normalizeKind(String(term.kind)) && match.value.toLowerCase() === value.toLowerCase()),
            sourceEvidenceRefs: uniqueStrings(evidenceRefs),
        }
    })
    const alertCaseRefs = input.relatedAlerts.map(alert => ({
        alertId: alert.id,
        casePath: alert.casePath ?? alert.deliveryReadinessContext?.casePath,
        caseIdCandidate: alert.caseIdCandidate,
        organizationId: alert.organizationId,
        tenantId: alert.tenantId,
        captureIds: uniqueStrings([...(alert.captureIds ?? []), ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? [])]),
        webhookDestinationIds: uniqueStrings([...(alert.webhookDestinationIds ?? []), ...(alert.deliveryReadinessContext?.webhookDestinationIds ?? [])]),
    }))
    const actorIdentity = actorIdentityForOrgRelevance(input.result, input.actor)
    const sourceCoverage = sourceCoverageForOrgRelevance(sourceEvidence, input.readiness.blockers)
    const orgEnrichmentGaps = orgRelevanceEnrichmentGaps({
        actorIdentity,
        sourceCoverage,
        sourceEvidence,
        freshness: input.actor.freshness,
    })
    const affectedEntities = buildAffectedEntities({
        result: input.result,
        actor: input.actor,
        matches: input.matches,
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
    })
    const blockers = input.readiness.blockers.filter(blocker => [
        'missing_org',
        'missing_org_watchlist',
        'missing_source_provenance',
        'missing_alert',
        'missing_capture',
        'missing_case_route',
        'missing_webhook_destination',
        'stale_provenance',
    ].includes(blocker.code))
    const watchlistIntersections = buildWatchlistIntersections({
        matches: input.matches,
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
        blockers,
    })
    const handoffRows = buildOrgRelevanceRows({
        actorId,
        matches: input.matches,
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
        enrichmentGaps: input.enrichmentGaps,
        orgEnrichmentGaps,
        blockers,
    })
    const state: PublicTiOrgRelevanceProof['state'] = blockers.length === 0
        ? 'ready'
        : sourceEvidence.length || candidateTerms.length || input.matches.length || alertCaseRefs.length ? 'review' : 'blocked'

    return {
        schemaVersion: 'ti.public_actor.org_relevance.v1',
        state,
        actorId,
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        freshness: input.actor.freshness,
        actorIdentity,
        sourceCoverage,
        enrichmentGaps: orgEnrichmentGaps,
        watchlistIntersections,
        organizationRefs: input.matches.map(match => ({
            tenantId: match.tenantId,
            organizationId: match.organizationId,
            watchlistId: match.watchlistId,
            watchlistItemId: match.watchlistItemId,
            kind: match.kind,
            value: match.value,
            route: match.route,
            casePath: match.casePath,
        })),
        candidateTerms,
        sourceEvidence,
        alertCaseRefs,
        affectedEntities,
        handoffRows,
        handoffRoutes: {
            watchlist: '/v1/dwm/watchlists',
            alertRebuild: '/v1/dwm/alerts/rebuild',
            case: '/v1/cases',
            webhookDelivery: '/v1/dwm/webhooks/deliver',
        },
        blockers,
    }
}

function buildWatchlistIntersections(input: {
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidateTerms: PublicTiOrgRelevanceProof['candidateTerms']
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    alertCaseRefs: PublicTiOrgRelevanceProof['alertCaseRefs']
    blockers: PublicTiReadinessBlocker[]
}): PublicTiOrgWatchlistIntersection[] {
    const terms = input.candidateTerms.length
        ? input.candidateTerms
        : input.matches.map(match => ({
            kind: match.kind,
            value: match.value,
            notes: '',
            matched: true,
            sourceEvidenceRefs: sourceRefsForTerm(match.value, input.sourceEvidence),
        }))
    const alertCaseIds = uniqueStrings(input.alertCaseRefs.flatMap(ref => [ref.caseIdCandidate]))
    const casePaths = uniqueStrings(input.alertCaseRefs.flatMap(ref => [ref.casePath]))
    const alertIds = uniqueStrings(input.alertCaseRefs.map(ref => ref.alertId))
    const captureIds = uniqueStrings(input.alertCaseRefs.flatMap(ref => ref.captureIds))
    const webhookDestinationIds = uniqueStrings(input.alertCaseRefs.flatMap(ref => ref.webhookDestinationIds))

    return uniqueBy(terms.map(term => {
        const matches = input.matches.filter(match => match.kind === term.kind && match.value.toLowerCase() === term.value.toLowerCase())
        const match = matches[0]
        const refs = uniqueStrings([
            ...term.sourceEvidenceRefs,
            ...matches.flatMap(item => [item.watchlistId, item.watchlistItemId, item.route, item.casePath]),
        ])
        const sourceFamilies = uniqueStrings(input.sourceEvidence
            .filter(source => refs.some(ref => ref === source.sourceId || ref === source.captureId || ref === source.provenance) || source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase()))
            .map(source => sourceFamilyForEvidence(source)))
        const blockers = intersectionBlockers({ term, match, refs, captureIds, alertIds, inputBlockers: input.blockers })
        const hasWatchlist = Boolean(match?.organizationId && match.watchlistId && match.watchlistItemId)
        const state: PublicTiOrgWatchlistIntersection['state'] = blockers.some(blocker => blocker.code === 'missing_org' || blocker.code === 'missing_org_watchlist' || blocker.code === 'missing_source_provenance')
            ? 'blocked'
            : hasWatchlist && alertIds.length && casePaths.length ? 'ready' : 'review'
        return {
            intersectionId: `intersection:${term.kind}:${term.value.toLowerCase()}`,
            kind: term.kind,
            value: term.value,
            state,
            tenantId: match?.tenantId,
            organizationId: match?.organizationId,
            watchlistId: match?.watchlistId,
            watchlistItemId: match?.watchlistItemId,
            route: match?.casePath ?? match?.route ?? '/v1/dwm/watchlists',
            casePath: match?.casePath ?? casePaths[0],
            sourceEvidenceRefs: refs,
            sourceFamilies: sourceFamilies as PublicTiOrgSourceFamily[],
            alertIds,
            caseIds: alertCaseIds,
            casePaths,
            captureIds,
            webhookDestinationIds,
            recommendedAction: recommendedIntersectionAction({ hasWatchlist, alertIds, casePaths, captureIds, refs }),
            blockers,
        }
    }), item => item.intersectionId).slice(0, 24)
}

function intersectionBlockers(input: {
    term: PublicTiOrgRelevanceProof['candidateTerms'][number]
    match?: NonNullable<TiActionabilityContract['watchlistMatches']>[number]
    refs: string[]
    captureIds: string[]
    alertIds: string[]
    inputBlockers: PublicTiReadinessBlocker[]
}) {
    const needed = new Set<PublicTiReadinessBlocker['code']>()
    if (!input.match?.organizationId) needed.add('missing_org')
    if (!input.match?.watchlistId || !input.match?.watchlistItemId) needed.add('missing_org_watchlist')
    if (!input.refs.length) needed.add('missing_source_provenance')
    if (!input.captureIds.length) needed.add('missing_capture')
    if (!input.alertIds.length && input.match?.watchlistItemId) needed.add('missing_alert')
    if (!input.term.matched && !input.match) needed.add('missing_org_watchlist')
    return input.inputBlockers.filter(blocker => needed.has(blocker.code))
}

function recommendedIntersectionAction(input: {
    hasWatchlist: boolean
    alertIds: string[]
    casePaths: string[]
    captureIds: string[]
    refs: string[]
}): PublicTiOrgWatchlistIntersection['recommendedAction'] {
    if (!input.refs.length || !input.captureIds.length) return 'attach_source_evidence'
    if (!input.hasWatchlist) return 'persist_watchlist_item'
    if (!input.alertIds.length) return 'rebuild_alerts'
    if (input.casePaths.length) return 'open_case'
    return 'open_watchlist_item'
}

function sourceSupportsTerm(source: NonNullable<TiActionabilityContract['sourceProvenance']>[number], term: Record<string, unknown>) {
    const haystack = `${source.sourceId ?? ''} ${source.sourceName} ${source.provenance}`.toLowerCase()
    const value = typeof term.value === 'string' ? term.value.toLowerCase() : ''
    return Boolean(value && haystack.includes(value.toLowerCase()))
}

function actorEvidenceForSource(actor: TiActorIntelligenceProfile, source: NonNullable<TiActionabilityContract['sourceProvenance']>[number]) {
    const sourceKey = `${source.sourceId ?? ''}:${source.captureId ?? ''}:${source.provenance}`.toLowerCase()
    return actor.provenanceRows.find(row => {
        const rowKey = `${row.sourceId ?? ''}:${row.captureId ?? ''}:${row.provenance}`.toLowerCase()
        return Boolean(
            rowKey === sourceKey
            || (source.captureId && row.captureId === source.captureId)
            || (source.sourceId && row.sourceId === source.sourceId)
            || row.provenance === source.provenance
        )
    })
}

function actorIdentityForOrgRelevance(result: TiSearchResponse, actor: TiActorIntelligenceProfile): PublicTiActorIdentity {
    return {
        canonicalName: result.query,
        aliases: uniqueStrings(result.aliases),
        actorClass: actor.actorClass,
        sectors: uniqueStrings(actor.targetSectors),
        regions: uniqueStrings(actor.geographies),
        motivations: uniqueStrings(actor.motivation),
    }
}

function sourceCoverageForOrgRelevance(sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence'], blockers: PublicTiReadinessBlocker[]): PublicTiOrgSourceCoverage[] {
    const missingCapture = blockers.some(blocker => blocker.code === 'missing_capture')
    return sourceEvidence.map(source => ({
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        sourceFamily: sourceFamilyForEvidence(source),
        provenance: source.provenance,
        captureId: source.captureId,
        sourceRequestId: source.sourceRequestId,
        parserStatus: source.parserStatus,
        confidence: source.confidence,
        status: source.captureId ? 'capture_ready' : missingCapture ? 'missing_capture' : 'public_reference',
        lastCollectedAt: source.lastCollectedAt || source.reportDate,
        supportsTerms: uniqueStrings(source.supportsTerms),
    }))
}

function orgRelevanceEnrichmentGaps(input: {
    actorIdentity: PublicTiActorIdentity
    sourceCoverage: PublicTiOrgSourceCoverage[]
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    freshness: TiActorIntelligenceProfile['freshness']
}): PublicTiOrgRelevanceEnrichmentGap[] {
    const gaps: PublicTiOrgRelevanceEnrichmentGap[] = []
    if (!input.actorIdentity.aliases.length) gaps.push(orgGap('missing_actor_aliases', 'public-ti', 'actorIdentity.aliases', 'Add known aliases before alert or watchlist handoff.', '/dashboard/ti/enrichment', 'actor_profile'))
    if (!input.actorIdentity.sectors.length) gaps.push(orgGap('missing_target_sectors', 'public-ti', 'actorIdentity.sectors', 'Attach target-sector evidence before routing this actor to a customer watchlist.', '/dashboard/ti/enrichment', 'actor_profile'))
    if (!input.actorIdentity.regions.length) gaps.push(orgGap('missing_target_regions', 'public-ti', 'actorIdentity.regions', 'Attach target-region evidence before regional exposure review.', '/dashboard/ti/enrichment', 'geography'))
    if (!input.sourceCoverage.length) gaps.push(orgGap('missing_source_coverage', 'source', 'sourceCoverage', 'Attach at least one source coverage row for this actor result.', '/dashboard/ti/sources', 'source_capture'))
    if (!input.sourceEvidence.length) gaps.push(orgGap('missing_provenance', 'source', 'sourceEvidence', 'Source provenance is required before org relevance can be reviewed.', '/dashboard/ti/enrichment', 'source_capture'))
    if (input.freshness.stale) gaps.push(orgGap('stale_evidence', 'source', 'freshness.lastSeen', input.freshness.reason, '/dashboard/ti/enrichment', 'source_capture'))
    return uniqueBy(gaps, gap => `${gap.code}:${gap.field}`)
}

function orgGap(
    code: PublicTiOrgRelevanceEnrichmentGap['code'],
    ownerLane: PublicTiOrgRelevanceEnrichmentGap['ownerLane'],
    field: string,
    detail: string,
    route: string,
    sourceFamily: PublicTiOrgSourceFamily,
): PublicTiOrgRelevanceEnrichmentGap {
    return {
        code,
        ownerLane,
        field,
        detail,
        route,
        sourceFamily,
        recoverable: true,
    }
}

function buildAffectedEntities(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidateTerms: PublicTiOrgRelevanceProof['candidateTerms']
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    alertCaseRefs: PublicTiOrgRelevanceProof['alertCaseRefs']
}): PublicTiOrgRelevanceProof['affectedEntities'] {
    const evidenceRefs = uniqueStrings(input.sourceEvidence.flatMap(source => [source.sourceId, source.captureId, source.provenance]))
    const alertIds = input.alertCaseRefs.map(ref => ref.alertId)
    const entityFor = (kind: PublicTiAffectedEntity['kind'], value: string, sourceFamily: PublicTiOrgSourceFamily): PublicTiAffectedEntity => {
        const matchedTerms = input.matches.filter(match => match.value.toLowerCase() === value.toLowerCase())
        return {
            kind,
            value,
            matched: matchedTerms.length > 0 || input.candidateTerms.some(term => term.value.toLowerCase() === value.toLowerCase() && term.matched),
            sourceFamily,
            provenanceRefs: evidenceRefs,
            watchlistItemIds: uniqueStrings(matchedTerms.map(match => match.watchlistItemId)),
            alertIds,
        }
    }
    const vendorValues = uniqueStrings([
        ...input.candidateTerms.filter(term => term.kind === 'company' || term.kind === 'vendor').map(term => term.value),
        ...input.matches.filter(match => match.kind === 'company' || match.kind === 'vendor').map(match => match.value),
    ])
    const domainValues = uniqueStrings([
        ...input.candidateTerms.filter(term => term.kind === 'domain').map(term => term.value),
        ...input.matches.filter(match => match.kind === 'domain').map(match => match.value),
        ...input.sourceEvidence.map(source => domainFromUrl(source.provenance)).filter((value): value is string => Boolean(value)),
    ])
    const regionValues = uniqueStrings([
        ...input.actor.geographies,
        ...input.result.targets.flatMap(target => target.regions),
        ...input.result.recentActivity.flatMap(activity => activity.countries ?? []),
    ])

    return {
        vendors: vendorValues.map(value => entityFor('vendor', value, 'watchlist')).slice(0, 12),
        domains: domainValues.map(value => entityFor('domain', value, 'source_capture')).slice(0, 12),
        regions: regionValues.map(value => entityFor('region', value, 'geography')).slice(0, 12),
    }
}

function buildOrgRelevanceRows(input: {
    actorId: string
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    candidateTerms: PublicTiOrgRelevanceProof['candidateTerms']
    sourceEvidence: PublicTiOrgRelevanceProof['sourceEvidence']
    alertCaseRefs: PublicTiOrgRelevanceProof['alertCaseRefs']
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    orgEnrichmentGaps: PublicTiOrgRelevanceEnrichmentGap[]
    blockers: PublicTiReadinessBlocker[]
}): PublicTiOrgRelevanceRow[] {
    const rowBlockers = (codes: PublicTiReadinessBlocker['code'][]) => input.blockers.filter(blocker => codes.includes(blocker.code))
    const rows: PublicTiOrgRelevanceRow[] = []

    for (const match of input.matches) {
        const provenanceRefs = uniqueStrings([
            match.watchlistId,
            match.watchlistItemId,
            ...sourceRefsForTerm(match.value, input.sourceEvidence),
        ])
        rows.push({
            rowId: `watchlist:${match.watchlistItemId ?? match.value}`,
            kind: 'watchlist_match',
            state: match.organizationId && match.watchlistId && match.watchlistItemId ? 'ready' : 'blocked',
            ownerLane: 'org',
            label: match.value,
            action: 'Open saved watchlist item',
            route: match.casePath ?? match.route ?? '/dashboard/dwm',
            sourceFamily: 'watchlist',
            provenanceRefs,
            tenantId: match.tenantId,
            organizationId: match.organizationId,
            watchlistId: match.watchlistId,
            watchlistItemId: match.watchlistItemId,
            captureIds: [],
            webhookDestinationIds: [],
            evidence: rowEvidenceFor(provenanceRefs, input.sourceEvidence, `Saved watchlist item for ${match.value}.`),
            blockers: match.organizationId && match.watchlistId && match.watchlistItemId ? [] : rowBlockers(['missing_org', 'missing_org_watchlist']),
        })
    }

    for (const term of input.candidateTerms) {
        const blockers = term.matched ? [] : rowBlockers(['missing_org_watchlist'])
        const provenanceRefs = uniqueStrings(term.sourceEvidenceRefs)
        rows.push({
            rowId: `term:${term.kind}:${term.value.toLowerCase()}`,
            kind: 'candidate_term',
            state: blockers.length ? 'blocked' : term.matched ? 'ready' : 'review',
            ownerLane: 'org',
            label: `${term.kind}: ${term.value}`,
            action: term.matched ? 'Use matched watchlist item' : 'Persist as watchlist item',
            route: '/v1/dwm/watchlists',
            sourceFamily: 'watchlist',
            provenanceRefs,
            captureIds: provenanceRefs.filter(ref => /^capture/i.test(ref)),
            webhookDestinationIds: [],
            evidence: rowEvidenceFor(provenanceRefs, input.sourceEvidence, term.notes || `Candidate watchlist term for ${term.value}.`),
            blockers,
        })
    }

    for (const source of input.sourceEvidence) {
        const blockers = source.captureId ? [] : rowBlockers(['missing_capture'])
        const provenanceRefs = uniqueStrings([source.sourceId, source.captureId, source.provenance])
        rows.push({
            rowId: `source:${source.sourceId ?? source.sourceName}:${source.captureId ?? source.provenance}`,
            kind: 'source_evidence',
            state: blockers.length ? 'blocked' : 'ready',
            ownerLane: 'source',
            label: source.sourceName,
            action: source.captureId ? 'Use capture as evidence' : 'Attach capture ID',
            route: '/dashboard/ti/enrichment',
            sourceFamily: sourceFamilyForEvidence(source),
            provenanceRefs,
            captureIds: uniqueStrings([source.captureId]),
            webhookDestinationIds: [],
            evidence: rowEvidenceFor(provenanceRefs, input.sourceEvidence, source.shownBecause),
            blockers,
        })
    }

    for (const alert of input.alertCaseRefs) {
        const caseBlockers = alert.casePath ? [] : rowBlockers(['missing_case_route'])
        const captureBlockers = alert.captureIds.length ? [] : rowBlockers(['missing_capture'])
        const blockers = uniqueBy([...caseBlockers, ...captureBlockers], blocker => `${blocker.code}:${blocker.field}`)
        const alertProvenanceRefs = uniqueStrings([alert.alertId, alert.caseIdCandidate, alert.casePath, ...alert.captureIds])
        rows.push({
            rowId: `alert:${alert.alertId}`,
            kind: 'alert_case',
            state: blockers.length ? 'blocked' : 'ready',
            ownerLane: 'case',
            label: alert.alertId,
            action: alert.casePath ? 'Open related case' : 'Create case route',
            route: alert.casePath ?? '/v1/cases',
            sourceFamily: alert.casePath ? 'case' : 'alert',
            provenanceRefs: alertProvenanceRefs,
            tenantId: alert.tenantId,
            organizationId: alert.organizationId,
            alertId: alert.alertId,
            casePath: alert.casePath,
            captureIds: alert.captureIds,
            webhookDestinationIds: alert.webhookDestinationIds,
            evidence: rowEvidenceFor(alertProvenanceRefs, input.sourceEvidence, `Related alert ${alert.alertId} is attached to this actor result.`),
            blockers,
        })
        const webhookProvenanceRefs = uniqueStrings([alert.alertId, ...alert.captureIds, ...alert.webhookDestinationIds])
        rows.push({
            rowId: `webhook:${alert.alertId}`,
            kind: 'webhook_delivery',
            state: alert.webhookDestinationIds.length ? 'ready' : 'blocked',
            ownerLane: 'webhook',
            label: alert.alertId,
            action: alert.webhookDestinationIds.length ? 'Prepare delivery dry run' : 'Attach webhook destination',
            route: '/v1/dwm/webhooks/deliver',
            sourceFamily: 'webhook',
            provenanceRefs: webhookProvenanceRefs,
            tenantId: alert.tenantId,
            organizationId: alert.organizationId,
            alertId: alert.alertId,
            casePath: alert.casePath,
            captureIds: alert.captureIds,
            webhookDestinationIds: alert.webhookDestinationIds,
            evidence: rowEvidenceFor(webhookProvenanceRefs, input.sourceEvidence, `Webhook delivery readiness for alert ${alert.alertId}.`),
            blockers: alert.webhookDestinationIds.length ? [] : rowBlockers(['missing_webhook_destination']),
        })
    }

    for (const gap of input.enrichmentGaps) {
        const provenanceRefs = uniqueStrings([gap.id, gap.dependency])
        rows.push({
            rowId: `gap:${gap.id}`,
            kind: 'enrichment_gap',
            state: gap.severity === 'high' ? 'blocked' : 'review',
            ownerLane: ownerLaneForGap(gap),
            label: gap.title,
            action: gap.dependency,
            route: gap.route ?? routeForGap(gap),
            sourceFamily: gap.sourceFamily ?? sourceFamilyForGap(gap),
            provenanceRefs,
            captureIds: [],
            webhookDestinationIds: [],
            evidence: {
                summary: gap.detail,
            },
            blockers: blockersForGap(gap, input.blockers),
        })
    }

    for (const gap of input.orgEnrichmentGaps) {
        rows.push({
            rowId: `org-gap:${gap.code}:${gap.field}`,
            kind: 'enrichment_gap',
            state: gap.code === 'stale_evidence' || gap.code === 'missing_provenance' || gap.code === 'missing_source_coverage' ? 'blocked' : 'review',
            ownerLane: gap.ownerLane,
            label: formatGapCode(gap.code),
            action: gap.detail,
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            provenanceRefs: uniqueStrings([gap.field]),
            captureIds: [],
            webhookDestinationIds: [],
            evidence: {
                summary: gap.detail,
            },
            blockers: [],
        })
    }

    for (const blocker of input.blockers) {
        if (rows.some(row => row.blockers.some(rowBlocker => rowBlocker.code === blocker.code && rowBlocker.field === blocker.field))) continue
        rows.push({
            rowId: `blocker:${blocker.code}:${blocker.field}`,
            kind: 'enrichment_gap',
            state: 'blocked',
            ownerLane: blocker.ownerLane,
            label: blocker.detail,
            action: blocker.handoff,
            route: blocker.route,
            sourceFamily: sourceFamilyForReadinessBlocker(blocker),
            provenanceRefs: uniqueStrings([blocker.field, blocker.handoff]),
            captureIds: [],
            webhookDestinationIds: [],
            evidence: {
                summary: blocker.detail,
            },
            blockers: [blocker],
        })
    }

    return uniqueBy(rows, row => row.rowId).slice(0, 48)
}

function formatGapCode(code: PublicTiOrgRelevanceEnrichmentGap['code']) {
    return code.replace(/_/g, ' ')
}

function sourceRefsForTerm(value: string, sources: PublicTiOrgRelevanceProof['sourceEvidence']) {
    return sources
        .filter(source => source.supportsTerms.some(term => term.toLowerCase() === value.toLowerCase()))
        .flatMap(source => [source.sourceId, source.captureId, source.provenance])
        .filter((ref): ref is string => Boolean(ref))
}

function rowEvidenceFor(refs: string[], sources: PublicTiOrgRelevanceProof['sourceEvidence'], fallbackSummary: string): PublicTiOrgRelevanceEvidence {
    const source = sources.find(item => refs.some(ref => ref === item.sourceId || ref === item.captureId || ref === item.provenance)) ?? sources[0]
    if (!source) {
        return {
            summary: fallbackSummary,
        }
    }
    return {
        sourceId: source.sourceId,
        sourceName: source.sourceName,
        provenance: source.provenance,
        reportDate: source.reportDate,
        captureId: source.captureId,
        confidence: source.confidence,
        summary: source.shownBecause || fallbackSummary,
    }
}

function sourceFamilyForEvidence(source: PublicTiOrgRelevanceProof['sourceEvidence'][number]): PublicTiOrgSourceFamily {
    if (source.sourceFamily) return source.sourceFamily
    const text = `${source.sourceId ?? ''} ${source.sourceName} ${source.provenance}`.toLowerCase()
    if (/microsoft|google|cisa|mandiant|crowdstrike|proofpoint|sentinelone|palo alto|unit 42|recorded future|secureworks/.test(text)) return 'vendor_disclosure'
    if (source.captureId) return 'source_capture'
    return 'public_ti'
}

function ownerLaneForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]): PublicTiReadinessBlocker['ownerLane'] {
    const family = gap.sourceFamily ?? sourceFamilyForGap(gap)
    if (family === 'watchlist') return 'org'
    if (family === 'alert') return 'alert'
    if (family === 'case') return 'case'
    if (family === 'source_capture' || family === 'indicator') return 'source'
    return 'public-ti'
}

function blockersForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number], blockers: PublicTiReadinessBlocker[]) {
    const family = gap.sourceFamily ?? sourceFamilyForGap(gap)
    if (family === 'source_capture') return blockers.filter(blocker => blocker.code === 'missing_capture' || blocker.code === 'missing_source_provenance')
    if (family === 'watchlist') return blockers.filter(blocker => blocker.code === 'missing_org' || blocker.code === 'missing_org_watchlist')
    if (family === 'alert') return blockers.filter(blocker => blocker.code === 'missing_alert')
    if (family === 'case') return blockers.filter(blocker => blocker.code === 'missing_case_route')
    return blockers.filter(blocker => blocker.code === 'stale_provenance')
}

function sourceFamilyForReadinessBlocker(blocker: PublicTiReadinessBlocker): PublicTiOrgSourceFamily {
    if (blocker.ownerLane === 'org') return 'watchlist'
    if (blocker.ownerLane === 'alert') return 'alert'
    if (blocker.ownerLane === 'case') return 'case'
    if (blocker.ownerLane === 'webhook') return 'webhook'
    if (blocker.ownerLane === 'source') return 'source_capture'
    return 'public_ti'
}

function buildPublicTiReadiness(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    contract: TiActionabilityContract | undefined
    exportPayloads: TiActionabilityModel['exportPayloads']
    consumerReadiness: ConsumerReadinessContract
}): PublicTiReadinessContract {
    const tenantIds = uniqueStrings([
        ...input.matches.map(match => match.tenantId),
        ...input.relatedAlerts.map(alert => alert.tenantId),
    ])
    const organizationIds = uniqueStrings([
        ...input.matches.map(match => match.organizationId),
        ...input.relatedAlerts.map(alert => alert.organizationId),
    ])
    const watchlistIds = uniqueStrings(input.matches.map(match => match.watchlistId))
    const watchlistItemIds = uniqueStrings(input.matches.map(match => match.watchlistItemId))
    const alertIds = uniqueStrings(input.relatedAlerts.map(alert => alert.id))
    const caseIds = uniqueStrings([
        ...input.relatedCases.map(item => item.id),
        ...input.relatedAlerts.map(alert => alert.caseIdCandidate),
    ])
    const casePaths = uniqueStrings([
        ...input.relatedCases.map(item => item.path),
        ...input.relatedAlerts.map(alert => alert.casePath),
        ...input.relatedAlerts.map(alert => alert.deliveryReadinessContext?.casePath),
    ])
    const captureIds = uniqueStrings([
        ...input.sourceProvenance.map(source => source.captureId),
        ...input.relatedAlerts.flatMap(alert => alert.captureIds ?? []),
        ...input.relatedAlerts.flatMap(alert => alert.deliveryReadinessContext?.selectedCaptureIds ?? []),
    ])
    const webhookDestinationIds = uniqueStrings([
        ...(input.contract?.relatedWebhookDestinations ?? []).filter(destination => destination.status === 'active').map(destination => destination.id),
        ...input.relatedAlerts.flatMap(alert => alert.webhookDestinationIds ?? []),
        ...input.relatedAlerts.flatMap(alert => alert.deliveryReadinessContext?.webhookDestinationIds ?? []),
    ])
    const blockers: PublicTiReadinessBlocker[] = []
    const hasWatchlistTerms = readTermArray(input.exportPayloads.watchlist.body.terms).length > 0
    const hasOrgContext = organizationIds.length > 0
    const hasAlertContext = alertIds.length > 0

    if (!hasOrgContext) blockers.push(readinessBlocker('missing_org', 'watchlist', 'org', 'watchlistMatches[].organizationId', 'Organization context is required before watchlist, alert, case, or delivery handoff can mutate customer state.', '/dashboard/dwm', 'Open the authenticated console and choose the customer organization before saving watchlist terms.', 'consumer_readiness'))
    if (!watchlistIds.length || !watchlistItemIds.length) blockers.push(readinessBlocker('missing_org_watchlist', 'watchlist', 'org', 'watchlistMatches[].watchlistId', hasWatchlistTerms ? 'Candidate watchlist terms exist, but no persisted organization watchlist item is attached.' : 'No candidate or persisted organization watchlist term is attached to this result.', '/dashboard/dwm', hasWatchlistTerms ? 'Create or select the customer watchlist, then rebuild alerts from the saved items.' : 'Collect a customer-relevant company, domain, vendor, or sector term before rebuilding alerts.', 'consumer_readiness'))
    if (!input.sourceProvenance.length) blockers.push(readinessBlocker('missing_source_provenance', 'source', 'source', 'sourceProvenance[]', 'No source provenance row is attached to this result.', '/dashboard/ti/enrichment', 'Attach source name, source ID, provenance, report date, and confidence before using this result for alerting.', 'public_result'))
    if (input.actor.freshness.stale) blockers.push(readinessBlocker('stale_provenance', 'public_ti', 'public-ti', 'actorIntelligence.freshness', input.actor.freshness.reason, '/dashboard/ti/enrichment', 'Refresh the actor profile or attach newer corroborating evidence before claiming alert-ready status.', 'public_result'))
    if (!alertIds.length) blockers.push(readinessBlocker('missing_alert', 'alert', 'alert', 'relatedAlerts[].id', 'No generated alert ID is attached to this actor result.', '/dashboard/dwm', 'Rebuild alerts from persisted watchlist items and return the alert ID.', 'consumer_readiness'))
    if (!captureIds.length) blockers.push(readinessBlocker('missing_capture', 'source', 'source', 'sourceProvenance[].captureId', 'No replayable capture ID is attached for case evidence or delivery dry-run.', '/dashboard/ti/enrichment', 'Attach capture IDs or source request IDs to the provenance rows.', 'consumer_readiness'))
    if (!casePaths.length) blockers.push(readinessBlocker('missing_case_route', 'case', 'case', 'relatedCases[].path', 'No case route or case path is attached to this result.', '/dashboard/ti/workbench', 'Return relatedCases[].path or relatedAlerts[].casePath after case creation is available.', 'consumer_readiness'))
    if (!webhookDestinationIds.length) blockers.push(readinessBlocker('missing_webhook_destination', 'webhook', 'webhook', 'relatedWebhookDestinations[].id', 'No active webhook destination ID is attached for dry-run delivery.', '/dashboard/dwm', 'Attach an active webhook destination before preparing customer delivery.', 'consumer_readiness'))

    if (hasOrgContext && !input.contract?.entitlementReadiness) {
        blockers.push(readinessBlocker('unavailable_contract', 'entitlement', 'entitlement', 'actionability.entitlementReadiness', 'Entitlement readiness was not returned with the public TI result.', '/dashboard/dwm', 'Load organization entitlement readiness before enabling watchlist, alert, case, or delivery mutation.', 'entitlement_readiness'))
    }
    if (hasAlertContext && input.relatedAlerts.every(alert => !alert.deliveryReadinessContext)) {
        blockers.push(readinessBlocker('unavailable_contract', 'webhook', 'webhook', 'relatedAlerts[].deliveryReadinessContext', 'Alert delivery readiness was not returned with the related alert.', '/dashboard/dwm', 'Return delivery readiness context with capture, case, destination, replay, and entitlement fields.', 'delivery_readiness'))
    }

    const entitlementActions = Object.values(input.contract?.entitlementReadiness?.actions ?? {})
    for (const action of entitlementActions.filter(action => action.status === 'blocked')) {
        const blockerCode = action.blockerCodes?.[0] ?? action.blockers?.[0]?.blockerCode ?? 'entitlement_blocked'
        blockers.push(readinessBlocker('entitlement_blocked', 'entitlement', 'entitlement', `entitlementReadiness.actions.${action.ownerLane ?? 'action'}`, action.dashboardText || action.blockers?.[0]?.dashboardText || `Entitlement blocked ${blockerCode}.`, action.route || action.blockers?.[0]?.route || '/dashboard/dwm', action.helpdeskText || action.blockers?.[0]?.supportText || 'Review organization entitlement limits before retrying this handoff.', 'entitlement_readiness'))
    }

    for (const alert of input.relatedAlerts) {
        for (const code of alert.deliveryReadinessContext?.blockerCodes ?? []) {
            if (code === 'missing_capture_evidence') blockers.push(readinessBlocker('missing_capture', 'source', 'source', `relatedAlerts.${alert.id}.deliveryReadinessContext.selectedCaptureIds`, 'Delivery readiness reports missing capture evidence.', '/dashboard/ti/enrichment', 'Attach capture IDs and evidence count before delivery or replay.', 'delivery_readiness'))
            if (code === 'case_route_unavailable') blockers.push(readinessBlocker('missing_case_route', 'case', 'case', `relatedAlerts.${alert.id}.deliveryReadinessContext.casePath`, 'Delivery readiness reports that the case route is unavailable.', '/dashboard/ti/workbench', 'Return case path and case ID candidate from the case workflow before handoff.', 'delivery_readiness'))
            if (code === 'delivery_disabled') blockers.push(readinessBlocker('missing_webhook_destination', 'webhook', 'webhook', `relatedAlerts.${alert.id}.deliveryReadinessContext.webhookDestinationIds`, 'Delivery readiness reports that webhook delivery is not configured.', '/dashboard/dwm', 'Attach an active webhook destination or mark delivery intentionally disabled.', 'delivery_readiness'))
            if (code === 'entitlement_denied') blockers.push(readinessBlocker('entitlement_blocked', 'entitlement', 'entitlement', `relatedAlerts.${alert.id}.deliveryReadinessContext.entitlement`, 'Delivery readiness reports an entitlement denial.', '/dashboard/dwm', 'Resolve organization entitlement before replay, delivery, or alert rebuild.', 'delivery_readiness'))
        }
    }

    const uniqueBlockers = uniqueBy(blockers, blocker => `${blocker.code}:${blocker.stage}:${blocker.field}`)
    const hasWorkableEvidence = input.sourceProvenance.length > 0 || hasWatchlistTerms || input.matches.length > 0 || hasAlertContext
    const state: PublicTiReadinessContract['state'] = uniqueBlockers.length === 0
        ? 'ready'
        : uniqueBlockers.some(blocker => blocker.code === 'entitlement_blocked' || blocker.code === 'missing_source_provenance') && !hasWorkableEvidence ? 'blocked'
            : hasWorkableEvidence ? 'degraded' : 'blocked'

    return {
        schemaVersion: 'ti.public_actor.readiness.v1',
        state,
        generatedAt: input.result.generatedAt,
        backedIds: {
            tenantIds,
            organizationIds,
            watchlistIds,
            watchlistItemIds,
            alertIds,
            caseIds,
            casePaths,
            captureIds,
            webhookDestinationIds,
        },
        blockers: uniqueBlockers,
    }
}

function readinessBlocker(code: PublicTiReadinessBlocker['code'], stage: PublicTiReadinessBlocker['stage'], ownerLane: PublicTiReadinessBlocker['ownerLane'], field: string, detail: string, route: string, handoff: string, source: PublicTiReadinessBlocker['source']): PublicTiReadinessBlocker {
    return {
        schemaVersion: 'ti.public_actor.readiness_blocker.v1',
        code,
        stage,
        ownerLane,
        field,
        detail,
        handoff,
        route,
        recoverable: code !== 'stale_provenance',
        source,
    }
}

function buildWatchlistRelevance(input: {
    state: WatchlistRelevanceContract['state']
    endpoint: string
    matches: WatchlistRelevanceContract['matches']
    candidates: WatchlistCandidate[]
    watchlistPayloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    blockers: string[]
    provenance: TiHandoffExportPayload['provenance']
}): WatchlistRelevanceContract {
    return {
        schemaVersion: 'ti.public_actor.watchlist_relevance.v1',
        state: input.state,
        endpoint: input.endpoint,
        matches: input.matches,
        candidates: input.candidates,
        terms: input.watchlistPayloads.map(term => ({
            ...term,
            matched: input.matches.some(match => match.kind === term.kind && match.value.toLowerCase() === term.value.toLowerCase()),
        })),
        blockers: input.blockers,
        provenance: input.provenance,
    }
}

function buildCreateAlertHandoff(payload: TiHandoffExportPayload): WorkflowHandoffContract {
    return {
        schemaVersion: 'ti.public_actor.workflow_handoff.v1',
        kind: 'create_alert',
        method: 'POST',
        endpoint: payload.endpoint ?? '/v1/dwm/alerts/rebuild',
        ready: !payload.blocked,
        blocked: payload.blocked,
        missing: payload.missing,
        payload: payload.body,
        backedRoute: payload.backedRoute,
        provenance: payload.provenance,
    }
}

function buildCaseHandoff(payload: TiHandoffExportPayload): WorkflowHandoffContract {
    return {
        schemaVersion: 'ti.public_actor.workflow_handoff.v1',
        kind: 'case',
        method: 'POST',
        endpoint: payload.endpoint ?? '/v1/cases',
        ready: !payload.blocked,
        blocked: payload.blocked,
        missing: payload.missing,
        payload: payload.body,
        backedRoute: payload.backedRoute,
        provenance: payload.provenance,
    }
}

function buildWebhookDeliveryHandoff(payload: TiHandoffExportPayload): WorkflowHandoffContract {
    return {
        schemaVersion: 'ti.public_actor.workflow_handoff.v1',
        kind: 'webhook_delivery',
        method: 'POST',
        endpoint: payload.endpoint ?? '/v1/dwm/webhooks/deliver',
        ready: !payload.blocked,
        blocked: payload.blocked,
        missing: payload.missing,
        payload: payload.body,
        backedRoute: payload.backedRoute,
        provenance: payload.provenance,
    }
}

function buildEnrichmentGapQueue(gaps: NonNullable<TiActionabilityContract['enrichmentGaps']>): EnrichmentGapQueueItem[] {
    return gaps.map(gap => ({
        id: gap.id,
        title: gap.title,
        severity: gap.severity,
        detail: gap.detail,
        dependency: gap.dependency,
        route: gap.route ?? routeForGap(gap),
        sourceFamily: gap.sourceFamily ?? sourceFamilyForGap(gap),
        requestedFields: gap.requestedFields?.length ? gap.requestedFields : requestedFieldsForGap(gap),
    }))
}

function buildPublicTiSourceHealthQueue(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    orgRelevance: PublicTiOrgRelevanceProof
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    exportPayloads: TiActionabilityModel['exportPayloads']
}): PublicTiSourceHealthQueue {
    const coverageRows = input.orgRelevance.sourceCoverage.map((source): PublicTiSourceHealthRow => {
        const matchingProvenance = input.actor.provenanceRows.find(row =>
            row.sourceId === source.sourceId
            || row.sourceName === source.sourceName
            || row.provenance === source.provenance
        )
        const matchingGaps = input.orgRelevance.enrichmentGaps.filter(gap =>
            gap.sourceFamily === source.sourceFamily
            || /source|capture|provenance/i.test(gap.field)
            || (source.status === 'missing_capture' && /capture/i.test(gap.field))
        )
        const requestedFields = uniqueStrings([
            ...matchingGaps.map(gap => gap.field),
            ...(!source.captureId ? ['sourceProvenance[].captureId'] : []),
            ...(!source.sourceRequestId && !source.captureId ? ['sourceProvenance[].sourceRequestId'] : []),
            ...(!matchingProvenance?.reportDate && !source.lastCollectedAt ? ['actorIntelligence.structuredProvenance[].reportDate'] : []),
        ])
        const timestamp = source.lastCollectedAt || matchingProvenance?.reportDate || input.actor.sourceCoverage.latestReportDate || input.result.lastSeen || input.result.generatedAt
        const stale = input.actor.freshness.stale || input.actor.sourceCoverage.stale
        const parserStatus = source.parserStatus || (source.status === 'capture_ready'
            ? stale ? 'capture linked; freshness review' : 'capture linked'
            : source.status === 'missing_capture'
                ? source.sourceRequestId ? 'source request queued' : 'capture needed'
                : stale ? 'public reference; freshness review' : 'public reference')
        const state: PublicTiSourceHealthRow['state'] = source.status === 'capture_ready'
            ? stale ? 'review' : 'ready'
            : source.status === 'missing_capture'
                ? source.sourceRequestId ? 'review' : 'blocked'
                : stale || requestedFields.length ? 'review' : 'ready'

        return {
            id: `source-health:${source.sourceId ?? source.sourceName}:${source.provenance}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: source.sourceName,
            sourceFamily: source.sourceFamily,
            provenance: source.provenance,
            timestamp,
            parserStatus,
            state,
            confidence: source.confidence,
            captureId: source.captureId,
            sourceRequestId: source.sourceRequestId,
            sourceId: source.sourceId,
            route: matchingGaps[0]?.route || input.exportPayloads.enrichment.backedRoute || '/dashboard/ti/enrichment',
            requestedFields,
            ownerLane: source.status === 'missing_capture' ? 'source' : stale ? 'public-ti' : 'source',
            nextAction: source.status === 'capture_ready'
                ? stale ? 'Refresh this source before using it as customer-facing evidence.' : 'Inspect this capture and attach it to the selected case draft when relevant.'
                : source.status === 'missing_capture'
                    ? source.sourceRequestId ? 'Track the source request and attach the resulting capture ID when collection completes.' : 'Attach a capture ID or source request ID in source enrichment.'
                    : 'Verify report date and source capture before routing to alert or case work.',
        }
    })

    const coverageKeys = new Set(coverageRows.map(row => `${row.sourceFamily}:${row.sourceName}`.toLowerCase()))
    const gapRows = input.enrichmentGapQueue
        .filter(gap => !coverageKeys.has(`${gap.sourceFamily}:${gap.title}`.toLowerCase()))
        .map((gap): PublicTiSourceHealthRow => ({
            id: `source-health-gap:${gap.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: gap.title,
            sourceFamily: sourceHealthFamilyForGap(gap.sourceFamily),
            provenance: gap.dependency,
            timestamp: input.actor.sourceCoverage.latestReportDate || input.result.lastSeen || input.result.generatedAt,
            parserStatus: 'enrichment queued',
            state: gap.severity === 'high' ? 'blocked' : 'review',
            route: gap.route,
            requestedFields: gap.requestedFields,
            ownerLane: gap.sourceFamily === 'alert' ? 'alert' : gap.sourceFamily === 'case' ? 'case' : gap.sourceFamily === 'watchlist' ? 'org' : 'source',
            nextAction: gap.detail,
        }))

    const rows = uniqueBy([...coverageRows, ...gapRows], row => row.id).sort((a, b) => {
        const stateRank = { blocked: 0, review: 1, ready: 2 }
        return stateRank[a.state] - stateRank[b.state] || a.sourceName.localeCompare(b.sourceName)
    }).slice(0, 10)

    return {
        schemaVersion: 'ti.public_actor.source_health_queue.v1',
        query: input.result.query,
        generatedAt: input.result.generatedAt,
        rows,
        summary: {
            total: rows.length,
            ready: rows.filter(row => row.state === 'ready').length,
            review: rows.filter(row => row.state === 'review').length,
            blocked: rows.filter(row => row.state === 'blocked').length,
        },
    }
}

function sourceHealthFamilyForGap(sourceFamily: EnrichmentGapQueueItem['sourceFamily']): PublicTiOrgSourceFamily {
    if (sourceFamily === 'actor_profile' || sourceFamily === 'source_capture' || sourceFamily === 'watchlist' || sourceFamily === 'alert' || sourceFamily === 'case' || sourceFamily === 'geography' || sourceFamily === 'indicator') return sourceFamily
    return 'source_capture'
}

function buildExportPayloads(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    watchlistEndpoint: string
    alertRebuildEndpoint: string
    caseEndpoint: string
    watchlistPayloads: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    watchlistBlockers: string[]
    casePayload?: { alertId: string; title?: string; priority?: string; note?: string }
    caseBlockers: string[]
    webhookDeliveryEndpoint: string
    webhookPayload?: Record<string, unknown>
    webhookBlockers?: string[]
    webhookDestinations: NonNullable<TiActionabilityContract['relatedWebhookDestinations']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
    geographyHandoffs: GeographyHandoff[]
    sourceClusters: SourceCluster[]
}): TiActionabilityModel['exportPayloads'] {
    const provenance = input.sourceProvenance.map(source => ({
        sourceName: source.sourceName,
        provenance: source.provenance,
        captureId: source.captureId,
        confidence: source.confidence,
    }))
    const watchTerms = input.watchlistPayloads.map(payload => ({
        kind: payload.kind,
        value: payload.value,
        notes: payload.notes,
    }))
    const relatedAlertContext = input.relatedAlerts.map(alert => ({
        id: alert.id,
        title: alert.title,
        status: alert.status,
        severity: alert.severity,
        caseIdCandidate: alert.caseIdCandidate,
        casePath: alert.casePath,
        source: alert.source,
        tenantId: alert.tenantId,
        organizationId: alert.organizationId,
        dedupeKey: alert.dedupeKey,
        recommendedRoute: alert.recommendedRoute,
        captureIds: alert.captureIds,
        evidenceCount: alert.evidenceCount,
        webhookDestinationIds: alert.webhookDestinationIds,
    }))
    const webhookDestinations = input.webhookDestinations.filter(destination => destination.status === 'active')
    const firstAlert = input.relatedAlerts[0]
    const captureIds = uniqueBy([
        ...input.sourceClusters.map(source => source.captureId).filter((captureId): captureId is string => Boolean(captureId)),
        ...(firstAlert?.captureIds ?? []),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    const webhookDestinationIds = uniqueBy([
        ...webhookDestinations.map(destination => destination.id),
        ...(firstAlert?.webhookDestinationIds ?? []),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    const webhookMissing = input.webhookBlockers ?? [
        ...(firstAlert?.id ? [] : ['DWM alert ID from /v1/dwm/alerts or /v1/dwm/alerts/rebuild']),
        ...(webhookDestinationIds.length ? [] : ['Active webhook destination ID from /v1/dwm/webhooks']),
        ...(captureIds.length ? [] : ['Replayable capture ID from source provenance or DWM alert evidence']),
    ]
    const relatedCaseContext = input.relatedCases.map(item => ({
        id: item.id,
        title: item.title,
        status: item.status,
        priority: item.priority,
        path: item.path,
    }))
    const enrichmentTasks = uniqueBy([
        ...input.enrichmentGaps.map(gap => ({
            id: gap.id,
            title: gap.title,
            severity: gap.severity,
            detail: gap.detail,
            dependency: gap.dependency,
        })),
        ...input.sourceClusters.map(source => ({
            id: `source:${source.sourceName}:${source.captureId || source.provenance}`,
            title: source.captureId ? 'Attach replayable capture as case evidence' : 'Attach capture ID or source hash',
            severity: source.captureId ? 'low' as const : 'high' as const,
            detail: source.enrichmentTask,
            dependency: source.captureId ? input.caseEndpoint : 'sourceProvenance[].captureId or source hash',
        })),
        ...input.geographyHandoffs.filter(item => !item.watchlistTerm).map(item => ({
            id: `geo:${item.role}:${item.code}`,
            title: `${item.country} ${item.role === 'operator' ? 'attribution' : 'targeting'} review`,
            severity: item.role === 'operator' ? 'low' as const : 'medium' as const,
            detail: item.enrichmentTask,
            dependency: item.role === 'operator' ? 'actor attribution source provenance' : 'country-specific victim/source evidence',
        })),
    ], task => task.id).slice(0, 12)
    const caseBody = input.casePayload ?? {
        sourceType: 'ti_actor',
        sourceId: input.result.query,
        title: `${input.result.query} actor/query review`,
        priority: relatedAlertContext[0]?.severity ?? 'medium',
        summary: input.result.summary,
        relatedAlertIds: relatedAlertContext.map(alert => alert.id),
        watchTerms,
        provenance,
    }

    return {
        watchlist: {
            schemaVersion: 'ti.public_actor.watchlist_handoff.v1',
            query: input.result.query,
            generatedAt: input.result.generatedAt,
            route: 'watchlist',
            method: 'POST',
            endpoint: input.watchlistEndpoint,
            backedRoute: '/dashboard/dwm',
            blocked: input.watchlistBlockers.length > 0,
            missing: input.watchlistBlockers,
            body: {
                name: `${input.result.query} watchlist`,
                terms: watchTerms,
                actorContext: {
                    query: input.result.query,
                    aliases: input.result.aliases,
                    actorClass: input.actor.actorClass,
                    attribution: input.actor.attribution,
                    confidence: input.actor.confidence,
                },
                provenance,
            },
            provenance,
        },
        alertRebuild: {
            schemaVersion: 'ti.public_actor.alert_rebuild_handoff.v1',
            query: input.result.query,
            generatedAt: input.result.generatedAt,
            route: 'alert_rebuild',
            method: 'POST',
            endpoint: input.alertRebuildEndpoint,
            backedRoute: '/dashboard/dwm',
            blocked: input.watchlistBlockers.length > 0 || !input.watchlistPayloads.length,
            missing: [
                ...input.watchlistBlockers,
                ...(!input.watchlistPayloads.length ? ['At least one organization watchlist term'] : []),
            ],
            body: {
                query: input.result.query,
                watchTerms,
                captureIds: input.sourceClusters.map(source => source.captureId).filter(Boolean),
                provenance,
            },
            provenance,
        },
        case: {
            schemaVersion: 'ti.public_actor.case_handoff.v1',
            query: input.result.query,
            generatedAt: input.result.generatedAt,
            route: 'case',
            method: 'POST',
            endpoint: input.caseEndpoint,
            backedRoute: relatedCaseContext[0]?.path ?? relatedAlertContext[0]?.casePath,
            blocked: input.caseBlockers.length > 0,
            missing: input.caseBlockers,
            body: {
                ...caseBody,
                relatedAlerts: relatedAlertContext,
                relatedCases: relatedCaseContext,
                requiredBeforePost: input.caseBlockers,
            },
            provenance,
        },
        webhookDelivery: {
            schemaVersion: 'ti.public_actor.webhook_delivery_handoff.v1',
            query: input.result.query,
            generatedAt: input.result.generatedAt,
            route: 'webhook_delivery',
            method: 'POST',
            endpoint: input.webhookDeliveryEndpoint,
            backedRoute: webhookDestinations[0]?.path ?? '/dashboard/dwm',
            blocked: webhookMissing.length > 0,
            missing: webhookMissing,
            body: input.webhookPayload ?? {
                query: input.result.query,
                alertId: firstAlert?.id,
                dedupeKey: firstAlert?.dedupeKey ?? (firstAlert?.id ? `public-ti:${input.result.query}:${firstAlert.id}` : undefined),
                idempotencyKey: firstAlert?.id ? `public-ti:${input.result.query}:${firstAlert.id}:${webhookDestinationIds[0] ?? 'destination'}` : undefined,
                recommendedRoute: firstAlert?.recommendedRoute ?? 'analyst_review',
                webhookDestinationIds,
                captureIds,
                evidenceCount: firstAlert?.evidenceCount ?? provenance.length,
                dryRun: true,
                requiredBeforePost: webhookMissing,
                provenance,
            },
            provenance,
        },
        enrichment: {
            schemaVersion: 'ti.public_actor.enrichment_queue.v1',
            query: input.result.query,
            generatedAt: input.result.generatedAt,
            route: 'enrichment_queue',
            backedRoute: '/dashboard/ti/enrichment',
            blocked: enrichmentTasks.length === 0,
            missing: enrichmentTasks.length ? [] : ['No enrichment tasks returned for this actor/query result'],
            body: {
                query: input.result.query,
                tasks: enrichmentTasks,
                geography: input.geographyHandoffs,
                sources: input.sourceClusters,
            },
            provenance,
        },
        blockers: {
            schemaVersion: 'ti.public_actor.blockers.v1',
            query: input.result.query,
            generatedAt: input.result.generatedAt,
            route: 'blocked_dependencies',
            blocked: input.watchlistBlockers.length > 0 || input.caseBlockers.length > 0,
            missing: uniqueBy([...input.watchlistBlockers, ...input.caseBlockers].map(value => ({ value })), item => item.value).map(item => item.value),
            body: {
                watchlist: input.watchlistBlockers,
                case: input.caseBlockers,
                alertRebuild: input.watchlistBlockers.length ? ['Create or select organization watchlist before alert rebuild'] : [],
                webhookDelivery: webhookMissing,
                orgRequired: input.watchlistBlockers.some(item => /organization|org/i.test(item)),
            },
            provenance,
        },
    }
}

function buildConsumerReadiness(input: {
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    exportPayloads: TiActionabilityModel['exportPayloads']
    enrichmentGapQueue: EnrichmentGapQueueItem[]
    watchTerms: Array<{ kind: WatchlistCandidate['kind']; value: string; notes: string }>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
}): ConsumerReadinessContract {
    const firstMatch = input.matches[0]
    const firstAlert = input.relatedAlerts[0]
    const firstCase = input.relatedCases[0]
    const orgId = firstMatch?.organizationId ?? firstAlert?.organizationId
    const tenantId = firstMatch?.tenantId ?? firstAlert?.tenantId ?? orgId
    const watchlistItemIds = uniqueBy(input.matches.map(match => match.watchlistItemId).filter((value): value is string => Boolean(value)).map(value => ({ value })), item => item.value).map(item => item.value)
    const watchlistId = firstMatch?.watchlistId
    const captureIds = uniqueBy([
        ...input.sourceProvenance.map(source => source.captureId).filter((value): value is string => Boolean(value)),
        ...(firstAlert?.captureIds ?? []),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    const webhookBody = input.exportPayloads.webhookDelivery.body
    const webhookDestinationIds = readStringArray(webhookBody.webhookDestinationIds)
    const publicTiRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/dwm/watchlists',
        body: {
            tenantId,
            organizationId: orgId,
            name: `${input.result.query} exposure watchlist`,
            terms: input.watchTerms,
            status: 'active',
            source: 'public_ti',
            actorQuery: input.result.query,
            artifactId: `query:${input.result.query}`,
            actorClass: input.actor.actorClass,
        },
    }
    const alertRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/dwm/alerts/rebuild',
        body: {
            tenantId,
            organizationId: orgId,
            watchlistId,
            watchlistItemIds,
            publicTiHandoffId: `public-ti:${input.result.query}`,
        },
    }
    const caseRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/cases',
        body: {
            tenantId,
            organizationId: orgId,
            alertId: firstAlert?.id,
            dedupeKey: firstAlert?.dedupeKey,
            caseIdCandidate: firstAlert?.caseIdCandidate ?? firstCase?.id,
            casePath: firstAlert?.casePath ?? firstCase?.path,
            title: firstAlert?.title ?? firstCase?.title ?? `${input.result.query} actor review`,
            priority: firstAlert?.severity ?? firstCase?.priority ?? 'medium',
            recommendedRoute: firstAlert?.recommendedRoute ?? 'analyst_review',
            captureIds,
            watchlistItemIds,
        },
    }
    const webhookRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/v1/dwm/webhooks/deliver',
        body: {
            tenantId,
            organizationId: orgId,
            alertId: webhookBody.alertId,
            dedupeKey: webhookBody.dedupeKey,
            recommendedRoute: webhookBody.recommendedRoute,
            webhookDestinationIds,
            captureIds: readStringArray(webhookBody.captureIds),
            evidenceCount: webhookBody.evidenceCount,
            idempotencyKey: webhookBody.idempotencyKey,
            dryRun: true,
        },
    }
    const enrichmentRequest: ConsumerReadinessRequest = {
        method: 'POST',
        path: '/dashboard/ti/enrichment',
        body: input.exportPayloads.enrichment.body,
    }
    const blockers: ConsumerReadinessBlocker[] = [
        ...blockersForStage('publicTi', publicTiRequest, input.exportPayloads.watchlist.missing, input.exportPayloads.watchlist.provenance),
        ...blockersForStage('orgWatchlist', alertRequest, input.exportPayloads.alertRebuild.missing, input.exportPayloads.alertRebuild.provenance),
        ...blockersForStage('caseHandoff', caseRequest, input.exportPayloads.case.missing, input.exportPayloads.case.provenance),
        ...blockersForStage('webhookTrigger', webhookRequest, input.exportPayloads.webhookDelivery.missing, input.exportPayloads.webhookDelivery.provenance),
        ...blockersForStage('enrichment', enrichmentRequest, input.exportPayloads.enrichment.missing, input.exportPayloads.enrichment.provenance),
        ...(watchlistId ? [] : [consumerBlocker('missing_watchlist_id', 'orgWatchlist', 'orgWatchlist.request.body.watchlistId', 'Persisted watchlist ID is required before alert rebuild.', true)]),
        ...(watchlistItemIds.length ? [] : [consumerBlocker('missing_watchlist_item', 'orgWatchlist', 'orgWatchlist.request.body.watchlistItemIds', 'Persisted watchlist item IDs are required before alert rebuild.', true)]),
        ...(webhookDestinationIds.length ? [] : [consumerBlocker('webhook_trigger_contract_mismatch', 'webhookTrigger', 'webhookTrigger.request.body.webhookDestinationIds', 'Active webhook destination ID is required before dry-run delivery.', true)]),
        ...(webhookBody.idempotencyKey ? [] : [consumerBlocker('webhook_trigger_contract_mismatch', 'webhookTrigger', 'webhookTrigger.request.body.idempotencyKey', 'Webhook dry-run request requires an idempotency key.', true)]),
    ]
    const stages: ConsumerReadinessStage[] = [
        consumerStage('publicTi', 'Watchlist', 'Create or select the organization watchlist entry.', publicTiRequest, input.exportPayloads.watchlist, blockers),
        consumerStage('orgWatchlist', 'Alerts', 'Rebuild alert review from persisted watchlist items.', alertRequest, input.exportPayloads.alertRebuild, blockers),
        consumerStage('caseHandoff', 'Case', 'Open the related case from alert evidence and capture context.', caseRequest, input.exportPayloads.case, blockers),
        consumerStage('webhookTrigger', 'Webhook', 'Prepare a dry-run customer delivery from alert and destination context.', webhookRequest, input.exportPayloads.webhookDelivery, blockers),
        consumerStage('enrichment', 'Enrichment', `${input.enrichmentGapQueue.length} enrichment item${input.enrichmentGapQueue.length === 1 ? '' : 's'} available for source work.`, enrichmentRequest, input.exportPayloads.enrichment, blockers),
    ]
    const bundleStages = Object.fromEntries(stages.filter(stage => stage.id !== 'enrichment').map(stage => [stage.id, {
        request: stage.request,
        missing: stage.missing,
    }]))

    return {
        schemaVersion: 'ti.public_actor.consumer_readiness.v1',
        consumerSchemaVersion: 'hanasand.analyst_handoff.consumer.v1',
        orgTermsExportSchemaVersion: 'organization.watchlist_alert_terms_export.v1',
        webhookAuditSchemaVersion: 'dwm.webhook.audit_event.v1',
        ready: stages.filter(stage => stage.id !== 'enrichment').every(stage => stage.state === 'ready'),
        generatedAt: input.result.generatedAt,
        stages,
        blockers,
        bundlePreview: {
            schemaVersion: 'hanasand.analyst_handoff.consumer.v1',
            generatedAt: input.result.generatedAt,
            stages: bundleStages,
        },
    }
}

function blockersForStage(stage: ConsumerReadinessStage['id'], request: ConsumerReadinessRequest, missing: string[], provenance: TiHandoffExportPayload['provenance']): ConsumerReadinessBlocker[] {
    const blockers = missing.map(item => consumerBlocker(blockerCodeFor(item, stage), stage, `${stage}.missing`, item, true))
    if (!request.body.organizationId && stage !== 'enrichment') blockers.push(consumerBlocker('missing_org', stage, `${stage}.request.body.organizationId`, 'Organization context is required in the authenticated console.', true))
    if (!provenance.length && stage !== 'publicTi') blockers.push(consumerBlocker('missing_provenance', stage, `${stage}.provenance`, 'Source provenance is required before this handoff can be consumed.', true))
    if ((stage === 'caseHandoff' || stage === 'webhookTrigger') && !readStringArray(request.body.captureIds).length) blockers.push(consumerBlocker('missing_provenance', stage, `${stage}.request.body.captureIds`, 'Capture IDs are required for case and delivery evidence.', true))
    if ((stage === 'caseHandoff' || stage === 'webhookTrigger') && !request.body.alertId) blockers.push(consumerBlocker('absent_alert_id', stage, `${stage}.request.body.alertId`, 'Alert ID is required before case or delivery handoff.', true))
    if (stage === 'publicTi' && !readTermArray(request.body.terms).length) blockers.push(consumerBlocker('missing_watchlist_term', stage, `${stage}.request.body.terms`, 'At least one watchlist term is required.', true))
    return uniqueBy(blockers, item => `${item.stage}:${item.code}:${item.field}:${item.detail}`)
}

function consumerStage(id: ConsumerReadinessStage['id'], label: string, detail: string, request: ConsumerReadinessRequest, payload: TiHandoffExportPayload, blockers: ConsumerReadinessBlocker[]): ConsumerReadinessStage {
    const missing = uniqueBy([
        ...payload.missing,
        ...blockers.filter(blocker => blocker.stage === id).map(blocker => blocker.detail),
    ].map(value => ({ value })), item => item.value).map(item => item.value)
    return {
        id,
        label,
        state: missing.length ? 'blocked' : payload.blocked ? 'review' : 'ready',
        detail,
        route: payload.backedRoute,
        request,
        payload,
        missing,
    }
}

function consumerBlocker(code: ConsumerReadinessBlocker['code'], stage: ConsumerReadinessStage['id'], field: string, detail: string, recoverable: boolean): ConsumerReadinessBlocker {
    return { code, stage, field, detail, recoverable }
}

function blockerCodeFor(value: string, stage: ConsumerReadinessStage['id']): ConsumerReadinessBlocker['code'] {
    if (/organization|org|member|admin/i.test(value)) return 'missing_org'
    if (/watchlist item/i.test(value)) return 'missing_watchlist_item'
    if (/watchlist/i.test(value)) return 'missing_watchlist_id'
    if (/alert id|DWM alert ID/i.test(value)) return 'absent_alert_id'
    if (/capture|source|provenance/i.test(value)) return 'missing_provenance'
    if (/webhook|destination|idempotency/i.test(value) || stage === 'webhookTrigger') return 'webhook_trigger_contract_mismatch'
    return 'missing_stage'
}

function readStringArray(value: unknown) {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

function readTermArray(value: unknown) {
    return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : []
}

function normalizeCandidates(contractCandidates: TiActionabilityContract['watchlistCandidates'], result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: VictimObservation[]): WatchlistCandidate[] {
    const candidates = [
        ...(contractCandidates ?? []).map(candidate => ({
            kind: normalizeKind(candidate.kind),
            value: candidate.value,
            reason: candidate.reason,
            confidence: candidate.confidence ?? 0.7,
        })),
        ...victimObservations.map(item => ({
            kind: 'company' as const,
            value: item.victim,
            reason: `Country observation for ${item.country}: ${item.sector}.`,
            confidence: 0.72,
        })),
        ...result.recentActivity.flatMap(item => item.victimName ? [{
            kind: 'company' as const,
            value: item.victimName,
            reason: `Recent activity victim field from ${item.firstReportedAt || item.date}.`,
            confidence: item.confidence,
        }] : []),
        ...result.sources.flatMap(source => {
            const domain = domainFromUrl(source.url || source.provenance)
            return domain ? [{
                kind: 'domain' as const,
                value: domain,
                reason: `Source domain attached to returned evidence: ${source.name}.`,
                confidence: 0.64,
            }] : []
        }),
        ...actor.targetSectors.slice(0, 3).map(sector => ({
            kind: 'vendor' as const,
            value: sector,
            reason: 'Sector category for buyer, supplier, and vendor exposure review.',
            confidence: 0.55,
        })),
    ]

    return uniqueBy(candidates
        .map(candidate => ({
            ...candidate,
            value: candidate.value.trim(),
            reason: candidate.reason.trim() || 'Candidate watchlist term from returned actor context.',
        }))
        .filter(candidate => Boolean(candidate.value) && !/not stated|global|multiple|various|unknown/i.test(candidate.value)), candidate => `${candidate.kind}:${candidate.value.toLowerCase()}`)
        .slice(0, 12)
}

function normalizeSourceProvenance(contractSources: TiActionabilityContract['sourceProvenance'], result: TiSearchResponse): NonNullable<TiActionabilityContract['sourceProvenance']> {
    const values = contractSources?.length ? contractSources : result.sources.map(source => ({
        sourceId: source.id,
        sourceName: source.name,
        provenance: source.url || source.provenance || source.name,
        confidence: result.confidence,
    }))
    return values.filter(item => item.sourceName && item.provenance).slice(0, 12)
}

function normalizeEnrichmentGaps(contractGaps: TiActionabilityContract['enrichmentGaps'], result: TiSearchResponse, actor: TiActorIntelligenceProfile, sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>): NonNullable<TiActionabilityContract['enrichmentGaps']> {
    const gaps = [...(contractGaps ?? [])]
    if (!sourceProvenance.some(source => source.captureId)) {
        gaps.push({
            id: 'capture-provenance',
            title: 'Attach capture IDs to source evidence',
            severity: 'high',
            detail: 'Returned sources identify provenance, but no capture IDs are attached for alert replay or case evidence.',
            dependency: 'TI search response sourceProvenance[].captureId or DWM alert evidence provenance',
            route: '/dashboard/ti/enrichment',
            sourceFamily: 'source_capture',
            requestedFields: ['sourceProvenance[].captureId', 'sourceProvenance[].sourceId', 'sourceProvenance[].provenance'],
        })
    }
    if (!result.actionability?.relatedAlerts?.length) {
        gaps.push({
            id: 'alert-linkage',
            title: 'Link actor result to generated alerts',
            severity: result.recentActivity.length ? 'medium' : 'high',
            detail: 'No related DWM alert IDs were returned, so the public result cannot open or create a backed case yet.',
            dependency: '/v1/dwm/alerts or /v1/dwm/alerts/rebuild alert ID',
            route: '/dashboard/dwm',
            sourceFamily: 'alert',
            requestedFields: ['relatedAlerts[].id', 'relatedAlerts[].casePath', 'handoffs.alertRebuild.endpoint'],
        })
    }
    if (!actor.malwareTools.length || !actor.campaigns.length) {
        gaps.push({
            id: 'actor-enrichment',
            title: 'Complete actor enrichment fields',
            severity: 'medium',
            detail: 'Actor tools and campaigns are needed to enrich watchlists and explain defensive relevance.',
            dependency: 'TiSearchResponse.actorIntelligence.malwareTools/campaigns',
            route: '/dashboard/ti/enrichment',
            sourceFamily: 'actor_profile',
            requestedFields: ['actorIntelligence.malwareTools', 'actorIntelligence.campaigns', 'actorIntelligence.sourceProvenance'],
        })
    }
    return uniqueBy(gaps, gap => gap.id).slice(0, 8)
}

function routeForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]) {
    if (/alert|dwm/i.test(`${gap.id} ${gap.dependency}`)) return '/dashboard/dwm'
    if (/case/i.test(`${gap.id} ${gap.dependency}`)) return '/dashboard/ti/workbench'
    return '/dashboard/ti/enrichment'
}

function sourceFamilyForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]): EnrichmentGapQueueItem['sourceFamily'] {
    const text = `${gap.id} ${gap.title} ${gap.detail} ${gap.dependency}`.toLowerCase()
    if (text.includes('capture') || text.includes('source')) return 'source_capture'
    if (text.includes('watchlist')) return 'watchlist'
    if (text.includes('alert')) return 'alert'
    if (text.includes('case')) return 'case'
    if (text.includes('country') || text.includes('geograph')) return 'geography'
    if (text.includes('indicator') || text.includes('ioc')) return 'indicator'
    return 'actor_profile'
}

function requestedFieldsForGap(gap: NonNullable<TiActionabilityContract['enrichmentGaps']>[number]) {
    const family = sourceFamilyForGap(gap)
    if (family === 'source_capture') return ['sourceProvenance[].sourceId', 'sourceProvenance[].captureId', 'sourceProvenance[].provenance']
    if (family === 'alert') return ['relatedAlerts[].id', 'relatedAlerts[].status', 'relatedAlerts[].casePath']
    if (family === 'case') return ['relatedCases[].id', 'handoffs.caseCreate.payload.alertId']
    if (family === 'watchlist') return ['watchlistMatches[].organizationId', 'watchlistMatches[].watchlistItemId']
    if (family === 'geography') return ['targets[].regions', 'recentActivity[].countries', 'actorIntelligence.geographies']
    if (family === 'indicator') return ['actorIntelligence.indicators', 'actorIntelligence.infrastructure']
    return ['actorIntelligence.malwareTools', 'actorIntelligence.campaigns', 'actorIntelligence.confidenceReasoning']
}

function buildGeographyHandoffs(result: TiSearchResponse, victimObservations: VictimObservation[], candidates: WatchlistCandidate[]): GeographyHandoff[] {
    const byCountry = new Map<string, VictimObservation[]>()
    for (const observation of victimObservations) {
        const country = countryFromValue(observation.country)
        if (!country) continue
        byCountry.set(country.code, [...(byCountry.get(country.code) ?? []), observation])
    }

    const countries = uniqueBy([
        ...victimObservations.map(observation => observation.country),
        ...result.targets.flatMap(target => target.regions),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ].map(countryFromValue).filter((country): country is NonNullable<ReturnType<typeof countryFromValue>> => Boolean(country)), country => country.code)

    const targetRows = countries.map(country => {
        const observations = byCountry.get(country.code) ?? []
        const firstObservation = observations[0]
        const candidate = firstObservation
            ? candidates.find(item => item.value.toLowerCase() === firstObservation.victim.toLowerCase())
            : candidates.find(item => item.kind === 'vendor' && result.targets.some(target => target.sector.toLowerCase() === item.value.toLowerCase()))
        return {
            code: country.code,
            country: country.label,
            role: 'target' as const,
            observationCount: Math.max(1, observations.length),
            watchlistTerm: candidate ? { kind: candidate.kind, value: candidate.value, reason: candidate.reason } : undefined,
            enrichmentTask: firstObservation
                ? `Corroborate ${firstObservation.victim} with source capture, sector, and timestamp before customer alerting.`
                : `Collect country-specific source evidence for ${country.label} before using this geography in alert routing.`,
            provenanceSummary: observations.length
                ? observations.slice(0, 2).map(item => `${item.victim} · ${item.source}`).join(' | ')
                : 'Country is present in profile target geography without a named victim row.',
            evidenceRows: observations.map(item => ({
                victim: item.victim,
                source: item.source,
                sourceIds: item.sourceIds,
                provenanceRefs: item.provenanceRefs,
                reportDate: item.reportDate,
                confidence: item.confidence,
            })),
        }
    })

    const origin = /apt29|cozy bear|midnight blizzard|nobelium|the dukes/i.test(`${result.query} ${result.aliases.join(' ')}`)
        ? countryFromValue('Russia')
        : undefined
    const originRows: GeographyHandoff[] = origin ? [{
        code: origin.code,
        country: origin.label,
        role: 'operator',
        observationCount: 1,
        enrichmentTask: `Keep ${origin.label} as attribution context; do not use operator origin by itself as a customer alert condition.`,
        provenanceSummary: 'Actor attribution context from public APT29/SVR reporting.',
        evidenceRows: [{
            victim: 'Operator attribution',
            source: 'public APT29/SVR reporting',
            sourceIds: ['svr-attribution'],
            provenanceRefs: ['CISA and allied government SVR/APT29 advisories'],
            reportDate: result.generatedAt,
            confidence: Math.max(result.confidence, 0.76),
        }],
    }] : []

    return [...originRows, ...targetRows].slice(0, 12)
}

function buildSourceClusters(sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>): SourceCluster[] {
    return sourceProvenance.map(source => {
        const domain = domainFromUrl(source.provenance)
        return {
            sourceName: source.sourceName,
            provenance: source.provenance,
            captureId: source.captureId,
            confidence: source.confidence,
            watchlistTerm: domain ? {
                kind: 'domain' as const,
                value: domain,
                reason: `Use ${domain} to track source-specific coverage and provenance changes.`,
            } : undefined,
            enrichmentTask: source.captureId
                ? `Use capture ${source.captureId} as replayable case evidence.`
                : `Attach capture ID or source hash for ${source.sourceName} before case replay.`,
        }
    }).slice(0, 8)
}

function dispositionFor(input: {
    candidates: WatchlistCandidate[]
    matches: NonNullable<TiActionabilityContract['watchlistMatches']>
    relatedAlerts: NonNullable<TiActionabilityContract['relatedAlerts']>
    relatedCases: NonNullable<TiActionabilityContract['relatedCases']>
    sourceProvenance: NonNullable<TiActionabilityContract['sourceProvenance']>
    enrichmentGaps: NonNullable<TiActionabilityContract['enrichmentGaps']>
}): TiActionabilityModel['alertDisposition'] {
    if (input.relatedCases.length) return 'case_ready'
    if (input.relatedAlerts.length || input.matches.length) return 'ready_for_alert_review'
    if (input.candidates.length) return 'watchlist_required'
    if (input.sourceProvenance.length && !input.enrichmentGaps.some(gap => gap.severity === 'high')) return 'needs_enrichment'
    return 'not_alertable'
}

function rationaleFor(disposition: TiActionabilityModel['alertDisposition'], candidates: WatchlistCandidate[], matches: NonNullable<TiActionabilityContract['watchlistMatches']>, alerts: NonNullable<TiActionabilityContract['relatedAlerts']>, sources: NonNullable<TiActionabilityContract['sourceProvenance']>) {
    if (disposition === 'case_ready') return 'A related case is already attached to this actor/query result.'
    if (alerts.length) return 'A backed alert ID is attached, so this result can move into case review.'
    if (matches.length) return 'A backed organization watchlist match is attached; rebuild or open alert review before customer delivery.'
    if (candidates.length) return 'The result has watchlist candidates, but no backed organization watchlist match or alert ID was returned.'
    if (sources.length) return 'Source provenance exists, but the result has no customer-relevant watchlist terms or backed alert linkage.'
    return 'The result does not have enough source, watchlist, alert, or case data to act on yet.'
}

function normalizeKind(value: string | undefined): WatchlistCandidate['kind'] {
    if (value === 'domain' || value === 'vendor') return value
    return 'company'
}

function domainFromUrl(value?: string) {
    if (!value) return null
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}

function uniqueStrings(values: Array<string | undefined>) {
    return uniqueBy(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)), value => value)
}

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}
