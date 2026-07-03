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
        decision: 'production_ready_with_live_sources' | 'demo_ready_needs_live_sources' | 'blocked_missing_watchlist'
        blockers: string[]
        advantages: string[]
        nextWorkItem: string
    }
}

export function demoDwmProductSnapshot(generatedAt = new Date().toISOString()): DwmProductSnapshot {
    const firstAlertAt = minutesBefore(generatedAt, 6)
    const secondAlertAt = minutesBefore(generatedAt, 29)
    const watchlist: DwmWatchTerm[] = [
        { value: 'acme.com', kind: 'domain' },
        { value: 'Acme Payments', kind: 'company' },
        { value: 'Northwind Supplier', kind: 'vendor' },
        { value: 'fjordenergy.example', kind: 'domain' },
    ]

    return {
        schemaVersion: 'dwm.product.v1',
        generatedAt,
        tenantId: 'tenant_demo',
        watchlist,
        alerts: [
            {
                id: 'dwm_alert_identity_acme_lumma',
                eventType: 'darkweb.monitoring.match',
                severity: 'critical',
                confidence: 91,
                matchedTerm: watchlist[0],
                company: 'Acme Payments',
                actor: 'Lumma C2',
                artifactType: 'session_or_token_hint',
                sourceFamily: 'telegram_public',
                sourceCount: 5,
                firstSeenAt: firstAlertAt,
                claimSummary: 'Public Telegram broker-room metadata claims acme.com appears in a stealer-log bundle with Okta session cookies, OAuth tokens, and AWS IAM key hints.',
                reviewState: 'validate_identity',
                recommendedAction: 'Validate the identity match, revoke live sessions, rotate affected keys, and route to incident response without storing raw stolen material.',
                evidence: [
                    {
                        id: 'ev_tel_acme_lumma',
                        sourceName: 'Public Telegram broker-room coverage',
                        sourceFamily: 'telegram_public',
                        captureMode: 'public_message',
                        redactionState: 'redacted',
                        contentHash: 'f91d0c2a',
                        excerpt: 'acme.com matched in a redacted public Telegram stealer-log listing.',
                    },
                    {
                        id: 'ev_dark_acme_actor',
                        sourceName: 'Leak-site metadata mirror',
                        sourceFamily: 'darkweb_metadata',
                        captureMode: 'metadata_only',
                        redactionState: 'metadata_only',
                        contentHash: 'a52c113e',
                        excerpt: 'Metadata-only leak-site entry includes Acme Payments as claimed victim with financial records category.',
                    },
                ],
                webhookDelivery: {
                    recommendedRoute: 'identity_response',
                    payloadHash: '4c08a98d',
                    dedupeKey: 'dwm_dedupe_acme_identity',
                },
            },
            {
                id: 'dwm_alert_vendor_northwind',
                eventType: 'darkweb.monitoring.match',
                severity: 'high',
                confidence: 84,
                matchedTerm: watchlist[2],
                company: 'Northwind Supplier',
                actor: 'RansomHouse',
                artifactType: 'vendor_claim',
                sourceFamily: 'darkweb_metadata',
                sourceCount: 3,
                firstSeenAt: secondAlertAt,
                claimSummary: 'Sensitive leak-site sources claim a watched supplier appears with procurement and customer-record categories.',
                reviewState: 'needs_review',
                recommendedAction: 'Route to vendor-risk workflow, ask the supplier owner for confirmation, and keep actor mirrors on 30-minute watch.',
                evidence: [
                    {
                        id: 'ev_dark_northwind',
                        sourceName: 'Restricted leak-site metadata',
                        sourceFamily: 'darkweb_metadata',
                        captureMode: 'metadata_only',
                        redactionState: 'metadata_only',
                        contentHash: 'c61be8a1',
                        excerpt: 'Northwind Supplier appears in leak-site metadata with claimed procurement data.',
                    },
                ],
                webhookDelivery: {
                    recommendedRoute: 'vendor_risk',
                    payloadHash: '8c10f2bd',
                    dedupeKey: 'dwm_dedupe_northwind_vendor',
                },
            },
        ],
        sourceCoverage: [
            { family: 'telegram_public', label: 'Public Telegram', sourceCount: 54, activeCount: 38, approvalState: 'active', health: 'partial', detail: 'Broker rooms, ransomware mirrors, combo-list drops, stealer-log shops, and phishing-kit seller channels.' },
            { family: 'darkweb_metadata', label: 'Dark web metadata', sourceCount: 18, activeCount: 12, approvalState: 'active', health: 'partial', detail: 'Leak sites, mirrors, first-seen times, screenshots, hashes, and victim/data-type metadata.' },
            { family: 'actor_page', label: 'Leak sites', sourceCount: 11, activeCount: 9, approvalState: 'active', health: 'partial', detail: 'Ransomware and extortion leak sites normalized into victim, sector, country, and mirror-state fields.' },
            { family: 'public_advisory', label: 'Public advisories', sourceCount: 32, activeCount: 32, approvalState: 'active', health: 'healthy', detail: 'CERT, vendor reports, GitHub advisories, malware infrastructure feeds, and corroborating public reports.' },
            { family: 'clear_web', label: 'Clear-web corroboration', sourceCount: 27, activeCount: 25, approvalState: 'active', health: 'partial', detail: 'Searchable public context used to reduce false positives before customer delivery.' },
        ],
        actorOverviews: [
            { actor: 'Lumma C2', aliases: [], sourceFamilies: ['telegram_public'], sourceCount: 5, captureCount: 5, latestSeenAt: firstAlertAt, confidence: 91, watchState: 'active_monitoring', summary: 'Lumma C2 is tracked across broker-room and stealer-log public Telegram sources with identity exposure context.' },
            { actor: 'RansomHouse', aliases: [], sourceFamilies: ['darkweb_metadata'], sourceCount: 3, captureCount: 3, latestSeenAt: secondAlertAt, confidence: 84, watchState: 'metadata_only', summary: 'RansomHouse is tracked through metadata-only leak-site coverage and vendor-risk claims.' },
        ],
        onDemandQueue: [
            { id: 'req_session_replay_market', target: 't.me/session_replay_market', type: 'telegram_channel', priority: 'high', scope: 'acme.com plus subsidiaries', approvalState: 'queued', nextAction: 'Run public-channel compliance checks and promote approved messages to continuous polling.' },
            { id: 'req_actor_mirror', target: 'new onion ransomware mirror', type: 'restricted_metadata', priority: 'high', scope: 'financial services vendors', approvalState: 'approved_metadata_only', nextAction: 'Block payload paths and capture actor, victim, first-seen, mirror, screenshot, and hash metadata only.' },
            { id: 'req_lumma_cluster', target: 'Lumma broker alias cluster', type: 'actor_scope', priority: 'medium', scope: 'identity exposure', approvalState: 'queued', nextAction: 'Link aliases to Telegram and clear-web corroboration sources before customer alerting.' },
        ],
        readiness: {
            decision: 'demo_ready_needs_live_sources',
            blockers: [
                'Persist tenant-specific DWM watchlists instead of using the preview snapshot.',
                'Schedule live public Telegram polling and source health rollups for approved channels.',
                'Persist webhook delivery attempts and replay state per alert key.',
            ],
            advantages: [
                'Telegram is modeled as a first-class source family, not a keyword side feed.',
                'Restricted dark web monitoring is metadata-only by default, avoiding bulk scraped-row bloat.',
                'Every alert includes source evidence, confidence, review state, and a recommended customer workflow.',
                'On-demand collection requests become approval packets before continuous monitoring.',
            ],
            nextWorkItem: 'Persist DWM watchlists and webhook subscriptions, then connect the TI /v1/dwm/product route to scheduled Telegram polling.',
        },
    }
}

function minutesBefore(value: string, minutes: number) {
    const time = Date.parse(value)
    if (Number.isNaN(time)) return new Date(Date.now() - minutes * 60_000).toISOString()
    return new Date(time - minutes * 60_000).toISOString()
}

export function dwmWebhookPayload(alert: DwmAlert) {
    return {
        eventType: alert.eventType,
        alertId: alert.id,
        severity: alert.severity,
        confidence: alert.confidence,
        company: alert.company,
        matchedTerm: alert.matchedTerm.value,
        actor: alert.actor,
        artifactType: alert.artifactType,
        sourceFamily: alert.sourceFamily,
        sourceCount: alert.sourceCount,
        firstSeenAt: alert.firstSeenAt,
        claimSummary: alert.claimSummary,
        reviewState: alert.reviewState,
        recommendedAction: alert.recommendedAction,
        evidence: alert.evidence.map(item => ({
            id: item.id,
            sourceName: item.sourceName,
            captureMode: item.captureMode,
            redactionState: item.redactionState,
            contentHash: item.contentHash,
        })),
        delivery: alert.webhookDelivery,
    }
}
