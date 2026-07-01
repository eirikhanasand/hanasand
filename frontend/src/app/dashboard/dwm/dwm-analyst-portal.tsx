'use client'

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, Copy, Fingerprint, Loader2, MessageSquareText, Play, Radar, RotateCcw, Search, Send, ShieldCheck, SlidersHorizontal, UserRound, Webhook, XCircle } from 'lucide-react'
import type { DwmAlert, DwmAlertAnalystAction, DwmProductSnapshot } from '@/utils/dwm/product'
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

export function DwmAnalystPortal({ snapshot, operations, alerts, deliveries, dataHealth, initialAlertId }: PortalProps) {
    const router = useRouter()
    const [selectedId, setSelectedId] = useState(initialAlertId && alerts.some(alert => alert.id === initialAlertId) ? initialAlertId : alerts[0]?.id ?? '')
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
    const freshCount = alerts.filter(isFreshAlert).length
    const highConfidenceCount = alerts.filter(alert => alert.confidence >= 80).length
    const latestCaptures = operations?.latestCaptures ?? []
    const latestRunLabel = operations?.latestRun ? `${operations.latestRun.captureCount} captures` : 'No run yet'
    const watchTermCount = snapshot.watchlist.length
    const webhookState = deliveries.some(delivery => delivery.alertId === 'webhook_test' && (delivery.status === 'dry_run' || delivery.status === 'delivered')) ? 'Tested' : 'Not tested'
    const apiProblemCount = [dataHealth.snapshot, dataHealth.operations, dataHealth.alerts, dataHealth.deliveries]
        .filter(item => item.state !== 'live').length + (dataHealth.usingFallbackAlerts ? 1 : 0)

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

    async function testDelivery(alertId: string) {
        await runAction(`test:${alertId}`, async () => {
            const response = await fetch('/api/dwm/webhooks/test', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tenantId: 'default', alertId, limit: 1 }),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return 'Webhook test completed.'
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
            <section className='min-w-0 overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
                <div className='border-b border-[#e8edf5] bg-[#171a21] px-4 py-3 text-white'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2'>
                            <StatusPill label='Cases' value={String(alerts.length)} tone={alerts.length ? 'warn' : 'neutral'} />
                            <StatusPill label='Active' value={String(activeCount)} tone={activeCount ? 'warn' : 'neutral'} />
                            <StatusPill label='Critical' value={String(criticalCount)} tone={criticalCount ? 'warn' : 'neutral'} />
                            <StatusPill label='Ready' value={String(readyCount)} tone={readyCount ? 'good' : 'neutral'} />
                            <StatusPill label='Fresh' value={String(freshCount)} tone={freshCount ? 'good' : 'neutral'} />
                            <StatusPill label='80%+' value={String(highConfidenceCount)} tone={highConfidenceCount ? 'good' : 'neutral'} />
                            <StatusPill label='Watchlist' value={`${watchTermCount} terms`} tone={watchTermCount ? 'good' : 'warn'} />
                            <StatusPill label='Webhook' value={webhookState} tone={webhookState === 'Tested' ? 'good' : 'warn'} />
                            <StatusPill label='Latest run' value={latestRunLabel} tone={operations?.latestRun?.status === 'completed' ? 'good' : 'neutral'} />
                            <StatusPill label='API' value={apiProblemCount ? `${apiProblemCount} issue${apiProblemCount === 1 ? '' : 's'}` : 'Live'} tone={apiProblemCount ? 'warn' : 'good'} />
                        </div>
                        <div className='min-w-0 text-left sm:shrink-0 sm:text-right'>
                            <p className='text-[10px] font-semibold uppercase text-[#9db4ff]'>Monitoring state</p>
                            <p className='mt-1 text-sm font-semibold text-white'>{operations?.counts.activeSourceCount ?? 0}/{operations?.counts.sourceCount ?? 0} sources active</p>
                        </div>
                    </div>
                </div>

                <div className='grid min-h-[680px] min-w-0 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]'>
                    <aside className='order-2 min-w-0 border-b border-[#e8edf5] bg-[#f8fafc] xl:order-none xl:border-b-0 xl:border-r'>
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

                    <main className='order-1 min-w-0 bg-white xl:order-none'>
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
                                onReplay={replayAlert}
                                onTest={testDelivery}
                                onSend={sendAlert}
                            />
                        ) : (
                            <NoCaseWorkspace latestCaptures={latestCaptures} />
                        )}
                    </main>

                    <aside className='order-3 min-w-0 border-t border-[#e8edf5] bg-[#fbfcfe] xl:col-span-2 xl:order-none 2xl:col-span-1 2xl:border-l 2xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <SourcePosture snapshot={snapshot} operations={operations} />
                            <DeliveryPanel alert={selectedAlert} deliveries={deliveries} />
                            <ActorPanel snapshot={snapshot} />
                        </div>
                    </aside>
                </div>
            </section>

            <DwmWorkflowActions initialTerms={snapshot.watchlist.map(term => term.value)} />
        </div>
    )
}

function CaseWorkspace({ alert, deliveries, sourceCoverage, sourceHealth, localState, busyAction, actionMessage, onLocalStateChange, onUpdate, onReplay, onTest, onSend }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    sourceCoverage: DwmProductSnapshot['sourceCoverage']
    sourceHealth: OperationsSnapshot['sourceHealth']
    localState?: LocalCaseState
    busyAction: string | null
    actionMessage: { ok: boolean, text: string } | null
    onLocalStateChange: (patch: LocalCaseState) => void
    onUpdate: (alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) => Promise<void>
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
                        <span className='min-w-0 rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{alert.confidence}% confidence</span>
                        <span className='min-w-0 rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{stateLabel(alert.reviewState)}</span>
                        <span className='min-w-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#596170]'>{stateLabel(alert.deliveryState || 'pending_review')}</span>
                    </div>
                    <h2 className='mt-3 wrap-break-word text-2xl font-semibold tracking-normal text-[#171a21]'>{alert.company}</h2>
                    <p className='mt-1 wrap-break-word text-sm leading-6 text-[#596170]'>
                        Matched <span className='font-mono'>{alert.matchedTerm.value}</span>
                        <span className='block sm:inline'> from {stateLabel(alert.sourceFamily)} · {stateLabel(alert.artifactType)}</span>
                    </p>
                </div>
            </div>

            <SelectedActionBar
                alert={alert}
                deliveries={deliveries}
                assignee={assignee}
                busyAction={busyAction}
                actionMessage={actionMessage}
                onUpdate={onUpdate}
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

            <section className='grid gap-2 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-3 sm:grid-cols-2 xl:grid-cols-5'>
                <ContextChip label='Org' value={workflowContext.organizationId || 'tenant default'} href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} />
                <ContextChip label='Watchlist' value={workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} scoped` : stateLabel(alert.matchedTerm.kind)} href='/organizations' />
                <ContextChip label='Case' value={workflowContext.caseId || 'candidate missing'} href={workflowContext.caseId ? `/api/cases/${encodeURIComponent(workflowContext.caseId)}${workflowContext.organizationId ? `?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : ''}` : undefined} />
                <ContextChip label='Delivery' value={workflowContext.lastDelivery ? `${stateLabel(workflowContext.lastDelivery.status)} · ${relativeTimeLabel(workflowContext.lastDelivery.attemptedAt)}` : workflowContext.hasWebhookRoute ? 'route configured' : 'route missing'} />
                <ContextChip label='Source' value={`${stateLabel(alert.sourceFamily)} · ${alert.sourceCount}`} />
            </section>

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

            <section className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 md:grid-cols-2'>
                <CaseBrief label='Claim' value={alert.claimSummary} />
                <CaseBrief label='Next action' value={alert.recommendedAction} />
                {alert.workflowNote && <CaseBrief label='Latest note' value={alert.workflowNote} />}
                <CaseBrief label='Customer route' value={`${stateLabel(alert.webhookDelivery.recommendedRoute)} · ${alert.webhookDelivery.dedupeKey}`} />
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

function InvestigationTabs({ active, onChange }: { active: InvestigationTab, onChange: (tab: InvestigationTab) => void }) {
    const tabs: Array<{ id: InvestigationTab, label: string }> = [
        { id: 'evidence', label: 'Evidence' },
        { id: 'entities', label: 'Entities' },
        { id: 'sources', label: 'Sources' },
        { id: 'delivery', label: 'Delivery/case' },
    ]
    return (
        <div className='flex gap-2 overflow-x-auto rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-2'>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    type='button'
                    onClick={() => onChange(tab.id)}
                    className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${active === tab.id ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3]' : 'border-[#d8dee9] bg-white text-[#475467] hover:bg-[#f2f5f9]'}`}
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
        <section className='rounded-lg border border-[#dfe5ee] bg-white'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Source coverage</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>Coverage, newest pull, and evidence count for this case.</p>
                </div>
                <button type='button' onClick={() => onSourceFilter('all')} className={`h-8 rounded-lg border px-3 text-xs font-semibold transition ${sourceFilter === 'all' ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3]' : 'border-[#d8dee9] bg-white text-[#475467] hover:bg-[#f2f5f9]'}`}>
                    All sources
                </button>
            </div>
            <div className='grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-5'>
                {rows.map(row => (
                    <button
                        key={row.family}
                        type='button'
                        onClick={() => onSourceFilter(row.family)}
                        className={`min-w-0 rounded-lg border p-3 text-left transition ${sourceFilter === row.family ? 'border-[#3056d3] bg-[#f8fbff]' : 'border-[#eef1f5] bg-[#fbfcfe] hover:border-[#d8dee9]'}`}
                    >
                        <div className='flex items-center justify-between gap-2'>
                            <span className='truncate text-sm font-semibold text-[#171a21]' title={row.label}>{row.label}</span>
                            <span className={row.health === 'healthy' ? 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-[11px] font-semibold text-[#147a3b]' : 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]'}>
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
        <section className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Exposure entities</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{entities.length} watched item{entities.length === 1 ? '' : 's'} tied to this case.</p>
                </div>
                <a href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} className='inline-flex h-8 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                    Open organization
                </a>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[760px] text-left text-xs'>
                    <thead className='bg-[#f8fafc] text-[10px] uppercase text-[#667085]'>
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
                    <tbody className='divide-y divide-[#eef1f5]'>
                        {entities.map(entity => (
                            <tr key={entity.key} onClick={() => onSelectEntity(entity.key)} className={`cursor-pointer align-top transition hover:bg-[#f8fbff] ${selectedEntityKey === entity.key ? 'bg-[#f8fbff]' : 'bg-white'}`}>
                                <td className='px-4 py-3'>
                                    <p className='font-semibold text-[#171a21]'>{entity.name}</p>
                                    <p className='mt-0.5 text-[11px] text-[#667085]'>{entity.scope}</p>
                                </td>
                                <td className='px-4 py-3 font-semibold text-[#475467]'>{stateLabel(entity.kind)}</td>
                                <td className='px-4 py-3 font-semibold text-[#475467]'>{entity.evidenceCount}</td>
                                <td className='px-4 py-3'>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {entity.sourceFamilies.map(family => <span key={family} className='rounded-full bg-[#eef3ff] px-2 py-0.5 font-semibold text-[#3056d3]'>{stateLabel(family)}</span>)}
                                    </div>
                                </td>
                                <td className='px-4 py-3 font-semibold text-[#475467]'>{relativeTimeLabel(entity.newestAt)}</td>
                                <td className='px-4 py-3 font-semibold text-[#475467]'>{entity.confidence}%</td>
                                <td className='px-4 py-3'>
                                    <button type='button' onClick={(event) => { event.stopPropagation(); onSelectEntity(entity.key) }} className='inline-flex h-8 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                        Pivot
                                    </button>
                                    <p className='mt-1 text-[11px] text-[#667085]'>{entity.nextAction}</p>
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
        <div className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Source provenance</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{selectedEntity ? `${selectedEntity.name} · ${visibleEvidence.length} row${visibleEvidence.length === 1 ? '' : 's'}` : 'Timeline, source family, capture state, and customer-safe excerpts.'}</p>
                </div>
                <RotateCcw className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='border-b border-[#eef1f5] px-4 py-3'>
                <div className='flex gap-2 overflow-x-auto pb-1'>
                    <SourceFilterChip label='All' active={sourceFilter === 'all'} onClick={() => onSourceFilter('all')} />
                    {sourceFamilies.map(family => (
                        <SourceFilterChip key={family} label={stateLabel(family)} active={sourceFilter === family} onClick={() => onSourceFilter(family)} />
                    ))}
                </div>
            </div>
            <div className='grid gap-3 p-4'>
                {selectedEvidence && (
                    <div className='rounded-lg border border-[#d8e2f0] bg-[#f8fbff] p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-semibold text-[#171a21]'>{selectedEvidence.sourceName}</span>
                            <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{stateLabel(selectedEvidence.sourceFamily)}</span>
                            <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{selectedEvidence.observedAt ? relativeTimeLabel(selectedEvidence.observedAt) : relativeTimeLabel(selectedEvidence.firstSeenAt || alert.firstSeenAt)}</span>
                        </div>
                        <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{selectedEvidence.excerpt}</p>
                        <div className='mt-3 grid gap-2 text-[11px] text-[#667085] sm:grid-cols-2'>
                            <p><span className='font-semibold text-[#475467]'>Capture:</span> {selectedEvidence.provenance?.captureId ?? selectedEvidence.id}</p>
                            <p><span className='font-semibold text-[#475467]'>Source:</span> {selectedEvidence.provenance?.sourceId ?? selectedEvidence.sourceName}</p>
                            <p><span className='font-semibold text-[#475467]'>State:</span> {stateLabel(selectedEvidence.redactionState)}</p>
                            <p className='flex flex-wrap items-center gap-2'>
                                <span><span className='font-semibold text-[#475467]'>Hash:</span> <span className='font-mono'>{selectedEvidence.contentHash}</span></span>
                                <button type='button' onClick={() => onCopyHash(selectedEvidence.contentHash)} className='inline-flex h-8 items-center gap-1 rounded-md border border-[#d8dee9] bg-white px-2 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                    <Copy className='h-3.5 w-3.5' />
                                    {copiedHash === selectedEvidence.contentHash ? 'Copied' : 'Copy'}
                                </button>
                            </p>
                        </div>
                    </div>
                )}
                <div className='overflow-x-auto rounded-lg border border-[#eef1f5]'>
                    <table className='w-full min-w-[720px] text-left text-xs'>
                        <thead className='bg-[#f8fafc] text-[10px] uppercase text-[#667085]'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Time</th>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Family</th>
                                <th className='px-3 py-2 font-semibold'>State</th>
                                <th className='px-3 py-2 font-semibold'>Snippet</th>
                                <th className='px-3 py-2 font-semibold'>Hash</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5]'>
                            {visibleEvidence.map(item => (
                                <tr key={item.id} className={`cursor-pointer align-top transition hover:bg-[#f8fbff] ${selectedEvidence?.id === item.id ? 'bg-[#f8fbff]' : 'bg-white'}`} onClick={() => onSelectEvidence(item.id)}>
                                    <td className='px-3 py-2 font-semibold text-[#475467]'>{shortTime(item.observedAt || item.firstSeenAt || alert.firstSeenAt)}</td>
                                    <td className='px-3 py-2'>
                                        <p className='max-w-[180px] truncate font-semibold text-[#171a21]' title={item.sourceName}>{item.sourceName}</p>
                                        <p className='mt-0.5 text-[11px] text-[#667085]'>{item.provenance?.sourceId ?? item.provenance?.captureId ?? item.id}</p>
                                    </td>
                                    <td className='px-3 py-2 font-semibold text-[#475467]'>{stateLabel(item.sourceFamily)}</td>
                                    <td className='px-3 py-2'>
                                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 font-semibold text-[#3056d3]'>{stateLabel(item.redactionState)}</span>
                                    </td>
                                    <td className='px-3 py-2 text-[#475467]'><p className='line-clamp-2 max-w-[280px]'>{item.excerpt}</p></td>
                                    <td className='px-3 py-2 font-mono text-[11px] text-[#667085]'>{item.contentHash}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!visibleEvidence.length && <p className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-3 text-sm text-[#596170]'>No evidence rows for this source family.</p>}
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
        <section className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Evidence disposition</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{visibleEvidence.length} row{visibleEvidence.length === 1 ? '' : 's'} · {route} · {watchlist}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <ImpactChip label='Entity' value={selectedEntity?.name || alert.matchedTerm.value} />
                    <ImpactChip label='Route' value={route} />
                    <ImpactChip label='Case' value={workflowContext.caseId || 'candidate'} />
                </div>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[980px] text-left text-xs'>
                    <thead className='bg-[#f8fafc] text-[10px] uppercase text-[#667085]'>
                        <tr>
                            <th className='px-3 py-2 font-semibold'>Evidence</th>
                            <th className='px-3 py-2 font-semibold'>Source</th>
                            <th className='px-3 py-2 font-semibold'>Impact</th>
                            <th className='px-3 py-2 font-semibold'>Status</th>
                            <th className='px-3 py-2 font-semibold'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-[#eef1f5]'>
                        {visibleEvidence.map(item => {
                            const disposition = dispositions[item.id]
                            return (
                                <tr key={item.id} onClick={() => onSelectEvidence(item.id)} className={`cursor-pointer align-top transition hover:bg-[#f8fbff] ${selectedEvidence?.id === item.id ? 'bg-[#f8fbff]' : 'bg-white'}`}>
                                    <td className='px-3 py-3'>
                                        <p className='line-clamp-2 max-w-80 text-sm leading-5 text-[#171a21]'>{item.excerpt}</p>
                                        <p className='mt-1 font-mono text-[11px] text-[#667085]'>{item.contentHash}</p>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <p className='max-w-[180px] truncate font-semibold text-[#171a21]' title={item.sourceName}>{item.sourceName}</p>
                                        <p className='mt-1 text-[11px] text-[#667085]'>{stateLabel(item.sourceFamily)} · {relativeTimeLabel(item.observedAt || item.firstSeenAt || alert.firstSeenAt)}</p>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <div className='grid gap-1.5'>
                                            <ImpactChip label='Watchlist' value={alert.matchedTerm.value} />
                                            <ImpactChip label='Delivery' value={workflowContext.lastDelivery ? stateLabel(workflowContext.lastDelivery.status) : alert.deliveryState || 'pending_review'} />
                                        </div>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <span className={dispositionClass(disposition?.state)}>{disposition ? stateLabel(disposition.state) : 'Unworked'}</span>
                                        {disposition?.at && <p className='mt-1 text-[11px] font-semibold text-[#667085]'>{relativeTimeLabel(disposition.at)}</p>}
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
            {!visibleEvidence.length && <p className='p-4 text-sm text-[#667085]'>No evidence rows match the current filters.</p>}
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
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Route and watchlist impact</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{workedCount}/{alert.evidence.length} evidence rows worked</p>
                </div>
                <ShieldCheck className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='grid gap-2 p-4 sm:grid-cols-2'>
                <ActionStatus label='Customer term' value={alert.matchedTerm.value} />
                <ActionStatus label='Term kind' value={stateLabel(alert.matchedTerm.kind)} />
                <ActionStatus label='Current entity' value={selectedEntity?.name || alert.company} />
                <ActionStatus label='Evidence status' value={selectedDisposition ? stateLabel(selectedDisposition.state) : 'unworked'} tone={selectedDisposition?.state === 'false_positive' || selectedDisposition?.state === 'suppressed' ? 'warn' : 'neutral'} />
                <ActionStatus label='Route' value={stateLabel(alert.routingContext?.queue || alert.webhookDelivery.recommendedRoute)} />
                <ActionStatus label='Urgency' value={stateLabel(alert.routingContext?.urgency || (alert.severity === 'critical' ? 'immediate' : 'same_day'))} tone={alert.severity === 'critical' ? 'warn' : 'neutral'} />
                <ActionStatus label='Watchlists' value={workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} scoped` : 'default scope'} />
                <ActionStatus label='Destination' value={workflowContext.webhookDestinationIds.length ? `${workflowContext.webhookDestinationIds.length} configured` : workflowContext.hasWebhookRoute ? 'route available' : 'route unavailable'} tone={workflowContext.hasWebhookRoute ? 'neutral' : 'warn'} />
            </div>
        </section>
    )
}

function ImpactChip({ label, value }: { label: string, value: string }) {
    return (
        <span className='inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg border border-[#d8e2f0] bg-white px-2 text-[11px] font-semibold text-[#475467]'>
            <span className='text-[#667085]'>{label}:</span>
            <span className='truncate text-[#171a21]' title={value}>{value}</span>
        </span>
    )
}

function DispositionButton({ onClick, children }: { onClick: (event: MouseEvent<HTMLButtonElement>) => void, children: string }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex h-8 items-center rounded-lg border border-[#d8dee9] bg-white px-2.5 text-[11px] font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
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
        <section className='grid gap-2 rounded-lg border border-[#d8e2f0] bg-[#f8fbff] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center'>
            <div className='min-w-0'>
                <p className='text-[10px] font-semibold text-[#667085]'>Selected context</p>
                <p className='mt-1 truncate text-sm font-semibold text-[#171a21]' title={selectedEntity?.name || selectedEvidence?.sourceName || alert.company}>
                    {selectedEntity?.name || selectedEvidence?.sourceName || alert.company}
                </p>
                <p className='mt-0.5 truncate text-xs text-[#667085]' title={selectedEvidence?.excerpt || alert.claimSummary}>
                    {sourceLabel} · {selectedEvidence ? relativeTimeLabel(selectedEvidence.observedAt || selectedEvidence.firstSeenAt || alert.firstSeenAt) : relativeTimeLabel(alert.lastSeenAt || alert.firstSeenAt)}
                </p>
            </div>
            <div className='grid gap-2 text-[11px] sm:grid-cols-3'>
                <ActionStatus label='Entity' value={selectedEntity ? stateLabel(selectedEntity.kind) : stateLabel(alert.matchedTerm.kind)} />
                <ActionStatus label='Evidence' value={selectedEvidence?.contentHash || `${alert.evidence.length} rows`} />
                <ActionStatus label='Route' value={workflowContext.caseId || stateLabel(alert.webhookDelivery.recommendedRoute)} />
            </div>
            <div className='flex flex-wrap gap-2 lg:justify-end'>
                {selectedEvidence?.contentHash && (
                    <button type='button' onClick={() => onCopyHash(selectedEvidence.contentHash)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                        <Copy className='h-4 w-4' />
                        {copiedHash === selectedEvidence.contentHash ? 'Copied' : 'Copy hash'}
                    </button>
                )}
                <a href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} className='inline-flex h-9 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
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
        <div className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Delivery and case activity</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{timeline.length} event{timeline.length === 1 ? '' : 's'} · {deliveries.length} delivery attempt{deliveries.length === 1 ? '' : 's'}</p>
                </div>
                <Clock3 className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='grid gap-3 p-4'>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <ActionStatus label='Last delivery' value={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTimeLabel(latestDelivery.attemptedAt)}` : 'not sent'} tone={latestDelivery?.status === 'failed' ? 'warn' : 'neutral'} />
                    <ActionStatus label='Case route' value={caseId || 'candidate pending'} />
                    <ActionStatus label='Replay count' value={`${alert.replayCount ?? 0}`} />
                    <ActionStatus label='Destination' value={workflowContext.webhookDestinationIds.length ? `${workflowContext.webhookDestinationIds.length} destination${workflowContext.webhookDestinationIds.length === 1 ? '' : 's'}` : workflowContext.hasWebhookRoute ? 'route available' : 'route unavailable'} tone={workflowContext.hasWebhookRoute ? 'neutral' : 'warn'} />
                </div>
                {failedDelivery?.error && <p className='rounded-lg border border-[#fde2d6] bg-[#fff7f3] px-3 py-2 text-xs text-[#9a3412]'>{failedDelivery.error}</p>}
                <div className='overflow-hidden rounded-lg border border-[#eef1f5]'>
                    <table className='w-full text-left text-xs'>
                        <thead className='bg-[#f8fafc] text-[10px] uppercase text-[#667085]'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Time</th>
                                <th className='px-3 py-2 font-semibold'>Event</th>
                                <th className='px-3 py-2 font-semibold'>Detail</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#eef1f5]'>
                            {timeline.slice(0, 8).map(item => (
                                <tr key={item.id} className='align-top'>
                                    <td className='px-3 py-2 font-semibold text-[#475467]'>{relativeTimeLabel(item.at)}</td>
                                    <td className='px-3 py-2 font-semibold text-[#171a21]'>{item.title}</td>
                                    <td className='px-3 py-2 text-[#667085]'>{item.detail}</td>
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
        <button type='button' onClick={onClick} className={`h-8 min-w-12 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${active ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3]' : 'border-[#d8dee9] bg-white text-[#475467] hover:bg-[#f2f5f9]'}`}>
            {label}
        </button>
    )
}

function SelectedActionBar({ alert, deliveries, assignee, busyAction, actionMessage, onUpdate, onReplay, onTest, onSend }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    assignee: string
    busyAction: string | null
    actionMessage: { ok: boolean, text: string } | null
    onUpdate: (alertId: string, reviewState: string, deliveryState: string, note: string, assignedOwner?: string) => Promise<void>
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
    return (
        <section className='grid min-w-0 gap-3 rounded-lg border border-[#cfd8e6] bg-[#f8fbff] p-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-4'>
                <ActionStatus label='Owner' value={assignee} />
                <ActionStatus label='Work state' value={stateLabel(alert.reviewState)} />
                <ActionStatus label='Delivery' value={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTimeLabel(latestDelivery.attemptedAt)}` : hasDeliveryRoute ? 'route available' : 'route unavailable'} tone={latestDelivery?.status === 'failed' || !hasDeliveryRoute ? 'warn' : 'neutral'} />
                <ActionStatus label='Case' value={alert.caseId || alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate || 'candidate pending'} />
            </div>
            <div className='grid gap-2'>
                <div className='flex flex-wrap gap-1.5 xl:justify-end'>
                    <ActionAvailability label='Workflow' ready={transitionReady} />
                    <ActionAvailability label='Replay' ready={replayReady} />
                    <ActionAvailability label='Delivery' ready={deliverReady} />
                    <ActionAvailability label='Close' ready={closeReady} />
                </div>
                <div className='grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end'>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!transitionReady} icon='review' onClick={() => onUpdate(alert.id, 'reviewing', 'pending_review', 'Analyst review started.', persistedOwner)}>Review</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!transitionReady} icon='ready' onClick={() => onUpdate(alert.id, 'route_to_customer', 'ready_to_send', 'Escalated for customer delivery.', persistedOwner)}>Escalate</CaseButton>
                    <CaseButton busy={busyAction === `replay:${alert.id}`} disabled={!replayReady} icon='replay' onClick={() => onReplay(alert.id)}>Replay</CaseButton>
                    <CaseButton busy={busyAction === `test:${alert.id}`} disabled={!deliverReady} icon='send' onClick={() => onTest(alert.id)}>Test</CaseButton>
                    <CaseButton busy={busyAction === `send:${alert.id}`} disabled={!deliverReady} icon='send' onClick={() => onSend(alert.id)}>Send</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!suppressReady} icon='false' onClick={() => onUpdate(alert.id, 'false_positive', 'muted', 'Suppressed as false positive.', persistedOwner)}>Suppress</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!closeReady} icon='ready' onClick={() => onUpdate(alert.id, 'resolved', alert.deliveryState === 'delivered' ? 'delivered' : 'muted', 'Closed by analyst.', persistedOwner)}>Close</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!reopenReady} icon='review' onClick={() => onUpdate(alert.id, 'needs_review', 'pending_review', 'Reopened for analyst review.', persistedOwner)}>Reopen</CaseButton>
                </div>
                {actionMessage && (
                    <p className={`justify-self-start rounded-lg border px-3 py-2 text-xs font-semibold xl:justify-self-end ${actionMessage.ok ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]' : 'border-[#fde2d6] bg-[#fff7f3] text-[#9a3412]'}`}>
                        {actionMessage.text}
                    </p>
                )}
            </div>
        </section>
    )
}

function ActionAvailability({ label, ready }: { label: string, ready: boolean }) {
    return (
        <span className={`min-w-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${ready ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]' : 'border-[#fde2d6] bg-[#fff7f3] text-[#9a3412]'}`}>
            {label}: {ready ? 'ready' : 'blocked'}
        </span>
    )
}

function ActionStatus({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'warn' }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#d8e2f0] bg-white px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-[#667085]'>{label}</p>
            <p className={`mt-1 truncate text-xs font-semibold ${tone === 'warn' ? 'text-[#b45309]' : 'text-[#171a21]'}`} title={value}>{value}</p>
        </div>
    )
}

function CaseBrief({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 line-clamp-3 text-sm leading-6 text-[#3d4656]'>{value}</p>
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
        <div className={`shrink-0 rounded-lg border px-3 py-2 ${toneClass}`}>
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

function ContextChip({ label, value, href }: { label: string, value: string, href?: string }) {
    const content = (
        <>
            <p className='text-[10px] font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 truncate text-xs font-semibold text-[#171a21]' title={value}>{value}</p>
        </>
    )
    if (href) {
        return (
            <a href={href} className='min-w-0 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff]'>
                {content}
            </a>
        )
    }
    return <div className='min-w-0 rounded-lg border border-[#e0e5ed] bg-white px-3 py-2'>{content}</div>
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

function CaseButton({ busy, disabled = false, icon, onClick, children }: { busy: boolean, disabled?: boolean, icon: 'review' | 'ready' | 'replay' | 'send' | 'false', onClick: () => void, children: string }) {
    const Icon = busy ? Loader2 : icon === 'send' ? Send : icon === 'false' ? XCircle : icon === 'replay' ? RotateCcw : icon === 'ready' ? CheckCircle2 : Play
    return (
        <button type='button' onClick={onClick} disabled={busy || disabled} title={disabled ? 'Action is not available for this alert state.' : undefined} className='inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-2.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60 sm:px-3'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {children}
        </button>
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
            title: 'Evidence disposition',
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

function dispositionClass(state?: EvidenceDispositionState) {
    if (state === 'escalated') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]'
    if (state === 'suppressed' || state === 'false_positive') return 'rounded-full bg-[#fff7f3] px-2 py-0.5 text-xs font-semibold text-[#9a3412]'
    if (state === 'reviewed') return 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]'
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
