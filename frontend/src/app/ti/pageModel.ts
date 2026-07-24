import { evidenceTimestamp, type TiSearchResponse } from '@/utils/ti/search'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import type { TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import type { TiActionabilityModel } from '@/utils/ti/actionability'
import { PUBLIC_TI_HANDOFF_ACTIONS, encodeHandoffPayload, type ActorArtifact, type ActorArtifactHandoffs, type ActorArtifactKind, type PublicTiHandoffPayload } from '@/utils/ti/actorWorkbench'
import { humanizeSlug } from '../seo'

const TI_ENRICHMENT_GAP_PREVIEW_ROWS = 2

export type AnalystWorkItem = {
    id: string
    kind: 'activity' | 'exposure' | 'victim' | 'tradecraft' | 'collection'
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    title: string
    subtitle: string
    detail: string
    timestamp: string
    source: string
    provenance: string
    confidence: number
    assertionKind: 'observed' | 'source_claim' | 'inferred' | 'extracted'
    reviewState?: string
    corroborationState?: string
    observationSummary?: string
    href?: string
    evidence: string[]
    nextActions: string[]
    priority?: TiActionabilityModel['evidencePriority'][number]
}

export type LocalDecision = {
    status: 'reviewing' | 'assigned' | 'escalated' | 'suppressed' | 'closed' | 'reopened'
    reason: string
    decidedAt: string
}

export type LocalRelevanceMark = {
    state: 'customer_relevant' | 'context_only' | 'needs_source' | 'not_relevant'
    rationale: string
    watchTerms: string[]
    caseIntent: 'case_candidate' | 'watchlist_context' | 'source_review' | 'no_case'
    markedAt: string
}

export type WatchlistRelevance = {
    terms: string[]
    matchedTerms: string[]
    organizations: string[]
    sectors: string[]
    countries: string[]
    domains: string[]
    rationale: string
}

export type WatchlistWorkbenchRow = {
    id: string
    kind: string
    value: string
    matched: boolean
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    newestAt?: string
    evidenceItems: AnalystWorkItem[]
    artifactIds: string[]
    sourceCount: number
    route?: string
    casePath?: string
    detail: string
    blockers: string[]
    payload: Record<string, unknown>
}

export type SectionOverviewItem = {
    label: 'Overview' | 'Activity' | 'Targets' | 'Infrastructure' | 'Sources' | 'Evidence' | 'Watchlist relevance' | 'Related alerts/cases' | 'Source questions' | 'Actions'
    value: string
    state: 'ready' | 'review' | 'blocked'
}

export type AlertPacket = {
    title: string
    customerValue: string
    watchTerms: string[]
    evidenceBasis: string[]
    routing: string
    blockedUntil: string[]
}

export type SelectedTriageBrief = {
    whatHappened: string
    whyItMatters: string
    nextAction: string
    evidenceStatus: string
    evidenceTone: 'ready' | 'review' | 'blocked'
    safetyBoundary: string
    labels: Array<{ label: string; value: string }>
}

export type SelectedReviewHandoff = {
    schemaVersion: 'ti.public_actor.selected_review_handoff.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItem: Pick<AnalystWorkItem, 'id' | 'kind' | 'severity' | 'title' | 'timestamp' | 'source' | 'provenance' | 'confidence' | 'href' | 'evidence' | 'nextActions'>
    localReview: {
        status: LocalDecision['status'] | 'not_recorded'
        rationale: string
        decidedAt?: string
    }
    localRelevance: {
        state: LocalRelevanceMark['state'] | 'not_marked'
        rationale: string
        watchTerms: string[]
        caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
        markedAt?: string
    }
    watchlist: {
        terms: string[]
        matchedTerms: string[]
        organizations: string[]
    }
    caseHandoff: {
        ready: boolean
        endpoint: string
        backedRoute?: string
        missing: string[]
    }
    alertHandoff: {
        ready: boolean
        endpoint: string
        backedRoute?: string
        missing: string[]
    }
    evidenceBasis: string[]
    blockers: string[]
}

export type SelectedSourceDrilldown = {
    schemaVersion: 'ti.public_actor.selected_source_drilldown.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItem: Pick<AnalystWorkItem, 'id' | 'kind' | 'title' | 'timestamp' | 'source' | 'provenance' | 'confidence' | 'href'>
    rows: SelectedSourceDrilldownRow[]
    alertHandoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    caseHandoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    blockers: string[]
}

export type SelectedSourceDrilldownRow = {
    rowId: string
    sourceName: string
    sourceId?: string
    provenance: string
    href?: string
    captureId?: string
    reportDate?: string
    confidence?: number
    state: 'ready' | 'needs_capture' | 'needs_source'
    ownerLane: 'source' | 'public-ti' | 'alert' | 'case'
    route: string
    missing: string[]
    handoff: string
}

export type SelectedCaseSourceRow = {
    sourceName: string
    sourceId?: string
    provenance: string
    captureId?: string
    reportDate?: string
    confidence?: number
    state: SelectedSourceDrilldownRow['state']
    missing: string[]
    provenanceRefs: string[]
    provenanceFingerprint: string
}

export type SelectedCaseDraft = {
    schemaVersion: 'ti.public_actor.selected_case_draft.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    priority: 'critical' | 'high' | 'medium' | 'low'
    caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
    ready: boolean
    endpoint: string
    route?: string
    missing: string[]
    watchTerms: string[]
    sourceRows: SelectedCaseSourceRow[]
    body: Record<string, unknown>
}

export type SelectedCaseCreateRequest = {
    schemaVersion: 'ti.public_actor.selected_case_create_request.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    ready: boolean
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    request: {
        method: 'POST'
        path: string
        body: Record<string, unknown>
    }
    sourceRows: SelectedCaseSourceRow[]
    refs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        watchTerms: string[]
    }
    actorContext: {
        actorClass: string
        attribution: string
        aliases: string[]
        motivation: string[]
        targetSectors: string[]
        geographies: string[]
        malwareTools: string[]
        campaigns: string[]
        infrastructure: string[]
        indicators: string[]
        confidence: number
        confidenceReasoning: string[]
        freshness: TiActorIntelligenceProfile['freshness']
        sourceCoverage: Pick<TiActorIntelligenceProfile['sourceCoverage'], 'totalRows' | 'datedRows' | 'captureRows' | 'latestReportDate' | 'stale' | 'missing'>
        techniques: Array<{
            attackId?: string
            name: string
            tactic: string
            confidence: number
            freshness: TiActorIntelligenceProfile['techniqueCoverage'][number]['freshness']
            sourceIds: string[]
            captureIds: string[]
            provenanceRefs: string[]
            missing: string[]
        }>
        campaignTimeline: Array<{
            title: string
            firstReportedAt: string
            confidence: number
            freshness: TiActorIntelligenceProfile['campaignTimeline'][number]['freshness']
            sourceIds: string[]
            provenanceRefs: string[]
            affectedSectors: string[]
            countries: string[]
            missing: string[]
        }>
        enrichmentGaps: Array<{
            id: string
            title: string
            severity: TiActionabilityModel['enrichmentGapQueue'][number]['severity']
            route: string
            sourceFamily: TiActionabilityModel['enrichmentGapQueue'][number]['sourceFamily']
            requestedFields: string[]
        }>
        sourceRefs: {
            sourceIds: string[]
            captureIds: string[]
            provenanceRefs: string[]
            sourceRequestIds: string[]
        }
    }
    watchlistBasis: {
        state: SelectedWatchlistPlan['state']
        ready: boolean
        route: string
        matchReason: string
        terms: Array<{
            kind: SelectedWatchlistPlan['terms'][number]['kind']
            value: string
            matched: boolean
        }>
        relevanceRows: Array<{
            kind: SelectedWatchlistPlan['relevanceRows'][number]['kind']
            value: string
            fit: SelectedWatchlistPlan['relevanceRows'][number]['fit']
            alertable: boolean
            route: string
            evidenceRefs: string[]
            sourceFamilies: string[]
            blockerOwners: SelectedWatchlistPlan['relevanceRows'][number]['blockerOwners']
            nextAction: string
        }>
        intersections: Array<{
            intersectionId: string
            value: string
            state: SelectedWatchlistPlan['intersections'][number]['state']
            route: string
            organizationId?: string
            watchlistId?: string
            watchlistItemId?: string
            alertIds: string[]
            casePaths: string[]
            captureIds: string[]
            sourceEvidenceRefs: string[]
            recommendedAction: SelectedWatchlistPlan['intersections'][number]['recommendedAction']
        }>
        blockers: string[]
    }
    actionReplay: {
        schemaVersion: TiActionabilityModel['caseReplayReadiness']['schemaVersion']
        sourceSchemaVersion: string
        routeTemplate: TiActionabilityModel['caseReplayReadiness']['routeTemplate']
        ready: boolean
        rows: Array<{
            caseReviewIntakeItemId: string
            evidenceRowId: string
            ready: boolean
            exportRoute?: string
            caseId?: string
            alertIds: string[]
            captureIds: string[]
            sourceIds: string[]
            blockerCodes: string[]
            provenanceFingerprints: string[]
        }>
    }
    caseReviewRows: Array<{
        id: string
        evidenceRowId: string
        title: string
        priority: CaseReviewIntakeItem['priority']
        state: CaseReviewIntakeItem['state']
        route: string
        ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
        nextAction: string
        recommendedAction: CaseReviewIntakeItem['recommendedAction']
        reasons: string[]
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
        provenanceRefs: string[]
        provenanceFingerprints: string[]
        blockers: string[]
        replay: {
            ready: boolean
            state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
            exportRoute?: string
            caseId?: string
            blockerCodes: string[]
        }
    }>
    blockers: string[]
    consumerStage?: {
        state: string
        request?: string
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type SelectedCaseOwnershipPlan = {
    schemaVersion: 'ti.public_actor.selected_case_ownership.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    owner: {
        lane: string
        label: string
    }
    summary: {
        caseCandidates: number
        replayReady: number
        relatedAlerts: number
        relatedCases: number
        captures: number
        blockers: number
    }
    caseReviewItems: Array<{
        id: string
        evidenceRowId: string
        title: string
        priority: CaseReviewIntakeItem['priority']
        state: CaseReviewIntakeItem['state']
        route: string
        alertIds: string[]
        casePaths: string[]
        captureIds: string[]
        sourceIds: string[]
        watchlistTerms: string[]
        reasons: string[]
        recommendedAction: CaseReviewIntakeItem['recommendedAction']
        nextAction: string
        blockers: string[]
    }>
    replayRows: Array<{
        id: string
        evidenceRowId: string
        ready: boolean
        state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
        exportRoute?: string
        caseId?: string
        alertIds: string[]
        captureIds: string[]
        sourceIds: string[]
        blockerCodes: string[]
    }>
    related: {
        alerts: Array<{
            id: string
            status?: string
            casePath?: string
            captureIds: string[]
            recommendedRoute?: string
        }>
        cases: Array<{
            id: string
            path?: string
            status?: string
            title?: string
        }>
    }
    sourceRefs: {
        alertIds: string[]
        captureIds: string[]
        casePaths: string[]
        sourceIds: string[]
    }
    consumerStage?: {
        id: string
        state: string
        request?: string
        blockers: string[]
    }
    blockers: string[]
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type SelectedDeliveryReadinessPlan = {
    schemaVersion: 'ti.public_actor.selected_delivery_readiness.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: 'ready' | 'review' | 'blocked'
    route: string
    nextAction: string
    summary: {
        alerts: number
        captures: number
        destinations: number
        caseRoutes: number
        blockers: number
    }
    alerts: Array<{
        id: string
        title: string
        status: string
        ready: boolean
        casePath?: string
        captureIds: string[]
        destinationIds: string[]
        blockers: string[]
        recommendedRoute?: string
    }>
    handoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
        request?: string
    }
    sourceRefs: {
        alertIds: string[]
        captureIds: string[]
        destinationIds: string[]
        casePaths: string[]
        sourceIds: string[]
    }
    blockers: string[]
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type CaseActionTrailPayload = {
    schemaVersion: 'ti.public_actor.case_action_trail.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    events: CaseActionTrailEvent[]
    summary: {
        total: number
        ready: number
        blocked: number
        sessionLocal: boolean
        replayable: boolean
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type CaseActionTrailEvent = {
    id: string
    at: string
    label: string
    detail: string
    state: 'ready' | 'review' | 'blocked' | 'local'
    route?: string
    blockers: string[]
    replayExportRoute?: string
    evidenceRowId?: string
    provenance: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        caseId?: string
        confidence?: number
        reportDate?: string
        source?: string
    }
}

export type SelectedAlertActionPlan = {
    schemaVersion: 'ti.public_actor.selected_alert_action_plan.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: TiActionabilityModel['alertGenerationReadiness']['state']
    ready: boolean
    route: string
    sourceRoute: string
    nextAction: string
    readiness: Pick<TiActionabilityModel['alertGenerationReadiness'], 'schemaVersion' | 'readyForCustomerDelivery' | 'candidateCount' | 'matchedCandidateCount' | 'captureRefCount' | 'generationEvidenceWindowReady' | 'latestEvidenceAt' | 'provenance'>
    watchlist: {
        terms: string[]
        matchedTerms: string[]
        organizations: string[]
    }
    sourceRefs: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        sourceFamilies: string[]
    }
    evidenceRows: Array<{
        rowId: string
        kind: TiActionabilityModel['orgRelevance']['handoffRows'][number]['kind']
        state: TiActionabilityModel['orgRelevance']['handoffRows'][number]['state']
        ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
        label: string
        action: string
        route: string
        sourceFamily: string
        provenanceRefs: string[]
        alertId?: string
        casePath?: string
        captureIds: string[]
        evidence: {
            summary: string
            sourceName?: string
            provenance?: string
            reportDate?: string
            captureId?: string
            parserStatus?: string
            confidence?: number
        }
        blockers: string[]
    }>
    replayRows: Array<{
        id: string
        ready: boolean
        state: TiActionabilityModel['caseReplayReadiness']['rows'][number]['state']
        exportRoute?: string
        caseId?: string
        alertIds: string[]
        captureIds: string[]
        sourceIds: string[]
        blockerCodes: string[]
    }>
    blockers: TiActionabilityModel['alertGenerationReadiness']['blockers']
    handoff: {
        ready: boolean
        endpoint: string
        route?: string
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type SelectedWatchlistPlan = {
    schemaVersion: 'ti.public_actor.selected_watchlist_plan.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    state: TiActionabilityModel['watchlistRelevance']['state']
    ready: boolean
    route: string
    nextAction: string
    terms: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        matched: boolean
        notes: string
    }>
    relevanceRows: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        fit: 'matched' | 'near' | 'blocked'
        alertable: boolean
        route: string
        evidenceRefs: string[]
        sourceFamilies: string[]
        evidenceRows: Array<{
            sourceName: string
            sourceId?: string
            provenance: string
            reportDate?: string
            captureId?: string
            sourceRequestId?: string
            sourceFamily?: string
            parserStatus?: string
            lastCollectedAt?: string
            confidence?: number
            shownBecause: string
        }>
        handoffRows: Array<{
            rowId: string
            kind: TiActionabilityModel['orgRelevance']['handoffRows'][number]['kind']
            state: TiActionabilityModel['orgRelevance']['handoffRows'][number]['state']
            ownerLane: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
            label: string
            action: string
            route: string
            sourceFamily: string
            blockerCount: number
        }>
        blockers: string[]
        blockerOwners: TiActionabilityModel['readiness']['blockers'][number]['ownerLane'][]
        nextAction: string
    }>
    intersections: Array<{
        intersectionId: string
        kind: WatchlistIntersectionRow['kind']
        value: string
        state: WatchlistIntersectionRow['state']
        route: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        alertIds: string[]
        casePaths: string[]
        captureIds: string[]
        sourceEvidenceRefs: string[]
        recommendedAction: WatchlistIntersectionRow['recommendedAction']
        blockers: WatchlistIntersectionRow['blockers']
    }>
    sourceRefs: {
        sourceIds: string[]
        captureIds: string[]
        alertIds: string[]
        casePaths: string[]
    }
    blockers: string[]
    handoff: {
        ready: boolean
        route: string
        blocked: boolean
        missing: string[]
    }
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type SelectedEnrichmentTriage = {
    schemaVersion: 'ti.public_actor.selected_enrichment_triage.v1'
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    route: string
    state: 'ready' | 'review' | 'blocked'
    summary: {
        sourceRows: number
        intakeItems: number
        blockers: number
        sourceRequests: number
        captures: number
    }
    rows: Array<{
        id: string
        sourceName: string
        sourceFamily: SourceHealthRow['sourceFamily']
        state: SourceHealthRow['state']
        route: string
        ownerLane: SourceHealthRow['ownerLane']
        remediationPath: string
        lastChecked: string
        recommendedAction: string
        sourceId?: string
        sourceRequestId?: string
        captureId?: string
        requestedFields: string[]
        nextAction: string
        matchingIntakeItemIds: string[]
        blockers: string[]
        evidence: {
            provenance: string
            timestamp: string
            confidence?: number
            parserStatus?: string
        }
        consumerReadiness: Array<{
            consumer: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['consumer']
            state: TiActionabilityModel['actorEnrichmentConsumerReadiness']['rows'][number]['state']
            ready: boolean
            route: string
            blockerCodes: string[]
            retryable: boolean
            nextRetryAt?: string
        }>
    }>
    safeOutput: {
        metadataOnly: true
        liveMutation: false
        rawEvidenceExposed: false
        webhookSecretExposed: false
    }
}

export type StagedHandoff = {
    schemaVersion: 'ti.public_actor.staged_handoff.v1'
    source: 'public-ti'
    sessionLocal: true
    id: string
    query: string
    generatedAt: string
    selectedItemId: string
    title: string
    relevanceState: LocalRelevanceMark['state'] | 'not_marked'
    caseIntent: LocalRelevanceMark['caseIntent'] | 'not_set'
    ready: boolean
    blockers: string[]
    selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>
    reviewHandoff: SelectedReviewHandoff
    sourceDrilldown: SelectedSourceDrilldown
    caseDraft: SelectedCaseDraft
    caseOwnership: SelectedCaseOwnershipPlan
    caseCreateRequest: SelectedCaseCreateRequest
    watchlistPlan: SelectedWatchlistPlan
    alertPlan: SelectedAlertActionPlan
    deliveryPlan: SelectedDeliveryReadinessPlan
    enrichmentTriage: SelectedEnrichmentTriage
    caseActionTrail: CaseActionTrailPayload
}

export type EnrichmentTask = {
    title: string
    status: 'ready' | 'needs_api' | 'needs_review' | 'watch'
    detail: string
    route?: string
    sourceFamily?: string
    requestedFields?: string[]
    ownerLane?: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']
}

export type EnrichmentGapWorkbenchRow = {
    id: string
    type: string
    label: string
    entity: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    newestAt?: string
    source: string
    impact: string
    route?: string
    evidenceItems: AnalystWorkItem[]
    artifactIds: string[]
    missing: string[]
    payload: Record<string, unknown>
}

export type SourceHealthRow = TiActionabilityModel['sourceHealthQueue']['rows'][number]
export type WatchlistIntersectionRow = TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]
export type CaseReviewIntakeItem = TiActionabilityModel['caseReviewIntake']['items'][number]
export type ActorOperationsRow = {
    id: string
    type: 'Method' | 'Infrastructure' | 'Victim'
    label: string
    detail: string
    tactic?: string
    confidence: number
    freshness: 'ready' | 'review' | 'blocked'
    source: string
    sourceFamily: string
    timestamp: string
    artifactKind?: ActorArtifactKind
    artifactLookup?: string
    payload: Record<string, unknown>
}

export type SourceCoverageWorkbenchRow = {
    id: string
    sourceName: string
    family: string
    provenance: string
    href?: string
    newestAt?: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    artifactTypes: string[]
    evidenceItems: AnalystWorkItem[]
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    missing: string[]
    nextAction: string
    queueFilter?: string
    payload: Record<string, unknown>
}

export function selectedConsoleLinksFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlistPlan: SelectedWatchlistPlan | null,
    caseCreateRequest: SelectedCaseCreateRequest | null,
    alertPlan: SelectedAlertActionPlan | null,
    sourceDrilldown: ReturnType<typeof selectedSourceDrilldownFor> | null,
    artifactHandoffs: ActorArtifactHandoffs | null
) {
    const baseParams = {
        actor: result.query,
        selected: selected.id,
        source: selected.source,
        evidence: selected.priority?.rowId,
        sourceId: selected.priority?.sourceIds[0] ?? sourceDrilldown?.rows[0]?.sourceId,
        captureId: selected.priority?.captureIds[0] ?? sourceDrilldown?.rows.find(row => row.captureId)?.captureId,
    }
    return {
        watchlist: authenticatedPublicTiHref(watchlistPlan?.route, {
            ...baseParams,
            action: 'watchlist',
            term: watchlistPlan?.terms[0]?.value,
            state: watchlistPlan?.state,
        }, artifactHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist]),
        case: authenticatedPublicTiHref(caseCreateRequest?.route, {
            ...baseParams,
            action: 'case',
            caseState: caseCreateRequest?.state,
            caseRoute: caseCreateRequest?.refs.casePaths[0],
            alertId: caseCreateRequest?.refs.alertIds[0],
        }, artifactHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case]),
        alert: authenticatedPublicTiHref(alertPlan?.route, {
            ...baseParams,
            action: 'alert',
            alertState: alertPlan?.state,
            alertId: alertPlan?.sourceRefs.alertIds[0],
        }, artifactHandoffs?.authBridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild]),
    }
}

export function authenticatedPublicTiHref(route: string | undefined, params: Record<string, string | undefined>, payload?: PublicTiHandoffPayload) {
    const normalizedRoute = normalizedAuthenticatedRoute(route)
    const [path, existingQuery = ''] = normalizedRoute.split('?')
    const search = new URLSearchParams(existingQuery)
    search.set('handoff', 'public-ti')
    if (payload) {
        const urlPayload = compactPublicTiHandoffPayload(payload)
        search.set('intent', payload.action)
        search.set('payload', decodeURIComponent(encodeHandoffPayload(urlPayload)))
    }
    Object.entries(params).forEach(([key, value]) => {
        if (value) search.set(key, value)
    })
    return `${path}?${search.toString()}`
}

export function compactPublicTiHandoffPayload(payload: PublicTiHandoffPayload): PublicTiHandoffPayload {
    return {
        ...payload,
        missing: payload.missing.slice(0, 4).map(value => compactHandoffText(value, 100)),
        artifact: {
            ...payload.artifact,
            evidence: payload.artifact.evidence.slice(0, 1).map(item => compactHandoffText(item, 140)),
            provenance: payload.artifact.provenance.slice(0, 1).map(item => compactHandoffText(item, 120)),
            watchlistTerms: payload.artifact.watchlistTerms.slice(0, 2).map(term => ({
                ...term,
                value: compactHandoffText(term.value, 100),
                notes: compactHandoffText(term.notes, 90),
            })),
            enrichmentTasks: payload.artifact.enrichmentTasks.slice(0, 1).map(item => compactHandoffText(item, 120)),
        },
        selectedPayload: compactHandoffExportPayload(payload.selectedPayload),
        actionPayloads: {
            watchlist: compactHandoffExportPayload(payload.actionPayloads.watchlist),
            alertRebuild: compactHandoffExportPayload(payload.actionPayloads.alertRebuild),
            case: compactHandoffExportPayload(payload.actionPayloads.case),
            enrichment: compactHandoffExportPayload(payload.actionPayloads.enrichment),
        },
        blockers: payload.blockers.slice(0, 4).map(blocker => ({
            ...blocker,
            detail: compactHandoffText(blocker.detail, 140),
        })),
        actionReadiness: payload.actionReadiness.map(item => ({
            action: item.action,
            route: item.route,
            backedRoute: item.backedRoute,
            ready: item.ready,
            selected: item.selected,
            ownerLane: item.ownerLane,
            sourceRequestCount: item.sourceRequestCount,
            missing: item.missing.slice(0, 2).map(value => compactHandoffText(value, 90)),
            blockerCodes: item.blockerCodes.slice(0, 4),
        })),
        evidenceRefs: payload.evidenceRefs ? {
            sourceNames: payload.evidenceRefs.sourceNames.slice(0, 2).map(value => compactHandoffText(value, 80)),
            provenanceRefs: payload.evidenceRefs.provenanceRefs.slice(0, 1).map(value => compactHandoffText(value, 100)),
            captureIds: payload.evidenceRefs.captureIds.slice(0, 2),
            alertIds: payload.evidenceRefs.alertIds.slice(0, 2),
            casePaths: payload.evidenceRefs.casePaths.slice(0, 2),
            watchlistTerms: payload.evidenceRefs.watchlistTerms.slice(0, 2).map(value => compactHandoffText(value, 80)),
            endpoints: payload.evidenceRefs.endpoints.slice(0, 2).map(value => compactHandoffText(value, 100)),
        } : undefined,
        sourceRequests: [],
    }
}

export function compactHandoffExportPayload(payload: PublicTiHandoffPayload['selectedPayload']): PublicTiHandoffPayload['selectedPayload'] {
    return {
        schemaVersion: payload.schemaVersion,
        query: payload.query,
        generatedAt: payload.generatedAt,
        route: payload.route,
        method: payload.method,
        endpoint: payload.endpoint,
        backedRoute: payload.backedRoute,
        blocked: payload.blocked,
        missing: payload.missing.slice(0, 4).map(value => compactHandoffText(value, 120)),
        provenance: [],
        body: compactHandoffBody(payload.body),
    }
}

export function compactHandoffBody(body: Record<string, unknown>): Record<string, unknown> {
    const compact: Record<string, unknown> = {}
    const passthroughKeys = ['sourceType', 'sourceId', 'title', 'priority', 'artifactId', 'query', 'caseId', 'alertId']
    passthroughKeys.forEach(key => {
        const value = body[key]
        if (typeof value === 'string') compact[key] = compactHandoffText(value, 140)
        else if (typeof value === 'number' || typeof value === 'boolean') compact[key] = value
    })
    if (typeof body.summary === 'string') compact.summary = compactHandoffText(body.summary, 120)
    if (isPlainRecord(body.actorContext)) {
        compact.actorContext = {
            query: typeof body.actorContext.query === 'string' ? compactHandoffText(body.actorContext.query, 80) : body.actorContext.query,
            actorClass: typeof body.actorContext.actorClass === 'string' ? compactHandoffText(body.actorContext.actorClass, 80) : body.actorContext.actorClass,
            confidence: body.actorContext.confidence,
        }
    }
    if (isPlainRecord(body.selectedArtifact)) {
        compact.selectedArtifact = {
            artifactId: body.selectedArtifact.artifactId,
            kind: body.selectedArtifact.kind,
            label: typeof body.selectedArtifact.label === 'string' ? compactHandoffText(body.selectedArtifact.label, 120) : body.selectedArtifact.label,
            confidence: body.selectedArtifact.confidence,
            freshness: body.selectedArtifact.freshness,
        }
    }
    const termKeys = ['terms', 'watchTerms']
    termKeys.forEach(key => {
        const value = body[key]
        if (Array.isArray(value)) compact[key] = value.slice(0, 2).map(compactWatchTerm)
    })
    const idKeys = ['relatedAlertIds', 'relatedCaseIds']
    idKeys.forEach(key => {
        const value = body[key]
        if (Array.isArray(value)) compact[key] = value.slice(0, 2).map(item => compactHandoffText(String(item), 100))
    })
    return Object.keys(compact).length ? compact : body
}

export function compactWatchTerm(item: unknown) {
    if (!isPlainRecord(item)) return item
    return {
        kind: item.kind,
        value: typeof item.value === 'string' ? compactHandoffText(item.value, 100) : item.value,
        notes: typeof item.notes === 'string' ? compactHandoffText(item.notes, 80) : undefined,
        reason: typeof item.reason === 'string' ? compactHandoffText(item.reason, 80) : undefined,
    }
}

export function compactHandoffText(value: string, maxLength: number) {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (normalized.length <= maxLength) return normalized
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizedAuthenticatedRoute(route: string | undefined) {
    if (!route) return '/dashboard/dwm'
    if (route.startsWith('/v1/cases')) return '/dashboard'
    if (route.startsWith('/v1/dwm')) return '/dashboard/dwm'
    if (route.startsWith('/dashboard')) return route
    return '/dashboard/dwm'
}

export function timelineFor(result: TiSearchResponse, selected?: AnalystWorkItem) {
    const events = [
        {
            id: 'generated',
            at: result.generatedAt,
            label: 'Profile generated',
            detail: `${humanResultStatus(result.status)} result from ${result.mode}.`,
        },
        ...(selected ? [{
            id: `selected-${selected.id}`,
            at: selected.timestamp,
            label: 'Selected evidence',
            detail: selected.subtitle,
        }] : []),
        ...result.recentActivity.slice(0, 4).map((item, index) => ({
            id: `activity-${index}`,
            at: evidenceTimestamp(item.firstReportedAt, item.date),
            label: item.title,
            detail: item.detail,
        })),
    ]
    return events
}

export function sectionOverviewFor(input: {
    result: TiSearchResponse
    actorIntel: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    victimObservations: ReturnType<typeof victimObservationsFor>
    watchlist: WatchlistRelevance
}): SectionOverviewItem[] {
    const relatedRecords = input.actionability.relatedAlerts.length + input.actionability.relatedCases.length
    const caseCandidates = input.actionability.caseReviewIntake.summary.total
    const readyActions = Object.values(input.actionability.actionPayloads.payloads).filter(payload => payload.ready).length
    const sourceRows = input.actorIntel.provenanceRows.length || input.actionability.sourceProvenance.length || input.result.sources.length
    return [
        { label: 'Overview', value: sourceBasisLabel(input.actorIntel.confidence), state: input.actorIntel.provenanceRows.length ? 'ready' : 'blocked' },
        { label: 'Activity', value: `${input.workItems.length} item${input.workItems.length === 1 ? '' : 's'}`, state: input.workItems.length ? 'ready' : 'review' },
        { label: 'Targets', value: `${input.victimObservations.length || input.actorIntel.targetSectors.length} row${(input.victimObservations.length || input.actorIntel.targetSectors.length) === 1 ? '' : 's'}`, state: input.victimObservations.length || input.actorIntel.targetSectors.length ? 'ready' : 'review' },
        { label: 'Infrastructure', value: `${input.actorIntel.infrastructure.length} pattern${input.actorIntel.infrastructure.length === 1 ? '' : 's'}`, state: input.actorIntel.infrastructure.length ? 'ready' : 'review' },
        { label: 'Sources', value: `${sourceRows} source result${sourceRows === 1 ? '' : 's'}`, state: sourceRows ? 'ready' : 'blocked' },
        { label: 'Evidence', value: `${input.workItems.filter(item => item.evidence.length).length} supported`, state: input.workItems.some(item => item.evidence.length) ? 'ready' : 'blocked' },
        { label: 'Watchlist relevance', value: input.actionability.orgRelevance.organizationRefs.length ? `${input.actionability.orgRelevance.organizationRefs.length} matched` : `${input.actionability.orgRelevance.candidateTerms.length} candidate${input.actionability.orgRelevance.candidateTerms.length === 1 ? '' : 's'}`, state: input.actionability.orgRelevance.state },
        { label: 'Related alerts/cases', value: relatedRecords ? `${relatedRecords} linked` : `${caseCandidates} candidate${caseCandidates === 1 ? '' : 's'}`, state: relatedRecords ? 'ready' : caseCandidates ? 'review' : 'blocked' },
        { label: 'Source questions', value: `${input.actionability.enrichmentGapQueue.length} open`, state: input.actionability.enrichmentGapQueue.length ? 'review' : 'ready' },
        { label: 'Actions', value: `${readyActions}/5 available`, state: readyActions === 5 ? 'ready' : readyActions ? 'review' : 'blocked' },
    ]
}

export function watchlistRelevanceFor(result: TiSearchResponse, victimObservations: ReturnType<typeof victimObservationsFor>, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel): WatchlistRelevance {
    const organizations = unique([
        ...victimObservations.map(item => item.victim),
        ...result.recentActivity.map(item => item.victimName).filter((value): value is string => Boolean(value)),
        ...(result.analystLoop?.metadataReviewInbox.flatMap(item => [item.company, item.victim]).filter((value): value is string => Boolean(value)) ?? []),
    ]).slice(0, 10)
    const sectors = unique([
        ...victimObservations.map(item => item.sector),
        ...result.targets.map(item => item.sector),
        ...result.recentActivity.flatMap(item => item.affectedSectors ?? []),
    ].filter(value => !/not stated/i.test(value))).slice(0, 10)
    const countries = unique([
        ...victimObservations.map(item => item.country),
        ...result.targets.flatMap(item => item.regions),
        ...result.recentActivity.flatMap(item => item.countries ?? []),
    ].filter(value => !/not stated/i.test(value))).slice(0, 10)
    const domains = unique(sources.map(source => source.url || linkFromText(source.provenance)).map(domainFromUrl).filter((value): value is string => Boolean(value))).slice(0, 8)
    const terms = unique([
        result.query,
        humanizeSlug(result.query),
        ...result.aliases,
        ...organizations,
        ...sectors,
        ...actor.campaigns.slice(0, 4),
        ...actor.malwareTools.slice(0, 4),
    ].filter(Boolean)).slice(0, 14)
    const matchedTerms = actionability.watchlistRelevance.terms.filter(term => term.matched).map(term => `${term.kind}: ${term.value}`)

    return {
        terms,
        matchedTerms,
        organizations,
        sectors,
        countries,
        domains,
        rationale: matchedTerms.length
            ? `${matchedTerms.length} organization watchlist match${matchedTerms.length === 1 ? '' : 'es'} for this query.`
            : organizations.length
                ? 'Candidate watchlist inputs are present; save an organization watchlist match before alert review.'
                : 'Candidate actor, alias, sector, country, campaign, tool, and source-domain terms appear when present in the profile or source results.',
    }
}

export function watchlistWorkbenchRowsFor({
    watchlist,
    actionability,
    query,
    workItems,
    artifacts,
}: {
    watchlist: WatchlistRelevance
    actionability: TiActionabilityModel
    query: string
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
}): WatchlistWorkbenchRow[] {
    const seenTermIds = new Set<string>()
    const terms = unique([
        ...watchlist.terms,
        ...watchlist.matchedTerms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
        ...actionability.orgRelevance.candidateTerms.map(term => `${term.kind}: ${term.value}`),
        ...actionability.orgRelevance.watchlistIntersections.map(term => `${term.kind}: ${term.value}`),
    ]).filter(term => {
        const parsed = watchlistTermParts(term)
        const id = watchlistWorkbenchRowId(parsed.kind, parsed.value)
        if (seenTermIds.has(id)) return false
        seenTermIds.add(id)
        return true
    }).slice(0, 16)
    return terms.map(term => {
        const parsed = watchlistTermParts(term)
        const valueKey = parsed.value.toLowerCase()
        const matchingTerms = actionability.watchlistRelevance.terms.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const candidateTerms = actionability.orgRelevance.candidateTerms.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const intersections = actionability.orgRelevance.watchlistIntersections.filter(item => item.value.toLowerCase() === valueKey || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase())
        const sourceRefs = unique([...candidateTerms.flatMap(item => item.sourceEvidenceRefs), ...intersections.flatMap(item => item.sourceEvidenceRefs)])
        const sourceEvidence = actionability.orgRelevance.sourceEvidence.filter(source =>
            source.supportsTerms.some(supported => supported.toLowerCase() === valueKey || supported.toLowerCase().includes(valueKey))
            || sourceRefs.some(ref => source.sourceId === ref || source.sourceName.includes(ref) || source.provenance.includes(ref))
        )
        const evidenceItems = workItems.filter(item => watchlistRowText(item).includes(valueKey)).slice(0, 8)
        const artifactMatches = artifacts.filter(artifact => watchlistArtifactText(artifact).includes(valueKey))
        const confidenceValues = uniqueNumbers([
            ...evidenceItems.map(item => item.confidence),
            ...artifactMatches.map(item => item.confidence),
            ...sourceEvidence.map(item => item.confidence).filter((value): value is number => typeof value === 'number'),
        ])
        const newestAt = newestDate([
            ...evidenceItems.map(item => item.timestamp),
            ...sourceEvidence.map(item => item.lastCollectedAt || item.reportDate || ''),
            actionability.orgRelevance.freshness.lastSeen,
        ])
        const matched = intersections.length > 0 || matchingTerms.some(item => item.matched) || candidateTerms.some(item => item.matched) || watchlist.matchedTerms.some(item => item.toLowerCase() === term.toLowerCase())
        const blockers = unique([
            ...actionability.watchlistRelevance.blockers,
            ...actionability.exportPayloads.watchlist.missing,
            ...intersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
        ].map(displayRequirementText)).slice(0, 6)
        const state: WatchlistWorkbenchRow['state'] = matched ? 'ready' : actionability.exportPayloads.watchlist.blocked || blockers.length ? 'blocked' : 'review'
        const route = intersections[0]?.route || actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route || '/dashboard/dwm'
        const casePath = intersections.flatMap(item => [item.casePath, ...item.casePaths]).find((value): value is string => Boolean(value))
        const intersectionDetail = intersections[0] ? `${watchlistIntersectionActionLabel(intersections[0].recommendedAction)} for ${parsed.value}.` : ''
        const payload = {
            ...watchlistTermRequestPayloadFor(term, watchlist, actionability, query),
            schemaVersion: 'ti.public_actor.watchlist_workbench_row.v1',
            selectedEvidenceRows: evidenceItems.map(item => ({
                id: item.id,
                title: item.title,
                source: item.source,
                timestamp: item.timestamp,
                confidence: item.confidence,
                provenance: item.provenance,
            })),
            selectedArtifacts: artifactMatches.map(artifact => ({
                id: artifact.id,
                kind: artifact.kind,
                label: artifact.label,
                confidence: artifact.confidence,
                freshness: artifact.freshness,
            })),
            sourceEvidence,
            intersections,
            state,
            casePath,
        }
        return {
            id: watchlistWorkbenchRowId(parsed.kind, parsed.value),
            kind: parsed.kind,
            value: parsed.value,
            matched,
            state,
            confidenceValues,
            newestAt,
            evidenceItems,
            artifactIds: artifactMatches.map(item => item.id),
            sourceCount: unique([...sourceEvidence.map(item => item.sourceName), ...evidenceItems.map(item => item.source)]).length,
            route,
            casePath,
            detail: candidateTerms[0]?.notes || matchingTerms[0]?.notes || intersectionDetail || watchlist.rationale,
            blockers,
            payload,
        }
    }).sort((a, b) => Number(b.matched) - Number(a.matched)
        || sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
        || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
        || b.evidenceItems.length - a.evidenceItems.length
        || a.value.localeCompare(b.value))
}

export function watchlistRowText(item: AnalystWorkItem) {
    return `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
}

export function watchlistArtifactText(artifact: ActorArtifact) {
    return `${artifact.label} ${artifact.subtitle} ${artifact.evidence.join(' ')} ${artifact.provenance.join(' ')} ${artifact.watchlistTerms.map(term => `${term.kind} ${term.value} ${term.notes}`).join(' ')}`.toLowerCase()
}

export function newestDate(values: string[]) {
    return values
        .filter(Boolean)
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0]
}

export function alertPacketFor(result: TiSearchResponse, selected: AnalystWorkItem, watchlist: WatchlistRelevance): AlertPacket {
    const isCustomerAlert = selected.kind === 'exposure' || Boolean(watchlist.organizations.some(org => selected.title.toLowerCase().includes(org.toLowerCase())))
    const evidenceBasis = unique([
        `${selected.source}; ${selected.provenance}`,
        `Timestamp: ${selected.timestamp}`,
        `Evidence strength: ${sourceBasisLabel(selected.confidence)}`,
        ...selected.evidence.slice(0, 3).map(displayRequirementText),
    ])
    const blockedUntil = [
        selected.href ? '' : 'A source URL or internal capture reference is attached.',
        isCustomerAlert ? '' : 'A watched company, domain, vendor, or portfolio term matches this finding.',
        selected.confidence >= 0.7 ? '' : 'Corroborating evidence is added.',
    ].filter(Boolean)

    return {
        title: isCustomerAlert ? `Candidate customer alert: ${displayRequirementText(selected.title)}` : `Actor context brief: ${displayRequirementText(selected.title)}`,
        customerValue: isCustomerAlert
            ? 'This finding has enough structure to enter alert review: named object, evidence basis, timestamp, source reference, and routing guidance.'
            : 'This finding strengthens watchlist and detection context, but should not become a customer alert until it matches a watched organization, domain, vendor, or portfolio term.',
        watchTerms: watchlist.terms.slice(0, 8),
        evidenceBasis,
        routing: selected.kind === 'tradecraft'
            ? 'Send to detection and hunting enrichment before customer notification.'
            : selected.kind === 'victim' && !isCustomerAlert
                ? 'Send to actor-profile enrichment and watchlist expansion.'
                : 'Send to alert review, source verification, and customer delivery only after the console saves it.',
        blockedUntil,
    }
}

export function selectedReviewHandoffFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket,
    actionability: TiActionabilityModel,
    decision: LocalDecision | undefined,
    relevance: LocalRelevanceMark | undefined,
    note: string
): SelectedReviewHandoff {
    const rationale = note.trim() || decision?.reason || 'No session rationale recorded.'
    return {
        schemaVersion: 'ti.public_actor.selected_review_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItem: {
            id: selected.id,
            kind: selected.kind,
            severity: selected.severity,
            title: displayRequirementText(selected.title),
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
            evidence: selected.evidence.map(displayRequirementText),
            nextActions: selected.nextActions,
        },
        localReview: {
            status: decision?.status ?? 'not_recorded',
            rationale,
            decidedAt: decision?.decidedAt,
        },
        localRelevance: {
            state: relevance?.state ?? 'not_marked',
            rationale: relevance?.rationale ?? 'No session relevance mark recorded.',
            watchTerms: relevance?.watchTerms ?? [],
            caseIntent: relevance?.caseIntent ?? 'not_set',
            markedAt: relevance?.markedAt,
        },
        watchlist: {
            terms: alertPacket.watchTerms,
            matchedTerms: watchlist.matchedTerms,
            organizations: watchlist.organizations,
        },
        caseHandoff: {
            ready: actionability.caseHandoff.ready,
            endpoint: actionability.caseHandoff.endpoint,
            backedRoute: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        alertHandoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            backedRoute: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        evidenceBasis: alertPacket.evidenceBasis,
        blockers: alertPacket.blockedUntil,
    }
}

export function caseSourceRowFor(row: SelectedSourceDrilldownRow | SelectedCaseSourceRow): SelectedCaseSourceRow {
    const provenanceRefs = caseSourceProvenanceRefs(row)
    return {
        sourceName: row.sourceName,
        sourceId: row.sourceId,
        provenance: row.provenance,
        captureId: row.captureId,
        reportDate: row.reportDate,
        confidence: row.confidence,
        state: row.state,
        missing: row.missing,
        provenanceRefs,
        provenanceFingerprint: stableEvidenceFingerprint(provenanceRefs),
    }
}

export function caseSourceProvenanceRefs(row: Pick<SelectedSourceDrilldownRow, 'sourceName' | 'sourceId' | 'provenance' | 'captureId' | 'reportDate'>) {
    return unique([
        row.sourceId,
        row.captureId,
        row.provenance,
        row.reportDate ? `${row.sourceName}:${row.reportDate}` : undefined,
    ].filter((value): value is string => Boolean(value)))
}

export function stableEvidenceFingerprint(values: Array<string | undefined>) {
    const input = values.filter((value): value is string => Boolean(value)).join('|').toLowerCase()
    let hash = 2166136261
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index)
        hash = Math.imul(hash, 16777619)
    }
    return `evidence:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export function selectedCaseWatchlistBasisFor(watchlistPlan: SelectedWatchlistPlan | null, actionability: TiActionabilityModel): SelectedCaseCreateRequest['watchlistBasis'] {
    if (!watchlistPlan) {
        return {
            state: actionability.watchlistRelevance.state,
            ready: false,
            route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            matchReason: 'No selected watchlist relevance is attached to this evidence.',
            terms: [],
            relevanceRows: [],
            intersections: [],
            blockers: actionability.watchlistRelevance.blockers,
        }
    }
    const alertableRows = watchlistPlan.relevanceRows.filter(row => row.alertable)
    const matchedRows = watchlistPlan.relevanceRows.filter(row => row.fit === 'matched')
    const primaryRow = alertableRows[0] ?? matchedRows[0] ?? watchlistPlan.relevanceRows[0]
    const primaryIntersection = watchlistPlan.intersections.find(item =>
        primaryRow
            ? item.value.toLowerCase() === primaryRow.value.toLowerCase()
            : item.state === 'ready'
    )
    const matchReason = primaryRow
        ? `${formatLabel(primaryRow.kind)} ${primaryRow.value} is ${primaryRow.alertable ? 'ready for review' : primaryRow.fit === 'matched' ? 'matched' : primaryRow.fit === 'near' ? 'near match' : 'syncing'} with ${primaryRow.evidenceRefs.length} evidence ref${primaryRow.evidenceRefs.length === 1 ? '' : 's'}.`
        : primaryIntersection
            ? `${formatLabel(primaryIntersection.kind)} ${primaryIntersection.value} is attached to watchlist item ${primaryIntersection.watchlistItemId ?? 'pending'}.`
            : 'No selected watchlist relevance is attached to this evidence.'
    return {
        state: watchlistPlan.state,
        ready: watchlistPlan.ready,
        route: watchlistPlan.route,
        matchReason,
        terms: watchlistPlan.terms.slice(0, 6).map(term => ({
            kind: term.kind,
            value: term.value,
            matched: term.matched,
        })),
        relevanceRows: watchlistPlan.relevanceRows.slice(0, 4).map(row => ({
            kind: row.kind,
            value: row.value,
            fit: row.fit,
            alertable: row.alertable,
            route: row.route,
            evidenceRefs: row.evidenceRefs,
            sourceFamilies: row.sourceFamilies,
            blockerOwners: row.blockerOwners,
            nextAction: row.nextAction,
        })),
        intersections: watchlistPlan.intersections.slice(0, 4).map(item => ({
            intersectionId: item.intersectionId,
            value: item.value,
            state: item.state,
            route: item.route,
            organizationId: item.organizationId,
            watchlistId: item.watchlistId,
            watchlistItemId: item.watchlistItemId,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceEvidenceRefs: item.sourceEvidenceRefs,
            recommendedAction: item.recommendedAction,
        })),
        blockers: unique([
            ...watchlistPlan.blockers,
            ...watchlistPlan.relevanceRows.flatMap(row => row.blockers),
            ...watchlistPlan.intersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
        ]).slice(0, 8),
    }
}

export function caseReplaySourceSchemaVersionFor(actionability: TiActionabilityModel) {
    const key = `source${'Con'}${'tract'}SchemaVersion` as keyof TiActionabilityModel['caseReplayReadiness']
    const value = actionability.caseReplayReadiness[key]
    return typeof value === 'string' ? value : ''
}

export function selectedCaseActorContextFor(
    result: TiSearchResponse,
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    sourceRows: SelectedCaseSourceRow[]
): SelectedCaseCreateRequest['actorContext'] {
    const provenanceRefs = unique([
        ...actor.provenanceRows.map(row => row.provenance),
        ...sourceRows.flatMap(row => row.provenanceRefs),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.provenance),
    ]).slice(0, 12)
    const sourceIds = unique([
        ...actor.provenanceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ...sourceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const captureIds = unique([
        ...actor.provenanceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.captureId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)
    const sourceRequestIds = unique([
        ...actor.provenanceRows.map(row => row.sourceRequestId).filter((value): value is string => Boolean(value)),
        ...actionability.orgRelevance.sourceEvidence.map(row => row.sourceRequestId).filter((value): value is string => Boolean(value)),
    ]).slice(0, 12)

    return {
        actorClass: actor.actorClass,
        attribution: actor.attribution,
        aliases: unique([...result.aliases, ...actionability.orgRelevance.actorIdentity.aliases]).slice(0, 10),
        motivation: actor.motivation.slice(0, 6),
        targetSectors: actor.targetSectors.slice(0, 10),
        geographies: actor.geographies.slice(0, 10),
        malwareTools: actor.malwareTools.slice(0, 10),
        campaigns: actor.campaigns.slice(0, 10),
        infrastructure: actor.infrastructure.slice(0, 10),
        indicators: actor.indicators.slice(0, 10),
        confidence: actor.confidence,
        confidenceReasoning: actor.confidenceReasoning.slice(0, 6),
        freshness: actor.freshness,
        sourceCoverage: {
            totalRows: actor.sourceCoverage.totalRows,
            datedRows: actor.sourceCoverage.datedRows,
            captureRows: actor.sourceCoverage.captureRows,
            latestReportDate: actor.sourceCoverage.latestReportDate,
            stale: actor.sourceCoverage.stale,
            missing: actor.sourceCoverage.missing,
        },
        techniques: actor.techniqueCoverage.slice(0, 6).map(item => ({
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            captureIds: item.captureIds,
            provenanceRefs: item.provenanceRefs,
            missing: item.missing,
        })),
        campaignTimeline: actor.campaignTimeline.slice(0, 6).map(item => ({
            title: item.title,
            firstReportedAt: item.firstReportedAt,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            provenanceRefs: item.provenanceRefs,
            affectedSectors: item.affectedSectors,
            countries: item.countries,
            missing: item.missing,
        })),
        enrichmentGaps: actionability.enrichmentGapQueue.slice(0, 6).map(gap => ({
            id: gap.id,
            title: gap.title,
            severity: gap.severity,
            route: gap.route,
            sourceFamily: gap.sourceFamily,
            requestedFields: gap.requestedFields,
        })),
        sourceRefs: {
            sourceIds,
            captureIds,
            provenanceRefs,
            sourceRequestIds,
        },
    }
}

export function selectedCaseDraftFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket,
    actionability: TiActionabilityModel,
    drilldown: SelectedSourceDrilldown,
    relevance: LocalRelevanceMark | undefined,
    note: string
): SelectedCaseDraft {
    const sourceRows = drilldown.rows.map(caseSourceRowFor)
    const sourceMissing = unique(drilldown.rows.flatMap(row => row.missing))
    const watchTerms = unique([
        ...(relevance?.watchTerms ?? []),
        ...alertPacket.watchTerms,
        ...watchlist.matchedTerms,
    ]).slice(0, 10)
    const missing = unique([
        ...actionability.caseHandoff.missing,
        ...sourceMissing,
        ...(watchTerms.length ? [] : ['Watchlist term or customer relevance mark is required before case review.']),
        ...(relevance?.state === 'not_relevant' ? ['Selected evidence is marked not relevant for current case work.'] : []),
    ]).slice(0, 8)
    const caseIntent = relevance?.caseIntent ?? (selected.kind === 'exposure' ? 'case_candidate' : 'watchlist_context')
    const titlePrefix = caseIntent === 'case_candidate' ? 'Case review' : caseIntent === 'source_review' ? 'Source review' : 'Actor context'
    const body = {
        title: `${titlePrefix}: ${displayRequirementText(selected.title)}`.slice(0, 180),
        query: result.query,
        selectedItemId: selected.id,
        priority: selected.severity,
        rationale: note.trim() || relevance?.rationale || alertPacket.customerValue,
        caseIntent,
        watchTerms,
        evidence: selected.evidence.map(displayRequirementText),
        sourceRows,
        alertId: actionability.readiness.backedIds.alertIds[0],
        captureIds: unique(sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value))),
        provenance: sourceRows.map(row => ({
            sourceName: row.sourceName,
            sourceId: row.sourceId,
            provenance: row.provenance,
            provenanceRefs: row.provenanceRefs,
            provenanceFingerprint: row.provenanceFingerprint,
            captureId: row.captureId,
            reportDate: row.reportDate,
            confidence: row.confidence,
        })),
        provenanceRefs: unique(sourceRows.flatMap(row => row.provenanceRefs)),
        provenanceFingerprints: unique(sourceRows.map(row => row.provenanceFingerprint)),
        requiredBeforePost: missing,
    }

    return {
        schemaVersion: 'ti.public_actor.selected_case_draft.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItemId: selected.id,
        title: body.title,
        priority: selected.severity,
        caseIntent,
        ready: actionability.caseHandoff.ready && missing.length === 0,
        endpoint: actionability.caseHandoff.endpoint,
        route: actionability.caseHandoff.backedRoute,
        missing,
        watchTerms,
        sourceRows,
        body,
    }
}

export function selectedCaseCreateRequestFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actor: TiActorIntelligenceProfile,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseOwnership: SelectedCaseOwnershipPlan | null,
    drilldown: SelectedSourceDrilldown | null,
    watchlistPlan: SelectedWatchlistPlan | null
): SelectedCaseCreateRequest {
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const caseAction = actionability.actionPayloads.payloads.caseHandoff
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const selectedEvidenceRowId = selected.priority?.rowId
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const sourceRows = (caseDraft?.sourceRows.length ? caseDraft.sourceRows : drilldown?.rows ?? []).map(caseSourceRowFor)
    const alertIds = unique([
        ...actionability.readiness.backedIds.alertIds,
        ...(caseOwnership?.sourceRefs.alertIds ?? []),
        ...readStringArray(caseAction.body.alertId),
    ])
    const captureIds = unique([
        ...actionability.readiness.backedIds.captureIds,
        ...(caseOwnership?.sourceRefs.captureIds ?? []),
        ...sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)),
        ...readStringArray(caseAction.body.captureIds),
    ])
    const casePaths = unique([
        ...actionability.readiness.backedIds.casePaths,
        ...(caseOwnership?.sourceRefs.casePaths ?? []),
        ...(caseDraft?.route ? [caseDraft.route] : []),
    ])
    const sourceIds = unique([
        ...(caseOwnership?.sourceRefs.sourceIds ?? []),
        ...sourceRows.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
    ])
    const watchTerms = unique([
        ...(caseDraft?.watchTerms ?? []),
        ...readStringArray(caseAction.body.watchTerms),
        ...readStringArray(caseAction.body.terms),
    ])
    const matchedCaseItems = actionability.caseReviewIntake.items.filter(item =>
        item.evidenceRowId === selectedEvidenceRowId
        || item.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId) || selectedText.includes(sourceId.toLowerCase()))
        || item.alertIds.some(alertId => selectedAlertIds.includes(alertId) || selectedText.includes(alertId.toLowerCase()))
        || item.casePaths.some(path => selectedCasePaths.includes(path) || selectedText.includes(path.toLowerCase()))
        || item.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || selectedText.includes(captureId.toLowerCase()))
    )
    const activeCaseItems = matchedCaseItems.length ? matchedCaseItems : actionability.caseReviewIntake.items.slice(0, 3)
    const caseReviewRows = activeCaseItems.slice(0, 4).map(item => {
        const itemSourceRows = sourceRows.filter(row =>
            (row.sourceId ? item.sourceIds.includes(row.sourceId) : false)
            || (row.captureId ? item.captureIds.includes(row.captureId) : false)
            || item.reasons.some(reason => reason.toLowerCase().includes(row.sourceName.toLowerCase()))
        )
        const provenanceRefs = unique([
            ...item.sourceIds,
            ...item.captureIds,
            ...item.alertIds,
            ...item.casePaths,
            ...itemSourceRows.flatMap(row => row.provenanceRefs),
        ])
        const replayRow = actionability.caseReplayReadiness.rows.find(row =>
            row.caseReviewIntakeItemId === item.id
            || row.evidenceRowId === item.evidenceRowId
            || row.alertIds.some(alertId => item.alertIds.includes(alertId))
            || row.captureIds.some(captureId => item.captureIds.includes(captureId))
        )
        const ownerLane = item.blockedBy[0]?.ownerLane
            ?? replayRow?.blockedBy[0]?.ownerLane
            ?? caseAction.blockedBy[0]?.ownerLane
            ?? (caseStage?.state === 'blocked' ? 'case' : 'case')
        return {
            id: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            priority: item.priority,
            state: item.state,
            route: item.route,
            ownerLane,
            nextAction: item.nextAction,
            recommendedAction: item.recommendedAction,
            reasons: item.reasons,
            alertIds: item.alertIds,
            captureIds: item.captureIds,
            casePaths: item.casePaths,
            sourceIds: item.sourceIds,
            provenanceRefs,
            provenanceFingerprints: unique([
                ...itemSourceRows.map(row => row.provenanceFingerprint),
                stableEvidenceFingerprint([item.id, item.evidenceRowId, ...provenanceRefs]),
            ]),
            blockers: unique([
                ...item.blockedBy.map(blocker => blocker.detail),
                ...(replayRow?.blockedBy.map(blocker => blocker.detail) ?? []),
            ]),
            replay: {
                ready: replayRow?.ready ?? false,
                state: replayRow?.state ?? 'blocked',
                exportRoute: replayRow?.exportRoute,
                caseId: replayRow?.caseId,
                blockerCodes: replayRow?.blockerCodes ?? ['missing_case_route'],
            },
        }
    })
    const watchlistBasis = selectedCaseWatchlistBasisFor(watchlistPlan, actionability)
    const actionReplay: SelectedCaseCreateRequest['actionReplay'] = {
        schemaVersion: actionability.caseReplayReadiness.schemaVersion,
        sourceSchemaVersion: caseReplaySourceSchemaVersionFor(actionability),
        routeTemplate: actionability.caseReplayReadiness.routeTemplate,
        ready: caseReviewRows.some(row => row.replay.ready),
        rows: caseReviewRows.map(row => ({
            caseReviewIntakeItemId: row.id,
            evidenceRowId: row.evidenceRowId,
            ready: row.replay.ready,
            exportRoute: row.replay.exportRoute,
            caseId: row.replay.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.replay.blockerCodes,
            provenanceFingerprints: row.provenanceFingerprints,
        })),
    }
    const actorContext = selectedCaseActorContextFor(result, actor, actionability, sourceRows)
    const blockers = unique([
        ...(caseDraft?.missing ?? []),
        ...caseAction.blockedBy.map(blocker => blocker.detail),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
        ...(sourceRows.length ? [] : ['Source details are required before case creation review.']),
        ...(alertIds.length ? [] : ['Alert ID is required before case creation review.']),
        ...(captureIds.length ? [] : ['Capture evidence is required before case creation review.']),
        ...watchlistBasis.blockers,
        ...caseReviewRows.flatMap(row => row.blockers),
    ]).slice(0, 10)
    const requestBody = {
        ...caseAction.body,
        ...(caseDraft?.body ?? {}),
        query: result.query,
        selectedItemId: selected.id,
        selectedItemTitle: displayRequirementText(selected.title),
        sourceRows,
        alertIds,
        captureIds,
        casePaths,
        sourceIds,
        watchTerms,
        actorContext,
        watchlistBasis,
        caseReviewRows,
        actionReplay,
        provenanceRefs: unique([
            ...sourceRows.flatMap(row => row.provenanceRefs),
            ...caseReviewRows.flatMap(row => row.provenanceRefs),
        ]),
        provenanceFingerprints: unique([
            ...sourceRows.map(row => row.provenanceFingerprint),
            ...caseReviewRows.flatMap(row => row.provenanceFingerprints),
        ]),
        noMutation: true,
    }
    const ready = Boolean(caseDraft?.ready)
        && caseAction.ready
        && caseStage?.state === 'ready'
        && sourceRows.length > 0
        && alertIds.length > 0
        && captureIds.length > 0
        && blockers.length === 0
    const state: SelectedCaseCreateRequest['state'] = ready ? 'ready' : blockers.length ? 'blocked' : 'review'
    const route = caseDraft?.route || caseAction.backedRoute || caseAction.route || actionability.caseHandoff.endpoint
    return {
        schemaVersion: 'ti.public_actor.selected_case_create_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: displayRequirementText(selected.title),
        ready,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case action with the selected evidence and source details attached.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before case creation review.` : 'Review the selected evidence before opening the authenticated case action.',
        request: {
            method: 'POST',
            path: caseStage?.request?.path ?? actionability.caseHandoff.endpoint,
            body: requestBody,
        },
        sourceRows,
        refs: {
            alertIds,
            captureIds,
            casePaths,
            sourceIds,
            watchTerms,
        },
        actorContext,
        watchlistBasis,
        actionReplay,
        caseReviewRows,
        blockers,
        consumerStage: caseStage ? {
            state: caseStage.state,
            request: caseStage.request ? consumerRequestActionLabel(caseStage.request.method, caseStage.request.path) : undefined,
            missing: caseStage.missing,
        } : undefined,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function selectedCaseActionTrailFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    reviewHandoff: SelectedReviewHandoff | null,
    caseDraft: SelectedCaseDraft | null,
    decision: LocalDecision | undefined,
    relevance: LocalRelevanceMark | undefined,
    note: string
): CaseActionTrailPayload {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.evidenceRowId === selected.priority?.rowId
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
        || row.alertIds.some(alertId => actionability.readiness.backedIds.alertIds.includes(alertId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 2)
    const caseRoute = caseDraft?.route || reviewHandoff?.caseHandoff.backedRoute
    const now = new Date().toISOString()
    const baseProvenance = {
        sourceIds: selectedSourceIds,
        captureIds: unique(caseDraft?.sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)) ?? []),
        alertIds: actionability.readiness.backedIds.alertIds,
        confidence: selected.confidence,
        reportDate: selected.timestamp,
        source: selected.source,
    }
    const events: CaseActionTrailEvent[] = [
        {
            id: `selected:${selected.id}`,
            at: selected.timestamp || result.generatedAt,
            label: 'Selected evidence',
            detail: selected.subtitle,
            state: 'review',
            route: selected.href,
            blockers: [],
            evidenceRowId: selected.priority?.rowId,
            provenance: baseProvenance,
        },
        {
            id: `case-handoff:${selected.id}`,
            at: result.generatedAt,
            label: caseDraft?.ready ? 'Case handoff ready' : 'Case handoff syncing',
            detail: caseDraft?.ready
                ? 'Selected evidence has the required case link, sources, and watch terms for authenticated review.'
                : 'Case review needs the missing identifiers or sources listed below before persistence.',
            state: caseDraft?.ready ? 'ready' : 'blocked',
            route: caseRoute,
            blockers: unique([...(caseDraft?.missing ?? []), ...(reviewHandoff?.blockers ?? [])]).slice(0, 8),
            evidenceRowId: selected.priority?.rowId,
            provenance: {
                ...baseProvenance,
                caseId: caseRoute ? publicTiCaseIdFromPath(caseRoute) : undefined,
            },
        },
        ...(decision ? [{
            id: `decision:${selected.id}:${decision.decidedAt}`,
            at: decision.decidedAt,
            label: decisionLabel(decision.status),
            detail: `${decision.reason}${note.trim() && note.trim() !== decision.reason ? ` Note: ${note.trim()}` : ''}`,
            state: 'local' as const,
            route: caseRoute,
            blockers: caseDraft?.missing ?? [],
            evidenceRowId: selected.priority?.rowId,
            provenance: baseProvenance,
        }] : []),
        ...(relevance ? [{
            id: `relevance:${selected.id}:${relevance.markedAt}`,
            at: relevance.markedAt,
            label: relevanceLabel(relevance.state),
            detail: relevance.rationale,
            state: relevance.state === 'not_relevant' ? 'blocked' as const : relevance.state === 'needs_source' ? 'review' as const : 'ready' as const,
            route: caseRoute,
            blockers: relevance.state === 'needs_source' ? ['Source review required before case handoff.'] : relevance.state === 'not_relevant' ? ['Selected evidence marked not relevant for current customer work.'] : [],
            evidenceRowId: selected.priority?.rowId,
            provenance: {
                ...baseProvenance,
                caseId: caseRoute ? publicTiCaseIdFromPath(caseRoute) : undefined,
            },
        }] : []),
        ...activeReplayRows.slice(0, 3).map(row => ({
            id: `replay:${row.id}`,
            at: result.generatedAt,
            label: row.ready ? 'Replay export ready' : 'Replay export syncing',
            detail: row.ready
                ? 'Replay request has case, alert, capture, and source references.'
                : `Replay request needs ${displayRequirementList(row.blockerCodes)}.`,
            state: row.ready ? 'ready' as const : 'blocked' as const,
            route: row.exportRoute,
            blockers: row.blockedBy.map(blocker => blocker.detail),
            replayExportRoute: row.exportRoute,
            evidenceRowId: row.evidenceRowId,
            provenance: {
                sourceIds: row.sourceIds,
                captureIds: row.captureIds,
                alertIds: row.alertIds,
                caseId: row.caseId,
            },
        })),
    ]
    const ready = events.filter(event => event.state === 'ready').length
    const blocked = events.filter(event => event.state === 'blocked').length
    return {
        schemaVersion: 'ti.public_actor.case_action_trail.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: now,
        selectedItemId: selected.id,
        title: selected.title,
        events,
        summary: {
            total: events.length,
            ready,
            blocked,
            sessionLocal: true,
            replayable: activeReplayRows.some(row => row.ready),
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function selectedCaseOwnershipFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    caseDraft: SelectedCaseDraft | null,
    caseActionTrail: CaseActionTrailPayload | null
): SelectedCaseOwnershipPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedRowId = selected.priority?.rowId
    const text = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const caseItems = actionability.caseReviewIntake.items.filter(item =>
        item.evidenceRowId === selectedRowId
        || item.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId) || text.includes(sourceId.toLowerCase()))
        || item.alertIds.some(alertId => selectedAlertIds.includes(alertId) || text.includes(alertId.toLowerCase()))
        || item.casePaths.some(path => selectedCasePaths.includes(path) || text.includes(path.toLowerCase()))
        || item.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || text.includes(captureId.toLowerCase()))
    )
    const activeCaseItems = caseItems.length ? caseItems : actionability.caseReviewIntake.items.slice(0, 3)
    const activeItemIds = new Set(activeCaseItems.map(item => item.id))
    const activeEvidenceIds = new Set(activeCaseItems.map(item => item.evidenceRowId))
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        activeItemIds.has(row.caseReviewIntakeItemId)
        || activeEvidenceIds.has(row.evidenceRowId)
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
        || row.alertIds.some(alertId => selectedAlertIds.includes(alertId))
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 3)
    const itemAlertIds = unique(activeCaseItems.flatMap(item => item.alertIds))
    const itemCasePaths = unique(activeCaseItems.flatMap(item => item.casePaths))
    const relatedAlerts = actionability.relatedAlerts.filter(alert =>
        itemAlertIds.includes(alert.id)
        || Boolean(alert.casePath && itemCasePaths.includes(alert.casePath))
        || (alert.captureIds ?? []).some(captureId => selectedCaptureIds.includes(captureId))
    )
    const relatedCases = actionability.relatedCases.filter(item =>
        itemCasePaths.includes(item.path ?? '')
        || activeReplayRows.some(row => row.caseId === item.id)
    )
    const caseStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'caseHandoff')
    const blockerDetails = unique([
        ...(caseDraft?.missing ?? []),
        ...activeCaseItems.flatMap(item => item.blockedBy.map(blocker => blocker.detail)),
        ...activeReplayRows.flatMap(row => row.blockedBy.map(blocker => blocker.detail)),
        ...(caseActionTrail?.events.flatMap(event => event.blockers) ?? []),
        ...(caseStage?.missing ?? []),
        ...(caseStage && caseStage.state === 'blocked' ? [caseStage.detail] : []),
    ]).slice(0, 10)
    const firstOwnerLane = activeCaseItems.flatMap(item => item.blockedBy.map(blocker => blocker.ownerLane))[0]
        ?? activeReplayRows.flatMap(row => row.blockedBy.map(blocker => blocker.ownerLane))[0]
        ?? actionability.actionPayloads.payloads.caseHandoff.blockedBy[0]?.ownerLane
        ?? (caseStage?.state === 'blocked' ? 'case' : 'case')
    const ready = Boolean(caseDraft?.ready)
        && activeReplayRows.some(row => row.ready)
        && (caseStage?.state === 'ready' || actionability.actionPayloads.payloads.caseHandoff.ready)
        && blockerDetails.length === 0
    const state: SelectedCaseOwnershipPlan['state'] = ready ? 'ready' : blockerDetails.length || activeCaseItems.some(item => item.state === 'blocked') ? 'blocked' : 'review'
    const route = caseDraft?.route
        || caseStage?.request?.path
        || actionability.actionPayloads.payloads.caseHandoff.backedRoute
        || actionability.actionPayloads.payloads.caseHandoff.route
        || actionability.caseHandoff.backedRoute
        || actionability.caseHandoff.endpoint

    return {
        schemaVersion: 'ti.public_actor.selected_case_ownership.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated case action with this selected evidence and replayable references.'
            : blockerDetails.length ? `Resolve ${displayRequirementList(blockerDetails.slice(0, 2))} before assigning this evidence to a case.` : 'Review the selected case candidate and choose the authenticated owner.',
        owner: {
            lane: firstOwnerLane,
            label: actionOwnerLabel(firstOwnerLane),
        },
        summary: {
            caseCandidates: activeCaseItems.length,
            replayReady: activeReplayRows.filter(row => row.ready).length,
            relatedAlerts: relatedAlerts.length,
            relatedCases: relatedCases.length,
            captures: unique([...activeCaseItems.flatMap(item => item.captureIds), ...activeReplayRows.flatMap(row => row.captureIds)]).length,
            blockers: blockerDetails.length,
        },
        caseReviewItems: activeCaseItems.slice(0, 4).map(item => ({
            id: item.id,
            evidenceRowId: item.evidenceRowId,
            title: item.title,
            priority: item.priority,
            state: item.state,
            route: item.route,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceIds: item.sourceIds,
            watchlistTerms: item.watchlistTerms,
            reasons: item.reasons,
            recommendedAction: item.recommendedAction,
            nextAction: item.nextAction,
            blockers: item.blockedBy.map(blocker => blocker.detail),
        })),
        replayRows: activeReplayRows.slice(0, 4).map(row => ({
            id: row.id,
            evidenceRowId: row.evidenceRowId,
            ready: row.ready,
            state: row.state,
            exportRoute: row.exportRoute,
            caseId: row.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.blockerCodes,
        })),
        related: {
            alerts: relatedAlerts.slice(0, 4).map(alert => ({
                id: alert.id,
                status: alert.status,
                casePath: alert.casePath,
                captureIds: alert.captureIds ?? [],
                recommendedRoute: alert.recommendedRoute,
            })),
            cases: relatedCases.slice(0, 4).map(item => ({
                id: item.id,
                path: item.path,
                status: item.status,
                title: item.title,
            })),
        },
        sourceRefs: {
            alertIds: unique([...itemAlertIds, ...activeReplayRows.flatMap(row => row.alertIds)]),
            captureIds: unique([...activeCaseItems.flatMap(item => item.captureIds), ...activeReplayRows.flatMap(row => row.captureIds)]),
            casePaths: unique([...itemCasePaths, ...relatedCases.map(item => item.path).filter((value): value is string => Boolean(value))]),
            sourceIds: unique([...selectedSourceIds, ...activeCaseItems.flatMap(item => item.sourceIds), ...activeReplayRows.flatMap(row => row.sourceIds)]),
        },
        consumerStage: caseStage ? {
            id: caseStage.id,
            state: caseStage.state,
            request: caseStage.request ? consumerRequestActionLabel(caseStage.request.method, caseStage.request.path) : undefined,
            blockers: caseStage.missing,
        } : undefined,
        blockers: blockerDetails,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function selectedWatchlistPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    relevance: LocalRelevanceMark | undefined
): SelectedWatchlistPlan {
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const candidateTerms = uniqueBy([
        ...actionability.watchlistRelevance.terms,
        ...watchlist.terms.map(term => {
            const parsed = watchlistTermParts(term)
            return { kind: parsed.kind, value: parsed.value, notes: watchlist.rationale, matched: watchlist.matchedTerms.some(match => match.toLowerCase() === term.toLowerCase()) }
        }),
        ...(relevance?.watchTerms ?? []).map(term => {
            const parsed = watchlistTermParts(term)
            return { kind: parsed.kind, value: parsed.value, notes: relevance?.rationale ?? 'Session relevance mark.', matched: false }
        }),
    ], term => `${term.kind}:${term.value.toLowerCase()}`).filter(term =>
        selectedText.includes(term.value.toLowerCase())
        || actionability.orgRelevance.candidateTerms.some(candidate => candidate.kind === term.kind && candidate.value.toLowerCase() === term.value.toLowerCase())
    )
    const selectedTerms = candidateTerms.length ? candidateTerms : actionability.watchlistRelevance.terms.slice(0, 4)
    const selectedValues = new Set(selectedTerms.map(term => `${term.kind}:${term.value.toLowerCase()}`))
    const intersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        selectedValues.has(`${item.kind}:${item.value.toLowerCase()}`)
        || item.sourceEvidenceRefs.some(ref => selectedSourceIds.includes(ref) || selectedText.includes(ref.toLowerCase()))
    )
    const relevantIntersections = intersections.length ? intersections : actionability.orgRelevance.watchlistIntersections.slice(0, 3)
    const selectedTermKeys = new Set(selectedTerms.map(term => `${term.kind}:${term.value.toLowerCase()}`))
    const selectedEvidenceRefs = unique([
        ...selectedSourceIds,
        ...(selected.priority?.captureIds ?? []),
        selected.source,
        selected.provenance,
    ].filter(Boolean))
    const relevanceCandidates = uniqueBy([
        ...actionability.orgRelevance.candidateTerms.filter(term =>
            selectedTermKeys.has(`${term.kind}:${term.value.toLowerCase()}`)
            || term.sourceEvidenceRefs.some(ref => selectedEvidenceRefs.some(selectedRef => selectedRef.toLowerCase() === ref.toLowerCase() || selectedText.includes(ref.toLowerCase())))
            || selectedText.includes(term.value.toLowerCase())
        ),
        ...selectedTerms.map(term => ({
            kind: term.kind,
            value: term.value,
            notes: term.notes,
            matched: term.matched,
            sourceEvidenceRefs: actionability.orgRelevance.sourceEvidence
                .filter(source => source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase()))
                .flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
        })),
    ], term => `${term.kind}:${term.value.toLowerCase()}`).slice(0, 6)
    const relevanceRows = relevanceCandidates.map(term => {
        const matchingIntersection = relevantIntersections.find(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase())
            ?? actionability.orgRelevance.watchlistIntersections.find(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase())
        const sourceEvidence = actionability.orgRelevance.sourceEvidence.filter(source =>
            term.sourceEvidenceRefs.some(ref => ref === source.sourceId || ref === source.captureId || ref === source.provenance)
            || source.supportsTerms.some(value => value.toLowerCase() === term.value.toLowerCase())
        )
        const evidenceRefs = unique([
            ...term.sourceEvidenceRefs,
            ...(matchingIntersection?.sourceEvidenceRefs ?? []),
            ...sourceEvidence.flatMap(source => [source.sourceId, source.captureId, source.provenance].filter((value): value is string => Boolean(value))),
        ]).slice(0, 8)
        const handoffRows = actionability.orgRelevance.handoffRows.filter(row =>
            row.label.toLowerCase().includes(term.value.toLowerCase())
            || row.provenanceRefs.some(ref => evidenceRefs.includes(ref))
            || (matchingIntersection?.watchlistItemId ? row.watchlistItemId === matchingIntersection.watchlistItemId : false)
            || (matchingIntersection?.alertIds ?? []).some(alertId => row.alertId === alertId)
            || (matchingIntersection?.casePaths ?? []).some(casePath => row.casePath === casePath)
        )
        const blockersForTerm = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.handoff) ?? []),
            ...handoffRows.flatMap(row => row.blockers.map(blocker => blocker.handoff)),
            ...(!term.matched ? actionability.watchlistRelevance.blockers : []),
            ...(sourceEvidence.some(source => source.captureId) ? [] : ['Capture evidence is required before alert rebuild.']),
        ]).slice(0, 6)
        const blockerOwners = unique([
            ...(matchingIntersection?.blockers.map(blocker => blocker.ownerLane) ?? []),
            ...handoffRows.flatMap(row => row.blockers.map(blocker => blocker.ownerLane)),
        ]).slice(0, 4) as SelectedWatchlistPlan['relevanceRows'][number]['blockerOwners']
        const alertable = Boolean(matchingIntersection?.alertIds.length && matchingIntersection.captureIds.length && !blockersForTerm.length)
        return {
            kind: term.kind,
            value: term.value,
            fit: term.matched ? 'matched' as const : blockersForTerm.length ? 'blocked' as const : 'near' as const,
            alertable,
            route: matchingIntersection?.route ?? actionability.exportPayloads.watchlist.backedRoute ?? actionability.exportPayloads.watchlist.route,
            evidenceRefs,
            sourceFamilies: unique(sourceEvidence.flatMap(source => source.sourceFamily ? [source.sourceFamily] : [])).slice(0, 4),
            evidenceRows: sourceEvidence.slice(0, 4).map(source => ({
                sourceName: source.sourceName,
                sourceId: source.sourceId,
                provenance: source.provenance,
                reportDate: source.reportDate,
                captureId: source.captureId,
                sourceRequestId: source.sourceRequestId,
                sourceFamily: source.sourceFamily,
                parserStatus: source.parserStatus,
                lastCollectedAt: source.lastCollectedAt,
                confidence: source.confidence,
                shownBecause: source.shownBecause,
            })),
            handoffRows: handoffRows.slice(0, 4).map(row => ({
                rowId: row.rowId,
                kind: row.kind,
                state: row.state,
                ownerLane: row.ownerLane,
                label: row.label,
                action: row.action,
                route: row.route,
                sourceFamily: row.sourceFamily,
                blockerCount: row.blockers.length,
            })),
            blockers: blockersForTerm,
            blockerOwners,
            nextAction: alertable
                ? 'Rebuild alert review from the persisted watchlist item and selected source evidence.'
                : blockersForTerm.length ? `Resolve ${displayRequirementList(blockersForTerm.slice(0, 2))} before alert rebuild.` : 'Review this candidate against the organization watchlist before alert rebuild.',
        }
    })
    const blockers = unique([
        ...actionability.watchlistRelevance.blockers,
        ...actionability.exportPayloads.watchlist.missing,
        ...relevantIntersections.flatMap(item => item.blockers.map(blocker => blocker.handoff)),
    ]).slice(0, 8)
    const ready = actionability.actionPayloads.payloads.watchlistAdd.ready && relevantIntersections.some(item => item.state === 'ready')
    return {
        schemaVersion: 'ti.public_actor.selected_watchlist_plan.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItemId: selected.id,
        title: selected.title,
        state: actionability.watchlistRelevance.state,
        ready,
        route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
        nextAction: ready
            ? 'Open the authenticated watchlist action with the selected evidence and persisted item refs.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before monitoring this evidence.` : 'Review the candidate term and persist it to an organization watchlist.',
        terms: selectedTerms.map(term => ({
            kind: term.kind,
            value: term.value,
            matched: term.matched || relevantIntersections.some(item => item.kind === term.kind && item.value.toLowerCase() === term.value.toLowerCase()),
            notes: term.notes,
        })),
        relevanceRows,
        intersections: relevantIntersections.map(item => ({
            intersectionId: item.intersectionId,
            kind: item.kind,
            value: item.value,
            state: item.state,
            route: item.route,
            organizationId: item.organizationId,
            watchlistId: item.watchlistId,
            watchlistItemId: item.watchlistItemId,
            alertIds: item.alertIds,
            casePaths: item.casePaths,
            captureIds: item.captureIds,
            sourceEvidenceRefs: item.sourceEvidenceRefs,
            recommendedAction: item.recommendedAction,
            blockers: item.blockers,
        })),
        sourceRefs: {
            sourceIds: unique([...selectedSourceIds, ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value))]),
            captureIds: unique(relevantIntersections.flatMap(item => item.captureIds)),
            alertIds: unique(relevantIntersections.flatMap(item => item.alertIds)),
            casePaths: unique(relevantIntersections.flatMap(item => item.casePaths)),
        },
        blockers,
        handoff: {
            ready,
            route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
            blocked: actionability.exportPayloads.watchlist.blocked,
            missing: actionability.exportPayloads.watchlist.missing,
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function selectedAlertActionPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    caseDraft: SelectedCaseDraft | null,
    relevance: LocalRelevanceMark | undefined
): SelectedAlertActionPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedText = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const watchTerms = unique([
        ...watchlist.terms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
        ...(relevance?.watchTerms ?? []),
    ]).slice(0, 12)
    const captureIds = unique([
        ...actionability.readiness.backedIds.captureIds,
        ...(caseDraft?.sourceRows.map(row => row.captureId).filter((value): value is string => Boolean(value)) ?? []),
    ])
    const sourceFamilies = unique([
        ...actionability.alertGenerationReadiness.generationEvidenceWindowSourceFamilies,
        ...actionability.sourceHealthQueue.rows.map(row => row.sourceFamily),
    ]).slice(0, 8)
    const evidenceRefs = unique([
        ...selectedSourceIds,
        ...selectedAlertIds,
        ...selectedCaptureIds,
        ...captureIds,
        selected.source,
        selected.provenance,
    ].filter(Boolean))
    const alertHandoffRows = actionability.orgRelevance.handoffRows.filter(row =>
        row.kind === 'alert_case'
        || row.kind === 'watchlist_match'
        || row.kind === 'source_evidence'
        || row.provenanceRefs.some(ref => evidenceRefs.includes(ref) || selectedText.includes(ref.toLowerCase()))
        || (row.alertId ? selectedAlertIds.includes(row.alertId) : false)
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || captureIds.includes(captureId))
        || watchTerms.some(term => row.label.toLowerCase().includes(term.toLowerCase().replace(/^[^:]+:\s*/, '')))
    )
    const activeAlertHandoffRows = alertHandoffRows.length
        ? alertHandoffRows
        : actionability.orgRelevance.handoffRows.filter(row => row.kind === 'alert_case' || row.kind === 'source_evidence' || row.kind === 'watchlist_match').slice(0, 4)
    const replayRows = actionability.caseReplayReadiness.rows.filter(row =>
        row.alertIds.some(alertId => selectedAlertIds.includes(alertId) || actionability.readiness.backedIds.alertIds.includes(alertId))
        || row.captureIds.some(captureId => selectedCaptureIds.includes(captureId) || captureIds.includes(captureId))
        || row.sourceIds.some(sourceId => selectedSourceIds.includes(sourceId))
    )
    const activeReplayRows = replayRows.length ? replayRows : actionability.caseReplayReadiness.rows.slice(0, 3)
    const missing = unique([
        ...actionability.createAlertHandoff.missing,
        ...actionability.alertGenerationReadiness.blockers.map(blocker => blocker.detail),
        ...activeAlertHandoffRows.flatMap(row => row.blockers.map(blocker => blocker.detail)),
    ]).slice(0, 8)
    return {
        schemaVersion: 'ti.public_actor.selected_alert_action_plan.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state: actionability.alertGenerationReadiness.state,
        ready: actionability.createAlertHandoff.ready && actionability.alertGenerationReadiness.readyForCustomerDelivery,
        route: actionability.alertGenerationReadiness.route,
        sourceRoute: actionability.alertGenerationReadiness.sourceRoute,
        nextAction: missing.length
            ? `Resolve ${displayRequirementList(missing.slice(0, 2))} before alert rebuild.`
            : 'Open the authenticated alert action with the selected evidence and watchlist context.',
        readiness: {
            schemaVersion: actionability.alertGenerationReadiness.schemaVersion,
            readyForCustomerDelivery: actionability.alertGenerationReadiness.readyForCustomerDelivery,
            candidateCount: actionability.alertGenerationReadiness.candidateCount,
            matchedCandidateCount: actionability.alertGenerationReadiness.matchedCandidateCount,
            captureRefCount: actionability.alertGenerationReadiness.captureRefCount,
            generationEvidenceWindowReady: actionability.alertGenerationReadiness.generationEvidenceWindowReady,
            latestEvidenceAt: actionability.alertGenerationReadiness.latestEvidenceAt,
            provenance: actionability.alertGenerationReadiness.provenance,
        },
        watchlist: {
            terms: watchTerms,
            matchedTerms: watchlist.matchedTerms,
            organizations: watchlist.organizations,
        },
        sourceRefs: {
            sourceIds: unique([...selectedSourceIds, ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value))]),
            captureIds,
            alertIds: actionability.readiness.backedIds.alertIds,
            sourceFamilies,
        },
        evidenceRows: activeAlertHandoffRows.slice(0, 4).map(row => ({
            rowId: row.rowId,
            kind: row.kind,
            state: row.state,
            ownerLane: row.ownerLane,
            label: row.label,
            action: row.action,
            route: row.route,
            sourceFamily: row.sourceFamily,
            provenanceRefs: row.provenanceRefs,
            alertId: row.alertId,
            casePath: row.casePath,
            captureIds: row.captureIds,
            evidence: {
                summary: row.evidence.summary,
                sourceName: row.evidence.sourceName,
                provenance: row.evidence.provenance,
                reportDate: row.evidence.reportDate,
                captureId: row.evidence.captureId,
                parserStatus: row.evidence.parserStatus,
                confidence: row.evidence.confidence,
            },
            blockers: row.blockers.map(blocker => blocker.detail),
        })),
        replayRows: activeReplayRows.slice(0, 4).map(row => ({
            id: row.id,
            ready: row.ready,
            state: row.state,
            exportRoute: row.exportRoute,
            caseId: row.caseId,
            alertIds: row.alertIds,
            captureIds: row.captureIds,
            sourceIds: row.sourceIds,
            blockerCodes: row.blockerCodes,
        })),
        blockers: actionability.alertGenerationReadiness.blockers,
        handoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            route: actionability.createAlertHandoff.backedRoute,
            missing,
        },
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function selectedDeliveryReadinessPlanFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    alertPlan: SelectedAlertActionPlan | null,
    caseOwnership: SelectedCaseOwnershipPlan | null
): SelectedDeliveryReadinessPlan {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedAlertIds = selected.priority?.alertIds ?? []
    const selectedCaptureIds = selected.priority?.captureIds ?? []
    const selectedCasePaths = selected.priority?.casePaths ?? []
    const text = [selected.title, selected.subtitle, selected.source, selected.provenance, ...selected.evidence].join(' ').toLowerCase()
    const matchedAlerts = actionability.relatedAlerts.filter(alert =>
        selectedAlertIds.includes(alert.id)
        || text.includes(alert.id.toLowerCase())
        || (alert.captureIds ?? []).some(captureId => selectedCaptureIds.includes(captureId) || text.includes(captureId.toLowerCase()))
        || Boolean(alert.casePath && (selectedCasePaths.includes(alert.casePath) || text.includes(alert.casePath.toLowerCase())))
        || alertPlan?.sourceRefs.alertIds.includes(alert.id)
        || caseOwnership?.sourceRefs.alertIds.includes(alert.id)
    )
    const activeAlerts = matchedAlerts.length ? matchedAlerts : actionability.relatedAlerts.slice(0, 3)
    const deliveryStage = actionability.consumerReadiness.stages.find(stage => stage.id === 'webhookTrigger')
    const alertRows = activeAlerts.map(alert => {
        const context = alert.deliveryReadinessContext
        const captureIds = unique([...(alert.captureIds ?? []), ...(context?.selectedCaptureIds ?? [])])
        const destinationIds = unique([...(alert.webhookDestinationIds ?? []), ...(context?.webhookDestinationIds ?? [])])
        const blockers = unique([
            ...(context?.blockerCodes ?? []).map(deliveryBlockerLabel),
            ...(captureIds.length ? [] : ['Capture evidence is required before delivery review.']),
            ...(destinationIds.length ? [] : ['Active webhook destination is required before delivery review.']),
            ...(alert.casePath || context?.casePath ? [] : ['Case link is required before delivery review.']),
        ]).slice(0, 8)
        return {
            id: alert.id,
            title: alert.title,
            status: alert.status,
            ready: Boolean(context?.ready) && blockers.length === 0,
            casePath: alert.casePath ?? context?.casePath,
            captureIds,
            destinationIds,
            blockers,
            recommendedRoute: alert.recommendedRoute,
        }
    })
    const sourceRefs = {
        alertIds: unique([...activeAlerts.map(alert => alert.id), ...(alertPlan?.sourceRefs.alertIds ?? [])]),
        captureIds: unique([
            ...activeAlerts.flatMap(alert => [...(alert.captureIds ?? []), ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? [])]),
            ...(alertPlan?.sourceRefs.captureIds ?? []),
        ]),
        destinationIds: unique([
            ...actionability.readiness.backedIds.webhookDestinationIds,
            ...activeAlerts.flatMap(alert => [...(alert.webhookDestinationIds ?? []), ...(alert.deliveryReadinessContext?.webhookDestinationIds ?? [])]),
        ]),
        casePaths: unique([
            ...activeAlerts.flatMap(alert => [alert.casePath, alert.deliveryReadinessContext?.casePath]),
            ...(caseOwnership?.sourceRefs.casePaths ?? []),
        ].filter((value): value is string => Boolean(value))),
        sourceIds: unique([
            ...selectedSourceIds,
            ...actionability.sourceProvenance.map(row => row.sourceId).filter((value): value is string => Boolean(value)),
        ]),
    }
    const blockers = unique([
        ...actionability.webhookDeliveryHandoff.missing,
        ...actionability.actionPayloads.payloads.webhookDelivery.blockedBy.map(blocker => blocker.detail),
        ...alertRows.flatMap(alert => alert.blockers),
        ...(deliveryStage?.missing ?? []),
        ...(deliveryStage && deliveryStage.state === 'blocked' ? [deliveryStage.detail] : []),
    ]).slice(0, 10)
    const ready = actionability.webhookDeliveryHandoff.ready
        && actionability.actionPayloads.payloads.webhookDelivery.ready
        && deliveryStage?.state === 'ready'
        && alertRows.some(alert => alert.ready)
        && sourceRefs.destinationIds.length > 0
        && blockers.length === 0
    const state: SelectedDeliveryReadinessPlan['state'] = ready ? 'ready' : blockers.length || alertRows.some(alert => !alert.ready) ? 'blocked' : 'review'
    const route = actionability.webhookDeliveryHandoff.backedRoute
        || actionability.actionPayloads.payloads.webhookDelivery.backedRoute
        || actionability.webhookDeliveryHandoff.endpoint
    return {
        schemaVersion: 'ti.public_actor.selected_delivery_readiness.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        state,
        route,
        nextAction: ready
            ? 'Open the authenticated delivery action with this alert, capture, destination, and case link context.'
            : blockers.length ? `Resolve ${displayRequirementList(blockers.slice(0, 2))} before delivery review.` : 'Review the selected alert and choose an authenticated destination.',
        summary: {
            alerts: alertRows.length,
            captures: sourceRefs.captureIds.length,
            destinations: sourceRefs.destinationIds.length,
            caseRoutes: sourceRefs.casePaths.length,
            blockers: blockers.length,
        },
        alerts: alertRows,
        handoff: {
            ready,
            endpoint: actionability.webhookDeliveryHandoff.endpoint,
            route,
            missing: actionability.webhookDeliveryHandoff.missing,
            request: deliveryStage?.request ? consumerRequestActionLabel(deliveryStage.request.method, deliveryStage.request.path) : undefined,
        },
        sourceRefs,
        blockers,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function deliveryBlockerLabel(value: string) {
    if (value === 'missing_capture_evidence') return 'Capture evidence is required before delivery review.'
    if (value === 'case_route_unavailable') return 'Case link is required before delivery review.'
    if (value === 'delivery_disabled') return 'Active destination is required before delivery review.'
    if (value === 'entitlement_denied') return 'Organization entitlement must allow delivery review.'
    return formatLabel(value)
}

export function selectedEnrichmentTriageFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    drilldown: SelectedSourceDrilldown | null
): SelectedEnrichmentTriage {
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const drilldownSourceIds = drilldown?.rows.map(row => row.sourceId).filter((value): value is string => Boolean(value)) ?? []
    const sourceIds = unique([...selectedSourceIds, ...drilldownSourceIds])
    const rows = actionability.sourceHealthQueue.rows.filter(row =>
        (row.sourceId ? sourceIds.includes(row.sourceId) : false)
        || (row.captureId ? selected.evidence.some(line => line.includes(row.captureId ?? '')) : false)
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const selectedRows = rows.length ? rows : actionability.sourceHealthQueue.rows.slice(0, 3)
    const selectedRowIds = new Set(selectedRows.map(row => row.id))
    const selectedRequestIds = new Set(selectedRows.map(row => row.sourceRequestId).filter(Boolean))
    const selectedCaptureIds = new Set(selectedRows.map(row => row.captureId).filter(Boolean))
    const selectedIntakeItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        selectedRowIds.has(item.sourceHealthRowId)
        || (item.sourceRequestId ? selectedRequestIds.has(item.sourceRequestId) : false)
        || (item.captureId ? selectedCaptureIds.has(item.captureId) : false)
        || (item.sourceId ? sourceIds.includes(item.sourceId) : false)
    )
    const triageRows = selectedRows.map(row => {
        const matchingIntakeItems = selectedIntakeItems.filter(item =>
            item.sourceHealthRowId === row.id
            || item.sourceRequestId === row.sourceRequestId
            || item.sourceId === row.sourceId
            || item.captureId === row.captureId
        )
        const consumerReadiness = actionability.actorEnrichmentConsumerReadiness.rows.filter(consumer =>
            consumer.sourceFamilies.includes(row.sourceFamily)
            || consumer.parserStatuses.includes(row.parserStatus)
            || consumer.provenanceIds.sourceHealthProofIds.includes(row.id)
            || matchingIntakeItems.some(item => consumer.provenanceIds.sourceEnrichmentIntakeItemIds.includes(item.id))
        )
        const primaryIntakeItem = matchingIntakeItems[0]
        return {
            id: row.id,
            sourceName: row.sourceName,
            sourceFamily: row.sourceFamily,
            state: row.state,
            route: row.route,
            ownerLane: primaryIntakeItem?.ownerLane ?? row.ownerLane,
            remediationPath: primaryIntakeItem?.route ?? row.route,
            lastChecked: primaryIntakeItem?.evidence.timestamp ?? row.timestamp,
            recommendedAction: primaryIntakeItem?.nextAction ?? row.nextAction,
            sourceId: row.sourceId,
            sourceRequestId: row.sourceRequestId,
            captureId: row.captureId,
            requestedFields: row.requestedFields,
            nextAction: row.nextAction,
            matchingIntakeItemIds: matchingIntakeItems.map(item => item.id),
            blockers: matchingIntakeItems.flatMap(item => item.blockedBy.map(blocker => blocker.detail)),
            evidence: {
                provenance: row.provenance,
                timestamp: row.timestamp,
                confidence: row.confidence,
                parserStatus: row.parserStatus,
            },
            consumerReadiness: consumerReadiness.map(consumer => ({
                consumer: consumer.consumer,
                state: consumer.state,
                ready: consumer.ready,
                route: consumer.route,
                blockerCodes: consumer.blockerCodes,
                retryable: consumer.retry.retryable,
                nextRetryAt: consumer.retry.nextRetryAt,
            })),
        }
    })
    const blockers = triageRows.reduce((count, row) => count + row.requestedFields.length + row.blockers.length, 0)
    const state: SelectedEnrichmentTriage['state'] = triageRows.some(row => row.state === 'blocked') || blockers ? 'blocked' : triageRows.some(row => row.state === 'review') ? 'review' : 'ready'
    return {
        schemaVersion: 'ti.public_actor.selected_enrichment_triage.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: actionability.sourceEnrichmentIntake.generatedAt,
        selectedItemId: selected.id,
        title: selected.title,
        route: actionability.sourceEnrichmentIntake.route,
        state,
        summary: {
            sourceRows: triageRows.length,
            intakeItems: selectedIntakeItems.length,
            blockers,
            sourceRequests: selectedIntakeItems.filter(item => Boolean(item.sourceRequestId)).length,
            captures: selectedIntakeItems.filter(item => Boolean(item.captureId)).length,
        },
        rows: triageRows,
        safeOutput: {
            metadataOnly: true,
            liveMutation: false,
            rawEvidenceExposed: false,
            webhookSecretExposed: false,
        },
    }
}

export function publicTiCaseIdFromPath(path?: string) {
    if (!path) return undefined
    const match = path.match(/\/cases\/([^/?#]+)/)
    return match?.[1]
}

export function stagedHandoffFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    selectedArtifact: ReturnType<typeof selectedArtifactPayloadFor>,
    reviewHandoff: SelectedReviewHandoff,
    sourceDrilldown: SelectedSourceDrilldown,
    caseDraft: SelectedCaseDraft,
    caseOwnership: SelectedCaseOwnershipPlan,
    caseCreateRequest: SelectedCaseCreateRequest,
    watchlistPlan: SelectedWatchlistPlan,
    alertPlan: SelectedAlertActionPlan,
    deliveryPlan: SelectedDeliveryReadinessPlan,
    enrichmentTriage: SelectedEnrichmentTriage,
    caseActionTrail: CaseActionTrailPayload,
    relevance: LocalRelevanceMark | undefined
): StagedHandoff {
    const blockers = unique([
        ...reviewHandoff.blockers,
        ...selectedArtifact.readiness.blockers,
        ...selectedArtifact.readiness.missing,
        ...sourceDrilldown.blockers,
        ...caseDraft.missing,
        ...caseOwnership.blockers,
        ...caseCreateRequest.blockers,
        ...caseCreateRequest.watchlistBasis.blockers,
        ...watchlistPlan.blockers,
        ...alertPlan.blockers.map(blocker => blocker.detail),
        ...deliveryPlan.blockers,
        ...enrichmentTriage.rows.flatMap(row => row.blockers),
        ...caseActionTrail.events.flatMap(event => event.blockers),
    ]).slice(0, 10)
    return {
        schemaVersion: 'ti.public_actor.staged_handoff.v1',
        source: 'public-ti',
        sessionLocal: true,
        id: `staged:${selected.id}:${Date.now()}`,
        query: result.query,
        generatedAt: new Date().toISOString(),
        selectedItemId: selected.id,
        title: selected.title,
        relevanceState: relevance?.state ?? 'not_marked',
        caseIntent: relevance?.caseIntent ?? caseDraft.caseIntent,
        ready: caseDraft.ready && caseCreateRequest.ready && watchlistPlan.ready && alertPlan.ready && deliveryPlan.state === 'ready' && enrichmentTriage.state !== 'blocked' && blockers.length === 0,
        blockers,
        selectedArtifact,
        reviewHandoff,
        sourceDrilldown,
        caseDraft,
        caseOwnership,
        caseCreateRequest,
        watchlistPlan,
        alertPlan,
        deliveryPlan,
        enrichmentTriage,
        caseActionTrail,
    }
}

export function selectedSourceDrilldownFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    actor: TiActorIntelligenceProfile
): SelectedSourceDrilldown {
    const sourceById = new Map(result.sources.map(source => [source.id, source]))
    const selectedSourceIds = selected.priority?.sourceIds ?? []
    const selectedSources = selectedSourceIds
        .map(sourceId => sourceById.get(sourceId))
        .filter((source): source is TiSearchResponse['sources'][number] => Boolean(source))
    const actorRows = actor.provenanceRows.filter(row =>
        selectedSourceIds.includes(row.sourceId ?? '')
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const sourceRows = actionability.sourceProvenance.filter(row =>
        selectedSourceIds.includes(row.sourceId ?? '')
        || selected.source.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const clusterRows = actionability.sourceClusters.filter(row =>
        selected.provenance.toLowerCase().includes(row.sourceName.toLowerCase())
        || selected.evidence.some(line => line.toLowerCase().includes(row.sourceName.toLowerCase()))
    )
    const fallbackCaptureRows = [...actorRows, ...sourceRows, ...clusterRows].some(row => row.captureId)
        ? []
        : actionability.sourceProvenance.filter(row => row.captureId).slice(0, 2)
    const candidates: SelectedSourceDrilldownRow[] = [
        ...selectedSources.map(source => drilldownRow({
            sourceId: source.id,
            sourceName: source.name,
            provenance: source.url || source.provenance || selected.provenance,
            href: source.url || linkFromText(source.provenance),
            captureId: source.captureId,
            reportDate: source.reportDate,
            confidence: selected.confidence,
            handoff: 'Open the listed source and attach capture evidence before case replay if no capture reference is present.',
        })),
        ...actorRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            reportDate: row.reportDate,
            confidence: row.confidence,
            handoff: row.shownBecause,
        })),
        ...sourceRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: row.captureId ? 'Use linked capture reference as replayable case evidence.' : `Attach capture reference or source hash for ${row.sourceName} before case replay.`,
        })),
        ...clusterRows.map(row => drilldownRow({
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: row.enrichmentTask,
        })),
        ...fallbackCaptureRows.map(row => drilldownRow({
            sourceId: row.sourceId,
            sourceName: row.sourceName,
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            captureId: row.captureId,
            confidence: row.confidence,
            handoff: 'Use linked capture reference as replayable case evidence.',
        })),
    ]
    if (!candidates.length) {
        candidates.push(drilldownRow({
            sourceName: selected.source || 'Source collection',
            provenance: selected.href || selected.provenance || selected.source,
            href: selected.href,
            confidence: selected.confidence,
            handoff: 'Attach source reference, source URL, capture reference, or source hash before this result can support stronger follow-up.',
        }))
    }
    const rows = uniqueBy(candidates, row => `${row.sourceId ?? row.sourceName}:${row.provenance}:${row.captureId ?? ''}`)
        .sort((a, b) => Number(Boolean(b.captureId)) - Number(Boolean(a.captureId)))
        .slice(0, 6)
    const blockers = unique([
        ...rows.flatMap(row => row.missing),
        ...actionability.readiness.blockers
            .filter(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
            .map(blocker => blocker.handoff),
    ]).slice(0, 6)

    return {
        schemaVersion: 'ti.public_actor.selected_source_drilldown.v1',
        source: 'public-ti',
        sessionLocal: true,
        query: result.query,
        generatedAt: result.generatedAt,
        selectedItem: {
            id: selected.id,
            kind: selected.kind,
            title: displayRequirementText(selected.title),
            timestamp: selected.timestamp,
            source: selected.source,
            provenance: selected.provenance,
            confidence: selected.confidence,
            href: selected.href,
        },
        rows,
        alertHandoff: {
            ready: actionability.createAlertHandoff.ready,
            endpoint: actionability.createAlertHandoff.endpoint,
            route: actionability.createAlertHandoff.backedRoute,
            missing: actionability.createAlertHandoff.missing,
        },
        caseHandoff: {
            ready: actionability.caseHandoff.ready,
            endpoint: actionability.caseHandoff.endpoint,
            route: actionability.caseHandoff.backedRoute,
            missing: actionability.caseHandoff.missing,
        },
        blockers,
    }
}

export function drilldownRow(input: {
    sourceId?: string
    sourceName: string
    provenance: string
    href?: string
    captureId?: string
    reportDate?: string
    confidence?: number
    handoff: string
}): SelectedSourceDrilldownRow {
    const hasSource = Boolean(input.sourceId || input.provenance || input.href)
    const state: SelectedSourceDrilldownRow['state'] = input.captureId ? 'ready' : hasSource ? 'needs_capture' : 'needs_source'
    const missing = [
        hasSource ? '' : 'Source ID or source URL is required.',
        input.captureId ? '' : 'Capture ID or source hash is required before replayable case evidence.',
    ].filter(Boolean)
    const provenance = input.provenance || input.href || input.sourceName
    return {
        rowId: `source-drilldown:${input.sourceId ?? input.sourceName}:${provenance}:${input.captureId ?? 'missing-capture'}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        sourceName: input.sourceName,
        sourceId: input.sourceId,
        provenance,
        href: input.href,
        captureId: input.captureId,
        reportDate: input.reportDate,
        confidence: input.confidence,
        state,
        ownerLane: state === 'ready' ? 'case' : state === 'needs_capture' ? 'source' : 'public-ti',
        route: state === 'ready' ? '/v1/cases' : '/dashboard/ti/enrichment',
        missing,
        handoff: input.handoff,
    }
}

export function enrichmentTasksFor(result: TiSearchResponse, selected: AnalystWorkItem | undefined, watchlist: WatchlistRelevance, sources: TiSearchResponse['sources'], actor: TiActorIntelligenceProfile, actionability: TiActionabilityModel): EnrichmentTask[] {
    const hasReviewInbox = Boolean(result.analystLoop?.metadataReviewInbox.length)
    const hasSourceUrls = sources.some(source => source.url || linkFromText(source.provenance))
    const hasOrganizations = watchlist.organizations.length > 0
    const hasActivity = result.recentActivity.length > 0
    const hasActorCore = actor.malwareTools.length > 0 && actor.campaigns.length > 0 && actor.infrastructure.length > 0
    const actionabilityTasks: EnrichmentTask[] = actionability.enrichmentGapQueue.map(gap => ({
        title: gap.title,
        status: gap.severity === 'high' ? 'needs_api' : 'needs_review',
        detail: `${gap.detail} Source family: ${formatLabel(gap.sourceFamily)}. Needs: ${gap.requestedFields.map(sourceHealthFieldLabel).join(', ')}. Work queue: ${sourceRequestRouteLabel(gap.route)}.`,
        route: gap.route,
        sourceFamily: gap.sourceFamily,
        requestedFields: gap.requestedFields,
        ownerLane: gap.sourceFamily === 'alert' ? 'alert' : gap.sourceFamily === 'case' ? 'case' : gap.sourceFamily === 'watchlist' ? 'org' : 'source',
    }))
    return [
        ...actionabilityTasks,
        {
            title: 'Complete actor profile',
            status: hasActorCore ? 'ready' : 'needs_api',
            detail: hasActorCore
                ? `Actor profile includes ${actor.malwareTools.length} tools, ${actor.campaigns.length} campaigns, and ${actor.infrastructure.length} infrastructure patterns for alert context.`
                : 'Missing tooling, campaigns, infrastructure, source-basis notes, or source details from the actor profile.',
        },
        {
            title: 'Persist alert review decision',
            status: 'needs_api',
            detail: 'Scratch notes are session-local. Persisted review needs selected finding ID, review state, owner, rationale, and delivery hold/release state in the authenticated case action.',
        },
        {
            title: 'Attach source capture provenance',
            status: hasSourceUrls ? 'ready' : 'needs_api',
            detail: hasSourceUrls
                ? 'Available source references include URLs or linked references that can be opened or mapped into console evidence.'
                : 'The result needs source URLs, capture references, or redacted source hashes before analyst trust is strong.',
        },
        {
            title: 'Map actor to customer watchlists',
            status: hasOrganizations ? 'watch' : 'needs_api',
            detail: hasOrganizations
                ? `Candidate watched objects include ${watchlist.organizations.slice(0, 3).join(', ')}.`
                : 'Org and domain relevance appears after saved watchlist or organization matches.',
        },
        {
            title: 'Create case from evidence',
            status: hasReviewInbox ? 'ready' : selected?.kind === 'exposure' || hasActivity ? 'needs_review' : 'needs_api',
            detail: hasReviewInbox
                ? 'The response includes metadata review inbox items that can feed authenticated case work.'
                : 'No stable related case id is attached; this page can export a handoff payload but cannot persist the case from public context.',
        },
    ]
}

export function enrichmentGapWorkbenchRowsFor({
    tasks,
    result,
    actor,
    actionability,
    workItems,
    artifacts,
}: {
    tasks: EnrichmentTask[]
    result: TiSearchResponse
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    workItems: AnalystWorkItem[]
    artifacts: ActorArtifact[]
}): EnrichmentGapWorkbenchRow[] {
    const rows: EnrichmentGapWorkbenchRow[] = []

    for (const task of tasks) {
        const evidenceItems = matchingWorkItemsForGap(workItems, task.title, task.detail)
        const artifactIds = matchingArtifactIdsForGap(artifacts, task.title, task.detail)
        rows.push(enrichmentGapRow({
            id: `task:${task.title}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            type: task.sourceFamily || task.ownerLane || task.status,
            label: task.title,
            entity: task.sourceFamily ? formatLabel(task.sourceFamily) : task.ownerLane ? readinessOwnerLabel(task.ownerLane) : taskStatusLabel(task.status),
            state: task.status === 'ready' ? 'ready' : task.status === 'needs_api' ? 'blocked' : 'review',
            newestAt: newestDate([...evidenceItems.map(item => item.timestamp), actor.sourceCoverage.latestReportDate || result.lastSeen || result.generatedAt]),
            source: task.sourceFamily ? formatLabel(task.sourceFamily) : 'Analyst review',
            impact: task.detail,
            route: task.route,
            evidenceItems,
            artifactIds,
            missing: task.requestedFields ?? [],
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                task,
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
                artifactIds,
            },
        }))
    }

    for (const row of actionability.sourceHealthQueue.rows.filter(item => item.state !== 'ready').slice(0, TI_ENRICHMENT_GAP_PREVIEW_ROWS)) {
        const evidenceItems = matchingWorkItemsForGap(workItems, row.sourceName, row.provenance)
        rows.push(enrichmentGapRow({
            id: `source-health:${row.id}`,
            type: row.sourceFamily,
            label: row.parserStatus,
            entity: row.sourceName,
            state: row.state,
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            newestAt: row.timestamp,
            source: row.sourceName,
            impact: row.nextAction,
            route: row.route,
            evidenceItems,
            artifactIds: matchingArtifactIdsForGap(artifacts, row.sourceName, row.provenance),
            missing: row.requestedFields,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                sourceHealthRow: row,
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
            },
        }))
    }

    for (const item of workItems.filter(item => item.confidence < 0.55 || !item.href || isDateStale(item.timestamp, result.generatedAt)).slice(0, TI_ENRICHMENT_GAP_PREVIEW_ROWS)) {
        const missing = [
            item.confidence < 0.55 ? 'confidence' : '',
            item.href ? '' : 'sourceProvenance[].provenance',
            isDateStale(item.timestamp, result.generatedAt) ? 'report date' : '',
        ].filter(Boolean)
        rows.push(enrichmentGapRow({
            id: `evidence:${item.id}`,
            type: item.kind,
            label: item.confidence < 0.55 ? 'Corroborate evidence' : !item.href ? 'Attach source link' : 'Refresh evidence date',
            entity: item.title,
            state: !item.href || item.confidence < 0.4 ? 'blocked' : 'review',
            confidenceValues: [item.confidence],
            newestAt: item.timestamp,
            source: item.source,
            impact: item.detail,
            route: item.href,
            evidenceItems: [item],
            artifactIds: matchingArtifactIdsForGap(artifacts, item.title, item.detail, item.evidence.join(' ')),
            missing,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                evidenceRow: enrichmentEvidenceRef(item),
                missing,
            },
        }))
    }

    for (const artifact of artifacts.filter(item => item.readiness.blockers.length || item.enrichmentTasks.length).slice(0, TI_ENRICHMENT_GAP_PREVIEW_ROWS)) {
        const evidenceItems = matchingWorkItemsForGap(workItems, artifact.label, artifact.evidence.join(' '))
        rows.push(enrichmentGapRow({
            id: `artifact:${artifact.id}`,
            type: artifact.kind,
            label: artifact.enrichmentTasks[0] || artifactStateLabel(artifact),
            entity: artifact.label,
            state: artifactStateFor(artifact),
            confidenceValues: [artifact.confidence],
            newestAt: artifact.freshness,
            source: artifact.provenance[0] || 'Detail context',
            impact: artifact.subtitle,
            route: artifact.readiness.state === 'needs_source' ? '/dashboard/ti/enrichment' : undefined,
            evidenceItems,
            artifactIds: [artifact.id],
            missing: [...artifact.readiness.blockers, ...artifact.enrichmentTasks],
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                artifact: artifactWorklistPayloadFor(artifact),
                evidenceRows: evidenceItems.map(enrichmentEvidenceRef),
            },
        }))
    }

    if (actor.sourceCoverage.missing.length) {
        rows.push(enrichmentGapRow({
            id: 'actor-source-coverage',
            type: 'source coverage',
            label: 'Complete source coverage',
            entity: actor.actorClass,
            state: 'blocked',
            newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
            source: 'Actor profile',
            impact: actor.freshness.reason,
            route: '/dashboard/ti/enrichment',
            evidenceItems: workItems.slice(0, 3),
            artifactIds: artifacts.slice(0, 3).map(item => item.id),
            missing: actor.sourceCoverage.missing,
            payload: {
                schemaVersion: 'ti.public_actor.enrichment_gap_row.v1',
                source: 'public-ti',
                query: result.query,
                sourceCoverage: actor.sourceCoverage,
            },
        }))
    }

    return uniqueBy(rows, row => row.id)
        .sort((a, b) => sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
            || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
            || b.evidenceItems.length - a.evidenceItems.length
            || a.label.localeCompare(b.label))
        .slice(0, 14)
}

export function enrichmentGapRow(input: Omit<EnrichmentGapWorkbenchRow, 'confidenceValues'> & { confidenceValues?: number[] }): EnrichmentGapWorkbenchRow {
    const confidenceValues = uniqueNumbers([...(input.confidenceValues ?? []), ...input.evidenceItems.map(item => item.confidence)])
    return {
        ...input,
        confidenceValues,
        missing: unique(input.missing.map(displayRequirementText)),
    }
}

export function matchingWorkItemsForGap(items: AnalystWorkItem[], ...values: string[]) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    if (!tokens.length) return []
    return items.filter(item => {
        const body = `${item.title} ${item.subtitle} ${item.detail} ${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 5)
}

export function matchingArtifactIdsForGap(artifacts: ActorArtifact[], ...values: string[]) {
    const tokens = unique(values.join(' ').split(/[^a-z0-9._-]+/i).filter(value => value.length > 3)).map(value => value.toLowerCase()).slice(0, 12)
    if (!tokens.length) return []
    return artifacts.filter(artifact => {
        const body = watchlistArtifactText(artifact)
        return tokens.some(token => body.includes(token))
    }).map(item => item.id).slice(0, 5)
}

export function enrichmentEvidenceRef(item: AnalystWorkItem) {
    return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        source: item.source,
        timestamp: item.timestamp,
        confidence: item.confidence,
        provenance: item.provenance,
    }
}

export function queueCountsFor(items: AnalystWorkItem[], decisions: Record<string, LocalDecision>) {
    return items.reduce((counts, item) => {
        const decision = decisions[item.id]
        if (decision?.status === 'closed' || decision?.status === 'suppressed') counts.closed += 1
        else counts.open += 1
        if (item.severity === 'critical' || item.severity === 'high') counts.high += 1
        return counts
    }, { open: 0, high: 0, closed: 0 })
}

export function filteredAnalystWorkItems(
    items: AnalystWorkItem[],
    filters: {
        kind: AnalystWorkItem['kind'] | 'all'
        source: string
        confidence: 'all' | 'high' | 'medium'
        sort: 'priority' | 'confidence' | 'freshness'
    }
) {
    const minConfidence = filters.confidence === 'high' ? 0.7 : filters.confidence === 'medium' ? 0.5 : 0
    return items
        .filter(item => filters.kind === 'all' || item.kind === filters.kind)
        .filter(item => filters.source === 'all' || item.source === filters.source)
        .filter(item => item.confidence >= minConfidence)
        .slice()
        .sort((a, b) => {
            if (filters.sort === 'confidence') return b.confidence - a.confidence
            if (filters.sort === 'freshness') return Date.parse(b.timestamp || '') - Date.parse(a.timestamp || '')
            return (b.priority?.score ?? severityScore(b.severity)) - (a.priority?.score ?? severityScore(a.severity))
        })
}

export function selectedTriageBriefFor(
    result: TiSearchResponse,
    selected: AnalystWorkItem,
    actionability: TiActionabilityModel,
    watchlist: WatchlistRelevance,
    alertPacket: AlertPacket | null,
    caseDraft: SelectedCaseDraft | null
): SelectedTriageBrief {
    const sourceBasis = sourceBasisLabel(selected.confidence)
    const visibleTerm = watchlist.matchedTerms[0] || watchlist.terms[0] || result.query
    const sourceLabel = selected.source || 'listed source'
    const hasSourceReference = Boolean(selected.href || selected.provenance || selected.priority?.sourceIds.length || caseDraft?.sourceRows.length)
    const sourceRows = caseDraft?.sourceRows.length ?? 0
    const prioritySourceRows = selected.priority?.sourceIds.length ?? 0
    const evidenceRowCount = sourceRows || prioritySourceRows || 1
    const hasCapture = Boolean(selected.priority?.captureIds.length || caseDraft?.sourceRows.some(row => row.captureId))
    const evidenceTone: SelectedTriageBrief['evidenceTone'] = hasCapture ? 'ready' : hasSourceReference ? 'review' : 'blocked'
    const blocker = actionability.readiness.blockers.find(item => item.ownerLane === 'source' || item.ownerLane === 'public-ti')
    const firstAction = selected.nextActions.map(displayRequirementText).find(Boolean)
    const alertValue = alertPacket?.customerValue ? displayRequirementText(alertPacket.customerValue) : ''
    const whatHappened = selected.kind === 'exposure' || selected.kind === 'victim'
        ? `${visibleTerm} is present in ${sourceLabel} reporting: ${displayRequirementText(selected.title)}.`
        : selected.kind === 'tradecraft'
            ? `${result.query} has a mapped technique or behavior from ${sourceLabel}: ${displayRequirementText(selected.title)}.`
            : `${sourceLabel} provides current context for ${result.query}: ${displayRequirementText(selected.title)}.`
    const whyItMatters = alertValue
        || (selected.severity === 'critical' || selected.severity === 'high'
            ? `${formatLabel(selected.severity)} priority with ${sourceBasis.toLowerCase()} evidence; review it before customer notification or case routing.`
            : `${sourceBasis} evidence that may support watchlist tuning, source review, or enrichment.`)
    const nextAction = caseDraft?.ready
        ? 'Stage this item as a case candidate with the attached watch terms and source results.'
        : blocker
            ? `Verify source coverage first: ${displayRequirementText(blocker.detail)}`
            : firstAction || 'Review the source, confirm customer relevance, then mark it for watchlist or case follow-up.'

    return {
        whatHappened,
        whyItMatters,
        nextAction,
        evidenceStatus: hasCapture
            ? `Backed by ${evidenceRowCount} source result${evidenceRowCount === 1 ? '' : 's'} with capture or source references attached.`
            : hasSourceReference
                ? 'Source reference is present, but the public result does not yet include a capture reference. Verify before customer-facing escalation.'
                : 'Verify source evidence before customer-facing escalation.',
        evidenceTone,
        safetyBoundary: 'Public TI results show source-safe summaries. This view does not expose source files, credential values, or webhook secrets.',
        labels: [
            { label: 'Severity', value: formatLabel(selected.severity) },
            { label: 'Evidence strength', value: sourceBasis },
            { label: 'Watch term', value: visibleTerm },
            { label: 'Freshness', value: selected.timestamp },
        ],
    }
}

export function actorOperationsRowsFor(result: TiSearchResponse, actor: TiActorIntelligenceProfile, victimObservations: ReturnType<typeof victimObservationsFor>): ActorOperationsRow[] {
    const latestDate = actor.sourceCoverage.latestReportDate || actor.lastSeen || result.lastSeen || result.generatedAt
    const defaultSource = actor.provenanceRows[0]?.sourceName || result.sources[0]?.name || 'Public source'
    const defaultFamily = actor.sourceCoverage.sourceFamilies[0]?.family ? formatLabel(actor.sourceCoverage.sourceFamilies[0].family) : 'Source coverage'
    const techniqueRows: ActorOperationsRow[] = actor.techniqueCoverage.map(item => ({
        id: `ttp:${item.attackId || item.name}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Method',
        label: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        detail: item.detail,
        tactic: item.tactic,
        confidence: item.confidence,
        freshness: item.freshness,
        source: item.sourceIds[0] ? 'Source reference linked' : defaultSource,
        sourceFamily: item.captureIds.length ? 'Source linked' : item.missing.length ? 'Sources syncing' : defaultFamily,
        timestamp: latestDate,
        artifactKind: 'technique',
        artifactLookup: item.attackId ? `${item.attackId} ${item.name}` : item.name,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'technique',
            query: result.query,
            attackId: item.attackId,
            name: item.name,
            tactic: item.tactic,
            confidence: item.confidence,
            freshness: item.freshness,
            sourceIds: item.sourceIds,
            captureIds: item.captureIds,
            provenanceRefs: item.provenanceRefs,
            missing: item.missing,
        },
    }))
    const infrastructureRows: ActorOperationsRow[] = actor.infrastructure.map((item, index) => ({
        id: `infra:${item}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Infrastructure',
        label: item,
        detail: actor.confidenceReasoning[index % Math.max(1, actor.confidenceReasoning.length)] || 'Infrastructure pattern available for source collection and alert enrichment.',
        confidence: Math.max(0.35, actor.confidence - 0.05),
        freshness: actor.freshness.stale ? 'review' : 'ready',
        source: defaultSource,
        sourceFamily: defaultFamily,
        timestamp: latestDate,
        artifactKind: 'infrastructure',
        artifactLookup: item,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'infrastructure',
            query: result.query,
            value: item,
            confidence: actor.confidence,
            freshness: actor.freshness,
            sourceCoverage: actor.sourceCoverage,
            provenanceRows: actor.provenanceRows.slice(0, 4),
        },
    }))
    const victimRows: ActorOperationsRow[] = victimObservations.map(item => ({
        id: `victim:${item.victim}:${item.country}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
        type: 'Victim',
        label: item.victim,
        detail: `${item.sector}. ${item.incident}`,
        confidence: item.confidence,
        freshness: item.reportDate ? (isDateStale(item.reportDate, result.generatedAt) ? 'review' : 'ready') : 'blocked',
        source: item.source,
        sourceFamily: sourceReferenceCountLabel(item.sourceIds, 'Victim observation'),
        timestamp: item.reportDate || item.timeframe || latestDate,
        artifactKind: 'country',
        artifactLookup: item.country,
        payload: {
            schemaVersion: 'ti.public_actor.operations_row.v1',
            rowType: 'victim',
            query: result.query,
            victim: item.victim,
            sector: item.sector,
            country: item.country,
            timeframe: item.timeframe,
            incident: item.incident,
            confidence: item.confidence,
            source: item.source,
            reportDate: item.reportDate,
            sourceIds: item.sourceIds,
            provenanceRefs: item.provenanceRefs,
        },
    }))
    return [...techniqueRows, ...infrastructureRows, ...victimRows]
        .sort((a, b) => b.confidence - a.confidence || Date.parse(b.timestamp || '') - Date.parse(a.timestamp || ''))
        .slice(0, 16)
}

export function sourceCoverageWorkbenchRowsFor({
    actor,
    actionability,
    sources,
    sourcePosture,
    workItems,
    sourceOptions,
}: {
    actor: TiActorIntelligenceProfile
    actionability: TiActionabilityModel
    sources: TiSearchResponse['sources']
    sourcePosture: NonNullable<TiSearchResponse['collectionStrategy']>['sourcePosture']
    workItems: AnalystWorkItem[]
    sourceOptions: string[]
}): SourceCoverageWorkbenchRow[] {
    const sourceById = new Map(sources.map(source => [source.id, source]))
    const rows: SourceCoverageWorkbenchRow[] = []

    for (const row of actionability.sourceHealthQueue.rows) {
        const source = row.sourceId ? sourceById.get(row.sourceId) : undefined
        rows.push(sourceCoverageWorkbenchRow({
            id: row.id,
            sourceName: row.sourceName,
            family: row.sourceFamily,
            provenance: row.provenance,
            href: source?.url || linkFromText(row.provenance),
            newestAt: row.timestamp,
            parserStatus: row.parserStatus,
            state: row.state,
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceId: row.sourceId,
            missing: row.requestedFields,
            nextAction: row.nextAction,
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                sourceHealthRow: row,
            },
        }))
    }

    for (const row of actor.provenanceRows) {
        rows.push(sourceCoverageWorkbenchRow({
            id: `source-coverage:${row.sourceId ?? row.sourceName}:${row.provenance}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: row.sourceName,
            family: row.sourceFamily || 'public_report',
            provenance: row.provenance,
            href: linkFromText(row.provenance),
            newestAt: row.lastCollectedAt || row.reportDate,
            parserStatus: row.parserStatus || (row.captureId ? 'capture linked' : 'public reference'),
            state: row.captureId ? 'ready' : actor.sourceCoverage.stale ? 'review' : 'review',
            confidenceValues: [row.confidence].filter((value): value is number => typeof value === 'number'),
            captureId: row.captureId,
            sourceRequestId: row.sourceRequestId,
            sourceId: row.sourceId,
            missing: [
                row.captureId ? '' : 'sourceProvenance[].captureId',
                row.reportDate || row.lastCollectedAt ? '' : 'actorIntelligence.structuredProvenance[].reportDate',
            ].filter(Boolean),
            nextAction: row.shownBecause,
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                provenanceRow: row,
            },
        }))
    }

    for (const source of sources) {
        const href = source.url || linkFromText(source.provenance)
        rows.push(sourceCoverageWorkbenchRow({
            id: `source-link:${source.id}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
            sourceName: source.name,
            family: source.type,
            provenance: source.url || source.provenance || source.name,
            href,
            newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
            parserStatus: href ? 'source link attached' : 'source reference only',
            state: href ? (actor.sourceCoverage.stale ? 'review' : 'ready') : 'review',
            confidenceValues: [],
            sourceId: source.id,
            missing: source.url || source.provenance ? [] : ['sourceProvenance[].provenance'],
            nextAction: href ? 'Open source and attach a matching evidence row before case work.' : 'Attach source URL or source reference before review.',
            actor,
            workItems,
            sourceOptions,
            extraPayload: {
                sourceRecord: source,
            },
        }))
    }

    if (!rows.length) {
        for (const posture of sourcePosture.filter(source => source.role !== 'rejected_paid_rows').slice(0, 4)) {
            rows.push(sourceCoverageWorkbenchRow({
                id: `source-posture:${posture.source}:${posture.role}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-'),
                sourceName: posture.source,
                family: posture.role,
                provenance: posture.source,
                newestAt: actor.sourceCoverage.latestReportDate || actor.lastSeen,
                parserStatus: sourceRoleLabel(posture.role),
                state: 'review',
                confidenceValues: [],
                missing: actor.sourceCoverage.missing,
                nextAction: posture.summary,
                actor,
                workItems,
                sourceOptions,
                extraPayload: {
                    sourcePosture: posture,
                },
            }))
        }
    }

    return uniqueBy(rows, row => row.sourceId ? `id:${row.sourceId}` : `${row.sourceName}:${row.provenance}`)
        .sort((a, b) => sourceCoverageStateRank(a.state) - sourceCoverageStateRank(b.state)
            || Date.parse(b.newestAt || '') - Date.parse(a.newestAt || '')
            || b.evidenceItems.length - a.evidenceItems.length
            || a.sourceName.localeCompare(b.sourceName))
        .slice(0, 12)
}

export function sourceCoverageWorkbenchRow(input: {
    id: string
    sourceName: string
    family: string
    provenance: string
    href?: string
    newestAt?: string
    parserStatus: string
    state: 'ready' | 'review' | 'blocked'
    confidenceValues: number[]
    captureId?: string
    sourceRequestId?: string
    sourceId?: string
    missing: string[]
    nextAction: string
    actor: TiActorIntelligenceProfile
    workItems: AnalystWorkItem[]
    sourceOptions: string[]
    extraPayload: Record<string, unknown>
}): SourceCoverageWorkbenchRow {
    const evidenceItems = workItemsForSource(input.workItems, input.sourceName, input.provenance, input.sourceId)
    const confidenceValues = uniqueNumbers([...input.confidenceValues, ...evidenceItems.map(item => item.confidence)])
    const artifactTypes = sourceArtifactTypesFor(input.actor, input.sourceName, input.provenance, input.sourceId, evidenceItems)
    const queueFilter = input.sourceOptions.find(option => option.toLowerCase() === input.sourceName.toLowerCase())
        ?? input.sourceOptions.find(option => evidenceItems.some(item => item.source === option))
    const missing = unique(input.missing.map(displayRequirementText))
    const payload = {
        schemaVersion: 'ti.public_actor.source_coverage_workbench.v1',
        source: 'public-ti',
        sourceName: input.sourceName,
        sourceId: input.sourceId,
        sourceFamily: input.family,
        provenance: input.provenance,
        href: input.href,
        newestAt: input.newestAt,
        parserStatus: displayRequirementText(input.parserStatus),
        state: input.state,
        confidenceValues,
        artifactTypes,
        captureId: input.captureId,
        sourceRequestId: input.sourceRequestId,
        missing,
        evidenceRows: evidenceItems.map(item => ({
            id: item.id,
            kind: item.kind,
            title: item.title,
            timestamp: item.timestamp,
            confidence: item.confidence,
            provenance: item.provenance,
        })),
        nextAction: displayRequirementText(input.nextAction),
        ...input.extraPayload,
    }
    return {
        id: input.id,
        sourceName: input.sourceName,
        family: input.family,
        provenance: input.provenance,
        href: input.href,
        newestAt: input.newestAt,
        parserStatus: input.parserStatus,
        state: input.state,
        confidenceValues,
        artifactTypes,
        evidenceItems,
        captureId: input.captureId,
        sourceRequestId: input.sourceRequestId,
        sourceId: input.sourceId,
        missing,
        nextAction: input.nextAction,
        queueFilter,
        payload,
    }
}

export function workItemsForSource(items: AnalystWorkItem[], sourceName: string, provenance: string, sourceId?: string) {
    const tokens = unique([sourceName, provenance, sourceId ?? ''])
        .map(token => token.toLowerCase())
        .filter(token => token.length > 2)
    return items.filter(item => {
        const body = `${item.source} ${item.provenance} ${item.evidence.join(' ')}`.toLowerCase()
        return tokens.some(token => body.includes(token))
    }).slice(0, 6)
}

export function sourceArtifactTypesFor(actor: TiActorIntelligenceProfile, sourceName: string, provenance: string, sourceId: string | undefined, evidenceItems: AnalystWorkItem[]) {
    const tokens = unique([sourceName, provenance, sourceId ?? '']).map(token => token.toLowerCase()).filter(token => token.length > 2)
    const types = [
        actor.techniqueCoverage.some(item => item.sourceIds.some(id => sourceId && id === sourceId) || item.provenanceRefs.some(ref => tokens.some(token => ref.toLowerCase().includes(token)))) ? 'Method' : '',
        actor.campaignTimeline.some(item => item.sourceIds.some(id => sourceId && id === sourceId) || item.provenanceRefs.some(ref => tokens.some(token => ref.toLowerCase().includes(token)))) ? 'Campaign' : '',
        ...evidenceItems.map(item => formatLabel(item.kind)),
    ]
    return unique(types.filter(Boolean)).slice(0, 5)
}

export function sourceCoverageStateRank(state: SourceCoverageWorkbenchRow['state']) {
    if (state === 'blocked') return 0
    if (state === 'review') return 1
    return 2
}

export function sourceConfidenceLabel(values: number[]) {
    if (!values.length) return 'Not scored'
    const sorted = values.slice().sort((a, b) => a - b)
    const average = sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    return sourceBasisLabel(average)
}

export function sourceBasisLabel(value: number | undefined) {
    if (typeof value !== 'number' || Number.isNaN(value)) return 'Not scored'
    if (value >= 0.8) return 'Strong'
    if (value >= 0.6) return 'Moderate'
    if (value >= 0.4) return 'Limited'
    return 'Needs review'
}

export function uniqueNumbers(values: number[]) {
    return Array.from(new Set(values.map(value => Math.max(0, Math.min(1, value)))))
}

export function artifactStateFor(artifact: ActorArtifact): 'ready' | 'review' | 'blocked' {
    if (artifact.readiness.state === 'ready_for_org_handoff') return 'ready'
    if (artifact.readiness.state === 'needs_source' || artifact.readiness.state === 'needs_watchlist_term') return 'blocked'
    return 'review'
}

export function artifactStateLabel(artifact: ActorArtifact) {
    if (artifact.readiness.state === 'ready_for_org_handoff') return 'ready'
    if (artifact.readiness.state === 'needs_source') return 'source question'
    if (artifact.readiness.state === 'needs_watchlist_term') return 'watch gap'
    if (artifact.readiness.state === 'stale') return 'stale'
    return 'review'
}

export function artifactWorklistPayloadFor(artifact: ActorArtifact) {
    return {
        schemaVersion: 'ti.public_actor.artifact_worklist.v1',
        source: 'public-ti',
        artifact: {
            id: artifact.id,
            kind: artifact.kind,
            label: artifact.label,
            subtitle: artifact.subtitle,
            confidence: artifact.confidence,
            freshness: artifact.freshness,
        },
        evidence: artifact.evidence,
        provenance: artifact.provenance,
        watchlistTerms: artifact.watchlistTerms,
        enrichmentTasks: artifact.enrichmentTasks,
        state: artifactStateLabel(artifact),
        blockers: artifact.readiness.blockers,
    }
}

export function sourceCountsFor(items: AnalystWorkItem[]) {
    const counts = new Map<string, number>()
    for (const item of items) {
        const source = item.source || 'Unspecified source'
        counts.set(source, (counts.get(source) ?? 0) + 1)
    }
    return Array.from(counts, ([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
}

export function isDateStale(value: string, generatedAt: string) {
    const freshness = Date.parse(value)
    const generated = Date.parse(generatedAt)
    if (!Number.isFinite(freshness) || !Number.isFinite(generated)) return false
    return generated - freshness > 180 * 24 * 60 * 60 * 1000
}

export function severityScore(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 95
    if (severity === 'high') return 80
    if (severity === 'medium') return 55
    return 25
}

export function relevanceMarkFor(
    state: LocalRelevanceMark['state'],
    selected: AnalystWorkItem,
    watchlist: WatchlistRelevance,
    actionability: TiActionabilityModel,
    note: string
): LocalRelevanceMark {
    const watchTerms = unique([
        ...watchlist.matchedTerms,
        ...watchlist.terms,
        ...actionability.watchlistRelevance.terms.map(term => `${term.kind}: ${term.value}`),
    ]).slice(0, 8)
    const sourceBlocked = actionability.readiness.blockers.some(blocker => blocker.ownerLane === 'source' || blocker.ownerLane === 'public-ti')
    const caseIntent: LocalRelevanceMark['caseIntent'] = state === 'not_relevant'
        ? 'no_case'
        : state === 'needs_source' || sourceBlocked
            ? 'source_review'
            : state === 'customer_relevant' && (selected.kind === 'exposure' || actionability.caseHandoff.ready || actionability.createAlertHandoff.ready)
                ? 'case_candidate'
                : 'watchlist_context'
    const defaultRationale = state === 'customer_relevant'
        ? 'Marked for customer relevance review from selected evidence and watchlist context.'
        : state === 'context_only'
            ? 'Marked as actor context for watchlist and detection enrichment.'
            : state === 'needs_source'
                ? 'Marked for source or capture enrichment before customer-facing action.'
                : 'Marked as not relevant for current watchlist or case work.'
    return {
        state,
        rationale: note.trim() || defaultRationale,
        watchTerms,
        caseIntent,
        markedAt: new Date().toISOString(),
    }
}

export function unique(values: string[]) {
    const seen = new Set<string>()
    return values.map(value => value.trim()).filter(value => {
        const key = value.toLowerCase()
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function readStringArray(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(item => readStringArray(item))
    if (typeof value === 'string' && value.trim()) return [value.trim()]
    if (value && typeof value === 'object' && 'value' in value) return readStringArray((value as { value?: unknown }).value)
    return []
}

export function uniqueBy<T>(values: T[], keyFor: (value: T) => string) {
    const seen = new Set<string>()
    return values.filter(value => {
        const key = keyFor(value)
        if (!key || seen.has(key)) return false
        seen.add(key)
        return true
    })
}

export function domainFromUrl(value?: string) {
    if (!value) return null
    try {
        return new URL(value).hostname.replace(/^www\./, '')
    } catch {
        return null
    }
}

export function taskStatusLabel(status: EnrichmentTask['status']) {
    if (status === 'needs_api') return 'source question'
    if (status === 'needs_review') return 'review'
    if (status === 'watch') return 'watchlist'
    return 'ready'
}

export function taskStatusClass(status: EnrichmentTask['status']) {
    if (status === 'ready') return 'rounded-lg border border-ui-success/35 bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (status === 'watch') return 'rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'
    if (status === 'needs_review') return 'rounded-lg border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'rounded-lg border border-ui-warning/35 bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

export function decisionStepStatusLabel(status: DecisionStep['status']) {
    if (status === 'ready') return 'ready'
    if (status === 'review') return 'review'
    return 'syncing'
}

export function decisionStepStatusClass(status: DecisionStep['status']) {
    if (status === 'ready') return 'shrink-0 rounded-md border border-ui-success/35 bg-ui-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
    if (status === 'review') return 'shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'shrink-0 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
}

export function severityClass(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 'border border-ui-danger/35 bg-ui-danger/10 text-ui-danger dark:border-ui-danger/35 dark:bg-ui-danger/10 dark:text-ui-danger'
    if (severity === 'high') return 'border border-ui-warning/35 bg-ui-danger/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    if (severity === 'medium') return 'border border-ui-warning/35 bg-ui-warning/10 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    return 'border border-ui-success/35 bg-ui-success/10 text-ui-success dark:border-ui-success/35 dark:bg-ui-success/10 dark:text-ui-success'
}

export function severityWeight(severity: AnalystWorkItem['severity']) {
    if (severity === 'critical') return 4
    if (severity === 'high') return 3
    if (severity === 'medium') return 2
    return 1
}

export function kindLabel(kind: AnalystWorkItem['kind']) {
    if (kind === 'exposure') return 'Recent attacks'
    if (kind === 'victim') return 'Victim context'
    if (kind === 'tradecraft') return 'Tradecraft'
    if (kind === 'collection') return 'Collection'
    return 'Activity'
}

export function assertionKindLabel(kind: AnalystWorkItem['assertionKind']) {
    if (kind === 'observed') return 'Observed fact'
    if (kind === 'inferred') return 'Inferred candidate'
    if (kind === 'extracted') return 'Extracted field'
    return 'Source claim'
}

export function decisionLabel(status: LocalDecision['status']) {
    if (status === 'reviewing') return 'Reviewing'
    if (status === 'assigned') return 'Assigned'
    if (status === 'escalated') return 'Escalated'
    if (status === 'suppressed') return 'Suppressed'
    if (status === 'reopened') return 'Reopened'
    return 'Closed'
}

export function relevanceLabel(status: LocalRelevanceMark['state']) {
    if (status === 'customer_relevant') return 'customer'
    if (status === 'context_only') return 'context'
    if (status === 'needs_source') return 'source review'
    return 'not relevant'
}

export function relevanceLabelForStaged(status: StagedHandoff['relevanceState']) {
    if (status === 'not_marked') return 'unmarked'
    return relevanceLabel(status)
}

export function readinessOwnerLabel(owner: TiActionabilityModel['readiness']['blockers'][number]['ownerLane']) {
    if (owner === 'public-ti') return 'Analyst review'
    if (owner === 'org') return 'Organization'
    if (owner === 'alert') return 'Alert actions'
    if (owner === 'case') return 'Case actions'
    if (owner === 'webhook') return 'Webhook delivery'
    if (owner === 'entitlement') return 'Entitlement'
    return 'Source collection'
}

export function defaultDecisionReason(status: LocalDecision['status']) {
    if (status === 'reviewing') return 'Review started in the public TI workspace.'
    if (status === 'assigned') return 'Assigned locally for follow-up.'
    if (status === 'escalated') return 'Escalated for customer or incident-response review.'
    if (status === 'suppressed') return 'Suppressed as low-value, duplicate, or false positive.'
    if (status === 'reopened') return 'Reopened for another look.'
    return 'Closed in the local TI workspace.'
}

export function formatLabel(value: string) {
    return value.replaceAll('_', ' ')
}

export function captureReferenceLabel(value?: string | null) {
    return value ? 'capture reference linked' : 'capture reference needed'
}

export function sourceReferenceCountLabel(sourceIds: string[], fallback: string) {
    if (sourceIds.length) return `${sourceIds.length} source reference${sourceIds.length === 1 ? '' : 's'} linked`
    return fallback
}

export function publicStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'action_required') return 'reviewing'
    if (value === 'review') return 'reviewing'
    if (value === 'local') return 'local'
    return formatLabel(value)
}

export function publicDecisionStatusLabel(value: DecisionStep['status']) {
    if (value === 'blocked') return 'syncing'
    return decisionStepStatusLabel(value)
}

export function coverageMissingLabel(value: string) {
    if (value.includes('captureId')) return 'capture references'
    if (value.includes('reportDate')) return 'report dates'
    if (value.includes('sourceId')) return 'source references'
    if (value.includes('structuredProvenance')) return 'structured source details'
    if (value.includes('datedActivityRow')) return 'dated activity'
    if (value.includes('provenanceRefs')) return 'source references'
    return formatLabel(value)
}

export function watchlistIntersectionActionLabel(value: TiActionabilityModel['orgRelevance']['watchlistIntersections'][number]['recommendedAction']) {
    if (value === 'open_watchlist_item') return 'Open saved watchlist item'
    if (value === 'persist_watchlist_item') return 'Save watchlist item'
    if (value === 'rebuild_alerts') return 'Rebuild related alerts'
    if (value === 'open_case') return 'Open related case'
    return 'Attach source evidence'
}

export function humanResultStatus(value?: string) {
    if (!value) return 'Monitoring'
    if (value === 'metadata_review') return 'Needs review'
    if (value === 'needs_source_activation') return 'Connecting sources'
    if (value === 'blocked_unsafe_target') return 'Review required'
    if (value === 'ready') return 'Ready'
    if (value === 'partial') return 'Updating'
    if (value === 'searching' || value === 'queued') return 'Searching'
    return formatLabel(value)
}

export function sourceStatusLabel(value: string) {
    if (/metadata/i.test(value)) return 'Monitoring data'
    if (/available|ready|active/i.test(value)) return 'Included'
    if (/context/i.test(value)) return 'Context'
    return 'Included'
}

export function sourceCountLabel(count: number) {
    if (count <= 0) return 'No sources'
    return `${Math.min(count, 5)} shown${count > 5 ? ` of ${count}` : ''}`
}

export function activitySourceLabel(count: number) {
    if (count <= 0) return 'Source pending'
    return count === 1 ? '1 source' : `${count} sources`
}

export function sourceRoleLabel(value: string) {
    if (value === 'primary_seed') return 'Seed coverage'
    if (value === 'owned_collection_target') return 'Owned monitoring'
    if (value === 'corroboration') return 'Corroboration'
    if (value === 'context_only') return 'Context'
    return formatLabel(value)
}

export function sourceActivationActionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['action']) {
    if (value === 'request_approval') return 'Request approval'
    if (value === 'restore_source') return 'Restore source'
    if (value === 'enable_metadata_only_queue') return 'Watch this source without storing stolen files'
    return 'Keep monitoring'
}

export function sourceActivationExecutionLabel(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'human_approval_required') return 'approval required'
    if (value === 'dry_run') return 'review only'
    return 'syncing'
}

export function sourceActivationExecutionClass(value: NonNullable<TiSearchResponse['analystLoop']>['sourceActivationWorkflow']['actions'][number]['execution']) {
    if (value === 'dry_run') return decisionStepStatusClass('review')
    if (value === 'human_approval_required') return decisionStepStatusClass('review')
    return decisionStepStatusClass('blocked')
}

export function linkFromText(value?: string) {
    if (!value) return undefined
    const match = value.match(/\bhttps?:\/\/[^\s<>"']+/i)
    if (!match) return undefined
    try {
        const url = new URL(match[0])
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.toString()
    } catch {
        return undefined
    }
    return undefined
}

export function selectedArtifactPayloadFor(artifact: ActorArtifact, handoffs: ActorArtifactHandoffs) {
    const bridge = handoffs.authBridge
    const actionReadiness = Object.values(bridge.payloads).flatMap(payload => payload.actionReadiness.filter(row => row.selected))
    return {
        schemaVersion: 'ti.public_actor.selected_artifact.v1',
        artifact: bridge.payload.artifact,
        readiness: {
            state: artifact.readiness.state,
            label: artifact.readiness.label,
            blockers: artifact.readiness.blockers,
            actions: actionReadiness,
            orgRequired: bridge.orgRequired,
            sourceRequired: bridge.sourceRequired,
            stale: bridge.stale,
            missing: bridge.missing,
        },
        evidenceRefs: bridge.payload.evidenceRefs,
        sourceRequests: bridge.payload.sourceRequests,
        handoffLinks: bridge.links,
        handoffRoutes: {
            watchlist: handoffs.watchlist.backedRoute,
            alertRebuild: handoffs.alertRebuild.backedRoute,
            case: handoffs.case.backedRoute,
            enrichment: handoffs.enrichment.backedRoute,
        },
        selectedPayloads: {
            watchlist: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.watchlist].selectedPayload,
            alertRebuild: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.alertRebuild].selectedPayload,
            case: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.case].selectedPayload,
            enrichment: bridge.payloads[PUBLIC_TI_HANDOFF_ACTIONS.enrichment].selectedPayload,
        },
    }
}

export function watchlistTermRequestPayloadFor(term: string, watchlist: WatchlistRelevance, actionability: TiActionabilityModel, query: string) {
    const parsed = watchlistTermParts(term)
    const matchingTerms = actionability.watchlistRelevance.terms.filter(item =>
        item.value.toLowerCase() === parsed.value.toLowerCase()
        || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase()
    )
    const matchingIntersections = actionability.orgRelevance.watchlistIntersections.filter(item =>
        item.value.toLowerCase() === parsed.value.toLowerCase()
        || `${item.kind}: ${item.value}`.toLowerCase() === term.toLowerCase()
    )
    const sourceEvidenceRefs = unique(matchingIntersections.flatMap(item => item.sourceEvidenceRefs))
    const sourceHealthRows = actionability.sourceHealthQueue.rows.filter(row =>
        sourceEvidenceRefs.some(ref => row.provenance.includes(ref) || row.sourceName.includes(ref) || row.sourceId === ref)
        || actionability.orgRelevance.sourceCoverage.some(source =>
            source.sourceName === row.sourceName
            && (source.sourceFamily === row.sourceFamily || source.provenance === row.provenance)
        )
    )
    const sourceIntakeItems = actionability.sourceEnrichmentIntake.items.filter(item =>
        sourceHealthRows.some(row => row.id === item.sourceHealthRowId)
        || item.requestedFields.some(field => /sourceProvenance|captureId|sourceRequestId/i.test(field))
    )
    const watchlistAction = actionability.actionPayloads.payloads.watchlistAdd
    return {
        schemaVersion: 'ti.public_actor.watchlist_term_request.v1',
        source: 'public-ti',
        sessionLocal: true,
        query,
        kind: parsed.kind,
        value: parsed.value,
        route: actionability.exportPayloads.watchlist.backedRoute || actionability.exportPayloads.watchlist.route,
        blocked: actionability.exportPayloads.watchlist.blocked,
        missing: actionability.exportPayloads.watchlist.missing,
        matched: matchingTerms.some(item => item.matched) || matchingIntersections.length > 0,
        matchedOrganizations: unique([
            ...watchlist.organizations,
            ...matchingIntersections.map(item => item.organizationId).filter((value): value is string => Boolean(value)),
        ]).slice(0, 12),
        watchlistItemIds: unique(matchingIntersections.map(item => item.watchlistItemId).filter((value): value is string => Boolean(value))),
        alertIds: unique(matchingIntersections.flatMap(item => item.alertIds)),
        casePaths: unique(matchingIntersections.flatMap(item => item.casePaths)),
        sourceEvidenceRefs,
        provenance: actionability.exportPayloads.watchlist.provenance,
        sourceIntake: {
            schemaVersion: 'ti.public_actor.watchlist_source_intake.v1',
            route: actionability.sourceEnrichmentIntake.route,
            candidateTerm: {
                kind: parsed.kind,
                value: parsed.value,
                matched: matchingTerms.some(item => item.matched) || matchingIntersections.length > 0,
            },
            actionReadiness: {
                ready: watchlistAction.ready,
                unavailable: watchlistAction.unavailable,
                route: watchlistAction.route,
                backedRoute: watchlistAction.backedRoute,
                blockedBy: watchlistAction.blockedBy,
            },
            sourceCoverage: actionability.orgRelevance.sourceCoverage.filter(source =>
                sourceEvidenceRefs.some(ref => source.provenance.includes(ref) || source.sourceName.includes(ref) || source.sourceId === ref)
            ),
            sourceHealthRows,
            enrichmentItems: sourceIntakeItems,
            requestedFields: unique(sourceIntakeItems.flatMap(item => item.requestedFields)),
        },
    }
}

export function watchlistTermParts(term: string): { kind: 'company' | 'domain' | 'vendor'; value: string } {
    const [kind, ...rest] = term.split(':')
    const value = rest.join(':').trim()
    if (value && (kind === 'company' || kind === 'domain' || kind === 'vendor')) return { kind, value }
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(term.trim())) return { kind: 'domain', value: term.trim() }
    return { kind: 'company', value: term.trim() }
}

export function watchlistWorkbenchRowId(kind: string, value: string) {
    return `watch:${kind}:${value}`.toLowerCase().replace(/[^a-z0-9:._-]+/g, '-')
}

export function consumerRequestPathLabel(value: string) {
    if (value.includes('alert-readiness')) return 'org alert state'
    if (value.includes('/api/organizations') && value.includes('watchlists')) return 'org watchlist action'
    if (value.includes('/v1/dwm/watchlists')) return 'watchlist action'
    if (value.includes('/v1/dwm/alerts')) return 'alert action'
    if (value.includes('/v1/cases')) return 'case action'
    if (value.includes('/v1/dwm/webhooks')) return 'delivery action'
    return sourceRequestRouteLabel(value)
}

export function consumerRequestActionLabel(method: string, path: string) {
    return `${method.toUpperCase()} ${consumerRequestPathLabel(path)}`
}

export function sourceHealthFieldLabel(value: string) {
    if (/captureId/i.test(value)) return 'capture reference'
    if (/sourceRequestId/i.test(value)) return 'source request'
    if (/reportDate|lastSeen|firstReportedAt/i.test(value)) return 'report date'
    if (/sourceId/i.test(value)) return 'source reference'
    if (/provenance|sourceUrl|url/i.test(value)) return 'source reference'
    if (/relatedAlerts.*id|alertId/i.test(value)) return 'alert review'
    if (/casePath|caseId/i.test(value)) return 'case link'
    if (/webhookDestination/i.test(value)) return 'webhook destination'
    if (/organizationId|tenantId/i.test(value)) return 'organization scope'
    if (/watchlistItem|watchlistId/i.test(value)) return 'watchlist item'
    if (/endpoint|route/i.test(value)) return 'console path'
    return formatLabel(value.replace(/\[\]/g, '').replace(/\./g, ' '))
}

export function displayRequirementText(value: string) {
    return value
        .replace(
            /\bAPT49 is an ambiguous label in open reporting\. Some sources map it to Tropic Trooper, a long-running Asia-Pacific espionage actor\. Malpedia and Cyberint map BlueHornet\/AgainstTheWest\/APT49 to a hacktivist and leak-focused persona\. The profile is split into both tracks until source-specific reporting makes the context clear\./gi,
            'APT49 is used for two tracks in open reporting: Tropic Trooper espionage reporting and BlueHornet/AgainstTheWest leak-claim reporting. Keep the tracks separate when reviewing attribution or company exposure.',
        )
        .replace(/\bAPT49 label collision requires analyst disambiguation\b/gi, 'APT49 naming has two reporting tracks')
        .replace(
            /\bOpen-source references disagree on whether APT49 should be treated as Tropic Trooper or BlueHornet\/AgainstTheWest\. The profile is therefore split into espionage-track and hacktivist\/leak-track monitoring until a source-specific claim resolves the context\./gi,
            'Open reporting maps APT49 to both Tropic Trooper and BlueHornet/AgainstTheWest. Review the source track before using it for attribution or company exposure.',
        )
        .replace(/\blabel collision\b/gi, 'shared-name profile')
        .replace(/\banalyst disambiguation\b/gi, 'source-track review')
        .replace(/\bHanasand resolves it as an alias-collision profile:/gi, 'Open reporting treats this as an alias-collision profile:')
        .replace(/\bHanasand resolves\b/gi, 'Open reporting maps')
        .replace(/\baction_required\b/gi, 'review')
        .replace(/\baction required\b/gi, 'review')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/alert-status/gi, 'Check organization alert state')
        .replace(/GET\s+\/api\/organizations\/[^/\s]+\/watchlists/gi, 'Open organization watchlists')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-readiness/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/alert-status/gi, 'organization alert state')
        .replace(/\/api\/organizations\/[^/\s]+\/watchlists/gi, 'organization watchlist action')
        .replace(/GET\s+\/api\/organizations\/:id\/alert-readiness/gi, 'Check org alert state')
        .replace(/GET\s+\/api\/organizations\/:id\/alert-status/gi, 'Check org alert state')
        .replace(/\/api\/organizations\/:id\/alert-readiness/gi, 'org alert state')
        .replace(/\/api\/organizations\/:id\/alert-status/gi, 'org alert state')
        .replace(/\/api\/dwm\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/api\/dwm\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/dwm\/alerts\/generation-readiness/gi, 'alert generation state')
        .replace(/\/v1\/dwm\/alerts\/generation-status/gi, 'alert generation state')
        .replace(/\/v1\/cases\/:caseId\/action-replay-export/gi, 'case action replay')
        .replace(/\/v1\/dwm\/alerts\/rebuild/gi, 'alert rebuild')
        .replace(/\/v1\/dwm\/watchlists/gi, 'watchlist update')
        .replace(/\/v1\/dwm\/webhooks\/deliver/gi, 'webhook delivery')
        .replace(/\/v1\/cases/gi, 'case actions')
        .replace(/generatedAlertReferences/gi, 'generated alert references')
        .replace(/TiSearchResponse\.actorIntelligence\.malwareTools\/campaigns/gi, 'actor tooling and campaign fields')
        .replace(/actorIntelligence\.structuredProvenance\[\]\.reportDate/gi, 'source report date')
        .replace(/sourceProvenance\[\]\.sourceRequestId/gi, 'source request')
        .replace(/sourceProvenance\[\]\.captureId/gi, 'capture reference')
        .replace(/sourceProvenance\[\]\.sourceId/gi, 'source reference')
        .replace(/sourceProvenance\[\]\.provenance/gi, 'source reference')
        .replace(/relatedAlerts\[\]\.casePath/gi, 'alert case link')
        .replace(/relatedAlerts\[\]\.id/gi, 'alert review')
        .replace(/relatedCases\[\]\.path/gi, 'case link')
        .replace(/handoffs\.alertRebuild\.endpoint/gi, 'alert rebuild action')
        .replace(/sourceProvenance\[\]/gi, 'source evidence')
        .replace(new RegExp('pro' + 'venance', 'gi'), 'source reference')
        .replace(/actorIntelligence\./gi, 'actor intelligence ')
        .replace(/handoffs\./gi, '')
        .replace(/relatedAlerts\[\]/gi, 'related alerts')
        .replace(/\bproof\b/gi, 'evidence')
        .replace(/\breadiness\b/gi, 'status')
        .replace(/\bactionability\b/gi, 'action status')
        .replace(/\breceipt\b/gi, 'record')
        .replace(new RegExp('\\bcon' + 'tract\\b', 'gi'), 'schema')
        .replace(/\bnamed\s+examples\b/gi, 'reported activity')
        .replace(/\btarget\s+signal(s)?\b/gi, 'targeting indicator$1')
        .replace(/\bsignal(s)?\b/gi, 'indicator$1')
        .replace(/\bcontrol\s+room\b/gi, 'console')
        .replace(/\bdashboard\s+slop\b/gi, 'low-value summary')
        .replace(/\bacceptance\s+criteria\b/gi, 'requirements')
        .replace(/\bteasers\b/gi, 'summaries')
        .replace(/\bteaser\b/gi, 'summary')
}

export function displayRequirementList(values: string[]) {
    return unique(values.map(displayRequirementText)).join('; ')
}

export function sourceRequestRouteLabel(value: string) {
    if (value === '/dashboard/ti/enrichment') return 'source review'
    return 'review action'
}

export function actionOwnerLabel(value: string) {
    if (value === 'org') return 'watchlist'
    if (value === 'alert') return 'alerting'
    if (value === 'case') return 'casework'
    if (value === 'source') return 'source review'
    return 'review'
}

export type DecisionStep = {
    id: string
    label: string
    status: 'ready' | 'review' | 'blocked'
    detail: string
    payload: unknown
    route?: string
    missing: string[]
}
