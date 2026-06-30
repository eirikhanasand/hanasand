'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, Fingerprint, Loader2, MessageSquareText, Play, Radar, RotateCcw, Search, Send, ShieldAlert, ShieldCheck, SlidersHorizontal, UserRound, Webhook, XCircle } from 'lucide-react'
import type { DwmAlert, DwmProductSnapshot } from '@/utils/dwm/product'
import { DwmWorkflowActions } from './dwm-workflow-actions'

type PortalAlert = DwmAlert & {
    deliveryState?: string
    workflowNote?: string
    assignedOwner?: string
    replayCount?: number
    lastReplayedAt?: string
    savedAt?: string
    deliveredAt?: string
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
    endpointHash: string
    dedupeKey: string
    attemptedAt: string
    dryRun?: boolean
    payloadHash: string
    status: string
    httpStatus?: number
    error?: string
}

type PortalProps = {
    snapshot: DwmProductSnapshot
    operations: OperationsSnapshot | null
    alerts: PortalAlert[]
    deliveries: DeliveryItem[]
    dataHealth: DwmDataHealth
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

type QueueFilter = 'active' | 'ready' | 'critical' | 'reviewing' | 'delivered' | 'muted' | 'all'

export function DwmAnalystPortal({ snapshot, operations, alerts, deliveries, dataHealth }: PortalProps) {
    const router = useRouter()
    const [selectedId, setSelectedId] = useState(alerts[0]?.id ?? '')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const [localCaseState, setLocalCaseState] = useLocalCaseState()
    const [queueFilter, setQueueFilter] = useState<QueueFilter>('active')
    const [queueQuery, setQueueQuery] = useState('')
    const queue = useMemo(() => filterAlerts(orderAlerts(alerts), queueFilter, queueQuery), [alerts, queueFilter, queueQuery])
    const selectedAlert = queue.find(alert => alert.id === selectedId) ?? queue[0]
    const selectedDeliveries = selectedAlert ? deliveries.filter(delivery => delivery.alertId === selectedAlert.id) : []
    const criticalCount = alerts.filter(alert => alert.severity === 'critical').length
    const readyCount = alerts.filter(alert => alert.deliveryState === 'ready_to_send').length
    const activeCount = alerts.filter(alert => alert.deliveryState !== 'muted' && alert.reviewState !== 'resolved').length
    const latestCaptures = operations?.latestCaptures ?? []
    const latestRunLabel = operations?.latestRun ? `${operations.latestRun.captureCount} captures` : 'No run yet'
    const watchTermCount = snapshot.watchlist.length
    const webhookState = deliveries.some(delivery => delivery.alertId === 'webhook_test' && (delivery.status === 'dry_run' || delivery.status === 'delivered')) ? 'Tested' : 'Not tested'

    useEffect(() => {
        if (queue.length && !queue.some(alert => alert.id === selectedId)) {
            setSelectedId(queue[0].id)
        }
    }, [queue, selectedId])

    async function updateAlert(alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) {
        await runAction(`update:${alertId}`, async () => {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ reviewState, deliveryState, note, assignedOwner, actor: 'dashboard' }),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return 'Case updated.'
        })
    }

    async function replayAlert(alertId: string) {
        await runAction(`replay:${alertId}`, async () => {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}/replay`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ actor: 'dashboard' }),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return 'Evidence replay recorded.'
        })
    }

    async function sendAlert(alertId: string) {
        await runAction(`send:${alertId}`, async () => {
            const response = await fetch('/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tenantId: 'default', alertId, limit: 1 }),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.attemptedCount ? 'Webhook delivery attempted.' : 'No webhook delivery was attempted.'
        })
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

    return (
        <div className='grid gap-4'>
            <section className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
                <div className='border-b border-[#e8edf5] bg-[#171a21] px-4 py-3 text-white'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <StatusPill label='Cases' value={String(alerts.length)} tone={alerts.length ? 'warn' : 'neutral'} />
                            <StatusPill label='Active' value={String(activeCount)} tone={activeCount ? 'warn' : 'neutral'} />
                            <StatusPill label='Critical' value={String(criticalCount)} tone={criticalCount ? 'warn' : 'neutral'} />
                            <StatusPill label='Ready' value={String(readyCount)} tone={readyCount ? 'good' : 'neutral'} />
                            <StatusPill label='Watchlist' value={`${watchTermCount} terms`} tone={watchTermCount ? 'good' : 'warn'} />
                            <StatusPill label='Webhook' value={webhookState} tone={webhookState === 'Tested' ? 'good' : 'warn'} />
                            <StatusPill label='Latest run' value={latestRunLabel} tone={operations?.latestRun?.status === 'completed' ? 'good' : 'neutral'} />
                        </div>
                        <div className='text-right'>
                            <p className='text-[10px] font-semibold uppercase text-[#9db4ff]'>Monitoring state</p>
                            <p className='mt-1 text-sm font-semibold text-white'>{operations?.counts.activeSourceCount ?? 0}/{operations?.counts.sourceCount ?? 0} sources active</p>
                        </div>
                    </div>
                </div>

                <DataHealthBanner dataHealth={dataHealth} />

                <div className='grid min-h-[680px] xl:grid-cols-[320px_minmax(0,1fr)_360px]'>
                    <aside className='border-b border-[#e8edf5] bg-[#f8fafc] xl:border-b-0 xl:border-r'>
                        <div className='border-b border-[#e8edf5] p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h3 className='text-sm font-semibold text-[#171a21]'>Case queue</h3>
                                    <p className='mt-1 text-xs text-[#667085]'>{alerts.length ? `${queue.length}/${alerts.length} visible after filters.` : 'No matches for the saved watchlist yet.'}</p>
                                </div>
                                <Radar className='h-4 w-4 text-[#3056d3]' />
                            </div>
                            <div className='mt-4 grid gap-2'>
                                <label className='relative block'>
                                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]' />
                                    <input
                                        value={queueQuery}
                                        onChange={event => setQueueQuery(event.target.value)}
                                        placeholder='Search company, actor, term, route'
                                        className='h-10 w-full rounded-lg border border-[#d8dee9] bg-white pl-9 pr-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                                    />
                                </label>
                                <div className='grid grid-cols-2 gap-1.5'>
                                    {queueFilters.map(filter => (
                                        <button
                                            key={filter.id}
                                            type='button'
                                            onClick={() => setQueueFilter(filter.id)}
                                            className={`h-8 rounded-lg border px-2 text-xs font-semibold transition ${queueFilter === filter.id ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3]' : 'border-[#d8dee9] bg-white text-[#475467] hover:bg-[#f2f5f9]'}`}
                                        >
                                            {filter.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className='max-h-[610px] overflow-auto p-2'>
                            {queue.length ? queue.map(alert => (
                                <button
                                    key={alert.id}
                                    type='button'
                                    onClick={() => setSelectedId(alert.id)}
                                    className={`w-full rounded-lg border p-3 text-left transition ${selectedAlert?.id === alert.id ? 'border-[#3056d3] bg-white shadow-sm' : 'border-transparent hover:border-[#dfe5ee] hover:bg-white'}`}
                                >
                                    <div className='flex items-center justify-between gap-2'>
                                        <span className='truncate text-sm font-semibold text-[#171a21]'>{alert.company}</span>
                                        <span className={severityClass(alert.severity)}>{alert.severity}</span>
                                    </div>
                                    <p className='mt-1 truncate font-mono text-xs text-[#667085]'>{alert.matchedTerm.value}</p>
                                    <div className='mt-3 grid grid-cols-2 gap-2 text-[11px]'>
                                        <QueueCell label='route' value={stateLabel(alert.routingContext?.queue || alert.webhookDelivery.recommendedRoute)} />
                                        <QueueCell label='urgency' value={stateLabel(alert.routingContext?.urgency || (alert.severity === 'critical' ? 'immediate' : 'same_day'))} tone={alert.routingContext?.urgency === 'immediate' || alert.severity === 'critical' ? 'bad' : 'neutral'} />
                                        <QueueCell label='evidence' value={`${alert.evidenceSummary?.evidenceCount ?? alert.evidence.length}`} />
                                        <QueueCell label='last seen' value={relativeTimeLabel(alert.lastSeenAt || alert.evidenceSummary?.lastObservedAt || alert.firstSeenAt)} />
                                    </div>
                                    <p className='mt-3 line-clamp-2 text-xs leading-5 text-[#596170]'>{alert.claimSummary}</p>
                                </button>
                            )) : (
                                <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-white p-4 text-sm leading-6 text-[#596170]'>
                                    {alerts.length ? 'No cases match the current queue filter.' : 'No open cases. Monitoring is live, but the saved watchlist terms have not matched recent captures.'}
                                </div>
                            )}
                        </div>
                    </aside>

                    <main className='min-w-0 bg-white'>
                        {selectedAlert ? (
                            <CaseWorkspace
                                alert={selectedAlert}
                                deliveries={selectedDeliveries}
                                localState={localCaseState[selectedAlert.id]}
                                busyAction={busyAction}
                                onLocalStateChange={(patch) => {
                                    setLocalCaseState(current => ({
                                        ...current,
                                        [selectedAlert.id]: { ...(current[selectedAlert.id] ?? {}), ...patch },
                                    }))
                                }}
                                onUpdate={updateAlert}
                                onReplay={replayAlert}
                                onSend={sendAlert}
                            />
                        ) : (
                            <NoCaseWorkspace latestCaptures={latestCaptures} />
                        )}
                    </main>

                    <aside className='border-t border-[#e8edf5] bg-[#fbfcfe] xl:border-l xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <SourcePosture snapshot={snapshot} operations={operations} />
                            <DeliveryPanel alert={selectedAlert} deliveries={deliveries} />
                            <ActorPanel snapshot={snapshot} />
                        </div>
                    </aside>
                </div>
            </section>

            {message && (
                <p className={`rounded-lg border px-3 py-2 text-sm ${message.ok ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]' : 'border-[#fde2d6] bg-[#fff7f3] text-[#9a3412]'}`}>
                    {message.text}
                </p>
            )}

            <DwmWorkflowActions initialTerms={snapshot.watchlist.map(term => term.value)} />
        </div>
    )
}

function CaseWorkspace({ alert, deliveries, localState, busyAction, onLocalStateChange, onUpdate, onReplay, onSend }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    localState?: LocalCaseState
    busyAction: string | null
    onLocalStateChange: (patch: LocalCaseState) => void
    onUpdate: (alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) => Promise<void>
    onReplay: (alertId: string) => Promise<void>
    onSend: (alertId: string) => Promise<void>
}) {
    const timeline = buildTimeline(alert, deliveries)
    const analystNote = localState?.note ?? ''
    const assignee = localState?.assignee ?? alert.assignedOwner ?? 'Unassigned'
    const persistedOwner = assignee === 'Unassigned' ? undefined : assignee
    const evidenceSummary = alert.evidenceSummary ?? fallbackEvidenceSummary(alert)
    const routingContext = alert.routingContext ?? fallbackRoutingContext(alert)
    const matchContext = alert.matchContext ?? {
        normalizedTerm: alert.matchedTerm.value.toLowerCase(),
        termKind: alert.matchedTerm.kind,
        matchType: 'case_insensitive_substring' as const,
        matchedFieldHints: [],
    }
    return (
        <div className='grid gap-5 p-5'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className={severityClass(alert.severity)}>{alert.severity}</span>
                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{alert.confidence}% confidence</span>
                        <span className='rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{stateLabel(alert.reviewState)}</span>
                        <span className='rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#596170]'>{stateLabel(alert.deliveryState || 'pending_review')}</span>
                    </div>
                    <h2 className='mt-3 text-2xl font-semibold tracking-normal text-[#171a21]'>{alert.company}</h2>
                    <p className='mt-1 text-sm text-[#596170]'>Matched <span className='font-mono'>{alert.matchedTerm.value}</span> from {stateLabel(alert.sourceFamily)} · {stateLabel(alert.artifactType)}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='review' onClick={() => onUpdate(alert.id, 'reviewing', 'pending_review', 'Analyst review started.', persistedOwner)}>Review</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='ready' onClick={() => onUpdate(alert.id, 'route_to_customer', 'ready_to_send', 'Escalated for customer delivery.', persistedOwner)}>Escalate</CaseButton>
                    <CaseButton busy={busyAction === `replay:${alert.id}`} icon='replay' onClick={() => onReplay(alert.id)}>Replay</CaseButton>
                    <CaseButton busy={busyAction === `send:${alert.id}`} icon='send' onClick={() => onSend(alert.id)}>Send</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='false' onClick={() => onUpdate(alert.id, 'false_positive', 'muted', 'Suppressed as false positive.', persistedOwner)}>Suppress</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='ready' onClick={() => onUpdate(alert.id, 'resolved', alert.deliveryState === 'delivered' ? 'delivered' : 'muted', 'Closed by analyst.', persistedOwner)}>Close</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='review' onClick={() => onUpdate(alert.id, 'needs_review', 'pending_review', 'Reopened for analyst review.', persistedOwner)}>Reopen</CaseButton>
                </div>
            </div>

            <section className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
                <div className='grid gap-0 md:grid-cols-4'>
                    <CaseMetric label='Route' value={stateLabel(routingContext.queue)} detail={stateLabel(routingContext.urgency)} tone={routingContext.urgency === 'immediate' ? 'bad' : routingContext.urgency === 'same_day' ? 'warn' : 'neutral'} />
                    <CaseMetric label='Evidence' value={`${evidenceSummary.evidenceCount}`} detail={`${evidenceSummary.publicSafeCount} redacted · ${evidenceSummary.metadataOnlyCount} metadata`} />
                    <CaseMetric label='First seen' value={shortTime(evidenceSummary.firstObservedAt)} detail={relativeTimeLabel(evidenceSummary.firstObservedAt)} />
                    <CaseMetric label='Last seen' value={shortTime(evidenceSummary.lastObservedAt)} detail={relativeTimeLabel(evidenceSummary.lastObservedAt)} />
                </div>
                <div className='grid gap-4 border-t border-[#eef1f5] bg-[#fbfcfe] p-4 lg:grid-cols-[0.8fr_1.2fr]'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-[#667085]'>Match context</p>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <span className='rounded-full bg-white px-2 py-1 font-mono text-xs font-semibold text-[#171a21]'>{matchContext.normalizedTerm}</span>
                            <span className='rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#596170]'>{stateLabel(matchContext.termKind)}</span>
                            <span className='rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#596170]'>{matchContext.matchedFieldHints.length ? matchContext.matchedFieldHints.join(', ') : stateLabel(matchContext.matchType)}</span>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {Object.entries(evidenceSummary.sourceFamilyCounts).map(([family, count]) => (
                                <span key={family} className='rounded-full border border-[#d8dee9] bg-white px-2 py-1 text-xs font-semibold text-[#344054]'>{stateLabel(family)}: {count}</span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className='text-xs font-semibold uppercase text-[#667085]'>Routing reason</p>
                        <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{routingContext.reason}</p>
                        <p className='mt-1 text-xs font-semibold text-[#667085]'>Customer evidence: {stateLabel(routingContext.customerVisibleEvidence)} · Dedupe {alert.webhookDelivery.dedupeKey}</p>
                    </div>
                </div>
            </section>

            <section className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4 lg:grid-cols-[0.55fr_1fr_auto] lg:items-end'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <UserRound className='h-4 w-4 text-[#3056d3]' />
                        Owner
                    </span>
                    <input
                        value={assignee === 'Unassigned' ? '' : assignee}
                        onChange={event => onLocalStateChange({ assignee: event.target.value.trim() || 'Unassigned' })}
                        placeholder='Assign analyst'
                        className='h-10 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                    />
                    <span className='text-[11px] text-[#667085]'>Saved to the shared DWM case when you save the note or decision.</span>
                </label>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <MessageSquareText className='h-4 w-4 text-[#3056d3]' />
                        Decision rationale
                    </span>
                    <textarea
                        value={analystNote}
                        onChange={event => onLocalStateChange({ note: event.target.value })}
                        placeholder='What was validated, who owns follow-up, and why this was escalated, suppressed, or closed'
                        className='min-h-20 resize-y rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
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

            <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4'>
                <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                    <ShieldAlert className='h-4 w-4 text-[#c2410c]' />
                    Investigation brief
                </div>
                <p className='mt-3 text-sm leading-6 text-[#3d4656]'>{alert.claimSummary}</p>
                <p className='mt-3 text-sm font-semibold leading-6 text-[#3056d3]'>{alert.recommendedAction}</p>
                {alert.workflowNote && <p className='mt-3 rounded-lg border border-[#dbe5ff] bg-white px-3 py-2 text-sm text-[#3056d3]'>{alert.workflowNote}</p>}
            </div>

            <section className='grid gap-3 lg:grid-cols-3'>
                <PlaybookStep done={alert.reviewState === 'reviewing' || alert.deliveryState === 'ready_to_send' || Boolean(alert.deliveredAt)} title='Validate match' body='Confirm watched term, actor context, and source provenance before routing.' />
                <PlaybookStep done={alert.deliveryState === 'ready_to_send' || Boolean(alert.deliveredAt)} title='Prepare customer route' body={`Recommended route: ${stateLabel(alert.webhookDelivery.recommendedRoute)}.`} />
                <PlaybookStep done={Boolean(alert.deliveredAt || deliveries.some(delivery => delivery.status === 'delivered'))} title='Notify and monitor' body='Send webhook, preserve dedupe key, and keep source monitoring active.' />
            </section>

            <section className='grid gap-4 lg:grid-cols-[1fr_0.82fr]'>
                <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                    <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                        <div>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Evidence replay</h3>
                            <p className='mt-0.5 text-xs text-[#667085]'>Safe excerpts, hashes, source families, provenance, and retention state.</p>
                        </div>
                        <RotateCcw className='h-4 w-4 text-[#3056d3]' />
                    </div>
                    <div className='grid gap-3 p-4'>
                        {alert.evidence.map(item => (
                            <div key={item.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-semibold text-[#171a21]'>{item.sourceName}</span>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{stateLabel(item.redactionState)}</span>
                                    <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{stateLabel(item.captureMode)}</span>
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{item.excerpt}</p>
                                <div className='mt-3 grid gap-2 rounded-lg border border-[#eef1f5] bg-white p-3 text-xs text-[#667085] sm:grid-cols-2'>
                                    <p><span className='font-semibold text-[#475467]'>Observed:</span> {item.observedAt ? shortTime(item.observedAt) : 'unknown'}</p>
                                    <p><span className='font-semibold text-[#475467]'>Capture:</span> {item.provenance?.captureId ?? item.id}</p>
                                    <p><span className='font-semibold text-[#475467]'>Source:</span> {item.provenance?.sourceId ?? item.sourceName}</p>
                                    <p><span className='font-semibold text-[#475467]'>Collector:</span> {item.provenance?.collector || item.provenance?.sourceType || 'unknown'}</p>
                                </div>
                                <p className='mt-3 break-all font-mono text-[11px] text-[#667085]'>{item.contentHash}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                    <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                        <div>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Case timeline</h3>
                            <p className='mt-0.5 text-xs text-[#667085]'>{timeline.length} event{timeline.length === 1 ? '' : 's'} recorded.</p>
                        </div>
                        <Clock3 className='h-4 w-4 text-[#3056d3]' />
                    </div>
                    <div className='grid gap-3 p-4'>
                        {timeline.map(item => (
                            <div key={item.id} className='grid grid-cols-[auto_1fr] gap-3'>
                                <span className='mt-1 h-2.5 w-2.5 rounded-full bg-[#3056d3]' />
                                <div>
                                    <p className='text-sm font-semibold text-[#171a21]'>{item.title}</p>
                                    <p className='mt-1 text-xs leading-5 text-[#667085]'>{item.detail}</p>
                                    <p className='mt-1 text-[11px] text-[#98a2b3]'>{relativeTimeLabel(item.at)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    )
}

function NoCaseWorkspace({ latestCaptures }: { latestCaptures: OperationsSnapshot['latestCaptures'] }) {
    return (
        <div className='grid gap-5 p-5'>
            <div className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4 md:grid-cols-3'>
                <WorkTile title='1. Watch terms' body='Keep company, domain, supplier, brand, and product terms current.' state='active' />
                <WorkTile title='2. Collect sources' body='Run Telegram and metadata-only dark web collection after watchlist changes.' state='active' />
                <WorkTile title='3. Route alerts' body='Test the webhook before the first real customer alert.' state='pending' />
            </div>
            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-white p-5'>
                <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <ShieldCheck className='h-4 w-4 text-[#147a3b]' />
                        No open cases
                    </div>
                    <span className='rounded-full bg-[#f4fbf7] px-2 py-1 text-xs font-semibold text-[#147a3b]'>Monitoring live</span>
                </div>
                <p className='mt-2 text-sm leading-6 text-[#596170]'>Fresh captures are still useful here: they show what the system is collecting and whether the watchlist needs better terms.</p>
            </div>
            <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                <div className='border-b border-[#eef1f5] px-4 py-3'>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Recent capture review</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>Useful for tuning watchlist terms without dumping raw rows.</p>
                </div>
                <div className='grid gap-2 p-4'>
                    {latestCaptures.slice(0, 8).map(capture => (
                        <div key={capture.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='font-mono text-xs font-semibold text-[#171a21]'>{capture.sourceName}</span>
                                <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{stateLabel(capture.family)}</span>
                                <span className='text-xs text-[#667085]'>{relativeTimeLabel(capture.collectedAt)}</span>
                            </div>
                            <p className='mt-2 line-clamp-2 text-sm leading-6 text-[#3d4656]'>{capture.safeExcerpt}</p>
                        </div>
                    ))}
                    {!latestCaptures.length && <p className='text-sm text-[#667085]'>No recent captures returned by the scraper operations API.</p>}
                </div>
            </div>
        </div>
    )
}

function SourcePosture({ snapshot, operations }: { snapshot: DwmProductSnapshot, operations: OperationsSnapshot | null }) {
    const sourceRows = operations?.sourceHealth ?? []
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Source posture</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{operations ? `${operations.counts.activeSourceCount}/${operations.counts.sourceCount} active sources` : 'Source inventory'}</p>
                </div>
                <SlidersHorizontal className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='p-3'>
                {sourceRows.length ? (
                    <div className='overflow-hidden rounded-lg border border-[#eef1f5]'>
                        <table className='w-full text-left text-xs'>
                            <thead className='bg-[#f8fafc] text-[10px] uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-3 py-2 font-semibold'>Source</th>
                                    <th className='px-3 py-2 font-semibold'>State</th>
                                    <th className='px-3 py-2 font-semibold'>Last pull</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#eef1f5]'>
                                {sourceRows.slice(0, 8).map(source => (
                                    <tr key={source.sourceId} className='bg-white align-top'>
                                        <td className='px-3 py-2'>
                                            <p className='max-w-[150px] truncate font-semibold text-[#171a21]' title={source.sourceName}>{source.sourceName}</p>
                                            <p className='mt-0.5 text-[11px] text-[#667085]'>{stateLabel(source.family)} · {source.approvedMetadataOnly ? 'metadata only' : 'message capture'}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={source.status === 'active' ? 'rounded-full bg-[#f4fbf7] px-2 py-0.5 font-semibold text-[#147a3b]' : 'rounded-full bg-[#fff7ed] px-2 py-0.5 font-semibold text-[#b45309]'}>
                                                {stateLabel(source.status)}
                                            </span>
                                        </td>
                                        <td className='px-3 py-2 font-semibold text-[#475467]'>{source.lastCollectedAt ? relativeTimeLabel(source.lastCollectedAt) : 'never'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className='grid gap-2'>
                        {snapshot.sourceCoverage.map(source => (
                            <div key={source.family} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-semibold text-[#171a21]'>{source.label}</span>
                                    <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{source.activeCount}/{source.sourceCount}</span>
                                </div>
                                <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#667085]'>{source.detail}</p>
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
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Customer delivery</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>Webhook attempts and test sends.</p>
                </div>
                <Webhook className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='grid gap-2 p-3'>
                {visible.slice(0, 6).map(delivery => (
                    <div key={delivery.id} className='grid gap-2 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <span className={deliveryClass(delivery.status)}>{stateLabel(delivery.status)}</span>
                            <span className='text-xs font-semibold text-[#667085]'>{relativeTimeLabel(delivery.attemptedAt)}</span>
                        </div>
                        <div className='grid grid-cols-2 gap-2 text-[11px] text-[#667085]'>
                            <p><span className='font-semibold text-[#475467]'>HTTP:</span> {delivery.httpStatus ?? (delivery.dryRun ? 'dry run' : 'pending')}</p>
                            <p><span className='font-semibold text-[#475467]'>Payload:</span> {delivery.payloadHash}</p>
                            <p className='col-span-2 break-all'><span className='font-semibold text-[#475467]'>Endpoint:</span> {delivery.endpointHash}</p>
                            <p className='col-span-2 break-all'><span className='font-semibold text-[#475467]'>Dedupe:</span> {delivery.dedupeKey}</p>
                        </div>
                        {delivery.error && <p className='text-xs text-[#9a3412]'>{delivery.error}</p>}
                    </div>
                ))}
                {!visible.length && <p className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-3 text-sm text-[#596170]'>No webhook attempts yet.</p>}
            </div>
        </section>
    )
}

const queueFilters: Array<{ id: QueueFilter, label: string }> = [
    { id: 'active', label: 'Active' },
    { id: 'ready', label: 'Ready' },
    { id: 'critical', label: 'Critical' },
    { id: 'reviewing', label: 'Reviewing' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'muted', label: 'Muted' },
    { id: 'all', label: 'All' },
]

function DataHealthBanner({ dataHealth }: { dataHealth: DwmDataHealth }) {
    const items = [
        { id: 'snapshot', item: dataHealth.snapshot },
        { id: 'operations', item: dataHealth.operations },
        { id: 'alerts', item: dataHealth.alerts },
        { id: 'deliveries', item: dataHealth.deliveries },
    ]
    const hasProblem = items.some(({ item }) => item.state === 'error' || item.state === 'fallback' || item.state === 'missing') || dataHealth.usingFallbackAlerts
    return (
        <div className={`border-b px-4 py-3 ${hasProblem ? 'border-[#fde2d6] bg-[#fffaf7]' : 'border-[#e7f0e9] bg-[#f7fbf8]'}`}>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
                <div className='min-w-0'>
                    <p className={`text-xs font-semibold uppercase ${hasProblem ? 'text-[#b45309]' : 'text-[#147a3b]'}`}>
                        {hasProblem ? 'Data source attention' : 'Live data connected'}
                    </p>
                    <p className='mt-1 text-sm leading-6 text-[#3d4656]'>
                        {dataHealth.usingFallbackAlerts
                            ? 'Saved workflow alerts were empty, so the queue is using the current product snapshot.'
                            : hasProblem
                                ? 'One or more backing APIs are unavailable; actions still use the configured workflow routes.'
                                : 'Snapshot, operations, alert workflow, and delivery APIs responded.'}
                    </p>
                </div>
                <div className='grid gap-2 sm:grid-cols-2 lg:min-w-[560px] lg:grid-cols-4'>
                    {items.map(({ id, item }) => <DataHealthSegment key={id} item={item} />)}
                </div>
            </div>
        </div>
    )
}

function DataHealthSegment({ item }: { item: DataHealthItem }) {
    const tone = item.state === 'live'
        ? 'border-[#d6e9de] bg-white text-[#147a3b]'
        : item.state === 'error'
            ? 'border-[#fde2d6] bg-white text-[#9a3412]'
            : 'border-[#ffe6bd] bg-white text-[#b45309]'
    return (
        <div className={`min-w-0 rounded-lg border px-3 py-2 ${tone}`}>
            <p className='truncate text-xs font-semibold' title={item.label}>{item.label}</p>
            <p className='mt-1 truncate text-[11px] text-[#667085]' title={item.detail}>{item.detail}</p>
        </div>
    )
}

function ActorPanel({ snapshot }: { snapshot: DwmProductSnapshot }) {
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Actor context</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>Actor, sources, latest sighting, and watch state.</p>
                </div>
                <Fingerprint className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='grid gap-2 p-3'>
                {snapshot.actorOverviews.slice(0, 4).map(actor => (
                    <div key={actor.actor} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
                        <div className='flex items-center justify-between gap-3'>
                            <span className='text-sm font-semibold text-[#171a21]'>{actor.actor}</span>
                            <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{actor.confidence}%</span>
                        </div>
                        <div className='mt-3 grid grid-cols-3 gap-2 text-[11px]'>
                            <QueueCell label='sources' value={`${actor.sourceCount}`} />
                            <QueueCell label='captures' value={`${actor.captureCount}`} />
                            <QueueCell label='latest' value={relativeTimeLabel(actor.latestSeenAt)} />
                        </div>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{stateLabel(actor.watchState)}</span>
                            {actor.sourceFamilies.slice(0, 2).map(family => (
                                <span key={family} className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{stateLabel(family)}</span>
                            ))}
                        </div>
                    </div>
                ))}
                {!snapshot.actorOverviews.length && <p className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-3 text-sm text-[#596170]'>No actor context in recent metadata yet.</p>}
            </div>
        </section>
    )
}

function StatusPill({ label, value, tone }: { label: string, value: string, tone: 'good' | 'warn' | 'neutral' }) {
    const toneClass = tone === 'good' ? 'border-[#2f8f56]/40 bg-[#163822] text-[#d9f8e5]' : tone === 'warn' ? 'border-[#f97316]/40 bg-[#3a2418] text-[#ffedd5]' : 'border-white/15 bg-white/8 text-[#e7edf8]'
    return (
        <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
            <p className='text-[10px] font-semibold uppercase opacity-75'>{label}</p>
            <p className='mt-0.5 text-sm font-semibold'>{value}</p>
        </div>
    )
}

function CaseMetric({ label, value, detail, tone = 'neutral' }: { label: string, value: string, detail: string, tone?: 'neutral' | 'warn' | 'bad' }) {
    const toneClass = tone === 'bad'
        ? 'text-[#c2410c]'
        : tone === 'warn'
            ? 'text-[#b45309]'
            : 'text-[#3056d3]'
    return (
        <div className='border-b border-r border-[#eef1f5] p-4 last:border-r-0 md:border-b-0'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 text-xs font-semibold text-[#667085]'>{detail}</p>
        </div>
    )
}

function QueueCell({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'bad' }) {
    return (
        <div className='rounded-lg border border-[#eef1f5] bg-white px-2 py-1.5'>
            <p className='text-[9px] font-semibold uppercase text-[#98a2b3]'>{label}</p>
            <p className={`mt-0.5 truncate font-semibold ${tone === 'bad' ? 'text-[#c2410c]' : 'text-[#475467]'}`} title={value}>{value}</p>
        </div>
    )
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

function WorkTile({ title, body, state }: { title: string, body: string, state: 'active' | 'pending' }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
            <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-semibold text-[#171a21]'>{title}</h3>
                <span className={state === 'active' ? 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-[11px] font-semibold text-[#147a3b]' : 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]'}>
                    {state}
                </span>
            </div>
            <p className='mt-2 text-xs leading-5 text-[#596170]'>{body}</p>
        </div>
    )
}

function PlaybookStep({ done, title, body }: { done: boolean, title: string, body: string }) {
    return (
        <div className={`rounded-lg border p-3 ${done ? 'border-[#d6e9de] bg-[#f4fbf7]' : 'border-[#e0e5ed] bg-white'}`}>
            <div className='flex items-center gap-2'>
                {done ? <CheckCircle2 className='h-4 w-4 text-[#147a3b]' /> : <Clock3 className='h-4 w-4 text-[#667085]' />}
                <h3 className='text-sm font-semibold text-[#171a21]'>{title}</h3>
            </div>
            <p className='mt-2 text-xs leading-5 text-[#596170]'>{body}</p>
        </div>
    )
}

function CaseButton({ busy, icon, onClick, children }: { busy: boolean, icon: 'review' | 'ready' | 'replay' | 'send' | 'false', onClick: () => void, children: string }) {
    const Icon = busy ? Loader2 : icon === 'send' ? Send : icon === 'false' ? XCircle : icon === 'replay' ? RotateCcw : icon === 'ready' ? CheckCircle2 : Play
    return (
        <button type='button' onClick={onClick} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {children}
        </button>
    )
}

type LocalCaseState = {
    assignee?: string
    note?: string
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

function filterAlerts(alerts: PortalAlert[], filter: QueueFilter, query: string) {
    const normalizedQuery = query.trim().toLowerCase()
    return alerts.filter(alert => {
        const filterMatch = filter === 'all'
            || (filter === 'active' && alert.deliveryState !== 'muted' && alert.reviewState !== 'resolved')
            || (filter === 'ready' && alert.deliveryState === 'ready_to_send')
            || (filter === 'critical' && alert.severity === 'critical')
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

function stateWeight(alert: PortalAlert) {
    if (alert.deliveryState === 'ready_to_send') return 5
    if (alert.severity === 'critical') return 4
    if (alert.reviewState === 'reviewing') return 3
    if (alert.deliveryState === 'muted') return 0
    return 2
}

function buildTimeline(alert: PortalAlert, deliveries: DeliveryItem[]) {
    const events = alert.workflowEvents ?? []
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
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)))
}

async function readPayload(response: Response): Promise<{ error?: { message?: string }, attemptedCount?: number }> {
    return await response.json().catch(() => ({}))
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold text-[#c2410c]'
    if (severity === 'high') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]'
    return 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'
}

function deliveryClass(status: string) {
    if (status === 'delivered') return 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]'
    if (status === 'failed') return 'rounded-full bg-[#fff7f3] px-2 py-0.5 text-xs font-semibold text-[#9a3412]'
    return 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'
}

function stateLabel(value: string) {
    return value.replaceAll('_', ' ')
}

function relativeTimeLabel(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    const days = Math.round(hours / 24)
    return `${days} d ago`
}
