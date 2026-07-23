export type DwmSourceFamily = 'telegram_public' | 'darkweb_metadata' | 'actor_page' | 'public_advisory' | 'clear_web'
export type DwmSeverity = 'critical' | 'high' | 'medium' | 'low'

export type DwmWatchTerm = {
    value: string
    kind: 'company' | 'domain' | 'vendor' | 'brand' | 'vip' | 'product' | 'unknown'
}

export type DwmAlert = {
    id: string
    eventType: 'darkweb.monitoring.match'
    severity: DwmSeverity
    confidence: number
    matchedTerm: DwmWatchTerm
    company: string
    actor?: string
    artifactType: string
    sourceFamily: DwmSourceFamily
    sourceCount: number
    firstSeenAt: string
    lastSeenAt?: string
    matchTiming?: {
        kind: 'new_evidence' | 'historical_backfill'
        firstObservedAt: string
        lastObservedAt: string
        firstCollectedAt?: string
        lastCollectedAt?: string
        historicalEvidenceCount: number
    }
    assertionKind?: 'source_claim'
    observedMatchSummary?: string
    claimSummary: string
    matchContext?: {
        normalizedTerm: string
        termKind: DwmWatchTerm['kind']
        matchType: 'case_insensitive_substring'
        matchedFieldHints: string[]
    }
    evidenceSummary?: {
        evidenceCount: number
        sourceFamilyCounts: Record<string, number>
        metadataOnlyCount: number
        publicSafeCount: number
        firstObservedAt: string
        lastObservedAt: string
    }
    routingContext?: {
        queue: 'identity_response' | 'vendor_risk' | 'incident_response' | 'brand_protection' | 'analyst_review'
        urgency: 'immediate' | 'same_day' | 'watch'
        customerVisibleEvidence: 'metadata_only' | 'redacted_excerpt'
        reason: string
    }
    sourceHandoffReadiness?: {
        analystWorkflowConsumer?: {
            ready?: boolean
            workflowStatus?: string
            assignedOwner?: string
            workflowEventCount?: number
            actionReadiness?: DwmAlertAnalystActionReadiness
        }
    }
    reviewState: string
    recommendedAction: string
    evidence: Array<{
        id: string
        sourceName: string
        sourceFamily: DwmSourceFamily
        captureMode: 'public_message' | 'metadata_only' | 'public_report'
        redactionState: 'redacted' | 'metadata_only' | 'public_safe'
        contentHash: string
        excerpt: string
        firstSeenAt?: string
        observedAt?: string
        provenance?: {
            captureId: string
            sourceId: string
            publishedAt?: string
            collectedAt?: string
            sourceType?: string
            collector?: string
            captureMode: 'public_message' | 'metadata_only' | 'public_report' | 'unknown'
            retentionClass?: string
            storageKind?: string
            metadataOnly: boolean
        }
    }>
    webhookDelivery: {
        recommendedRoute: 'identity_response' | 'vendor_risk' | 'incident_response' | 'brand_protection' | 'analyst_review'
        payloadHash: string
        dedupeKey: string
    }
}

export type DwmAlertAnalystActionReadiness = {
    schemaVersion: 'dwm.alert_analyst_action_readiness.v1' | string
    expectedWorkflowEventCount?: number
    readyActions?: DwmAlertAnalystAction[]
    blockedActions?: DwmAlertAnalystAction[]
    actions?: DwmAlertAnalystActionReadinessRow[]
}

export type DwmAlertAnalystAction = 'assign' | 'note' | 'transition' | 'case_link' | 'replay' | 'close' | 'reopen' | 'suppress' | 'deliver'

export type DwmAlertAnalystActionReadinessRow = {
    action: DwmAlertAnalystAction
    ready: boolean
    idempotencyKey?: string
    workflowEventCount?: number
    casePath?: string
    deliveryDedupeKey?: string
    blockerCodes?: string[]
}

export type DwmSourceCoverage = {
    family: DwmSourceFamily
    label: string
    sourceCount: number
    activeCount: number
    approvalState: 'active' | 'canary' | 'approval_required' | 'missing'
    health: 'healthy' | 'partial' | 'missing'
    detail: string
}

export type DwmActorOverview = {
    actor: string
    aliases: string[]
    sourceFamilies: DwmSourceFamily[]
    sourceCount: number
    captureCount: number
    latestSeenAt: string
    confidence: number
    watchState: 'active_monitoring' | 'metadata_only' | 'needs_more_sources'
    summary: string
}

export type DwmProductSnapshot = {
    schemaVersion: 'dwm.product.v1'
    generatedAt: string
    tenantId: string
    watchlist: DwmWatchTerm[]
    alerts: DwmAlert[]
    sourceCoverage: DwmSourceCoverage[]
    actorOverviews: DwmActorOverview[]
    onDemandQueue: Array<{
        id: string
        target: string
        type: 'telegram_channel' | 'restricted_metadata' | 'actor_scope' | 'sector_scope' | 'language_scope'
        priority: 'critical' | 'high' | 'medium'
        scope: string
        approvalState: 'draft' | 'queued' | 'approved_metadata_only' | 'blocked'
        nextAction: string
    }>
    readiness: {
        decision: 'production_ready_with_live_sources' | 'blocked_missing_live_sources' | 'blocked_missing_watchlist'
        blockers: string[]
        advantages: string[]
        nextWorkItem: string
    }
}
