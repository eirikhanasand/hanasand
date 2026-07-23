import config from '@/config'

const cacheTtlMs = 60_000
const memoryCache = new Map<string, { expiresAt: number; result: TiSearchResponse }>()
const browserCachePrefix = 'hanasand:ti-search:'

export interface TiSearchResponse {
    query: string
    queryKind?: 'actor' | 'domain' | 'cve' | 'indicator' | 'organization' | 'free_text'
    generatedAt: string
    mode: 'scraper' | 'seeded' | 'live_search'
    status?: TiResultState
    runId?: string
    refreshAfterSeconds?: number
    summary: string
    confidence: number
    lastSeen?: string
    aliases: string[]
    recentActivity: Array<{
        date: string
        title: string
        detail: string
        confidence: number
        sourceIds: string[]
        url?: string
        claimType?: 'campaign' | 'victim_claim' | 'malware_activity' | 'vulnerability_exploitation' | 'infrastructure_activity' | 'general_activity'
        victimName?: string
        affectedSectors?: string[]
        countries?: string[]
        impact?: string
        firstReportedAt?: string
        lastReportedAt?: string
        publisherCount?: number
        corroboratingSourceIds?: string[]
        contradictingSourceIds?: string[]
        assertionKind?: 'source_claim'
        reviewState?: string
        corroborationState?: string
        observationSummary?: string
    }>
    claims?: TiClaimAssessment[]
    incidents?: TiIncidentAssessment[]
    evidenceAssessment?: TiEvidenceAssessment
    targets: Array<{
        sector: string
        regions: string[]
        rationale: string
        confidence: number
    }>
    ttps: Array<{
        name: string
        attackId?: string
        tactic: string
        detail: string
        confidence: number
        sourceIds?: string[]
        captureIds?: string[]
        reviewState?: string
        extractionMethod?: string
        extractorVersion?: string
    }>
    datasets: Array<{
        name: string
        type: string
        coverage: string
        status: string
        url?: string
    }>
    sources: Array<{
        id: string
        name: string
        type: string
        provenance?: string
        url?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: NonNullable<NonNullable<TiActionabilityContract['sourceProvenance']>[number]['sourceFamily']>
        parserStatus?: NonNullable<NonNullable<TiActionabilityContract['sourceProvenance']>[number]['parserStatus']>
        reportDate?: string
        lastCollectedAt?: string
    }>
    notes: string[]
    operationalStatus?: TiOperationalStatus
    analystLoop?: TiAnalystLoop
    collectionStrategy?: TiCollectionStrategy
    actorIntelligence?: TiActorIntelligenceContract
    actorIdentity?: TiActorIdentityMatch
    actionability?: TiActionabilityContract
}

export interface TiActorIdentityMatch {
    catalogMatched: boolean
    ambiguous: boolean
    activityEvidenceAvailable: boolean
    candidates: TiActorIdentityCandidate[]
}

export interface TiActorIdentityCandidate {
    catalogId: string
    externalId: string
    canonicalName: string
    associatedNames: string[]
    matchKinds: Array<'canonical' | 'associated'>
    status: 'current' | 'deprecated' | 'revoked' | 'retired'
    aptNumberDesignationPresent: boolean
    sourceUrl: string
    catalogVersion: string
    catalogModifiedAt: string
    captureId?: string
}

export interface TiActorIntelligenceContract {
    actorClass?: string
    attribution?: string
    firstSeen?: string
    lastSeen?: string
    motivation?: string[]
    malwareTools?: string[]
    campaigns?: string[]
    infrastructure?: string[]
    indicators?: string[]
    targetSectors?: string[]
    geographies?: string[]
    confidence?: number
    confidenceReasoning?: string[]
    sourceProvenance?: string[]
    missingFields?: string[]
    businessModel?: TiBusinessModelAssessment
    attributionEvidence?: {
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
    }
    structuredProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        reportDate?: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'
        parserStatus?: 'parsed' | 'partial' | 'queued' | 'failed' | 'missing_capture' | 'public_reference'
        lastCollectedAt?: string
        confidence?: number
        shownBecause: string
    }>
}

export interface TiBusinessModelObservation {
    value: string
    assertionKind: string
    evidenceKind?: 'observed' | 'actor_claim' | 'third_party_report' | 'analytical_inference'
    confidence: number
    sourceIds: string[]
    captureIds: string[]
    claimIds?: string[]
    reviewState: string
    reviewReasons: string[]
    corroborationState?: string
    sourceCount?: number
    evidenceCount?: number
    firstSeenAt?: string
    lastSeenAt?: string
    evidenceStages?: string[]
    extractionMethods?: string[]
    extractorVersions?: string[]
    evidence?: Array<{
        sourceId: string
        captureId: string
        url?: string
        collectedAt?: string
        excerpt: string
    }>
}

export interface TiBusinessModelAssessment {
    schemaVersion: 'ti.actor.business_model.v1' | 'ti.actor.business_model.v2'
    evidenceState: 'observed_mechanisms' | 'not_observed'
    extortionModels?: TiBusinessModelObservation[]
    advertisedProducts?: TiBusinessModelObservation[]
    advertisedData?: TiBusinessModelObservation[]
    pricingClaims?: TiBusinessModelObservation[]
    paymentClaims?: TiBusinessModelObservation[]
    revenueClaims?: TiBusinessModelObservation[]
    revenueShareClaims?: TiBusinessModelObservation[]
    publicationStrategies: TiBusinessModelObservation[]
    publicityTactics: TiBusinessModelObservation[]
    publicityEvents?: TiBusinessModelObservation[]
    pressureTactics: TiBusinessModelObservation[]
    communicationChannels: TiBusinessModelObservation[]
    buyerSellerCommunications: TiBusinessModelObservation[]
    intermediaryCommunications: TiBusinessModelObservation[]
    monetizationPaths: TiBusinessModelObservation[]
    profitabilitySignals: TiBusinessModelObservation[]
    profitabilityConclusion?: {
        status: 'profitability_reported' | 'revenue_reported' | 'unknown'
        summary: string
        claimIds: string[]
        sourceIds: string[]
        captureIds: string[]
    }
    missingEvidence: string[]
    evidenceBoundary: string
}

export interface TiClaimAssessment {
    id: string
    claimType?: string
    summary?: string
    confidence?: number
    reviewState: string
    corroborationState: string
    sourceCount: number
    evidenceCount: number
    evidenceStage?: string
    extractionMethod?: string
    extractorVersion?: string
    firstSeenAt?: string
    lastSeenAt?: string
    uncertaintyReasons: string[]
}

export interface TiIncidentAssessment {
    id: string
    title: string
    summary?: string
    confidence?: number
    assertionKind: 'inferred'
    reviewState: string
    firstSeenAt?: string
    sourceId?: string
    captureId?: string
    extractorVersion?: string
    reviewReasons: string[]
}

export interface TiEvidenceAssessment {
    ready: boolean
    confidence: number
    sourceCount: number
    captureCount: number
    confirmedClaimCount: number
    corroboratedClaimCount: number
    validationCount: number
    contradictedClaimCount: number
    rejectedClaimCount?: number
    staleClaimCount?: number
    metadataOnly: boolean
    reasons: string[]
    claimCounts?: { total: number; confirmed: number; needsReview: number; rejected?: number; stale?: number; contradicted: number; corroborated: number }
    missingFields: string[]
}

export interface TiActionabilityContract {
    schemaVersion?: 'ti.query.actionability.v1'
    alertDisposition?: 'ready_for_alert_review' | 'watchlist_required' | 'case_ready' | 'not_alertable' | 'needs_enrichment'
    shouldAlert?: boolean
    rationale?: string
    watchlistCandidates?: Array<{
        kind: 'company' | 'domain' | 'vendor'
        value: string
        reason: string
        confidence?: number
    }>
    watchlistMatches?: Array<{
        tenantId?: string
        organizationId?: string
        watchlistId?: string
        watchlistItemId?: string
        kind: 'company' | 'domain' | 'vendor'
        value: string
        route?: string
        casePath?: string
    }>
    relatedAlerts?: Array<{
        id: string
        title: string
        status: string
        severity?: string
        caseIdCandidate?: string
        casePath?: string
        source?: string
        tenantId?: string
        organizationId?: string
        dedupeKey?: string
        recommendedRoute?: string
        captureIds?: string[]
        evidenceCount?: number
        webhookDestinationIds?: string[]
        deliveryReadinessContext?: {
            schemaVersion?: 'dwm.alert_delivery_persistence.v1'
            state?: 'ready' | 'blocked' | 'closed' | 'suppressed' | 'delivered'
            ready?: boolean
            blockerCodes?: string[]
            casePath?: string
            selectedCaptureIds?: string[]
            webhookDestinationIds?: string[]
            entitlement?: {
                status?: string
                blockedReasons?: string[]
            }
        }
    }>
    relatedCases?: Array<{
        id: string
        title: string
        status: string
        priority?: string
        path?: string
    }>
    relatedWebhookDestinations?: Array<{
        id: string
        name: string
        status: 'active' | 'paused' | 'disabled'
        path?: string
    }>
    sourceProvenance?: Array<{
        sourceId?: string
        sourceName: string
        provenance: string
        captureId?: string
        sourceRequestId?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator' | 'vendor_disclosure' | 'webhook' | 'public_ti'
        parserStatus?: 'parsed' | 'partial' | 'queued' | 'failed' | 'missing_capture' | 'public_reference'
        reportDate?: string
        lastCollectedAt?: string
        confidence?: number
    }>
    enrichmentGaps?: Array<{
        id: string
        title: string
        severity: 'high' | 'medium' | 'low'
        detail: string
        dependency: string
        route?: string
        sourceFamily?: 'actor_profile' | 'source_capture' | 'watchlist' | 'alert' | 'case' | 'geography' | 'indicator'
        requestedFields?: string[]
    }>
    handoffs?: {
        watchlist?: {
            method: 'POST'
            endpoint: string
            payloads: Array<{ kind: 'company' | 'domain' | 'vendor'; value: string; notes: string }>
            missing?: string[]
        }
        alertRebuild?: {
            method: 'POST'
            endpoint: string
            missing?: string[]
        }
        caseCreate?: {
            method: 'POST'
            endpoint: string
            payload?: { alertId: string; title?: string; priority?: string; note?: string }
            missing?: string[]
        }
        webhookDelivery?: {
            method: 'POST'
            endpoint: string
            payload?: Record<string, unknown>
            missing?: string[]
        }
    }
    entitlementReadiness?: {
        schemaVersion?: 'dwm.entitlement_readiness.v1'
        actions?: Record<string, {
            ownerLane?: string
            status?: 'allowed' | 'blocked' | 'permissive_no_policy' | 'needs_input'
            blockerCodes?: string[]
            route?: string
            dashboardText?: string
            helpdeskText?: string
            blockers?: Array<{
                schemaVersion?: 'dwm.entitlement_blocker.v1'
                ownerLane?: string
                actionId?: string
                blockerCode?: string
                route?: string
                supportText?: string
                dashboardText?: string
            }>
        }>
    }
}

export interface TiCollectionStrategy {
    thesis: string
    productFocus: string[]
    sourcePosture: Array<{
        source: string
        role: 'primary_seed' | 'corroboration' | 'context_only' | 'rejected_paid_rows' | 'owned_collection_target'
        summary: string
        buyerValue: string
        limitations?: string
    }>
    ownedCollection: {
        priority: 'primary'
        summary: string
        requirements: string[]
        prohibited: string[]
    }
    distribution: {
        primarySurface: 'hanasand.com'
        secondarySurface: 'none'
        summary: string
    }
}

export type TiResultState = 'queued' | 'searching' | 'partial' | 'ready' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation'

export interface TiOperationalStatus {
    state: 'idle' | 'queued' | 'searching' | 'partial' | 'ready' | 'blocked' | 'degraded' | 'metadata_review' | 'needs_source_activation'
    headline: string
    queue: {
        selectedTasks: number
        queuedTasks: number
        leasedTasks: number
        reviewTasks: number
        maxAgeSeconds: number
        p95AgeSeconds: number
        nextPollSeconds?: number
        backpressureState?: string
        cursorContinuity?: string
    }
    workers: {
        leaseState: string
        retryDebt: number
        deadLetters: number
        backoffState: string
        concurrency: string
        fairness: string
        memoryPressure?: number
    }
    budgets: Array<{
        workClass: string
        queued: number
        leased: number
        budgetSlots: number
        maxAgeSeconds: number
        retryDebt: number
        action: string
    }>
    fairness: {
        ok: boolean
        worstGroup?: string
        worstShare: number
    }
    aging: Array<{
        label: string
        seconds: number
        tone: 'ok' | 'watch' | 'bad'
    }>
    controls: Array<{
        action: string
        scenario?: string
        warningCodes: string[]
        queueDelta: number
        workerDelta: number
        rollback: string
    }>
    notes: string[]
}

export interface TiAnalystLoop {
    resultState: TiResultState
    headline: string
    nextSteps: Array<{
        state: 'queued' | 'metadata_review' | 'blocked_unsafe_target' | 'needs_source_activation' | 'ready'
        label: string
        detail: string
        tone: 'ok' | 'watch' | 'bad'
    }>
    runStatusClarity: {
        queuedTasks: number
        reviewTasks: number
        rejectedSources: number
        blockedUnsafeTargets: number
        meaningfulWorkCount: number
        summary: string
    }
    metadataReviewInbox: TiMetadataReviewItem[]
    sourceActivationWorkflow: {
        required: boolean
        dryRunOnly: boolean
        actions: Array<{
            action: 'request_approval' | 'restore_source' | 'enable_metadata_only_queue' | 'keep_blocked'
            sourceId?: string
            reason: string
            execution: 'dry_run' | 'human_approval_required' | 'blocked'
        }>
    }
    victimNotificationPacket?: TiVictimNotificationPacket
}

export interface TiMetadataReviewItem {
    id: string
    company?: string
    victim?: string
    affectedAccounts?: string
    accountSubjects?: string
    datasetSize?: string
    actorStatement?: string
    claimedDate?: string
    sourceHash?: string
    provenance?: string
    confidence: number
    status: 'needs_review' | 'queued_metadata_only' | 'duplicate' | 'escalated'
    allowedActions: Array<'notify_company' | 'mark_duplicate' | 'request_approval' | 'escalate'>
}

export interface TiVictimNotificationPacket {
    company?: string
    claimSummary: string
    affectedAccounts?: string
    datasetSize?: string
    actorStatement?: string
    sourceHash?: string
    confidence: number
    whatWasNotAccessed: string[]
    recommendedAction: string
}

export default async function searchThreatIntel(query: string): Promise<TiSearchResponse | null> {
    const clean = query.trim()
    if (!clean) return null

    const key = clean.toLowerCase()
    const cached = readCachedResult(key)
    if (cached) return cached

    let response: Response
    try {
        response = await fetch(`${config.url.api}/ti/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: clean })
        })
    } catch {
        return null
    }

    if (!response.ok) {
        return null
    }

    try {
        const result: unknown = await response.json()
        if (!isTiSearchResponse(result)) return null
        writeCachedResult(key, result)
        return result
    } catch {
        return null
    }
}

function isTiSearchResponse(value: unknown): value is TiSearchResponse {
    return typeof value === 'object'
        && value !== null
        && typeof (value as TiSearchResponse).query === 'string'
        && typeof (value as TiSearchResponse).summary === 'string'
        && Array.isArray((value as TiSearchResponse).recentActivity)
        && Array.isArray((value as TiSearchResponse).sources)
}

export const evidenceTimestamp = (...values: Array<string | null | undefined>) =>
    values.find(value => value?.trim()) ?? 'Observation date unavailable'

function readCachedResult(key: string) {
    const now = Date.now()
    const memoryHit = memoryCache.get(key)
    if (memoryHit && memoryHit.expiresAt > now) {
        return memoryHit.result
    }
    if (memoryHit) memoryCache.delete(key)

    if (typeof window === 'undefined') return null

    try {
        const raw = window.localStorage.getItem(`${browserCachePrefix}${key}`)
        if (!raw) return null
        const parsed = JSON.parse(raw) as { expiresAt?: number; result?: TiSearchResponse }
        if (!parsed.expiresAt || parsed.expiresAt <= now || !parsed.result?.query) {
            window.localStorage.removeItem(`${browserCachePrefix}${key}`)
            return null
        }
        return parsed.result
    } catch {
        return null
    }
}

function writeCachedResult(key: string, result: TiSearchResponse) {
    if (result.status === 'queued' || result.status === 'searching') {
        return
    }

    const record = { expiresAt: Date.now() + cacheTtlMs, result }
    memoryCache.set(key, record)

    if (typeof window === 'undefined') return

    try {
        window.localStorage.setItem(`${browserCachePrefix}${key}`, JSON.stringify(record))
    } catch {
        // Storage can be unavailable in private or locked-down browser contexts.
    }
}
