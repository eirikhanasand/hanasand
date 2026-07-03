import type { DwmAlert, DwmSeverity } from '@/utils/dwm/product'
import { safeAlertSummary } from '@/utils/dwm/display'
import type { WorkbenchAction, WorkbenchCase, WorkbenchEvidence, WorkbenchTimelineItem } from './workbenchClient'

type RuntimeDwmAlert = DwmAlert & {
    tenantId?: string
    organizationId?: string
    workflowStatus?: string
    assignedOwner?: string
    workflowNote?: string
    workflowRationale?: string
    updatedAt?: string
    lastSeenAt?: string
    caseId?: string
    caseIdCandidate?: string
    casePath?: string
    alertDetailPath?: string
    dedupeKey?: string
    recommendedRoute?: string
    watchlistIds?: string[]
    watchlistItemIds?: string[]
    workflowEvents?: Array<{ id?: string, at?: string, eventType?: string, toWorkflowStatus?: string, toOwner?: string, note?: string }>
    workflowContext?: {
        organizationId?: string
        caseIdCandidate?: string
        casePath?: string
        alertDetailPath?: string
        watchlistIds?: string[]
        watchlistItemIds?: string[]
        captureIds?: string[]
        sourceIds?: string[]
        webhookDestinationIds?: string[]
        evidenceCount?: number
        matchReason?: { evidenceCount?: number }
        duplicateEvidenceSuppression?: { suppressedCount?: number, suppressedCaptureIds?: string[] }
    }
    webhookContext?: {
        webhookDestinationIds?: string[]
        selectedCaptureIds?: string[]
        deliveryDedupeKey?: string
    }
    deliveryReadinessContext?: {
        ready?: boolean
        webhookDestinationIds?: string[]
        selectedWebhookDestinationId?: string
        selectedCaptureIds?: string[]
        deliveryDedupeKey?: string
        blockerCodes?: string[]
    }
    sourceProvenanceSummary?: {
        sourceFamily?: string
        sourceFamilies?: string[]
        captureIds?: string[]
        sourceIds?: string[]
        contentHashes?: string[]
        evidenceExcerpts?: Array<{ id?: string, sourceName?: string, sourceFamily?: string, excerpt?: string, observedAt?: string, contentHash?: string }>
        provenanceGaps?: Array<{ code?: string }>
        generationEvidenceWindow?: { captureIds?: string[], sourceFamilies?: string[], firstSeenAt?: string, lastSeenAt?: string }
    }
    orgWatchlistScope?: {
        organizationId?: string
        watchlistIds?: string[]
        watchlistItemIds?: string[]
        alertGenerationRefs?: unknown[]
    }
    customerReadiness?: {
        ready?: boolean
        state?: string
        alertReadiness?: {
            selectedCaptureIds?: string[]
            watchlistIds?: string[]
            watchlistItemIds?: string[]
            recommendedRoute?: string
            matchReason?: unknown
            blockerCodes?: string[]
        }
        caseHandoff?: { ready?: boolean, caseId?: string, caseIdCandidate?: string, casePath?: string }
        deliveryReadiness?: { ready?: boolean, selectedWebhookDestinationId?: string, webhookDestinationIds?: string[], blockerCodes?: string[] }
        webhookReplayReadiness?: { ready?: boolean, blockerCodes?: string[], deliveryHistoryRefs?: string[] }
        workflowReadiness?: { ready?: boolean, status?: string, assignedOwner?: string, eventCount?: number }
        blockerCodes?: string[]
    }
    workflowSummary?: {
        status?: string
        assignedOwner?: string
        eventCount?: number
        caseId?: string
        casePath?: string
    }
    nextBestAction?: { label?: string, action?: string, reason?: string, route?: string, casePath?: string, webhookReady?: boolean }
    deliveryReadiness?: { ready?: boolean, blockerCodes?: string[], selectedCaptureIds?: string[], webhookDestinationIds?: string[] }
    deliveries?: Array<{ id?: string, alertId?: string, status?: string, deliveryKind?: string, attemptedAt?: string, webhookDestinationId?: string, endpointHash?: string, payloadHash?: string, httpStatus?: number, error?: string }>
}

export function dwmAlertToWorkbenchCase(input: DwmAlert): WorkbenchCase {
    const alert = input as RuntimeDwmAlert
    const severity = normalizeSeverity(alert.severity)
    const route = String(alert.recommendedRoute ?? alert.customerReadiness?.alertReadiness?.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? 'analyst_review')
    const workflowStatus = String(alert.workflowStatus ?? alert.workflowSummary?.status ?? alert.customerReadiness?.workflowReadiness?.status ?? alert.reviewState ?? 'new')
    const owner = alert.assignedOwner ?? alert.workflowSummary?.assignedOwner ?? alert.customerReadiness?.workflowReadiness?.assignedOwner ?? 'unassigned'
    const caseId = alert.caseId ?? alert.customerReadiness?.caseHandoff?.caseId ?? alert.customerReadiness?.caseHandoff?.caseIdCandidate ?? alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate
    const casePath = alert.casePath ?? alert.customerReadiness?.caseHandoff?.casePath ?? alert.workflowSummary?.casePath ?? alert.workflowContext?.casePath
    const organizationId = alert.organizationId ?? alert.orgWatchlistScope?.organizationId ?? alert.workflowContext?.organizationId
    const selectedCaptureIds = uniqueStrings([
        ...(alert.customerReadiness?.alertReadiness?.selectedCaptureIds ?? []),
        ...(alert.deliveryReadinessContext?.selectedCaptureIds ?? []),
        ...(alert.webhookContext?.selectedCaptureIds ?? []),
        ...(alert.workflowContext?.captureIds ?? []),
        ...(alert.sourceProvenanceSummary?.captureIds ?? []),
        ...(alert.sourceProvenanceSummary?.generationEvidenceWindow?.captureIds ?? []),
    ])
    const watchlistIds = uniqueStrings([
        ...(alert.watchlistIds ?? []),
        ...(alert.orgWatchlistScope?.watchlistIds ?? []),
        ...(alert.workflowContext?.watchlistIds ?? []),
        ...(alert.customerReadiness?.alertReadiness?.watchlistIds ?? []),
    ])
    const watchlistItemIds = uniqueStrings([
        ...(alert.watchlistItemIds ?? []),
        ...(alert.orgWatchlistScope?.watchlistItemIds ?? []),
        ...(alert.workflowContext?.watchlistItemIds ?? []),
        ...(alert.customerReadiness?.alertReadiness?.watchlistItemIds ?? []),
    ])
    const evidence = buildWorkbenchEvidence(alert, selectedCaptureIds)
    const actionBlockers = alert.customerReadiness?.blockerCodes ?? []
    const alertHref = `/api/dwm/alerts/${encodeURIComponent(alert.id)}${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`
    const caseDetailHref = dashboardCaseHref({ caseId, casePath, alertId: alert.id, organizationId, tenantId: alert.tenantId })
    const deliveryEvidence = (alert.deliveries ?? []).map(row => ({
        id: String(row.id ?? ''),
        alertId: String(row.alertId ?? alert.id),
        status: String(row.status ?? 'recorded'),
        deliveryKind: row.deliveryKind,
        attemptedAt: String(row.attemptedAt ?? alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt),
        webhookDestinationId: row.webhookDestinationId,
        endpointHash: String(row.endpointHash ?? 'endpoint_hash_not_returned'),
        payloadHash: String(row.payloadHash ?? alert.webhookDelivery?.payloadHash ?? 'payload_hash_not_returned'),
        httpStatus: row.httpStatus,
        error: row.error,
    })).filter(row => row.id)

    return {
        id: alert.id,
        kind: 'dwm_alert',
        queue: severity === 'critical' ? 'Incident response' : route.replaceAll('_', ' '),
        title: alert.company,
        subtitle: safeAlertSummary(alert),
        severity,
        status: workflowStatus,
        priority: severityPriority(severity) + alert.confidence + (workflowStatus === 'new' ? 20 : 0),
        confidence: alert.confidence,
        owner,
        createdAt: alert.firstSeenAt,
        updatedAt: alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt,
        company: alert.company,
        matchedTerm: alert.matchedTerm.value,
        actor: alert.actor || alert.sourceFamily.replaceAll('_', ' '),
        sourceLabel: `${alert.sourceCount || evidence.length} ${pluralize('source', alert.sourceCount || evidence.length)}`,
        recommendedAction: alert.nextBestAction?.label || alert.recommendedAction,
        routeLabel: route.replaceAll('_', ' '),
        persistent: true,
        evidence,
        timeline: buildAlertTimeline(alert, selectedCaptureIds, watchlistIds, watchlistItemIds),
        nextTasks: nextAlertTasks(alert, actionBlockers),
        relatedLinks: [
            { href: alertHref, label: 'Open alert detail' },
            ...(caseDetailHref ? [{ href: caseDetailHref, label: 'Open case' }] : []),
            ...(watchlistIds.length ? [{ href: watchlistLedgerHref(organizationId, alert.tenantId), label: 'Watchlists' }] : []),
        ],
        workflowPath: [
            {
                id: 'persisted_alert',
                label: 'Persisted alert',
                status: 'ready',
                owner: 'alert',
                source: 'Saved alert record',
                detail: `${selectedCaptureIds.length || evidence.length} capture-backed evidence item${(selectedCaptureIds.length || evidence.length) === 1 ? '' : 's'} retained.`,
                entityId: alert.id,
                href: alertHref,
            },
            {
                id: 'watchlist_scope',
                label: 'Watchlist scope',
                status: watchlistIds.length ? 'ready' : 'blocked',
                owner: 'org',
                source: 'orgWatchlistScope',
                detail: watchlistIds.length ? `${watchlistIds.length} watchlist ref${watchlistIds.length === 1 ? '' : 's'}; ${watchlistItemIds.length} item ref${watchlistItemIds.length === 1 ? '' : 's'}.` : 'Org/shared watchlist reference is syncing.',
                entityId: watchlistItemIds[0] ?? watchlistIds[0],
                href: watchlistIds.length ? watchlistLedgerHref(organizationId, alert.tenantId) : undefined,
            },
            {
                id: 'case_handoff',
                label: 'Case handoff',
                status: caseDetailHref ? 'ready' : 'needs_action',
                owner: 'case',
                source: 'caseHandoff',
                detail: caseDetailHref ? `Case detail route ${caseDetailHref}.` : 'Case id and path are syncing.',
                entityId: caseId,
                href: caseDetailHref,
            },
            {
                id: 'delivery',
                label: 'Delivery',
                status: alert.customerReadiness?.deliveryReadiness?.ready || alert.deliveryReadinessContext?.ready ? 'ready' : 'needs_action',
                owner: 'webhook',
                source: 'deliveryReadiness',
                detail: deliveryDetail(alert),
                entityId: alert.customerReadiness?.deliveryReadiness?.selectedWebhookDestinationId ?? alert.deliveryReadinessContext?.selectedWebhookDestinationId,
                href: deliveryLedgerHref(organizationId, alert.tenantId, alert.id),
            },
        ],
        actions: buildAlertActions(alert, organizationId),
        caseDetailHref,
        deliveryEvidence,
        missingDependency: caseDetailHref ? undefined : 'Backed case id is syncing to this alert.',
    }
}

function buildWorkbenchEvidence(alert: RuntimeDwmAlert, selectedCaptureIds: string[]): WorkbenchEvidence[] {
    const evidence: WorkbenchEvidence[] = alert.evidence.map(item => ({
        id: item.id,
        sourceName: item.sourceName,
        sourceFamily: item.sourceFamily.replaceAll('_', ' '),
        captureMode: item.captureMode.replaceAll('_', ' '),
        redactionState: item.redactionState.replaceAll('_', ' '),
        contentHash: item.contentHash,
        excerpt: item.excerpt,
        observedAt: item.observedAt ?? item.firstSeenAt,
        provenance: typeof item.provenance === 'object'
            ? [item.provenance.sourceId, item.provenance.captureId].filter(Boolean).join(' / ')
            : undefined,
        confidence: alert.confidence,
        metadata: [
            { label: 'Capture', value: typeof item.provenance === 'object' ? item.provenance.captureId : selectedCaptureIds.find(id => id === item.id) || item.id },
            { label: 'Source', value: typeof item.provenance === 'object' ? item.provenance.sourceId : item.sourceName },
            { label: 'Hash', value: item.contentHash },
        ],
    }))
    const excerptRows = alert.sourceProvenanceSummary?.evidenceExcerpts ?? []
    for (const row of excerptRows) {
        const id = String(row.id ?? row.contentHash ?? '')
        if (!id || evidence.some(item => item.id === id)) continue
        evidence.push({
            id,
            sourceName: row.sourceName ?? alert.sourceFamily,
            sourceFamily: String(row.sourceFamily ?? alert.sourceFamily).replaceAll('_', ' '),
            captureMode: 'metadata only',
            redactionState: 'customer safe',
            contentHash: String(row.contentHash ?? id),
            excerpt: String(row.excerpt ?? 'Source excerpt retained in provenance summary.'),
            observedAt: row.observedAt,
            confidence: alert.confidence,
        })
    }
    return evidence
}

function buildAlertTimeline(alert: RuntimeDwmAlert, selectedCaptureIds: string[], watchlistIds: string[], watchlistItemIds: string[]): WorkbenchTimelineItem[] {
    const rows: WorkbenchTimelineItem[] = [
        {
            id: `${alert.id}_created`,
            at: alert.firstSeenAt,
            title: 'Alert created',
            body: `${alert.matchedTerm.value} matched ${selectedCaptureIds.length || alert.evidence.length} capture${(selectedCaptureIds.length || alert.evidence.length) === 1 ? '' : 's'} from ${alert.sourceFamily.replaceAll('_', ' ')}.`,
        },
        {
            id: `${alert.id}_watchlist`,
            at: alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt,
            title: 'Watchlist scope',
            body: watchlistIds.length ? `${watchlistIds.join(', ')} / ${watchlistItemIds.join(', ') || 'watchlist item syncing'}` : 'Org watchlist scope is syncing.',
        },
        {
            id: `${alert.id}_route`,
            at: alert.updatedAt ?? alert.lastSeenAt ?? alert.firstSeenAt,
            title: 'Recommended route',
            body: String(alert.recommendedRoute ?? alert.webhookDelivery?.recommendedRoute ?? 'analyst_review').replaceAll('_', ' '),
        },
        ...(alert.workflowEvents ?? []).map((event, index) => ({
            id: String(event.id ?? `${alert.id}_workflow_${index}`),
            at: String(event.at ?? alert.updatedAt ?? alert.firstSeenAt),
            title: String(event.eventType ?? event.toWorkflowStatus ?? 'Workflow event').replaceAll('_', ' '),
            body: [event.toWorkflowStatus, event.toOwner ? `owner ${event.toOwner}` : undefined, event.note].filter(Boolean).join(' · '),
        })),
    ]
    return rows.sort((a, b) => a.at.localeCompare(b.at))
}

function buildAlertActions(alert: RuntimeDwmAlert, organizationId: string | undefined): WorkbenchAction[] {
    const scope = organizationId ? { organizationId } : {}
    const expectedWorkflowEventCount = alert.workflowEvents?.length ?? alert.customerReadiness?.workflowReadiness?.eventCount ?? alert.workflowSummary?.eventCount
    const caseId = alert.caseId ?? alert.customerReadiness?.caseHandoff?.caseId ?? alert.customerReadiness?.caseHandoff?.caseIdCandidate ?? alert.caseIdCandidate ?? alert.workflowContext?.caseIdCandidate
    const casePath = alert.casePath ?? alert.customerReadiness?.caseHandoff?.casePath ?? alert.workflowSummary?.casePath ?? alert.workflowContext?.casePath
    const bodyBase = {
        ...scope,
        ...(expectedWorkflowEventCount !== undefined ? { expectedWorkflowEventCount } : {}),
    }
    const alertHref = `/api/dwm/alerts/${encodeURIComponent(alert.id)}`
    const replayBlocked = alert.customerReadiness?.webhookReplayReadiness?.ready === false ? blockerLabel(alert.customerReadiness.webhookReplayReadiness.blockerCodes) : undefined
    const sendBlocked = alert.customerReadiness?.deliveryReadiness?.ready === false ? blockerLabel(alert.customerReadiness.deliveryReadiness.blockerCodes) : undefined
    return [
        ...(!caseId ? [{
            id: 'open_case',
            label: 'Open case',
            method: 'POST' as const,
            href: `${alertHref}/case-handoff`,
            body: {
                ...scope,
                note: 'Open a case from this alert.',
                idempotencyKey: `ti-workbench-open-case:${alert.id}`,
            },
        }] : []),
        { id: 'review_alert', label: 'Review', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: 'triaged' } },
        { id: 'escalate_alert', label: 'Escalate', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: 'investigating' } },
        { id: 'suppress_alert', label: 'Suppress', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: 'suppressed' } },
        { id: 'close_alert', label: alert.workflowStatus === 'closed' ? 'Reopen' : 'Close', method: 'PATCH', href: alertHref, body: { ...bodyBase, status: alert.workflowStatus === 'closed' ? 'reopened' : 'closed' } },
        { id: 'replay_alert', label: 'Replay', method: 'POST', href: `${alertHref}/replay`, body: { ...bodyBase, action: 'replay' }, disabledReason: replayBlocked },
        { id: 'send_alert', label: 'Send', method: 'POST', href: '/api/dwm/webhooks/deliver', body: { ...scope, alertId: alert.id, caseId, casePath, webhookDestinationId: alert.customerReadiness?.deliveryReadiness?.selectedWebhookDestinationId ?? alert.deliveryReadinessContext?.selectedWebhookDestinationId, limit: 1 }, disabledReason: sendBlocked },
    ]
}

function nextAlertTasks(alert: RuntimeDwmAlert, blockers: string[]) {
    if (blockers.length) {
        return [
            `Clear blocker: ${blockers[0].replaceAll('_', ' ')}.`,
            'Review evidence and watchlist scope before customer routing.',
            'Assign an owner and add rationale before suppression or closure.',
        ]
    }
    return [
        alert.nextBestAction?.label || 'Review the persisted evidence and confirm customer impact.',
        'Assign an analyst owner and record the decision rationale.',
        'Open case handoff or send webhook delivery when evidence is customer-safe.',
    ]
}

function deliveryDetail(alert: RuntimeDwmAlert) {
    const selected = alert.customerReadiness?.deliveryReadiness?.selectedWebhookDestinationId ?? alert.deliveryReadinessContext?.selectedWebhookDestinationId
    const destinations = alert.customerReadiness?.deliveryReadiness?.webhookDestinationIds ?? alert.deliveryReadinessContext?.webhookDestinationIds ?? alert.workflowContext?.webhookDestinationIds ?? []
    if (selected) return `Selected destination ${selected}; ${destinations.length || 1} destination ref${(destinations.length || 1) === 1 ? '' : 's'}.`
    const blockers = alert.customerReadiness?.deliveryReadiness?.blockerCodes ?? alert.deliveryReadinessContext?.blockerCodes ?? []
    return blockers.length ? blockers.map(item => item.replaceAll('_', ' ')).join(', ') : 'Delivery destination is not selected yet.'
}

function blockerLabel(blockers: string[] | undefined) {
    return blockers?.length ? blockers.map(item => item.replaceAll('_', ' ')).join(', ') : undefined
}

function watchlistLedgerHref(organizationId: string | undefined, tenantId: string | undefined) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    if (tenantId) params.set('tenantId', tenantId)
    const query = params.toString()
    return `/api/dwm/watchlists${query ? `?${query}` : ''}`
}

function deliveryLedgerHref(organizationId: string | undefined, tenantId: string | undefined, alertId: string) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    if (tenantId) params.set('tenantId', tenantId)
    params.set('alertId', alertId)
    return `/api/dwm/webhooks/deliveries?${params.toString()}`
}

function dashboardCaseHref(input: { caseId?: string, casePath?: string, alertId: string, organizationId?: string, tenantId?: string }) {
    const caseId = input.caseId ?? caseIdFromPath(input.casePath)
    if (!caseId) return undefined
    const params = new URLSearchParams()
    if (input.organizationId) params.set('organizationId', input.organizationId)
    if (input.tenantId) params.set('tenantId', input.tenantId)
    params.set('alertId', input.alertId)
    params.set('route', 'ti_workbench')
    return `/dashboard/dwm/cases/${encodeURIComponent(caseId)}?${params.toString()}`
}

function caseIdFromPath(path?: string) {
    const match = path?.match(/\/cases\/([^/?#]+)/)
    if (!match?.[1]) return undefined
    try {
        return decodeURIComponent(match[1])
    } catch {
        return match[1]
    }
}

function normalizeSeverity(severity: DwmSeverity): WorkbenchCase['severity'] {
    return severity
}

function severityPriority(severity: WorkbenchCase['severity']) {
    if (severity === 'critical') return 400
    if (severity === 'high') return 300
    if (severity === 'medium') return 200
    return 100
}

function pluralize(word: string, count: number) {
    return count === 1 ? word : `${word}s`
}

function uniqueStrings(values: Array<string | undefined>) {
    return [...new Set(values.map(value => String(value ?? '').trim()).filter(Boolean))]
}
