'use client'

import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Clock3, Copy, Fingerprint, FolderOpen, Loader2, MessageSquareText, Play, Radar, RotateCcw, Search, Send, ShieldCheck, SlidersHorizontal, UserRound, Webhook, XCircle } from 'lucide-react'
import type { DwmAlert, DwmAlertAnalystAction, DwmProductSnapshot } from '@/utils/dwm/product'
import { safeAlertSummary, safeEvidenceExcerpt } from '@/utils/dwm/display'
import { dwmNextOperatorAction, type DwmNextOperatorActionKind } from '@/utils/dwm/nextOperatorAction'
import { DwmWorkflowActions } from './dwm-workflow-actions'

type PortalAlert = DwmAlert & {
    deliveryState?: string
    workflowNote?: string
    assignedOwner?: string
    organizationId?: string
    caseId?: string
    caseIdCandidate?: string
    replayCount?: number
    lastReplayedAt?: string
    savedAt?: string
    deliveredAt?: string
    workflowContext?: {
        organizationId?: string
        watchlistIds?: string[]
        webhookDestinationIds?: string[]
        caseIdCandidate?: string
    }
    webhookContext?: {
        hasWebhookRoute?: boolean
        webhookDestinationIds?: string[]
        caseIdCandidate?: string
    }
    workflowEvents?: Array<{
        id: string
        at: string
        actor?: string
        note?: string
        fromReviewState?: string
        toReviewState?: string
        fromDeliveryState?: string
        toDeliveryState?: string
        fromOwner?: string
        toOwner?: string
    }>
}

type OperationsSnapshot = {
    counts: {
        sourceCount: number
        activeSourceCount: number
        telegramSourceCount: number
        darkwebMetadataSourceCount: number
        captureCount: number
        watchlistMatchCount: number
    }
    latestRun?: {
        status: string
        updatedAt: string
        captureCount: number
        error?: string
    }
    latestCaptures: Array<{
        id: string
        sourceName: string
        family: string
        collectedAt: string
        redactionState: string
        contentHash: string
        safeExcerpt: string
        matchedWatchTerms: string[]
    }>
    sourceHealth: Array<{
        sourceId: string
        sourceName: string
        family: string
        status: string
        lastCollectedAt?: string
        approvedMetadataOnly: boolean
    }>
    zeroAlertExplanation: {
        message: string
    }
}

type DeliveryItem = {
    id: string
    alertId: string
    organizationId?: string
    watchlistId?: string
    webhookDestinationId?: string
    destinationId?: string
    requestId?: string
    auditEventId?: string
    endpointHash: string
    endpointHint?: string
    dedupeKey: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
    errorClass?: string
    attemptCount?: number | null
    nextRetryAt?: string | null
    deliveryKind?: string
}

type PortalProps = {
    tenantId: string
    organizationId?: string
    snapshot: DwmProductSnapshot
    operations: OperationsSnapshot | null
    alerts: PortalAlert[]
    deliveries: DeliveryItem[]
    dataHealth: DwmDataHealth
    initialAlertId?: string
}

type DwmDataHealth = {
    snapshot: DataHealthItem
    operations: DataHealthItem
    alerts: DataHealthItem
    deliveries: DataHealthItem
    usingFallbackAlerts: boolean
}

type DataHealthItem = {
    state: 'live' | 'fallback' | 'missing' | 'error'
    label: string
    detail: string
}

type QueueFilter = 'active' | 'ready' | 'critical' | 'source' | 'high_confidence' | 'fresh' | 'pending_delivery' | 'reviewing' | 'delivered' | 'muted' | 'all'
type InvestigationTab = 'evidence' | 'entities' | 'sources' | 'delivery'
type EvidenceDispositionState = 'reviewed' | 'escalated' | 'suppressed' | 'false_positive'

export function DwmAnalystPortal({ tenantId, organizationId, snapshot, operations, alerts, deliveries, dataHealth, initialAlertId }: PortalProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [selectedId, setSelectedId] = useState(initialAlertId && alerts.some(alert => alert.id === initialAlertId) ? initialAlertId : alerts[0]?.id ?? '')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const [localDeliveries, setLocalDeliveries] = useState<DeliveryItem[]>(deliveries)
    const [localCaseState, setLocalCaseState] = useLocalCaseState()
    const [queueFilter, setQueueFilter] = useState<QueueFilter>(() => normalizeQueueFilter(searchParams.get('filter')))
    const [queueQuery, setQueueQuery] = useState(() => searchParams.get('q')?.slice(0, 120) ?? '')
    const queue = useMemo(() => filterAlerts(orderAlerts(alerts), queueFilter, queueQuery), [alerts, queueFilter, queueQuery])
    const selectedAlert = queue.find(alert => alert.id === selectedId) ?? queue[0]
    const selectedOrganizationId = selectedAlert ? alertOrganizationId(selectedAlert, organizationId) : organizationId
    const visibleQueue = useMemo(() => visibleQueueAlerts(queue, selectedAlert?.id), [queue, selectedAlert?.id])
    const selectedDeliveries = selectedAlert ? localDeliveries.filter(delivery => delivery.alertId === selectedAlert.id) : []
    const criticalCount = alerts.filter(alert => alert.severity === 'critical').length
    const readyCount = alerts.filter(alert => alert.deliveryState === 'ready_to_send').length
    const activeCount = alerts.filter(alert => alert.deliveryState !== 'muted' && alert.reviewState !== 'resolved').length
    const freshCount = alerts.filter(isFreshAlert).length
    const highConfidenceCount = alerts.filter(alert => alert.confidence >= 80).length
    const latestCaptures = operations?.latestCaptures ?? []
    const activeSourceCount = operations?.counts.activeSourceCount ?? 0
    const sourceCount = operations?.counts.sourceCount ?? 0
    const captureCount = operations?.counts.captureCount ?? latestCaptures.length
    const watchlistMatchCount = operations?.counts.watchlistMatchCount ?? 0
    const caseCount = alerts.filter(alert => alert.caseId || alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate || alert.webhookContext?.caseIdCandidate).length
    const latestRunLabel = operations?.latestRun
        ? `${operations.latestRun.captureCount} captures`
        : activeSourceCount
            ? 'collecting'
            : 'source'
    const watchTermCount = snapshot.watchlist.length
    const webhookState = deliverySummaryLabel(localDeliveries)
    const apiProblemCount = [dataHealth.snapshot, dataHealth.operations, dataHealth.alerts, dataHealth.deliveries]
        .filter(item => item.state !== 'live').length + (dataHealth.usingFallbackAlerts ? 1 : 0)
    const workflowTelemetry = {
        activeSourceCount,
        sourceCount,
        captureCount,
        watchlistMatchCount,
        latestRunStatus: operations?.latestRun?.status,
        latestRunCaptureCount: operations?.latestRun?.captureCount,
        alertCount: alerts.length,
        deliveryCount: localDeliveries.length,
    }
    const workflowActions = (
        <DwmWorkflowActions
            tenantId={tenantId}
            organizationId={selectedOrganizationId}
            initialTerms={snapshot.watchlist.map(term => term.value)}
            telemetry={workflowTelemetry}
        />
    )

    useEffect(() => {
        if (queue.length && !queue.some(alert => alert.id === selectedId)) {
            setSelectedId(queue[0].id)
        }
    }, [queue, selectedId])

    useEffect(() => {
        setLocalDeliveries(current => mergeDeliveries(deliveries, current))
    }, [deliveries])

    async function updateAlert(alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) {
        await runAction(`update:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ reviewState, deliveryState, note, assignedOwner, actor: 'dashboard' }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return 'Case updated.'
        })
    }

    async function replayAlert(alertId: string) {
        await runAction(`replay:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}/replay`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ actor: 'dashboard' }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return 'Evidence replay recorded.'
        })
    }

    async function openCase(alert: PortalAlert, assignedOwner?: string, note?: string) {
        await runAction(`case:${alert.id}`, async () => {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({
                    actor: 'dashboard',
                    assignedOwner,
                    note: note?.trim() || 'Case opened from DWM alert.',
                    idempotencyKey: `dashboard-case-handoff:${alert.id}`,
                }, tenantId, alertOrganizationId(alert, organizationId))),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            const caseId = payload.case?.id || payload.alertCaseHandoff?.caseId
            if (caseId) {
                router.push(caseDetailHref(caseId, alert.id, alertOrganizationId(alert, organizationId), 'alert_queue'))
                return `Opening case ${caseId}.`
            }
            return 'Case is ready.'
        })
    }

    async function sendAlert(alertId: string) {
        await runAction(`send:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch('/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            const nextDeliveries = upsertDeliveryRows(payload.deliveries ?? (payload.delivery ? [payload.delivery] : []))
            return deliveryActionMessage(nextDeliveries, payload.attemptedCount, 'Webhook delivery')
        })
    }

    async function testDelivery(alertId: string) {
        await runAction(`test:${alertId}`, async () => {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch('/api/dwm/webhooks/test', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            const nextDeliveries = upsertDeliveryRows(payload.deliveries ?? (payload.delivery ? [payload.delivery] : []))
            return deliveryActionMessage(nextDeliveries, payload.attemptedCount, 'Webhook test')
        })
    }

    function upsertDeliveryRows(rows: DeliveryItem[]) {
        if (!rows.length) return []
        setLocalDeliveries(current => mergeDeliveries(rows, current))
        return rows
    }

    async function runAction(key: string, action: () => Promise<string>) {
        setBusyAction(key)
        setMessage(null)
        try {
            const text = await action()
            setMessage({ ok: true, text })
            router.refresh()
        } catch (error) {
            setMessage({ ok: false, text: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    function selectAlert(alert: PortalAlert) {
        setSelectedId(alert.id)
        router.replace(dwmQueueHref({
            params: searchParams,
            tenantId,
            organizationId: alertOrganizationId(alert, organizationId),
            alertId: alert.id,
            filter: queueFilter,
            query: queueQuery,
        }), { scroll: false })
    }

    function updateQueueFilter(filter: QueueFilter) {
        setQueueFilter(filter)
        router.replace(dwmQueueHref({
            params: searchParams,
            tenantId,
            organizationId: selectedOrganizationId,
            alertId: selectedAlert?.id,
            filter,
            query: queueQuery,
        }), { scroll: false })
    }

    function updateQueueQuery(query: string) {
        setQueueQuery(query)
        router.replace(dwmQueueHref({
            params: searchParams,
            tenantId,
            organizationId: selectedOrganizationId,
            alertId: selectedAlert?.id,
            filter: queueFilter,
            query,
        }), { scroll: false })
    }

    return (
        <div className='grid gap-4'>
            <section className='min-w-0 overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                <div className='border-b border-ui-border bg-ui-raised px-4 py-3 text-ui-text'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                            <StatusPill label='Cases' value={String(alerts.length)} tone={alerts.length ? 'warn' : 'neutral'} />
                            <StatusPill label='Active' value={String(activeCount)} tone={activeCount ? 'warn' : 'neutral'} className='hidden sm:block' />
                            <StatusPill label='Critical' value={String(criticalCount)} tone={criticalCount ? 'warn' : 'neutral'} />
                            <StatusPill label='Ready' value={String(readyCount)} tone={readyCount ? 'good' : 'neutral'} />
                            <StatusPill label='Fresh' value={String(freshCount)} tone={freshCount ? 'good' : 'neutral'} className='hidden sm:block' />
                            <StatusPill label='80%+' value={String(highConfidenceCount)} tone={highConfidenceCount ? 'good' : 'neutral'} className='hidden sm:block' />
                            <StatusPill label='Watchlist' value={`${watchTermCount} terms`} tone={watchTermCount ? 'good' : 'warn'} />
                            <StatusPill label='Webhook' value={webhookState} tone={webhookReady(webhookState) ? 'good' : 'warn'} />
                            <StatusPill label='Latest run' value={latestRunLabel} tone={operations?.latestRun?.status === 'completed' ? 'good' : 'neutral'} />
                            <StatusPill label='API' value={apiProblemCount ? `${apiProblemCount} issue${apiProblemCount === 1 ? '' : 's'}` : 'Live'} tone={apiProblemCount ? 'warn' : 'good'} className='hidden sm:block' />
                        </div>
                        <div className='min-w-0 text-left sm:shrink-0 sm:text-right'>
                            <p className='text-[10px] font-semibold uppercase text-ui-primary'>Monitoring state</p>
                            <p className='mt-1 text-sm font-semibold text-ui-text'>{activeSourceCount}/{sourceCount} sources active</p>
                        </div>
                    </div>
                </div>

                <WorkflowRouteStrip
                    watchTermCount={watchTermCount}
                    activeSourceCount={activeSourceCount}
                    sourceCount={sourceCount}
                    captureCount={captureCount}
                    watchlistMatchCount={watchlistMatchCount}
                    alertCount={alerts.length}
                    caseCount={caseCount}
                    deliveryCount={localDeliveries.length}
                    latestRunLabel={latestRunLabel}
                    webhookState={webhookState}
                />

                <div className='grid min-h-[480px] min-w-0 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]'>
                    <aside className='order-2 min-w-0 border-b border-ui-border bg-ui-raised xl:order-none xl:border-b-0 xl:border-r'>
                        <div className='border-b border-ui-border p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h3 className='text-sm font-semibold text-ui-text'>Recent attacks</h3>
                                    <p className='mt-1 text-xs text-ui-muted'>{alerts.length ? `${visibleQueue.length}/${queue.length} shown after filters.` : 'Collectors are monitoring the saved watchlist.'}</p>
                                </div>
                                <Radar className='h-4 w-4 text-ui-primary' />
                            </div>
                            <div className='mt-4 grid gap-2'>
                                <label className='relative block'>
                                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                                    <input
                                        value={queueQuery}
                                        onChange={event => updateQueueQuery(event.target.value)}
                                        placeholder='Search company, actor, term, or status'
                                        className='h-10 w-full rounded-lg border border-ui-border bg-ui-panel pl-9 pr-3 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                                    />
                                </label>
                                <div className='grid grid-cols-2 gap-1.5'>
                                    {queueFilters.map(filter => (
                                        <button
                                            key={filter.id}
                                            type='button'
                                            onClick={() => updateQueueFilter(filter.id)}
                                            className={`h-8 rounded-lg border px-2 text-xs font-semibold transition ${queueFilter === filter.id ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-canvas'}`}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className='max-h-[610px] overflow-auto p-2'>
                            {queue.length ? visibleQueue.map(alert => (
                                <button
                                    key={alert.id}
                                    type='button'
                                    onClick={() => selectAlert(alert)}
                                    className={`w-full rounded-lg border p-3 text-left transition ${selectedAlert?.id === alert.id ? 'border-ui-primary bg-ui-panel shadow-sm' : 'border-transparent hover:border-ui-border hover:bg-ui-panel'}`}
                                >
                                    <div className='flex items-center justify-between gap-2'>
                                        <span className='truncate text-sm font-semibold text-ui-text'>{alert.company}</span>
                                        <span className={severityClass(alert.severity)}>{alert.severity}</span>
                                    </div>
                                    <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{alert.matchedTerm.value}</p>
                                    <div className='mt-3 grid grid-cols-2 gap-2 text-[11px]'>
                                        <QueueCell label='path' value={stateLabel(alert.routingContext?.queue || alert.webhookDelivery.recommendedRoute)} />
                                        <QueueCell label='urgency' value={stateLabel(alert.routingContext?.urgency || (alert.severity === 'critical' ? 'immediate' : 'same_day'))} tone={alert.routingContext?.urgency === 'immediate' || alert.severity === 'critical' ? 'bad' : 'neutral'} />
                                        <QueueCell label='evidence' value={`${alert.evidenceSummary?.evidenceCount ?? alert.evidence.length}`} />
                                        <QueueCell label='last seen' value={relativeTimeLabel(alert.lastSeenAt || alert.evidenceSummary?.lastObservedAt || alert.firstSeenAt)} />
                                    </div>
                                    <p className='mt-3 line-clamp-2 text-xs leading-5 text-ui-muted'>{safeAlertSummary(alert)}</p>
                                </button>
                            )) : (
                                <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-4 text-sm leading-6 text-ui-muted'>
                                    {alerts.length ? 'No attacks match the current filters.' : 'No recent attacks. Monitoring stays live while watchlist terms listen for new captures.'}
                                </div>
                            )}
                            {queue.length > visibleQueue.length && (
                                <p className='px-2 py-1 text-xs leading-5 text-ui-muted'>Narrow the search or filters to see more matching attacks.</p>
                            )}
                        </div>
                    </aside>

                    <main className='order-1 min-w-0 bg-ui-panel xl:order-none'>
                        {selectedAlert ? (
                            <CaseWorkspace
                                alert={selectedAlert}
                                deliveries={selectedDeliveries}
                                sourceCoverage={snapshot.sourceCoverage}
                                sourceHealth={operations?.sourceHealth ?? []}
                                localState={localCaseState[selectedAlert.id]}
                                busyAction={busyAction}
                                actionMessage={message}
                                onLocalStateChange={(patch) => {
                                    setLocalCaseState(current => ({
                                        ...current,
                                        [selectedAlert.id]: { ...(current[selectedAlert.id] ?? {}), ...patch },
                                    }))
                                }}
                                onUpdate={updateAlert}
                                onOpenCase={openCase}
                                onReplay={replayAlert}
                                onTest={testDelivery}
                                onSend={sendAlert}
                            />
                        ) : (
                            <NoCaseWorkspace latestCaptures={latestCaptures} workflowActions={workflowActions} />
                        )}
                    </main>

                    <aside className='order-3 min-w-0 border-t border-ui-border bg-ui-raised xl:col-span-2 xl:order-none 2xl:col-span-1 2xl:border-l 2xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <SourcePosture snapshot={snapshot} operations={operations} />
                            <DeliveryPanel alert={selectedAlert} deliveries={localDeliveries} />
                            <ActorPanel snapshot={snapshot} />
                        </div>
                    </aside>
                </div>
            </section>

            {selectedAlert ? (
                <section id='dwm-workflow-actions' className='scroll-mt-24 overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-dwm-selected-workflow-actions>
                    <div className='flex flex-col gap-1 border-b border-ui-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                        <h2 className='text-sm font-semibold text-ui-text'>Route controls</h2>
                        <p className='text-xs font-medium text-ui-muted'>Watchlist, source pack, case, and webhook actions</p>
                    </div>
                    <div className='p-3'>
                        {workflowActions}
                    </div>
                </section>
            ) : null}
        </div>
    )
}

function alertOrganizationId(alert: PortalAlert, fallback?: string) {
    return alert.organizationId || alert.workflowContext?.organizationId || fallback
}

function normalizeQueueFilter(value: string | null): QueueFilter {
    return queueFilters.some(filter => filter.id === value) ? value as QueueFilter : 'active'
}

function dwmQueueHref(input: { params: URLSearchParams, tenantId: string, organizationId?: string, alertId?: string, filter: QueueFilter, query: string }) {
    const nextParams = new URLSearchParams(input.params.toString())
    nextParams.set('tenantId', input.tenantId)
    if (input.organizationId) {
        nextParams.set('organizationId', input.organizationId)
    } else {
        nextParams.delete('organizationId')
    }
    if (input.alertId) {
        nextParams.set('alert', input.alertId)
    } else {
        nextParams.delete('alert')
    }
    if (input.filter !== 'active') {
        nextParams.set('filter', input.filter)
    } else {
        nextParams.delete('filter')
    }
    const query = input.query.trim()
    if (query) {
        nextParams.set('q', query.slice(0, 120))
    } else {
        nextParams.delete('q')
    }
    return `/dashboard/dwm?${nextParams.toString()}`
}

function scopeBody<T extends Record<string, unknown>>(body: T, tenantId: string, organizationId?: string) {
    return organizationId ? { ...body, tenantId, organizationId } : { ...body, tenantId }
}

function WorkflowRouteStrip({ watchTermCount, activeSourceCount, sourceCount, captureCount, watchlistMatchCount, alertCount, caseCount, deliveryCount, latestRunLabel, webhookState }: {
    watchTermCount: number
    activeSourceCount: number
    sourceCount: number
    captureCount: number
    watchlistMatchCount: number
    alertCount: number
    caseCount: number
    deliveryCount: number
    latestRunLabel: string
    webhookState: string
}) {
    const cells = [
        { label: 'Watchlist', value: `${watchTermCount}`, detail: watchTermCount ? 'terms scoped' : 'add terms', tone: watchTermCount ? 'ready' : 'blocked' },
        { label: 'Sources', value: `${activeSourceCount}/${sourceCount}`, detail: sourceCount ? 'active coverage' : 'load source pack', tone: activeSourceCount ? 'ready' : 'blocked' },
        { label: 'Captures', value: `${captureCount}`, detail: latestRunLabel, tone: captureCount ? 'ready' : 'waiting' },
        { label: 'Matches', value: `${watchlistMatchCount}`, detail: alertCount ? `${alertCount} alerts` : 'watching', tone: alertCount ? 'ready' : 'waiting' },
        { label: 'Cases', value: `${caseCount}`, detail: caseCount ? 'linked' : 'open from alert', tone: caseCount ? 'ready' : alertCount ? 'waiting' : 'blocked' },
        { label: 'Delivery', value: deliveryCount ? `${deliveryCount}` : webhookState, detail: deliveryCount ? 'attempts' : 'test route', tone: deliveryCount || webhookReady(webhookState) ? 'ready' : 'waiting' },
    ] as const

    return (
        <section data-dwm-workflow-snapshot className='border-b border-ui-border bg-ui-raised'>
            <div className='flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Workflow route</p>
                    <p className='mt-1 text-sm font-semibold text-ui-text'>Watchlist to source, alert, case, and delivery.</p>
                </div>
                <span className='rounded-lg border border-ui-border bg-ui-panel px-3 py-1.5 text-xs font-semibold text-ui-muted'>
                    {alertCount} alerts · {caseCount} cases · {deliveryCount ? `${deliveryCount} deliveries` : webhookState}
                </span>
            </div>
            <div className='border-t border-ui-border px-4 py-3'>
                <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
                    <p className='text-xs leading-5 text-ui-muted'>Use this path when a source match needs to become a customer case and delivery.</p>
                    <a href='#dwm-workflow-actions' className='inline-flex h-8 items-center rounded-lg border border-ui-primary bg-ui-primary/10 px-3 text-xs font-semibold text-ui-primary transition hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                        Run path
                    </a>
                </div>
                <div className='grid grid-cols-2 gap-2 lg:grid-cols-3 2xl:grid-cols-6'>
                    {cells.map(cell => (
                        <div key={cell.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
                            <div className='flex items-center justify-between gap-2'>
                                <p className='truncate text-[10px] font-semibold uppercase text-ui-muted'>{cell.label}</p>
                                <span className={`h-2 w-2 shrink-0 rounded-full ${cell.tone === 'ready' ? 'bg-ui-success' : cell.tone === 'blocked' ? 'bg-ui-warning' : 'bg-ui-primary'}`} />
                            </div>
                            <div className='mt-2 flex min-w-0 items-end justify-between gap-2'>
                                <p className='truncate text-lg font-semibold text-ui-text' title={cell.value}>{cell.value}</p>
                                <p className='truncate pb-0.5 text-xs text-ui-muted' title={cell.detail}>{cell.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

function CaseWorkspace({ alert, deliveries, sourceCoverage, sourceHealth, localState, busyAction, actionMessage, onLocalStateChange, onUpdate, onOpenCase, onReplay, onTest, onSend }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    sourceCoverage: DwmProductSnapshot['sourceCoverage']
    sourceHealth: OperationsSnapshot['sourceHealth']
    localState?: LocalCaseState
    busyAction: string | null
    actionMessage: { ok: boolean, text: string } | null
    onLocalStateChange: (patch: LocalCaseState) => void
    onUpdate: (alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) => Promise<void>
    onOpenCase: (alert: PortalAlert, assignedOwner?: string, note?: string) => Promise<void>
    onReplay: (alertId: string) => Promise<void>
    onTest: (alertId: string) => Promise<void>
    onSend: (alertId: string) => Promise<void>
}) {
    const analystNote = localState?.note ?? ''
    const assignee = localState?.assignee ?? alert.assignedOwner ?? 'Unassigned'
    const persistedOwner = assignee === 'Unassigned' ? undefined : assignee
    const evidenceSummary = alert.evidenceSummary ?? fallbackEvidenceSummary(alert)
    const routingContext = alert.routingContext ?? fallbackRoutingContext(alert)
    const workflowContext = selectedWorkflowContext(alert, deliveries)
    const matchContext = alert.matchContext ?? {
        normalizedTerm: alert.matchedTerm.value.toLowerCase(),
        termKind: alert.matchedTerm.kind,
        matchType: 'case_insensitive_substring' as const,
        matchedFieldHints: [],
    }
    const sourceFamilies = Array.from(new Set(alert.evidence.map(item => item.sourceFamily)))
    const [sourceFilter, setSourceFilter] = useState('all')
    const [investigationTab, setInvestigationTab] = useState<InvestigationTab>('evidence')
    const entities = buildExposureEntities(alert, evidenceSummary, workflowContext, routingContext)
    const [selectedEntityKey, setSelectedEntityKey] = useState('')
    const selectedEntity = entities.find(entity => entity.key === selectedEntityKey)
    const sourceFilteredEvidence = sourceFilter === 'all' ? alert.evidence : alert.evidence.filter(item => item.sourceFamily === sourceFilter)
    const entityFilteredEvidence = selectedEntity ? sourceFilteredEvidence.filter(item => evidenceMatchesEntity(item, selectedEntity)) : sourceFilteredEvidence
    const visibleEvidence = entityFilteredEvidence.length ? entityFilteredEvidence : sourceFilteredEvidence
    const [selectedEvidenceId, setSelectedEvidenceId] = useState(alert.evidence[0]?.id ?? '')
    const selectedEvidence = alert.evidence.find(item => item.id === selectedEvidenceId) ?? visibleEvidence[0] ?? alert.evidence[0]
    const [copiedHash, setCopiedHash] = useState('')
    const evidenceDispositions = localState?.evidenceDispositions ?? {}
    const analystBrief = buildAnalystBrief(alert, evidenceSummary, routingContext, workflowContext)
    const caseHref = workflowContext.caseId ? caseDetailHref(workflowContext.caseId, alert.id, workflowContext.organizationId, 'alert_queue') : undefined
    const timeline = buildTimeline(alert, deliveries, {
        localState,
        selectedEvidence,
        selectedEntity,
        sourceFilter,
        actionMessage,
    })
    async function copyHash(value: string) {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedHash(value)
        } catch {
            setCopiedHash('')
        }
    }
    return (
        <div className='grid max-w-full min-w-0 gap-5 overflow-hidden p-4 sm:p-5'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center'>
                        <span className={severityClass(alert.severity)}>{alert.severity}</span>
                        <span className='min-w-0 rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'>{alert.confidence}% confidence</span>
                        <span className='min-w-0 rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-muted'>{stateLabel(alert.reviewState)}</span>
                        <span className='min-w-0 rounded-full bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-muted'>{stateLabel(alert.deliveryState || 'pending_review')}</span>
                    </div>
                    <h2 className='mt-3 wrap-break-word text-2xl font-semibold tracking-normal text-ui-text'>{alert.company}</h2>
                    <p className='mt-1 wrap-break-word text-sm leading-6 text-ui-muted'>
                        Matched <span className='font-mono'>{alert.matchedTerm.value}</span>
                        <span className='block sm:inline'> from {stateLabel(alert.sourceFamily)} · {stateLabel(alert.artifactType)}</span>
                    </p>
                </div>
            </div>

            <AnalystBriefPanel brief={analystBrief} />

            <WorkflowSpine
                alert={alert}
                deliveries={deliveries}
                workflowContext={workflowContext}
                evidenceSummary={evidenceSummary}
                busyAction={busyAction}
                note={analystNote}
                assignee={persistedOwner}
                onOpenCase={onOpenCase}
            />

            <SelectedActionBar
                alert={alert}
                deliveries={deliveries}
                assignee={assignee}
                busyAction={busyAction}
                actionMessage={actionMessage}
                onUpdate={onUpdate}
                onOpenCase={() => onOpenCase(alert, persistedOwner, analystNote)}
                onReplay={onReplay}
                onTest={onTest}
                onSend={onSend}
            />

            <SelectedContextBar
                alert={alert}
                selectedEvidence={selectedEvidence}
                selectedEntity={selectedEntity}
                sourceFilter={sourceFilter}
                workflowContext={workflowContext}
                copiedHash={copiedHash}
                onCopyHash={copyHash}
            />

            <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 sm:grid-cols-2 xl:grid-cols-5'>
                <ContextChip label='Organization' value={workflowContext.organizationId || 'tenant default'} href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} />
                <ContextChip label='Watched terms' value={workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} scoped` : stateLabel(alert.matchedTerm.kind)} href='/organizations' />
                <ContextChip label='Case' value={workflowContext.caseId || 'case is being prepared'} href={caseHref} />
                <ContextChip label='Delivery' value={workflowContext.lastDelivery ? `${stateLabel(workflowContext.lastDelivery.status)} · ${relativeTimeLabel(workflowContext.lastDelivery.attemptedAt)}` : workflowContext.hasWebhookRoute ? 'delivery configured' : 'checking delivery'} />
                <ContextChip label='Source type' value={`${stateLabel(alert.sourceFamily)} · ${alert.sourceCount}`} />
            </section>

            <section className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                <div className='grid gap-0 md:grid-cols-4'>
                    <CaseMetric label='Recommended path' value={stateLabel(routingContext.queue)} detail={stateLabel(routingContext.urgency)} tone={routingContext.urgency === 'immediate' ? 'bad' : routingContext.urgency === 'same_day' ? 'warn' : 'neutral'} />
                    <CaseMetric label='Evidence' value={`${evidenceSummary.evidenceCount}`} detail={`${evidenceSummary.publicSafeCount} redacted · ${evidenceSummary.metadataOnlyCount} metadata`} />
                    <CaseMetric label='First seen' value={shortTime(evidenceSummary.firstObservedAt)} detail={relativeTimeLabel(evidenceSummary.firstObservedAt)} />
                    <CaseMetric label='Last seen' value={shortTime(evidenceSummary.lastObservedAt)} detail={relativeTimeLabel(evidenceSummary.lastObservedAt)} />
                </div>
                <div className='grid gap-4 border-t border-ui-border bg-ui-raised p-4 lg:grid-cols-[0.8fr_1.2fr]'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-ui-muted'>Why this matched</p>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <span className='rounded-full bg-ui-panel px-2 py-1 font-mono text-xs font-semibold text-ui-text'>{matchContext.normalizedTerm}</span>
                            <span className='rounded-full bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>{stateLabel(matchContext.termKind)}</span>
                            <span className='rounded-full bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-muted'>{matchContext.matchedFieldHints.length ? matchContext.matchedFieldHints.join(', ') : stateLabel(matchContext.matchType)}</span>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {Object.entries(evidenceSummary.sourceFamilyCounts).map(([family, count]) => (
                                <span key={family} className='rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-xs font-semibold text-ui-text'>{stateLabel(family)}: {count}</span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className='text-xs font-semibold uppercase text-ui-muted'>Why this matters</p>
                        <p className='mt-2 text-sm leading-6 text-ui-muted'>{routingContext.reason}</p>
                        <p className='mt-1 text-xs font-semibold text-ui-muted'>Customer-safe evidence: {stateLabel(routingContext.customerVisibleEvidence)} · Alert key {alert.webhookDelivery.dedupeKey}</p>
                    </div>
                </div>
            </section>

            <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4 lg:grid-cols-[0.55fr_1fr_auto] lg:items-end'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                        <UserRound className='h-4 w-4 text-ui-primary' />
                        Owner
                    </span>
                    <input
                        value={assignee === 'Unassigned' ? '' : assignee}
                        onChange={event => onLocalStateChange({ assignee: event.target.value.trim() || 'Unassigned' })}
                        placeholder='Assign owner'
                        className='h-10 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                    <span className='text-[11px] text-ui-muted'>Saved to the shared case when you save the note or decision.</span>
                </label>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                        <MessageSquareText className='h-4 w-4 text-ui-primary' />
                        Decision note
                    </span>
                    <textarea
                        value={analystNote}
                        onChange={event => onLocalStateChange({ note: event.target.value })}
                        placeholder='What was checked, who owns follow-up, and why this was escalated, suppressed, or closed'
                        className='min-h-20 resize-y rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-text outline-none transition focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                    />
                </label>
                <CaseButton
                    busy={busyAction === `update:${alert.id}`}
                    icon='ready'
                    onClick={() => onUpdate(alert.id, alert.reviewState, alert.deliveryState || 'pending_review', analystNote.trim() || 'Analyst rationale saved.', persistedOwner)}
                >
                    Save note
                </CaseButton>
            </section>

            <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4 md:grid-cols-2'>
                <CaseBrief label='What happened' value={safeAlertSummary(alert)} />
                <CaseBrief label='Next action' value={alert.recommendedAction} />
                {alert.workflowNote && <CaseBrief label='Latest note' value={alert.workflowNote} />}
                <CaseBrief label='Delivery path' value={`${stateLabel(alert.webhookDelivery.recommendedRoute)} · ${alert.webhookDelivery.dedupeKey}`} />
            </section>

            <InvestigationTabs active={investigationTab} onChange={setInvestigationTab} />

            {investigationTab === 'evidence' && (
                <section className='grid gap-4'>
                    <EvidenceDispositionQueue
                        alert={alert}
                        visibleEvidence={visibleEvidence}
                        selectedEvidence={selectedEvidence}
                        selectedEntity={selectedEntity}
                        workflowContext={workflowContext}
                        dispositions={evidenceDispositions}
                        copiedHash={copiedHash}
                        onSelectEvidence={setSelectedEvidenceId}
                        onCopyHash={copyHash}
                        onDisposition={(evidenceId, state) => {
                            onLocalStateChange({
                                evidenceDispositions: {
                                    ...evidenceDispositions,
                                    [evidenceId]: { state, at: new Date().toISOString() },
                                },
                            })
                        }}
                    />
                    <section className='grid gap-4 lg:grid-cols-[1fr_0.82fr]'>
                        <SourceProvenancePanel
                            alert={alert}
                            sourceFamilies={sourceFamilies}
                            sourceFilter={sourceFilter}
                            selectedEvidence={selectedEvidence}
                            selectedEntity={selectedEntity}
                            visibleEvidence={visibleEvidence}
                            copiedHash={copiedHash}
                            onSourceFilter={setSourceFilter}
                            onSelectEvidence={setSelectedEvidenceId}
                            onCopyHash={copyHash}
                        />
                        <div className='grid gap-4'>
                            <RouteWatchlistImpactRail alert={alert} selectedEvidence={selectedEvidence} selectedEntity={selectedEntity} workflowContext={workflowContext} dispositions={evidenceDispositions} />
                            <DeliveryCaseActivityRail alert={alert} deliveries={deliveries} timeline={timeline} workflowContext={workflowContext} />
                        </div>
                    </section>
                </section>
            )}

            {investigationTab === 'entities' && (
                <section className='grid gap-4 lg:grid-cols-[1fr_0.82fr]'>
                    <ExposureEntitiesPanel
                        entities={entities}
                        selectedEntityKey={selectedEntityKey}
                        workflowContext={workflowContext}
                        onSelectEntity={(key) => {
                            const entity = entities.find(row => row.key === key)
                            setSelectedEntityKey(key)
                            const nextEvidence = entity ? alert.evidence.find(item => evidenceMatchesEntity(item, entity)) : undefined
                            if (nextEvidence) setSelectedEvidenceId(nextEvidence.id)
                            setInvestigationTab('evidence')
                        }}
                    />
                    <SourceProvenancePanel
                        alert={alert}
                        sourceFamilies={sourceFamilies}
                        sourceFilter={sourceFilter}
                        selectedEvidence={selectedEvidence}
                        selectedEntity={selectedEntity}
                        visibleEvidence={visibleEvidence}
                        copiedHash={copiedHash}
                        onSourceFilter={setSourceFilter}
                        onSelectEvidence={setSelectedEvidenceId}
                        onCopyHash={copyHash}
                    />
                </section>
            )}

            {investigationTab === 'sources' && (
                <section className='grid gap-4'>
                    <SourceCoverageStrip
                        evidenceSummary={evidenceSummary}
                        sourceCoverage={sourceCoverage}
                        sourceHealth={sourceHealth}
                        sourceFilter={sourceFilter}
                        onSourceFilter={(value) => {
                            setSourceFilter(value)
                            setInvestigationTab('evidence')
                        }}
                    />
                    <SourceProvenancePanel
                        alert={alert}
                        sourceFamilies={sourceFamilies}
                        sourceFilter={sourceFilter}
                        selectedEvidence={selectedEvidence}
                        selectedEntity={selectedEntity}
                        visibleEvidence={visibleEvidence}
                        copiedHash={copiedHash}
                        onSourceFilter={setSourceFilter}
                        onSelectEvidence={setSelectedEvidenceId}
                        onCopyHash={copyHash}
                    />
                </section>
            )}

            {investigationTab === 'delivery' && (
                <section className='grid gap-4 lg:grid-cols-[0.9fr_1.1fr]'>
                    <DeliveryCaseActivityRail alert={alert} deliveries={deliveries} timeline={timeline} workflowContext={workflowContext} />
                    <SourceProvenancePanel
                        alert={alert}
                        sourceFamilies={sourceFamilies}
                        sourceFilter={sourceFilter}
                        selectedEvidence={selectedEvidence}
                        selectedEntity={selectedEntity}
                        visibleEvidence={visibleEvidence}
                        copiedHash={copiedHash}
                        onSourceFilter={setSourceFilter}
                        onSelectEvidence={setSelectedEvidenceId}
                        onCopyHash={copyHash}
                    />
                </section>
            )}
        </div>
    )
}

function AnalystBriefPanel({ brief }: { brief: ReturnType<typeof buildAnalystBrief> }) {
    return (
        <section data-dwm-analyst-brief className='grid gap-4 rounded-lg border border-ui-border bg-ui-raised p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Analyst brief</p>
                    <h3 className='mt-1 wrap-break-word text-xl font-semibold tracking-normal text-ui-text'>{brief.headline}</h3>
                </div>
                <span className={brief.readyForCustomer ? 'rounded-full border border-ui-success/35 bg-ui-success/10 px-3 py-1 text-xs font-semibold text-ui-success' : 'rounded-full border border-ui-warning/35 bg-ui-warning/10 px-3 py-1 text-xs font-semibold text-ui-warning'}>
                    {brief.readyForCustomer ? 'Customer-ready after review' : 'Review before customer update'}
                </span>
            </div>
            <div className='grid gap-3 lg:grid-cols-3'>
                <BriefStep label='What happened' value={brief.whatHappened} />
                <BriefStep label='Why it matters' value={brief.whyItMatters} />
                <BriefStep label='What to do next' value={brief.nextAction} />
            </div>
            <div className='grid gap-3 border-t border-ui-border pt-3 md:grid-cols-3'>
                <BriefFact label='Evidence boundary' value={brief.evidenceBoundary} />
                <BriefFact label='Source records' value={brief.sourceRecords} />
                <BriefFact label='Action status' value={brief.workflowReadiness} />
            </div>
        </section>
    )
}

function BriefStep({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-2 line-clamp-4 text-sm leading-6 text-ui-text'>{value}</p>
        </div>
    )
}

function BriefFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 text-sm leading-6 text-ui-muted'>{value}</p>
        </div>
    )
}

function WorkflowSpine({ alert, deliveries, workflowContext, evidenceSummary, busyAction, note, assignee, onOpenCase }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    workflowContext: ReturnType<typeof selectedWorkflowContext>
    evidenceSummary: NonNullable<PortalAlert['evidenceSummary']>
    busyAction: string | null
    note: string
    assignee?: string
    onOpenCase: (alert: PortalAlert, assignedOwner?: string, note?: string) => Promise<void>
}) {
    const latestDelivery = [...deliveries].sort((first, second) => second.attemptedAt.localeCompare(first.attemptedAt))[0]
    const actualCaseId = alert.caseId
    const caseCandidate = alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate || alert.webhookContext?.caseIdCandidate
    const casePath = actualCaseId ? caseDetailHref(actualCaseId, alert.id, workflowContext.organizationId, 'alert_queue') : alert.sourceHandoffReadiness?.analystWorkflowConsumer?.actionReadiness?.actions?.find(action => action.action === 'case_link' && action.casePath)?.casePath
    const canOpenCase = Boolean(alert.id && alert.evidence?.some(item => item.id || item.provenance?.captureId))
    const routeControlLabel = actualCaseId
        ? latestDelivery
            ? 'Route controls'
            : 'Test delivery'
        : canOpenCase
            ? 'Open case'
            : 'Run route'
    const steps: WorkflowStepModel[] = [
        {
            id: 'watchlist',
            label: 'Watchlist',
            value: alert.matchedTerm.value,
            detail: `${stateLabel(alert.matchedTerm.kind)} · ${workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} scoped list${workflowContext.watchlistIds.length === 1 ? '' : 's'}` : 'default scope'}`,
            state: 'ready',
            href: workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations',
        },
        {
            id: 'source-match',
            label: 'Source match',
            value: `${evidenceSummary.evidenceCount} evidence row${evidenceSummary.evidenceCount === 1 ? '' : 's'}`,
            detail: `${stateLabel(alert.sourceFamily)} · newest ${relativeTimeLabel(evidenceSummary.lastObservedAt || alert.lastSeenAt || alert.firstSeenAt)}`,
            state: evidenceSummary.evidenceCount ? 'ready' : 'blocked',
        },
        {
            id: 'alert',
            label: 'Action status',
            value: stateLabel(alert.reviewState),
            detail: `${stateLabel(alert.severity)} · ${stateLabel(alert.deliveryState || 'pending_review')}`,
            state: alert.deliveryState === 'muted' || alert.reviewState === 'false_positive' ? 'blocked' : 'ready',
        },
        {
            id: 'case',
            label: 'Case',
            value: actualCaseId || caseCandidate || 'not opened',
            detail: actualCaseId ? 'Case file is linked to this alert.' : canOpenCase ? 'Open the case to preserve analyst work.' : 'Evidence is required before case handoff.',
            state: actualCaseId ? 'ready' : canOpenCase ? 'action' : 'blocked',
            action: actualCaseId || !canOpenCase ? undefined : {
                label: 'Open case',
                busy: busyAction === `case:${alert.id}`,
                onClick: () => onOpenCase(alert, assignee, note),
            },
            href: casePath,
        },
        {
            id: 'delivery',
            label: 'Webhook',
            value: latestDelivery ? stateLabel(latestDelivery.status) : workflowContext.hasWebhookRoute ? 'ready to test' : 'not configured',
            detail: latestDelivery ? `${relativeTimeLabel(latestDelivery.attemptedAt)} · ${latestDelivery.endpointHash}` : workflowContext.webhookDestinationIds.length ? `${workflowContext.webhookDestinationIds.length} destination${workflowContext.webhookDestinationIds.length === 1 ? '' : 's'}` : 'Add or test a destination before sending.',
            state: latestDelivery?.status === 'delivered' || latestDelivery?.status === 'dry_run' ? 'ready' : workflowContext.hasWebhookRoute ? 'action' : 'blocked',
        },
        {
            id: 'audit',
            label: 'Audit trail',
            value: `${(alert.workflowEvents?.length ?? 0) + deliveries.length} event${(alert.workflowEvents?.length ?? 0) + deliveries.length === 1 ? '' : 's'}`,
            detail: alert.replayCount ? `${alert.replayCount} replay${alert.replayCount === 1 ? '' : 's'} recorded` : 'Timeline updates after case, replay, and delivery actions.',
            state: (alert.workflowEvents?.length || deliveries.length || alert.replayCount) ? 'ready' : 'action',
        },
    ]

    return (
        <section data-dwm-workflow-spine className='rounded-lg border border-ui-border bg-ui-raised'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-primary'>Workflow</p>
                    <h3 className='mt-0.5 text-base font-semibold text-ui-text'>Watchlist match to customer handoff</h3>
                </div>
                <a href='#dwm-workflow-actions' className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                    {routeControlLabel}
                </a>
            </div>
            <div className='grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-6'>
                {steps.map((step, index) => (
                    <WorkflowSpineStep key={step.id} step={step} index={index + 1} />
                ))}
            </div>
        </section>
    )
}

type WorkflowStepModel = {
    id: string
    label: string
    value: string
    detail: string
    state: 'ready' | 'action' | 'blocked'
    href?: string
    action?: {
        label: string
        busy: boolean
        onClick: () => void
    }
}

function WorkflowSpineStep({ step, index }: { step: WorkflowStepModel, index: number }) {
    const toneClass = step.state === 'ready'
        ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
        : step.state === 'action'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    const body = (
        <div className='min-h-[136px] rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center justify-between gap-2'>
                <span className='grid h-7 w-7 place-items-center rounded-full border border-ui-border bg-ui-raised text-xs font-semibold text-ui-text'>{index}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClass}`}>{step.state}</span>
            </div>
            <p className='mt-3 text-[10px] font-semibold uppercase text-ui-muted'>{step.label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-ui-text' title={step.value}>{step.value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted'>{step.detail}</p>
            {step.action ? (
                <button type='button' disabled={step.action.busy} onClick={(event) => { event.preventDefault(); step.action?.onClick() }} className='mt-3 inline-flex h-8 items-center rounded-lg border border-ui-primary bg-ui-primary/10 px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-primary/15 disabled:cursor-not-allowed disabled:opacity-60'>
                    {step.action.busy ? 'Opening' : step.action.label}
                </button>
            ) : null}
        </div>
    )
    if (step.href && !step.action) {
        return <a href={step.href} className='block rounded-lg focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>{body}</a>
    }
    return body
}

function InvestigationTabs({ active, onChange }: { active: InvestigationTab, onChange: (tab: InvestigationTab) => void }) {
    const tabs: Array<{ id: InvestigationTab, label: string }> = [
        { id: 'evidence', label: 'Evidence' },
        { id: 'entities', label: 'Entities' },
        { id: 'sources', label: 'Sources' },
        { id: 'delivery', label: 'Delivery and case' },
    ]
    return (
        <div className='flex gap-2 overflow-x-auto rounded-lg border border-ui-border bg-ui-raised p-2'>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    type='button'
                    onClick={() => onChange(tab.id)}
                    className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${active === tab.id ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-canvas'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    )
}

function SourceCoverageStrip({ evidenceSummary, sourceCoverage, sourceHealth, sourceFilter, onSourceFilter }: {
    evidenceSummary: NonNullable<PortalAlert['evidenceSummary']>
    sourceCoverage: DwmProductSnapshot['sourceCoverage']
    sourceHealth: OperationsSnapshot['sourceHealth']
    sourceFilter: string
    onSourceFilter: (value: string) => void
}) {
    const rows = sourceCoverage.map(source => {
        const healthRows = sourceHealth.filter(item => item.family === source.family)
        const newest = healthRows
            .map(item => item.lastCollectedAt)
            .filter(Boolean)
            .sort()
            .at(-1)
        return {
            family: source.family,
            label: source.label,
            activeCount: source.activeCount,
            sourceCount: source.sourceCount,
            health: source.health,
            evidenceCount: evidenceSummary.sourceFamilyCounts[source.family] ?? 0,
            newest,
        }
    })
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Source coverage</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Coverage, newest pull, and evidence count for this case.</p>
                </div>
                <button type='button' onClick={() => onSourceFilter('all')} className={`h-8 rounded-lg border px-3 text-xs font-semibold transition ${sourceFilter === 'all' ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-canvas'}`}>
                    All sources
                </button>
            </div>
            <div className='grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-5'>
                {rows.map(row => (
                    <button
                        key={row.family}
                        type='button'
                        onClick={() => onSourceFilter(row.family)}
                        className={`min-w-0 rounded-lg border p-3 text-left transition ${sourceFilter === row.family ? 'border-ui-primary bg-ui-raised' : 'border-ui-border bg-ui-raised hover:border-ui-border'}`}
                    >
                        <div className='flex items-center justify-between gap-2'>
                            <span className='truncate text-sm font-semibold text-ui-text' title={row.label}>{row.label}</span>
                            <span className={row.health === 'healthy' ? 'rounded-full bg-ui-success/10 px-2 py-0.5 text-[11px] font-semibold text-ui-success' : 'rounded-full bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning'}>
                                {stateLabel(row.health)}
                            </span>
                        </div>
                        <div className='mt-3 grid grid-cols-3 gap-2 text-[11px]'>
                            <QueueCell label='active' value={`${row.activeCount}/${row.sourceCount}`} />
                            <QueueCell label='evidence' value={`${row.evidenceCount}`} />
                            <QueueCell label='newest' value={row.newest ? relativeTimeLabel(row.newest) : 'none'} />
                        </div>
                    </button>
                ))}
            </div>
        </section>
    )
}

function ExposureEntitiesPanel({ entities, selectedEntityKey, workflowContext, onSelectEntity }: {
    entities: ReturnType<typeof buildExposureEntities>
    selectedEntityKey: string
    workflowContext: ReturnType<typeof selectedWorkflowContext>
    onSelectEntity: (key: string) => void
}) {
    return (
        <section className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Watched entities</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{entities.length} watched item{entities.length === 1 ? '' : 's'} tied to this case.</p>
                </div>
                <a href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas'>
                    Open organization
                </a>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[760px] text-left text-xs'>
                    <thead className='bg-ui-raised text-[10px] uppercase text-ui-muted'>
                        <tr>
                            <th className='px-4 py-2 font-semibold'>Entity</th>
                            <th className='px-4 py-2 font-semibold'>Kind</th>
                            <th className='px-4 py-2 font-semibold'>Evidence</th>
                            <th className='px-4 py-2 font-semibold'>Sources</th>
                            <th className='px-4 py-2 font-semibold'>Newest</th>
                            <th className='px-4 py-2 font-semibold'>Confidence</th>
                            <th className='px-4 py-2 font-semibold'>Next</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border'>
                        {entities.map(entity => (
                            <tr key={entity.key} onClick={() => onSelectEntity(entity.key)} className={`cursor-pointer align-top transition hover:bg-ui-raised ${selectedEntityKey === entity.key ? 'bg-ui-raised' : 'bg-ui-panel'}`}>
                                <td className='px-4 py-3'>
                                    <p className='font-semibold text-ui-text'>{entity.name}</p>
                                    <p className='mt-0.5 text-[11px] text-ui-muted'>{entity.scope}</p>
                                </td>
                                <td className='px-4 py-3 font-semibold text-ui-muted'>{stateLabel(entity.kind)}</td>
                                <td className='px-4 py-3 font-semibold text-ui-muted'>{entity.evidenceCount}</td>
                                <td className='px-4 py-3'>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {entity.sourceFamilies.map(family => <span key={family} className='rounded-full bg-ui-primary/10 px-2 py-0.5 font-semibold text-ui-primary'>{stateLabel(family)}</span>)}
                                    </div>
                                </td>
                                <td className='px-4 py-3 font-semibold text-ui-muted'>{relativeTimeLabel(entity.newestAt)}</td>
                                <td className='px-4 py-3 font-semibold text-ui-muted'>{entity.confidence}%</td>
                                <td className='px-4 py-3'>
                                    <button type='button' onClick={(event) => { event.stopPropagation(); onSelectEntity(entity.key) }} className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas'>
                                        Review
                                    </button>
                                    <p className='mt-1 text-[11px] text-ui-muted'>{entity.nextAction}</p>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

function SourceProvenancePanel({ alert, sourceFamilies, sourceFilter, selectedEvidence, selectedEntity, visibleEvidence, copiedHash, onSourceFilter, onSelectEvidence, onCopyHash }: {
    alert: PortalAlert
    sourceFamilies: string[]
    sourceFilter: string
    selectedEvidence?: PortalAlert['evidence'][number]
    selectedEntity?: ReturnType<typeof buildExposureEntities>[number]
    visibleEvidence: PortalAlert['evidence']
    copiedHash: string
    onSourceFilter: (value: string) => void
    onSelectEvidence: (value: string) => void
    onCopyHash: (value: string) => void
}) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Evidence details</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{selectedEntity ? `${selectedEntity.name} · ${visibleEvidence.length} row${visibleEvidence.length === 1 ? '' : 's'}` : 'Timeline, source family, capture state, and customer-safe excerpts.'}</p>
                </div>
                <RotateCcw className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='border-b border-ui-border px-4 py-3'>
                <div className='flex gap-2 overflow-x-auto pb-1'>
                    <SourceFilterChip label='All' active={sourceFilter === 'all'} onClick={() => onSourceFilter('all')} />
                    {sourceFamilies.map(family => (
                        <SourceFilterChip key={family} label={stateLabel(family)} active={sourceFilter === family} onClick={() => onSourceFilter(family)} />
                    ))}
                </div>
            </div>
            <div className='grid gap-3 p-4'>
                {selectedEvidence && (
                    <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-semibold text-ui-text'>{selectedEvidence.sourceName}</span>
                            <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{stateLabel(selectedEvidence.sourceFamily)}</span>
                            <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{selectedEvidence.observedAt ? relativeTimeLabel(selectedEvidence.observedAt) : relativeTimeLabel(selectedEvidence.firstSeenAt || alert.firstSeenAt)}</span>
                        </div>
                        <p className='mt-2 text-sm leading-6 text-ui-muted'>{safeEvidenceExcerpt(selectedEvidence.excerpt)}</p>
                        <div className='mt-3 grid gap-2 text-[11px] text-ui-muted sm:grid-cols-2'>
                            <p><span className='font-semibold text-ui-muted'>Evidence ID:</span> {selectedEvidence.provenance?.captureId ?? selectedEvidence.id}</p>
                            <p><span className='font-semibold text-ui-muted'>Source:</span> {selectedEvidence.provenance?.sourceId ?? selectedEvidence.sourceName}</p>
                            <p><span className='font-semibold text-ui-muted'>State:</span> {stateLabel(selectedEvidence.redactionState)}</p>
                            <p className='flex flex-wrap items-center gap-2'>
                                <span><span className='font-semibold text-ui-muted'>Hash:</span> <span className='font-mono'>{selectedEvidence.contentHash}</span></span>
                                <button type='button' onClick={() => onCopyHash(selectedEvidence.contentHash)} className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-text transition hover:bg-ui-canvas'>
                                    <Copy className='h-3.5 w-3.5' />
                                    {copiedHash === selectedEvidence.contentHash ? 'Copied' : 'Copy'}
                                </button>
                            </p>
                        </div>
                    </div>
                )}
                <div className='overflow-x-auto rounded-lg border border-ui-border'>
                    <table className='w-full min-w-[720px] text-left text-xs'>
                        <thead className='bg-ui-raised text-[10px] uppercase text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Time</th>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Family</th>
                                <th className='px-3 py-2 font-semibold'>State</th>
                                <th className='px-3 py-2 font-semibold'>Snippet</th>
                                <th className='px-3 py-2 font-semibold'>Hash</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {visibleEvidence.map(item => (
                                <tr key={item.id} className={`cursor-pointer align-top transition hover:bg-ui-raised ${selectedEvidence?.id === item.id ? 'bg-ui-raised' : 'bg-ui-panel'}`} onClick={() => onSelectEvidence(item.id)}>
                                    <td className='px-3 py-2 font-semibold text-ui-muted'>{shortTime(item.observedAt || item.firstSeenAt || alert.firstSeenAt)}</td>
                                    <td className='px-3 py-2'>
                                        <p className='max-w-[180px] truncate font-semibold text-ui-text' title={item.sourceName}>{item.sourceName}</p>
                                        <p className='mt-0.5 text-[11px] text-ui-muted'>{item.provenance?.sourceId ?? item.provenance?.captureId ?? item.id}</p>
                                    </td>
                                    <td className='px-3 py-2 font-semibold text-ui-muted'>{stateLabel(item.sourceFamily)}</td>
                                    <td className='px-3 py-2'>
                                        <span className='rounded-full bg-ui-primary/10 px-2 py-0.5 font-semibold text-ui-primary'>{stateLabel(item.redactionState)}</span>
                                    </td>
                                    <td className='px-3 py-2 text-ui-muted'><p className='line-clamp-2 max-w-[280px]'>{safeEvidenceExcerpt(item.excerpt)}</p></td>
                                    <td className='px-3 py-2 font-mono text-[11px] text-ui-muted'>{item.contentHash}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!visibleEvidence.length && <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>No evidence for this source family yet.</p>}
            </div>
        </div>
    )
}

function EvidenceDispositionQueue({ alert, visibleEvidence, selectedEvidence, selectedEntity, workflowContext, dispositions, copiedHash, onSelectEvidence, onCopyHash, onDisposition }: {
    alert: PortalAlert
    visibleEvidence: PortalAlert['evidence']
    selectedEvidence?: PortalAlert['evidence'][number]
    selectedEntity?: ReturnType<typeof buildExposureEntities>[number]
    workflowContext: ReturnType<typeof selectedWorkflowContext>
    dispositions: NonNullable<LocalCaseState['evidenceDispositions']>
    copiedHash: string
    onSelectEvidence: (value: string) => void
    onCopyHash: (value: string) => void
    onDisposition: (evidenceId: string, state: EvidenceDispositionState) => void
}) {
    const route = stateLabel(alert.routingContext?.queue || alert.webhookDelivery.recommendedRoute)
    const watchlist = workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} watchlists` : stateLabel(alert.matchedTerm.kind)
    return (
        <section className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Evidence decisions</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{visibleEvidence.length} row{visibleEvidence.length === 1 ? '' : 's'} · {route} · {watchlist}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <ImpactChip label='Entity' value={selectedEntity?.name || alert.matchedTerm.value} />
                    <ImpactChip label='Path' value={route} />
                    <ImpactChip label='Case' value={workflowContext.caseId || 'candidate'} />
                </div>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[980px] text-left text-xs'>
                    <thead className='bg-ui-raised text-[10px] uppercase text-ui-muted'>
                        <tr>
                            <th className='px-3 py-2 font-semibold'>Evidence</th>
                            <th className='px-3 py-2 font-semibold'>Source</th>
                            <th className='px-3 py-2 font-semibold'>Impact</th>
                            <th className='px-3 py-2 font-semibold'>Status</th>
                            <th className='px-3 py-2 font-semibold'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-ui-border'>
                        {visibleEvidence.map(item => {
                            const disposition = dispositions[item.id]
                            return (
                                <tr key={item.id} onClick={() => onSelectEvidence(item.id)} className={`cursor-pointer align-top transition hover:bg-ui-raised ${selectedEvidence?.id === item.id ? 'bg-ui-raised' : 'bg-ui-panel'}`}>
                                    <td className='px-3 py-3'>
                                        <p className='line-clamp-2 max-w-80 text-sm leading-5 text-ui-text'>{safeEvidenceExcerpt(item.excerpt)}</p>
                                        <p className='mt-1 font-mono text-[11px] text-ui-muted'>{item.contentHash}</p>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <p className='max-w-[180px] truncate font-semibold text-ui-text' title={item.sourceName}>{item.sourceName}</p>
                                        <p className='mt-1 text-[11px] text-ui-muted'>{stateLabel(item.sourceFamily)} · {relativeTimeLabel(item.observedAt || item.firstSeenAt || alert.firstSeenAt)}</p>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <div className='grid gap-1.5'>
                                            <ImpactChip label='Watchlist' value={alert.matchedTerm.value} />
                                            <ImpactChip label='Delivery' value={workflowContext.lastDelivery ? stateLabel(workflowContext.lastDelivery.status) : alert.deliveryState || 'pending_review'} />
                                        </div>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <span className={dispositionClass(disposition?.state)}>{disposition ? stateLabel(disposition.state) : 'Unworked'}</span>
                                        {disposition?.at && <p className='mt-1 text-[11px] font-semibold text-ui-muted'>{relativeTimeLabel(disposition.at)}</p>}
                                    </td>
                                    <td className='px-3 py-3'>
                                        <div className='flex flex-wrap gap-1.5'>
                                            <DispositionButton onClick={(event) => { event.stopPropagation(); onDisposition(item.id, 'reviewed') }}>Reviewed</DispositionButton>
                                            <DispositionButton onClick={(event) => { event.stopPropagation(); onDisposition(item.id, 'escalated') }}>Escalate</DispositionButton>
                                            <DispositionButton onClick={(event) => { event.stopPropagation(); onDisposition(item.id, 'suppressed') }}>Suppress</DispositionButton>
                                            <DispositionButton onClick={(event) => { event.stopPropagation(); onDisposition(item.id, 'false_positive') }}>False</DispositionButton>
                                            <DispositionButton onClick={(event) => { event.stopPropagation(); onCopyHash(item.contentHash) }}>{copiedHash === item.contentHash ? 'Copied' : 'Copy'}</DispositionButton>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {!visibleEvidence.length && <p className='p-4 text-sm text-ui-muted'>Evidence filters are clear.</p>}
        </section>
    )
}

function RouteWatchlistImpactRail({ alert, selectedEvidence, selectedEntity, workflowContext, dispositions }: {
    alert: PortalAlert
    selectedEvidence?: PortalAlert['evidence'][number]
    selectedEntity?: ReturnType<typeof buildExposureEntities>[number]
    workflowContext: ReturnType<typeof selectedWorkflowContext>
    dispositions: NonNullable<LocalCaseState['evidenceDispositions']>
}) {
    const workedCount = Object.keys(dispositions).length
    const selectedDisposition = selectedEvidence ? dispositions[selectedEvidence.id] : undefined
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Customer impact</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{workedCount}/{alert.evidence.length} evidence rows worked</p>
                </div>
                <ShieldCheck className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='grid gap-2 p-4 sm:grid-cols-2'>
                <ActionStatus label='Customer term' value={alert.matchedTerm.value} />
                <ActionStatus label='Term kind' value={stateLabel(alert.matchedTerm.kind)} />
                <ActionStatus label='Current entity' value={selectedEntity?.name || alert.company} />
                <ActionStatus label='Evidence status' value={selectedDisposition ? stateLabel(selectedDisposition.state) : 'unworked'} tone={selectedDisposition?.state === 'false_positive' || selectedDisposition?.state === 'suppressed' ? 'warn' : 'neutral'} />
                <ActionStatus label='Recommended path' value={stateLabel(alert.routingContext?.queue || alert.webhookDelivery.recommendedRoute)} />
                <ActionStatus label='Urgency' value={stateLabel(alert.routingContext?.urgency || (alert.severity === 'critical' ? 'immediate' : 'same_day'))} tone={alert.severity === 'critical' ? 'warn' : 'neutral'} />
                <ActionStatus label='Watchlists' value={workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} scoped` : 'default scope'} />
                <ActionStatus label='Destination' value={workflowContext.webhookDestinationIds.length ? `${workflowContext.webhookDestinationIds.length} configured` : workflowContext.hasWebhookRoute ? 'delivery available' : 'checking delivery'} tone={workflowContext.hasWebhookRoute ? 'neutral' : 'warn'} />
            </div>
        </section>
    )
}

function ImpactChip({ label, value }: { label: string, value: string }) {
    return (
        <span className='inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg border border-ui-border bg-ui-panel px-2 text-[11px] font-semibold text-ui-muted'>
            <span className='text-ui-muted'>{label}:</span>
            <span className='truncate text-ui-text' title={value}>{value}</span>
        </span>
    )
}

function DispositionButton({ onClick, children }: { onClick: (event: MouseEvent<HTMLButtonElement>) => void, children: string }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-panel px-2.5 text-[11px] font-semibold text-ui-text transition hover:bg-ui-canvas'>
            {children}
        </button>
    )
}

function SelectedContextBar({ alert, selectedEvidence, selectedEntity, sourceFilter, workflowContext, copiedHash, onCopyHash }: {
    alert: PortalAlert
    selectedEvidence?: PortalAlert['evidence'][number]
    selectedEntity?: ReturnType<typeof buildExposureEntities>[number]
    sourceFilter: string
    workflowContext: ReturnType<typeof selectedWorkflowContext>
    copiedHash: string
    onCopyHash: (value: string) => void
}) {
    const sourceLabel = sourceFilter === 'all' ? stateLabel(alert.sourceFamily) : stateLabel(sourceFilter)
    return (
        <section className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center'>
            <div className='min-w-0'>
                <p className='text-[10px] font-semibold text-ui-muted'>Selected context</p>
                <p className='mt-1 truncate text-sm font-semibold text-ui-text' title={selectedEntity?.name || selectedEvidence?.sourceName || alert.company}>
                    {selectedEntity?.name || selectedEvidence?.sourceName || alert.company}
                </p>
                <p className='mt-0.5 truncate text-xs text-ui-muted' title={selectedEvidence ? safeEvidenceExcerpt(selectedEvidence.excerpt) : safeAlertSummary(alert)}>
                    {sourceLabel} · {selectedEvidence ? relativeTimeLabel(selectedEvidence.observedAt || selectedEvidence.firstSeenAt || alert.firstSeenAt) : relativeTimeLabel(alert.lastSeenAt || alert.firstSeenAt)}
                </p>
            </div>
            <div className='grid gap-2 text-[11px] sm:grid-cols-3'>
                <ActionStatus label='Entity' value={selectedEntity ? stateLabel(selectedEntity.kind) : stateLabel(alert.matchedTerm.kind)} />
                <ActionStatus label='Evidence' value={selectedEvidence?.contentHash || `${alert.evidence.length} rows`} />
                <ActionStatus label='Path' value={workflowContext.caseId || stateLabel(alert.webhookDelivery.recommendedRoute)} />
            </div>
            <div className='flex flex-wrap gap-2 lg:justify-end'>
                {selectedEvidence?.contentHash && (
                    <button type='button' onClick={() => onCopyHash(selectedEvidence.contentHash)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas'>
                        <Copy className='h-4 w-4' />
                        {copiedHash === selectedEvidence.contentHash ? 'Copied' : 'Copy hash'}
                    </button>
                )}
                <a href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} className='inline-flex h-9 items-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas'>
                    Organization
                </a>
            </div>
        </section>
    )
}

function DeliveryCaseActivityRail({ alert, deliveries, timeline, workflowContext }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    timeline: Array<{ id: string, at: string, title: string, detail: string }>
    workflowContext: ReturnType<typeof selectedWorkflowContext>
}) {
    const latestDelivery = [...deliveries].sort((first, second) => second.attemptedAt.localeCompare(first.attemptedAt))[0]
    const caseId = workflowContext.caseId || alert.caseId || alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate
    const failedDelivery = deliveries.find(delivery => delivery.status === 'failed')
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Delivery and case activity</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{timeline.length} event{timeline.length === 1 ? '' : 's'} · {deliveries.length} delivery attempt{deliveries.length === 1 ? '' : 's'}</p>
                </div>
                <Clock3 className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='grid gap-3 p-4'>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <ActionStatus label='Last delivery' value={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTimeLabel(latestDelivery.attemptedAt)}` : 'no delivery yet'} tone={latestDelivery?.status === 'failed' ? 'warn' : 'neutral'} />
                    <ActionStatus label='Case' value={caseId || 'case is being prepared'} />
                    <ActionStatus label='Replay count' value={`${alert.replayCount ?? 0}`} />
                    <ActionStatus label='Destination' value={workflowContext.webhookDestinationIds.length ? `${workflowContext.webhookDestinationIds.length} destination${workflowContext.webhookDestinationIds.length === 1 ? '' : 's'}` : workflowContext.hasWebhookRoute ? 'delivery available' : 'checking delivery'} tone={workflowContext.hasWebhookRoute ? 'neutral' : 'warn'} />
                </div>
                {failedDelivery?.error && <p className='rounded-lg border border-ui-danger/35 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'>{failedDelivery.error}</p>}
                <div className='overflow-hidden rounded-lg border border-ui-border'>
                    <table className='w-full text-left text-xs'>
                        <thead className='bg-ui-raised text-[10px] uppercase text-ui-muted'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Time</th>
                                <th className='px-3 py-2 font-semibold'>Event</th>
                                <th className='px-3 py-2 font-semibold'>Detail</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {timeline.slice(0, 8).map(item => (
                                <tr key={item.id} className='align-top'>
                                    <td className='px-3 py-2 font-semibold text-ui-muted'>{relativeTimeLabel(item.at)}</td>
                                    <td className='px-3 py-2 font-semibold text-ui-text'>{item.title}</td>
                                    <td className='px-3 py-2 text-ui-muted'>{item.detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function SourceFilterChip({ label, active, onClick }: { label: string, active: boolean, onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className={`h-8 min-w-12 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${active ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-canvas'}`}>
            {label}
        </button>
    )
}

function SelectedActionBar({ alert, deliveries, assignee, busyAction, actionMessage, onUpdate, onOpenCase, onReplay, onTest, onSend }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    assignee: string
    busyAction: string | null
    actionMessage: { ok: boolean, text: string } | null
    onUpdate: (alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) => Promise<void>
    onOpenCase: () => Promise<void>
    onReplay: (alertId: string) => Promise<void>
    onTest: (alertId: string) => Promise<void>
    onSend: (alertId: string) => Promise<void>
}) {
    const persistedOwner = assignee === 'Unassigned' ? undefined : assignee
    const latestDelivery = [...deliveries].sort((first, second) => second.attemptedAt.localeCompare(first.attemptedAt))[0]
    const hasDeliveryRoute = Boolean(alert.webhookContext?.hasWebhookRoute || alert.webhookContext?.webhookDestinationIds?.length || alert.webhookDelivery.dedupeKey)
    const transitionReady = actionReady(alert, 'transition')
    const replayReady = actionReady(alert, 'replay')
    const deliverReady = actionReady(alert, 'deliver') && hasDeliveryRoute
    const suppressReady = actionReady(alert, 'suppress')
    const closeReady = actionReady(alert, 'close')
    const reopenReady = actionReady(alert, 'reopen')
    const caseId = alert.caseId || alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate || alert.webhookContext?.caseIdCandidate
    const caseHref = caseId ? caseDetailHref(caseId, alert.id, alertOrganizationId(alert), 'alert_queue') : undefined
    const caseReady = Boolean(alert.id && alert.evidence?.some(item => item.id || item.provenance?.captureId))
    const nextAction = dwmNextOperatorAction({
        reviewState: alert.reviewState,
        deliveryState: alert.deliveryState,
        latestDeliveryStatus: latestDelivery?.status,
        latestDeliverySummary: latestDelivery ? `${stateLabel(latestDelivery.status)} from ${relativeTimeLabel(latestDelivery.attemptedAt)}` : undefined,
        caseHref,
        caseReady,
        transitionReady,
        replayReady,
        deliverReady,
        closeReady,
        reopenReady,
        suppressReady,
    })
    const nextActionBusy = nextOperatorActionBusy(nextAction.kind, alert.id) === busyAction
    const onNextAction = () => {
        switch (nextAction.kind) {
            case 'reopen':
                return onUpdate(alert.id, 'needs_review', 'pending_review', 'Reopened for analyst review.', persistedOwner)
            case 'open_case':
                return onOpenCase()
            case 'review':
                return onUpdate(alert.id, 'reviewing', 'pending_review', 'Analyst review started.', persistedOwner)
            case 'send':
                return onSend(alert.id)
            case 'test':
                return onTest(alert.id)
            case 'replay':
                return onReplay(alert.id)
            case 'close':
                return onUpdate(alert.id, 'resolved', alert.deliveryState === 'delivered' ? 'delivered' : 'muted', 'Closed by analyst.', persistedOwner)
            case 'suppress':
                return onUpdate(alert.id, 'false_positive', 'muted', 'Suppressed as false positive.', persistedOwner)
            default:
                return undefined
        }
    }
    return (
        <section className='grid min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='grid gap-3 rounded-lg border border-ui-primary/35 bg-ui-panel p-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center' data-dwm-next-action='true'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-ui-primary'>Next action</p>
                    <h3 className='mt-1 wrap-break-word text-sm font-semibold text-ui-text'>{nextAction.label}</h3>
                    <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted'>{nextAction.detail}</p>
                </div>
                {nextAction.href ? (
                    <a href={nextAction.href} className='inline-flex min-h-10 items-center justify-center rounded-lg border border-ui-text bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                        {nextAction.cta}
                    </a>
                ) : (
                    <button type='button' onClick={onNextAction} disabled={nextAction.disabled || nextActionBusy} className='inline-flex min-h-10 items-center justify-center rounded-lg border border-ui-text bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border-ui-border disabled:bg-ui-panel disabled:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                        {nextActionBusy ? 'Working' : nextAction.cta}
                    </button>
                )}
            </div>
            <div className='grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                <ActionStatus label='Owner' value={assignee} />
                <ActionStatus label='Work state' value={stateLabel(alert.reviewState)} />
                <ActionStatus label='Delivery' value={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTimeLabel(latestDelivery.attemptedAt)}` : hasDeliveryRoute ? 'delivery available' : 'checking delivery'} tone={latestDelivery?.status === 'failed' || !hasDeliveryRoute ? 'warn' : 'neutral'} />
                <ActionStatus label='Case' value={alert.caseId || alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate || 'case is being prepared'} />
            </div>
            <div className='grid gap-2'>
                <div className='flex flex-wrap gap-1.5'>
                    <ActionAvailability label='Case actions' ready={transitionReady} />
                    <ActionAvailability label='Replay' ready={replayReady} />
                    <ActionAvailability label='Delivery' ready={deliverReady} />
                    <ActionAvailability label='Close' ready={closeReady} />
                </div>
                <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap'>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!transitionReady} icon='review' onClick={() => onUpdate(alert.id, 'reviewing', 'pending_review', 'Analyst review started.', persistedOwner)}>Review</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!transitionReady} icon='ready' onClick={() => onUpdate(alert.id, 'route_to_customer', 'ready_to_send', 'Escalated for customer delivery.', persistedOwner)}>Escalate</CaseButton>
                    {caseHref ? <CaseLink href={caseHref}>Open case</CaseLink> : <CaseButton busy={busyAction === `case:${alert.id}`} disabled={!caseReady} icon='case' onClick={onOpenCase}>Open case</CaseButton>}
                    <CaseButton busy={busyAction === `replay:${alert.id}`} disabled={!replayReady} icon='replay' onClick={() => onReplay(alert.id)}>Replay</CaseButton>
                    <CaseButton busy={busyAction === `test:${alert.id}`} disabled={!deliverReady} icon='send' onClick={() => onTest(alert.id)}>Test</CaseButton>
                    <CaseButton busy={busyAction === `send:${alert.id}`} disabled={!deliverReady} icon='send' onClick={() => onSend(alert.id)}>Send</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!suppressReady} icon='false' onClick={() => onUpdate(alert.id, 'false_positive', 'muted', 'Suppressed as false positive.', persistedOwner)}>Suppress</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!closeReady} icon='ready' onClick={() => onUpdate(alert.id, 'resolved', alert.deliveryState === 'delivered' ? 'delivered' : 'muted', 'Closed by analyst.', persistedOwner)}>Close</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!reopenReady} icon='review' onClick={() => onUpdate(alert.id, 'needs_review', 'pending_review', 'Reopened for analyst review.', persistedOwner)}>Reopen</CaseButton>
                </div>
                {actionMessage && (
                    <p className={`justify-self-start rounded-lg border px-3 py-2 text-xs font-semibold xl:justify-self-end ${actionMessage.ok ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'}`}>
                        {actionMessage.text}
                    </p>
                )}
            </div>
        </section>
    )
}

function nextOperatorActionBusy(kind: DwmNextOperatorActionKind, alertId: string) {
    if (kind === 'open_case') return `case:${alertId}`
    if (kind === 'replay') return `replay:${alertId}`
    if (kind === 'test') return `test:${alertId}`
    if (kind === 'send') return `send:${alertId}`
    if (kind === 'reopen' || kind === 'review' || kind === 'close' || kind === 'suppress') return `update:${alertId}`
    return undefined
}

function ActionAvailability({ label, ready }: { label: string, ready: boolean }) {
    return (
        <span className={`min-w-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${ready ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'}`}>
            {label}: {ready ? 'ready' : 'syncing'}
        </span>
    )
}

function ActionStatus({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'warn' }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-1 truncate text-xs font-semibold ${tone === 'warn' ? 'text-ui-warning' : 'text-ui-text'}`} title={value}>{value}</p>
        </div>
    )
}

function CaseBrief({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 line-clamp-3 text-sm leading-6 text-ui-muted'>{value}</p>
        </div>
    )
}

function NoCaseWorkspace({ latestCaptures, workflowActions }: { latestCaptures: OperationsSnapshot['latestCaptures'], workflowActions: ReactNode }) {
    const newestCapture = [...latestCaptures].sort((first, second) => second.collectedAt.localeCompare(first.collectedAt))[0]
    const operatorRows = [
        {
            stage: 'Scope',
            state: 'Watchlist controls are ready',
            action: 'Edit watchlist',
            detail: 'Companies, domains, suppliers, brands, and products define match scope.',
        },
        {
            stage: 'Collection',
            state: latestCaptures.length ? `${latestCaptures.length} accepted capture${latestCaptures.length === 1 ? '' : 's'}` : 'No accepted captures',
            action: 'Run collection',
            detail: newestCapture ? `${newestCapture.sourceName} ${relativeTimeLabel(newestCapture.collectedAt)}` : 'Approved source records appear after duplicate and safety checks.',
        },
        {
            stage: 'Case path',
            state: 'No alert selected',
            action: 'Rebuild alerts',
            detail: 'Matches become reviewable alerts with evidence, provenance, and delivery state.',
        },
        {
            stage: 'Delivery',
            state: 'Customer send blocked',
            action: 'Test webhook',
            detail: 'Dry-run delivery before sending customer notifications.',
        },
    ]
    return (
        <div className='grid gap-4 p-4'>
            <section id='dwm-workflow-actions' className='scroll-mt-24'>
                {workflowActions}
            </section>
            <section data-dwm-zero-case-recovery className='overflow-hidden rounded-lg border border-ui-border bg-ui-raised'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-3'>
                    <div>
                        <p className='text-[10px] font-semibold uppercase text-ui-primary'>Exposure operations</p>
                        <h3 className='mt-1 text-base font-semibold text-ui-text'>No alert is waiting for review</h3>
                    </div>
                    <span className='rounded-full border border-ui-success/35 bg-ui-success/10 px-2.5 py-1 text-xs font-semibold text-ui-success'>Monitoring live</span>
                </div>
                <div className='overflow-x-auto'>
                    <table className='w-full min-w-[760px] text-left text-xs'>
                        <thead className='bg-ui-panel text-[10px] uppercase text-ui-muted'>
                            <tr>
                                <th className='px-4 py-2 font-semibold'>Stage</th>
                                <th className='px-4 py-2 font-semibold'>State</th>
                                <th className='px-4 py-2 font-semibold'>Action</th>
                                <th className='px-4 py-2 font-semibold'>Evidence</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {operatorRows.map(row => (
                                <tr key={row.stage} className='align-top transition hover:bg-ui-canvas'>
                                    <td className='px-4 py-3 text-sm font-semibold text-ui-text'>{row.stage}</td>
                                    <td className='px-4 py-3 text-sm text-ui-text'>{row.state}</td>
                                    <td className='px-4 py-3'>
                                        <a href='#dwm-workflow-actions' className='inline-flex rounded-lg border border-ui-border bg-ui-panel px-3 py-1.5 text-xs font-semibold text-ui-primary transition hover:border-ui-primary hover:bg-ui-primary/10 focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>
                                            {row.action}
                                        </a>
                                    </td>
                                    <td className='px-4 py-3 text-sm leading-5 text-ui-muted'>{row.detail}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
            <div className='rounded-lg border border-ui-border bg-ui-panel'>
                <div className='border-b border-ui-border px-4 py-3'>
                    <h3 className='text-sm font-semibold text-ui-text'>Recent capture review</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Useful for tuning watchlist terms without dumping raw rows.</p>
                </div>
                <div className='grid gap-2 p-4'>
                    {latestCaptures.slice(0, 8).map(capture => (
                        <div key={capture.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='font-mono text-xs font-semibold text-ui-text'>{capture.sourceName}</span>
                                <span className='rounded-full bg-ui-primary/10 px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{stateLabel(capture.family)}</span>
                                <span className='text-xs text-ui-muted'>{relativeTimeLabel(capture.collectedAt)}</span>
                            </div>
                            <p className='mt-2 line-clamp-2 text-sm leading-6 text-ui-muted'>{capture.safeExcerpt}</p>
                        </div>
                    ))}
                    {!latestCaptures.length && <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>Collectors are checking sources. Accepted captures appear here after duplicate and safety checks.</p>}
                </div>
            </div>
        </div>
    )
}

function SourcePosture({ snapshot, operations }: { snapshot: DwmProductSnapshot, operations: OperationsSnapshot | null }) {
    const sourceRows = operations?.sourceHealth ?? []
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Source health</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>{operations ? `${operations.counts.activeSourceCount}/${operations.counts.sourceCount} active sources` : 'Source inventory'}</p>
                </div>
                <SlidersHorizontal className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='p-3'>
                {sourceRows.length ? (
                    <div className='overflow-hidden rounded-lg border border-ui-border'>
                        <table className='w-full text-left text-xs'>
                            <thead className='bg-ui-raised text-[10px] uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-3 py-2 font-semibold'>Source</th>
                                    <th className='px-3 py-2 font-semibold'>State</th>
                                    <th className='px-3 py-2 font-semibold'>Last pull</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border'>
                                {sourceRows.slice(0, 8).map(source => (
                                    <tr key={source.sourceId} className='bg-ui-panel align-top'>
                                        <td className='px-3 py-2'>
                                            <p className='max-w-[150px] truncate font-semibold text-ui-text' title={source.sourceName}>{source.sourceName}</p>
                                            <p className='mt-0.5 text-[11px] text-ui-muted'>{stateLabel(source.family)} · {source.approvedMetadataOnly ? 'metadata only' : 'message capture'}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={source.status === 'active' ? 'rounded-full bg-ui-success/10 px-2 py-0.5 font-semibold text-ui-success' : 'rounded-full bg-ui-warning/10 px-2 py-0.5 font-semibold text-ui-warning'}>
                                                {stateLabel(source.status)}
                                            </span>
                                        </td>
                                        <td className='px-3 py-2 font-semibold text-ui-muted'>{source.lastCollectedAt ? relativeTimeLabel(source.lastCollectedAt) : 'never'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className='grid gap-2'>
                        {snapshot.sourceCoverage.map(source => (
                            <div key={source.family} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-semibold text-ui-text'>{source.label}</span>
                                    <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{source.activeCount}/{source.sourceCount}</span>
                                </div>
                                <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted'>{source.detail}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

function DeliveryPanel({ alert, deliveries }: { alert?: PortalAlert, deliveries: DeliveryItem[] }) {
    const visible = alert ? deliveries.filter(delivery => delivery.alertId === alert.id || delivery.alertId === 'webhook_test') : deliveries
    const orgId = alert ? alertOrganizationId(alert) : undefined
    const caseId = alert?.caseId || alert?.caseIdCandidate || alert?.workflowContext?.caseIdCandidate || alert?.webhookContext?.caseIdCandidate
    const caseHref = alert && caseId ? caseDetailHref(caseId, alert.id, orgId, 'delivery_history') : undefined
    const latestDelivery = visible[0]
    const orgHref = organizationDeliveryWorkspaceHref({ organizationId: orgId, alertId: alert?.id, caseId, delivery: latestDelivery })
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Customer delivery</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Webhook attempts, retry state, and linked case context.</p>
                </div>
                <Webhook className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='grid gap-2 p-3'>
                <div className='grid grid-cols-2 gap-2 text-[11px]'>
                    <a href={orgHref} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 font-semibold text-ui-text transition hover:bg-ui-canvas'>
                        Destinations
                        <span className='mt-0.5 block truncate font-mono font-normal text-ui-muted'>{orgId || 'default scope'}</span>
                    </a>
                    {caseHref ? (
                        <a href={caseHref} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 font-semibold text-ui-text transition hover:bg-ui-canvas'>
                            Case trail
                            <span className='mt-0.5 block truncate font-mono font-normal text-ui-muted'>{caseId}</span>
                        </a>
                    ) : (
                        <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised px-3 py-2 font-semibold text-ui-muted'>
                            Case trail
                            <span className='mt-0.5 block font-normal'>Open a case to attach delivery audit.</span>
                        </div>
                    )}
                </div>
                {visible.slice(0, 6).map(delivery => {
                    const deliveryOrgHref = organizationDeliveryWorkspaceHref({ organizationId: orgId, alertId: alert?.id, caseId, delivery })
                    return (
                        <div key={delivery.id} className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <span className={deliveryClass(delivery.status)}>{stateLabel(delivery.status)}</span>
                                <div className='flex flex-wrap items-center justify-end gap-1.5 text-[11px] font-semibold text-ui-muted'>
                                    <span>{relativeTimeLabel(delivery.attemptedAt)}</span>
                                    <span className='rounded-full border border-ui-border px-1.5 py-0.5'>{delivery.dryRun ? 'dry run' : delivery.deliveryKind || 'send'}</span>
                                </div>
                            </div>
                            <div className='grid grid-cols-2 gap-2 text-[11px] text-ui-muted'>
                                <p><span className='font-semibold text-ui-muted'>HTTP:</span> {delivery.httpStatus ?? (delivery.dryRun ? 'dry run' : 'pending')}</p>
                                <p><span className='font-semibold text-ui-muted'>Attempt:</span> {delivery.attemptCount ?? 1}</p>
                                <p className='col-span-2 break-all'><span className='font-semibold text-ui-muted'>Destination:</span> {delivery.endpointHint || delivery.endpointHash || delivery.webhookDestinationId || delivery.destinationId || 'redacted destination'}</p>
                                <p className='break-all'><span className='font-semibold text-ui-muted'>Request:</span> {delivery.requestId || delivery.auditEventId || 'not linked'}</p>
                                <p className='break-all'><span className='font-semibold text-ui-muted'>Alert key:</span> {delivery.dedupeKey}</p>
                                <p className='break-all'><span className='font-semibold text-ui-muted'>Payload:</span> {delivery.payloadHash}</p>
                                <p><span className='font-semibold text-ui-muted'>Retry:</span> {delivery.nextRetryAt ? relativeTimeLabel(delivery.nextRetryAt) : retryStateLabel(delivery)}</p>
                                <p><span className='font-semibold text-ui-muted'>Audit:</span> {delivery.auditEventId || 'pending'}</p>
                            </div>
                            <div className='flex flex-wrap gap-2 text-[11px] font-semibold'>
                                <a href={deliveryOrgHref} className='inline-flex h-7 items-center rounded-lg border border-ui-border bg-ui-panel px-2 text-ui-text transition hover:bg-ui-canvas'>Manage destination</a>
                                {caseHref ? <a href={caseHref} className='inline-flex h-7 items-center rounded-lg border border-ui-border bg-ui-panel px-2 text-ui-text transition hover:bg-ui-canvas'>Open case trail</a> : null}
                            </div>
                            {(delivery.error || delivery.errorClass) && <p className='rounded-lg border border-ui-danger/35 bg-ui-danger/10 px-2 py-1.5 text-xs text-ui-danger'>{delivery.error || stateLabel(delivery.errorClass || 'delivery failed')}</p>}
                        </div>
                    )
                })}
                {!visible.length && <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>No delivery attempt is attached to this alert yet. Use Test or Send on the selected alert, then inspect the redacted destination, request id, retry state, and case trail here.</p>}
            </div>
        </section>
    )
}

const queueFilters: Array<{ id: QueueFilter, label: string }> = [
    { id: 'active', label: 'Active' },
    { id: 'ready', label: 'Ready' },
    { id: 'critical', label: 'Critical' },
    { id: 'source', label: 'Source' },
    { id: 'high_confidence', label: '80%+' },
    { id: 'fresh', label: 'Fresh' },
    { id: 'pending_delivery', label: 'To send' },
    { id: 'reviewing', label: 'Reviewing' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'muted', label: 'Muted' },
    { id: 'all', label: 'All' },
]

function ActorPanel({ snapshot }: { snapshot: DwmProductSnapshot }) {
    return (
        <section className='rounded-lg border border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Actor context</h3>
                    <p className='mt-0.5 text-xs text-ui-muted'>Actor, sources, latest sighting, and watch state.</p>
                </div>
                <Fingerprint className='h-4 w-4 text-ui-primary' />
            </div>
            <div className='grid gap-2 p-3'>
                {snapshot.actorOverviews.slice(0, 4).map(actor => (
                    <div key={actor.actor} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                        <div className='flex items-center justify-between gap-3'>
                            <span className='text-sm font-semibold text-ui-text'>{actor.actor}</span>
                            <span className='rounded-full bg-ui-primary/10 px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{actor.confidence}%</span>
                        </div>
                        <div className='mt-3 grid grid-cols-3 gap-2 text-[11px]'>
                            <QueueCell label='sources' value={`${actor.sourceCount}`} />
                            <QueueCell label='captures' value={`${actor.captureCount}`} />
                            <QueueCell label='latest' value={relativeTimeLabel(actor.latestSeenAt)} />
                        </div>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <span className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{stateLabel(actor.watchState)}</span>
                            {actor.sourceFamilies.slice(0, 2).map(family => (
                                <span key={family} className='rounded-full bg-ui-panel px-2 py-0.5 text-[11px] font-semibold text-ui-muted'>{stateLabel(family)}</span>
                            ))}
                        </div>
                    </div>
                ))}
                {!snapshot.actorOverviews.length && <p className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>Actor profiles are checking metadata. Linked profiles stream here as evidence attaches to known actors.</p>}
            </div>
        </section>
    )
}

function StatusPill({ label, value, tone, className = '' }: { label: string, value: string, tone: 'good' | 'warn' | 'neutral', className?: string }) {
    const toneClass = tone === 'good' ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : tone === 'warn' ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning' : 'border-ui-border bg-ui-raised text-ui-text'
    return (
        <div className={`shrink-0 rounded-lg border px-3 py-2 ${toneClass} ${className}`}>
            <p className='text-[10px] font-semibold uppercase opacity-75'>{label}</p>
            <p className='mt-0.5 text-sm font-semibold'>{value}</p>
        </div>
    )
}

function CaseMetric({ label, value, detail, tone = 'neutral' }: { label: string, value: string, detail: string, tone?: 'neutral' | 'warn' | 'bad' }) {
    const toneClass = tone === 'bad'
        ? 'text-ui-danger'
        : tone === 'warn'
            ? 'text-ui-warning'
            : 'text-ui-primary'
    return (
        <div className='border-b border-r border-ui-border p-4 last:border-r-0 md:border-b-0'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 text-xs font-semibold text-ui-muted'>{detail}</p>
        </div>
    )
}

function QueueCell({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'bad' }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel px-2 py-1.5'>
            <p className='text-[9px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className={`mt-0.5 truncate font-semibold ${tone === 'bad' ? 'text-ui-danger' : 'text-ui-muted'}`} title={value}>{value}</p>
        </div>
    )
}

function ContextChip({ label, value, href }: { label: string, value: string, href?: string }) {
    const content = (
        <>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 truncate text-xs font-semibold text-ui-text' title={value}>{value}</p>
        </>
    )
    if (href) {
        return (
            <a href={href} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 transition hover:bg-ui-canvas focus:outline-none focus:ring-2 focus:ring-ui-primary/20'>
                {content}
            </a>
        )
    }
    return <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>{content}</div>
}

function buildExposureEntities(
    alert: PortalAlert,
    evidenceSummary: NonNullable<PortalAlert['evidenceSummary']>,
    workflowContext: ReturnType<typeof selectedWorkflowContext>,
    routingContext: NonNullable<PortalAlert['routingContext']>,
) {
    const newestAt = evidenceSummary.lastObservedAt || alert.lastSeenAt || alert.firstSeenAt
    const sourceFamilies = Object.keys(evidenceSummary.sourceFamilyCounts)
    const baseScope = workflowContext.organizationId || 'tenant default'
    const rows = [
        {
            key: `company:${alert.company}`,
            name: alert.company,
            kind: 'company',
            matchValue: alert.company,
            scope: baseScope,
            evidenceCount: evidenceSummary.evidenceCount,
            sourceFamilies,
            newestAt,
            confidence: alert.confidence,
            nextAction: stateLabel(routingContext.queue),
        },
        {
            key: `${alert.matchedTerm.kind}:${alert.matchedTerm.value}`,
            name: alert.matchedTerm.value,
            kind: alert.matchedTerm.kind,
            matchValue: alert.matchedTerm.value,
            scope: workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} watchlist scopes` : 'watchlist match',
            evidenceCount: evidenceSummary.evidenceCount,
            sourceFamilies,
            newestAt,
            confidence: alert.confidence,
            nextAction: stateLabel(alert.reviewState),
        },
    ]
    if (alert.actor) {
        rows.push({
            key: `actor:${alert.actor}`,
            name: alert.actor,
            kind: 'actor',
            matchValue: alert.actor,
            scope: stateLabel(alert.sourceFamily),
            evidenceCount: evidenceSummary.evidenceCount,
            sourceFamilies,
            newestAt,
            confidence: alert.confidence,
            nextAction: workflowContext.hasWebhookRoute ? 'test delivery' : 'review route',
        })
    }
    return rows
}

function evidenceMatchesEntity(item: PortalAlert['evidence'][number], entity: ReturnType<typeof buildExposureEntities>[number]) {
    const needle = entity.matchValue.toLowerCase()
    return [
        item.excerpt,
        item.sourceName,
        item.provenance?.sourceId,
        item.provenance?.captureId,
        item.contentHash,
    ].filter(Boolean).some(value => String(value).toLowerCase().includes(needle))
}

function fallbackEvidenceSummary(alert: PortalAlert): NonNullable<PortalAlert['evidenceSummary']> {
    const observed = alert.evidence.map(item => item.observedAt || item.firstSeenAt || alert.firstSeenAt).sort()
    return {
        evidenceCount: alert.evidence.length,
        sourceFamilyCounts: alert.evidence.reduce<Record<string, number>>((counts, item) => {
            counts[item.sourceFamily] = (counts[item.sourceFamily] ?? 0) + 1
            return counts
        }, {}),
        metadataOnlyCount: alert.evidence.filter(item => item.redactionState === 'metadata_only' || item.provenance?.metadataOnly).length,
        publicSafeCount: alert.evidence.filter(item => item.redactionState === 'redacted' || item.redactionState === 'public_safe').length,
        firstObservedAt: observed[0] || alert.firstSeenAt,
        lastObservedAt: observed[observed.length - 1] || alert.lastSeenAt || alert.firstSeenAt,
    }
}

function fallbackRoutingContext(alert: PortalAlert): NonNullable<PortalAlert['routingContext']> {
    const queue = alert.webhookDelivery.recommendedRoute
    const urgency = alert.severity === 'critical' ? 'immediate' : alert.severity === 'high' ? 'same_day' : 'watch'
    return {
        queue,
        urgency,
        customerVisibleEvidence: alert.sourceFamily === 'darkweb_metadata' ? 'metadata_only' : 'redacted_excerpt',
        reason: `${stateLabel(alert.artifactType)} routes to ${stateLabel(queue)} based on source family, severity, and watched term.`,
    }
}

function buildAnalystBrief(
    alert: PortalAlert,
    evidenceSummary: NonNullable<PortalAlert['evidenceSummary']>,
    routingContext: NonNullable<PortalAlert['routingContext']>,
    workflowContext: ReturnType<typeof selectedWorkflowContext>,
) {
    const sourceFamilies = Object.entries(evidenceSummary.sourceFamilyCounts)
        .map(([family, count]) => `${count} ${stateLabel(family)}`)
        .join(', ')
    const visibleCounts = [
        evidenceSummary.publicSafeCount ? `${evidenceSummary.publicSafeCount} redacted excerpt${evidenceSummary.publicSafeCount === 1 ? '' : 's'}` : '',
        evidenceSummary.metadataOnlyCount ? `${evidenceSummary.metadataOnlyCount} metadata-only record${evidenceSummary.metadataOnlyCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(', ') || 'safe source records'
    const freshness = relativeTimeLabel(evidenceSummary.lastObservedAt || alert.lastSeenAt || alert.firstSeenAt)
    const readyForCustomer = Boolean(
        alert.reviewState === 'route_to_customer'
        || alert.deliveryState === 'ready_to_send'
        || alert.deliveryState === 'delivered'
        || workflowContext.lastDelivery,
    )
    return {
        headline: `${alert.company} matched ${alert.matchedTerm.value}`,
        whatHappened: safeAlertSummary(alert),
        whyItMatters: routingContext.reason,
        nextAction: alert.recommendedAction,
        readyForCustomer,
        evidenceBoundary: `Show ${visibleCounts}; keep raw leaked files and secrets out of the customer update.`,
        sourceRecords: `${evidenceSummary.evidenceCount} record${evidenceSummary.evidenceCount === 1 ? '' : 's'} across ${sourceFamilies || stateLabel(alert.sourceFamily)}, newest ${freshness}.`,
        workflowReadiness: workflowContext.hasWebhookRoute
            ? `${stateLabel(routingContext.queue)} is available; ${workflowContext.lastDelivery ? `last delivery ${stateLabel(workflowContext.lastDelivery.status)} ${relativeTimeLabel(workflowContext.lastDelivery.attemptedAt)}` : 'test delivery before sending'}.`
            : 'Keep in analyst review until a delivery route is configured.',
    }
}

function shortTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const parts = new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
        hourCycle: 'h23',
    }).formatToParts(date)
    const byType = new Map(parts.map(part => [part.type, part.value]))
    return `${byType.get('month')} ${byType.get('day')}, ${byType.get('hour')}:${byType.get('minute')}`
}

function CaseButton({ busy, disabled = false, icon, onClick, children }: { busy: boolean, disabled?: boolean, icon: 'review' | 'ready' | 'replay' | 'send' | 'false' | 'case', onClick: () => void, children: string }) {
    const Icon = busy ? Loader2 : icon === 'case' ? FolderOpen : icon === 'send' ? Send : icon === 'false' ? XCircle : icon === 'replay' ? RotateCcw : icon === 'ready' ? CheckCircle2 : Play
    return (
        <button type='button' onClick={onClick} disabled={busy || disabled} title={disabled ? 'Action is not available for this alert state.' : undefined} className='inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-canvas disabled:cursor-not-allowed disabled:opacity-60 sm:px-3'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {children}
        </button>
    )
}

function CaseLink({ href, children }: { href: string, children: string }) {
    return (
        <a href={href} className='inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-ui-primary bg-ui-primary/10 px-2.5 text-xs font-semibold text-ui-text transition hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/30 sm:px-3'>
            <FolderOpen className='h-4 w-4' />
            {children}
        </a>
    )
}

type LocalCaseState = {
    assignee?: string
    note?: string
    evidenceDispositions?: Record<string, { state: EvidenceDispositionState, at: string }>
}

function useLocalCaseState() {
    const [state, setState] = useState<Record<string, LocalCaseState>>({})

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem('hanasand:dwm-case-state')
            if (raw) setState(JSON.parse(raw) as Record<string, LocalCaseState>)
        } catch {
            setState({})
        }
    }, [])

    useEffect(() => {
        try {
            window.localStorage.setItem('hanasand:dwm-case-state', JSON.stringify(state))
        } catch {
            // Local notes are a convenience; workflow actions still persist through the API.
        }
    }, [state])

    return [state, setState] as const
}

function orderAlerts(alerts: PortalAlert[]) {
    const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }
    return [...alerts].sort((a, b) => {
        const stateDelta = stateWeight(b) - stateWeight(a)
        if (stateDelta) return stateDelta
        const severityDelta = (severityWeight[b.severity] ?? 0) - (severityWeight[a.severity] ?? 0)
        if (severityDelta) return severityDelta
        return String(b.firstSeenAt).localeCompare(String(a.firstSeenAt))
    })
}

function visibleQueueAlerts(queue: PortalAlert[], selectedId?: string) {
    const limit = 12
    const firstPage = queue.slice(0, limit)
    if (!selectedId || firstPage.some(alert => alert.id === selectedId)) return firstPage
    const selected = queue.find(alert => alert.id === selectedId)
    return selected ? [selected, ...firstPage.slice(0, limit - 1)] : firstPage
}

function filterAlerts(alerts: PortalAlert[], filter: QueueFilter, query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    return alerts.filter(alert => {
        const filterMatch = filter === 'all'
            || (filter === 'active' && alert.deliveryState !== 'muted' && alert.reviewState !== 'resolved')
            || (filter === 'ready' && alert.deliveryState === 'ready_to_send')
            || (filter === 'critical' && alert.severity === 'critical')
            || (filter === 'source' && ['telegram_public', 'darkweb_metadata'].includes(alert.sourceFamily))
            || (filter === 'high_confidence' && alert.confidence >= 80)
            || (filter === 'fresh' && isFreshAlert(alert))
            || (filter === 'pending_delivery' && ['ready_to_send', 'pending_review'].includes(alert.deliveryState || 'pending_review'))
            || (filter === 'reviewing' && alert.reviewState === 'reviewing')
            || (filter === 'delivered' && (alert.deliveryState === 'delivered' || Boolean(alert.deliveredAt)))
            || (filter === 'muted' && (alert.deliveryState === 'muted' || alert.reviewState === 'false_positive'))
        if (!filterMatch) return false
        if (!normalizedQuery) return true
        const haystack = [
            alert.company,
            alert.actor,
            alert.matchedTerm.value,
            alert.matchedTerm.kind,
            alert.sourceFamily,
            alert.artifactType,
            alert.severity,
            alert.reviewState,
            alert.deliveryState,
            alert.routingContext?.queue,
            alert.routingContext?.urgency,
            alert.claimSummary,
        ].filter(Boolean).join(' ').toLowerCase()
        return haystack.includes(normalizedQuery)
    })
}

function isFreshAlert(alert: PortalAlert) {
    const value = alert.lastSeenAt || alert.evidenceSummary?.lastObservedAt || alert.firstSeenAt
    const timestamp = new Date(value).getTime()
    if (Number.isNaN(timestamp)) return false
    return Date.now() - timestamp < 1000 * 60 * 60 * 24 * 7
}

function selectedWorkflowContext(alert: PortalAlert, deliveries: DeliveryItem[]) {
    const workflowContext = alert.workflowContext
    const webhookContext = alert.webhookContext
    const organizationId = alert.organizationId || workflowContext?.organizationId
    const watchlistIds = workflowContext?.watchlistIds || []
    const webhookDestinationIds = webhookContext?.webhookDestinationIds || workflowContext?.webhookDestinationIds || []
    const caseId = alert.caseId || alert.caseIdCandidate || workflowContext?.caseIdCandidate || webhookContext?.caseIdCandidate
    const lastDelivery = [...deliveries].sort((first, second) => second.attemptedAt.localeCompare(first.attemptedAt))[0]
    return {
        organizationId,
        watchlistIds,
        webhookDestinationIds,
        caseId,
        hasWebhookRoute: Boolean(webhookContext?.hasWebhookRoute || webhookDestinationIds.length || alert.webhookDelivery.dedupeKey),
        lastDelivery,
    }
}

function stateWeight(alert: PortalAlert) {
    if (alert.deliveryState === 'ready_to_send') return 5
    if (alert.severity === 'critical') return 4
    if (alert.reviewState === 'reviewing') return 3
    if (alert.deliveryState === 'muted') return 0
    return 2
}

function buildTimeline(alert: PortalAlert, deliveries: DeliveryItem[], context?: {
    localState?: LocalCaseState
    selectedEvidence?: PortalAlert['evidence'][number]
    selectedEntity?: ReturnType<typeof buildExposureEntities>[number]
    sourceFilter?: string
    actionMessage?: { ok: boolean, text: string } | null
}) {
    const events = alert.workflowEvents ?? []
    const localRows = [
        ...Object.entries(context?.localState?.evidenceDispositions ?? {}).map(([evidenceId, disposition]) => ({
            id: `${alert.id}:disposition:${evidenceId}`,
            at: disposition.at,
            title: 'Evidence decision',
            detail: `${stateLabel(disposition.state)} · ${evidenceId}`,
        })),
        context?.localState?.assignee ? {
            id: `${alert.id}:local-owner`,
            at: new Date().toISOString(),
            title: 'Owner selected',
            detail: context.localState.assignee,
        } : undefined,
        context?.localState?.note ? {
            id: `${alert.id}:local-note`,
            at: new Date().toISOString(),
            title: 'Decision drafted',
            detail: context.localState.note,
        } : undefined,
        context?.selectedEntity ? {
            id: `${alert.id}:entity:${context.selectedEntity.key}`,
            at: context.selectedEntity.newestAt,
            title: 'Entity pivot',
            detail: `${stateLabel(context.selectedEntity.kind)} · ${context.selectedEntity.name}`,
        } : undefined,
        context?.selectedEvidence ? {
            id: `${alert.id}:evidence:${context.selectedEvidence.id}`,
            at: context.selectedEvidence.observedAt || context.selectedEvidence.firstSeenAt || alert.firstSeenAt,
            title: 'Evidence selected',
            detail: `${context.selectedEvidence.sourceName} · ${context.selectedEvidence.contentHash}`,
        } : undefined,
        context?.sourceFilter && context.sourceFilter !== 'all' ? {
            id: `${alert.id}:source-filter:${context.sourceFilter}`,
            at: alert.lastSeenAt || alert.firstSeenAt,
            title: 'Source filter',
            detail: stateLabel(context.sourceFilter),
        } : undefined,
        context?.actionMessage ? {
            id: `${alert.id}:action-result`,
            at: new Date().toISOString(),
            title: context.actionMessage.ok ? 'Action completed' : 'Action failed',
            detail: context.actionMessage.text,
        } : undefined,
    ].filter(Boolean) as Array<{ id: string, at: string, title: string, detail: string }>
    return [
        { id: `${alert.id}:created`, at: alert.savedAt || alert.firstSeenAt, title: 'Case opened', detail: `${stateLabel(alert.sourceFamily)} evidence matched ${alert.matchedTerm.value}.` },
        ...events.map(event => ({
            id: event.id,
            at: event.at,
            title: `${stateLabel(event.fromReviewState || 'queued')} to ${stateLabel(event.toReviewState || 'updated')}`,
            detail: [
                event.note || `${stateLabel(event.fromDeliveryState || 'pending')} to ${stateLabel(event.toDeliveryState || 'pending')}`,
                event.toOwner ? `Owner: ${event.toOwner}` : undefined,
            ].filter(Boolean).join(' · '),
        })),
        ...deliveries.map(delivery => ({
            id: delivery.id,
            at: delivery.attemptedAt,
            title: `Webhook ${stateLabel(delivery.status)}`,
            detail: delivery.error || `HTTP ${delivery.httpStatus ?? 0} · ${delivery.endpointHash}`,
        })),
        ...localRows,
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

function actionReady(alert: PortalAlert, action: DwmAlertAnalystAction) {
    const actionState = alert.sourceHandoffReadiness?.analystWorkflowConsumer?.actionReadiness
    if (!actionState) return true
    const row = actionState.actions?.find(item => item.action === action)
    if (row) return row.ready
    if (actionState.blockedActions?.includes(action)) return false
    if (actionState.readyActions?.length) return actionState.readyActions.includes(action)
    return true
}

async function readPayload(response: Response): Promise<{ error?: { message?: string }, attemptedCount?: number, case?: { id?: string }, alertCaseHandoff?: { caseId?: string }, delivery?: DeliveryItem, deliveries?: DeliveryItem[] }> {
    return await response.json().catch(() => ({}))
}

function mergeDeliveries(incoming: DeliveryItem[], current: DeliveryItem[]) {
    const rows = [...incoming, ...current]
    const seen = new Set<string>()
    return rows
        .filter(row => {
            if (!row?.id || seen.has(row.id)) return false
            seen.add(row.id)
            return true
        })
        .sort((first, second) => String(second.attemptedAt).localeCompare(String(first.attemptedAt)))
}

function deliveryActionMessage(rows: DeliveryItem[], attemptedCount: number | undefined, fallback: string) {
    const row = rows[0]
    if (!row) return attemptedCount ? `${fallback} attempted.` : `${fallback} did not find a configured destination.`
    const destination = row.endpointHint || row.endpointHash || row.webhookDestinationId || row.destinationId || 'redacted destination'
    const retry = row.nextRetryAt ? ` Retry ${relativeTimeLabel(row.nextRetryAt)}.` : ''
    const error = row.error ? ` ${row.error}` : ''
    return `${fallback} ${stateLabel(row.status)} for ${destination}.${retry}${error}`
}

function deliverySummaryLabel(rows: DeliveryItem[]) {
    if (!rows.length) return 'Not tested'
    if (rows.some(row => row.status === 'delivered')) {
        return `${rows.filter(row => row.status === 'delivered').length} delivered`
    }
    if (rows.some(row => row.status === 'dry_run')) {
        return `${rows.filter(row => row.status === 'dry_run').length} tested`
    }
    if (rows.some(row => row.status === 'failed')) {
        return `${rows.filter(row => row.status === 'failed').length} failed`
    }
    return `${rows.length} attempted`
}

function webhookReady(label: string) {
    const normalized = label.toLowerCase()
    return normalized.includes('delivered') || normalized.includes('tested') || normalized.includes('attempted')
}

function retryStateLabel(delivery: DeliveryItem) {
    if (delivery.status === 'failed') return delivery.errorClass ? stateLabel(delivery.errorClass) : 'review failure'
    if (delivery.status === 'skipped') return 'not eligible'
    if (delivery.status === 'dry_run') return 'test only'
    return 'none'
}

function organizationDeliveryWorkspaceHref(input: { organizationId?: string, alertId?: string, caseId?: string, delivery?: DeliveryItem }) {
    const params = new URLSearchParams()
    if (input.organizationId) params.set('organizationId', input.organizationId)
    params.set('focus', 'destinations')
    if (input.alertId) params.set('alertId', input.alertId)
    if (input.caseId) params.set('caseId', input.caseId)
    if (input.delivery?.webhookDestinationId || input.delivery?.destinationId) {
        params.set('destinationId', input.delivery.webhookDestinationId || input.delivery.destinationId || '')
    }
    if (input.delivery?.id) params.set('deliveryId', input.delivery.id)
    if (input.delivery?.watchlistId) params.set('watchlistId', input.delivery.watchlistId)
    return `/organizations?${params.toString()}`
}

function caseDetailHref(caseId: string, alertId?: string, organizationId?: string, route?: string) {
    const params = new URLSearchParams()
    if (organizationId) params.set('organizationId', organizationId)
    if (alertId) params.set('alertId', alertId)
    if (route) params.set('route', route)
    const query = params.toString()
    return `/dashboard/dwm/cases/${encodeURIComponent(caseId)}${query ? `?${query}` : ''}`
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold text-ui-danger'
    if (severity === 'high') return 'rounded-full bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

function deliveryClass(status: string) {
    if (status === 'delivered') return 'rounded-full bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'
    if (status === 'failed') return 'rounded-full bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold text-ui-danger'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

function dispositionClass(state?: EvidenceDispositionState) {
    if (state === 'escalated') return 'rounded-full bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning'
    if (state === 'suppressed' || state === 'false_positive') return 'rounded-full bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold text-ui-danger'
    if (state === 'reviewed') return 'rounded-full bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'
    return 'rounded-full bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

function stateLabel(value: string) {
    return value.replaceAll('_', ' ')
}

function relativeTimeLabel(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const deltaMs = Date.now() - date.getTime()
    const absMinutes = Math.round(Math.abs(deltaMs) / 60000)
    const suffix = deltaMs >= 0 ? 'ago' : 'from now'
    if (absMinutes < 1) return deltaMs >= 0 ? 'just now' : 'under 1 min from now'
    if (absMinutes < 60) return `${absMinutes} min ${suffix}`
    const absHours = Math.round(absMinutes / 60)
    if (absHours < 24) return `${absHours} hr ${suffix}`
    const absDays = Math.round(absHours / 24)
    if (absDays < 7) return `${absDays} day${absDays === 1 ? '' : 's'} ${suffix}`
    return shortTime(value)
}
