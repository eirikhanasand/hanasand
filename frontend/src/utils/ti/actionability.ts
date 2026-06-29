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
    watchlistRelevance: WatchlistRelevanceContract
    createAlertHandoff: WorkflowHandoffContract
    caseHandoff: WorkflowHandoffContract
    webhookDeliveryHandoff: WorkflowHandoffContract
    consumerReadiness: ConsumerReadinessContract
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
}

export type SourceCluster = {
    sourceName: string
    provenance: string
    captureId?: string
    confidence?: number
    watchlistTerm?: { kind: WatchlistCandidate['kind']; value: string; reason: string }
    enrichmentTask: string
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
        watchlistRelevance: buildWatchlistRelevance({
            state: matches.length ? 'backed_matches' : candidates.length ? 'candidate_handoff' : 'missing_terms',
            endpoint: watchlistEndpoint,
            matches,
            candidates,
            watchlistPayloads,
            blockers: watchlistBlockers,
            provenance: exportPayloads.watchlist.provenance,
        }),
        createAlertHandoff: buildCreateAlertHandoff(exportPayloads.alertRebuild),
        caseHandoff: buildCaseHandoff(exportPayloads.case),
        webhookDeliveryHandoff: buildWebhookDeliveryHandoff(exportPayloads.webhookDelivery),
        consumerReadiness,
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

function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}
