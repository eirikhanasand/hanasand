'use client'

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, Copy, Fingerprint, FolderOpen, Loader2, MessageSquareText, Play, Radar, RotateCcw, Search, Send, ShieldCheck, SlidersHorizontal, UserRound, Webhook, XCircle } from 'lucide-react'
import type { DwmAlert, DwmAlertAnalystAction, DwmProductSnapshot } from '@/utils/dwm/product'
import { safeAlertSummary, safeEvidenceExcerpt } from '@/utils/dwm/display'
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
    const visibleQueue = useMemo(() => visibleQueueAlerts(queue, selectedAlert?.id), [queue, selectedAlert?.id])
    const selectedDeliveries = selectedAlert ? deliveries.filter(delivery => delivery.alertId === selectedAlert.id) : []
    const criticalCount = alerts.filter(alert => alert.severity === 'critical').length
    const readyCount = alerts.filter(alert => alert.deliveryState === 'ready_to_send').length
    const activeCount = alerts.filter(alert => alert.deliveryState !== 'muted' && alert.reviewState !== 'resolved').length
    const freshCount = alerts.filter(isFreshAlert).length
    const highConfidenceCount = alerts.filter(alert => alert.confidence >= 80).length
    const latestCaptures = operations?.latestCaptures ?? []
    const latestRunLabel = operations?.latestRun
        ? `${operations.latestRun.captureCount} captures`
        : operations?.counts.activeSourceCount
            ? 'collecting'
            : 'source'
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

    async function openCase(alert: PortalAlert, assignedOwner?: string, note?: string) {
        await runAction(`case:${alert.id}`, async () => {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alert.id)}/case-handoff`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    tenantId: 'default',
                    organizationId: alert.organizationId || alert.workflowContext?.organizationId,
                    actor: 'dashboard',
                    assignedOwner,
                    note: note?.trim() || 'Case opened from DWM alert.',
                    idempotencyKey: `dashboard-case-handoff:${alert.id}`,
                }),
            })
            const payload = await readPayload(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.case?.id ? `Case ${payload.case.id} is ready.` : 'Case is ready.'
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
            return payload.attemptedCount ? 'Webhook delivery attempted.' : 'No delivery is waiting for this alert.'
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
            <section className='min-w-0 overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
                <div className='border-b border-[#26344d] bg-[#0b121e] px-4 py-3 text-white'>
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

                <div className='grid min-h-[480px] min-w-0 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_340px]'>
                    <aside className='order-2 min-w-0 border-b border-[#26344d] bg-[#0b121e] xl:order-none xl:border-b-0 xl:border-r'>
                        <div className='border-b border-[#26344d] p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Recent attacks</h3>
                                    <p className='mt-1 text-xs text-[#8fa0ba]'>{alerts.length ? `${visibleQueue.length}/${queue.length} shown after filters.` : 'Collectors are monitoring the saved watchlist.'}</p>
                                </div>
                                <Radar className='h-4 w-4 text-[#9db8ff]' />
                            </div>
                            <div className='mt-4 grid gap-2'>
                                <label className='relative block'>
                                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]' />
                                    <input
                                        value={queueQuery}
                                        onChange={event => setQueueQuery(event.target.value)}
                                        placeholder='Search company, actor, term, or status'
                                        className='h-10 w-full rounded-lg border border-[#27364f] bg-[#101827] pl-9 pr-3 text-sm text-[#edf4ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                                    />
                                </label>
                                <div className='grid grid-cols-2 gap-1.5'>
                                    {queueFilters.map(filter => (
                                        <button
                                            key={filter.id}
                                            type='button'
                                            onClick={() => setQueueFilter(filter.id)}
                                            className={`h-8 rounded-lg border px-2 text-xs font-semibold transition ${queueFilter === filter.id ? 'border-[#5f86ff] bg-[#122449] text-[#9db8ff]' : 'border-[#27364f] bg-[#101827] text-[#aab7cc] hover:bg-[#162033]'}`}
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
                                    onClick={() => setSelectedId(alert.id)}
                                    className={`w-full rounded-lg border p-3 text-left transition ${selectedAlert?.id === alert.id ? 'border-[#5f86ff] bg-[#101827] shadow-sm' : 'border-transparent hover:border-[#26344d] hover:bg-[#101827]'}`}
                                >
                                    <div className='flex items-center justify-between gap-2'>
                                        <span className='truncate text-sm font-semibold text-[#edf4ff]'>{alert.company}</span>
                                        <span className={severityClass(alert.severity)}>{alert.severity}</span>
                                    </div>
                                    <p className='mt-1 truncate font-mono text-xs text-[#8fa0ba]'>{alert.matchedTerm.value}</p>
                                    <div className='mt-3 grid grid-cols-2 gap-2 text-[11px]'>
                                        <QueueCell label='path' value={stateLabel(alert.routingContext?.queue || alert.webhookDelivery.recommendedRoute)} />
                                        <QueueCell label='urgency' value={stateLabel(alert.routingContext?.urgency || (alert.severity === 'critical' ? 'immediate' : 'same_day'))} tone={alert.routingContext?.urgency === 'immediate' || alert.severity === 'critical' ? 'bad' : 'neutral'} />
                                        <QueueCell label='evidence' value={`${alert.evidenceSummary?.evidenceCount ?? alert.evidence.length}`} />
                                        <QueueCell label='last seen' value={relativeTimeLabel(alert.lastSeenAt || alert.evidenceSummary?.lastObservedAt || alert.firstSeenAt)} />
                                    </div>
                                    <p className='mt-3 line-clamp-2 text-xs leading-5 text-[#aab7cc]'>{safeAlertSummary(alert)}</p>
                                </button>
                            )) : (
                                <div className='rounded-lg border border-dashed border-[#334762] bg-[#101827] p-4 text-sm leading-6 text-[#aab7cc]'>
                                    {alerts.length ? 'No attacks match the current filters.' : 'No recent attacks. Monitoring stays live while watchlist terms listen for new captures.'}
                                </div>
                            )}
                            {queue.length > visibleQueue.length && (
                                <p className='px-2 py-1 text-xs leading-5 text-[#8fa0ba]'>Narrow the search or filters to see more matching attacks.</p>
                            )}
                        </div>
                    </aside>

                    <main className='order-1 min-w-0 bg-[#101827] xl:order-none'>
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
                            <NoCaseWorkspace latestCaptures={latestCaptures} />
                        )}
                    </main>

                    <aside className='order-3 min-w-0 border-t border-[#26344d] bg-[#0b121e] xl:col-span-2 xl:order-none 2xl:col-span-1 2xl:border-l 2xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <SourcePosture snapshot={snapshot} operations={operations} />
                            <DeliveryPanel alert={selectedAlert} deliveries={deliveries} />
                            <ActorPanel snapshot={snapshot} />
                        </div>
                    </aside>
                </div>
            </section>

            <section id='dwm-workflow-actions' className='scroll-mt-24'>
                <DwmWorkflowActions initialTerms={snapshot.watchlist.map(term => term.value)} />
            </section>
        </div>
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
                        <span className='min-w-0 rounded-full bg-[#122449] px-2 py-0.5 text-xs font-semibold text-[#9db8ff]'>{alert.confidence}% confidence</span>
                        <span className='min-w-0 rounded-full bg-[#122449] px-2 py-0.5 text-xs font-semibold text-[#aab7cc]'>{stateLabel(alert.reviewState)}</span>
                        <span className='min-w-0 rounded-full bg-[#101827] px-2 py-0.5 text-xs font-semibold text-[#aab7cc]'>{stateLabel(alert.deliveryState || 'pending_review')}</span>
                    </div>
                    <h2 className='mt-3 wrap-break-word text-2xl font-semibold tracking-normal text-[#edf4ff]'>{alert.company}</h2>
                    <p className='mt-1 wrap-break-word text-sm leading-6 text-[#aab7cc]'>
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

            <section className='grid gap-2 rounded-lg border border-[#26344d] bg-[#0b121e] p-3 sm:grid-cols-2 xl:grid-cols-5'>
                <ContextChip label='Organization' value={workflowContext.organizationId || 'tenant default'} href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} />
                <ContextChip label='Watched terms' value={workflowContext.watchlistIds.length ? `${workflowContext.watchlistIds.length} scoped` : stateLabel(alert.matchedTerm.kind)} href='/organizations' />
                <ContextChip label='Case' value={workflowContext.caseId || 'case is being prepared'} href={workflowContext.caseId ? `/api/cases/${encodeURIComponent(workflowContext.caseId)}${workflowContext.organizationId ? `?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : ''}` : undefined} />
                <ContextChip label='Delivery' value={workflowContext.lastDelivery ? `${stateLabel(workflowContext.lastDelivery.status)} · ${relativeTimeLabel(workflowContext.lastDelivery.attemptedAt)}` : workflowContext.hasWebhookRoute ? 'delivery configured' : 'checking delivery'} />
                <ContextChip label='Source type' value={`${stateLabel(alert.sourceFamily)} · ${alert.sourceCount}`} />
            </section>

            <section className='overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
                <div className='grid gap-0 md:grid-cols-4'>
                    <CaseMetric label='Recommended path' value={stateLabel(routingContext.queue)} detail={stateLabel(routingContext.urgency)} tone={routingContext.urgency === 'immediate' ? 'bad' : routingContext.urgency === 'same_day' ? 'warn' : 'neutral'} />
                    <CaseMetric label='Evidence' value={`${evidenceSummary.evidenceCount}`} detail={`${evidenceSummary.publicSafeCount} redacted · ${evidenceSummary.metadataOnlyCount} metadata`} />
                    <CaseMetric label='First seen' value={shortTime(evidenceSummary.firstObservedAt)} detail={relativeTimeLabel(evidenceSummary.firstObservedAt)} />
                    <CaseMetric label='Last seen' value={shortTime(evidenceSummary.lastObservedAt)} detail={relativeTimeLabel(evidenceSummary.lastObservedAt)} />
                </div>
                <div className='grid gap-4 border-t border-[#1f2c42] bg-[#0b121e] p-4 lg:grid-cols-[0.8fr_1.2fr]'>
                    <div>
                        <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Why this matched</p>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <span className='rounded-full bg-[#101827] px-2 py-1 font-mono text-xs font-semibold text-[#edf4ff]'>{matchContext.normalizedTerm}</span>
                            <span className='rounded-full bg-[#101827] px-2 py-1 text-xs font-semibold text-[#aab7cc]'>{stateLabel(matchContext.termKind)}</span>
                            <span className='rounded-full bg-[#101827] px-2 py-1 text-xs font-semibold text-[#aab7cc]'>{matchContext.matchedFieldHints.length ? matchContext.matchedFieldHints.join(', ') : stateLabel(matchContext.matchType)}</span>
                        </div>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {Object.entries(evidenceSummary.sourceFamilyCounts).map(([family, count]) => (
                                <span key={family} className='rounded-full border border-[#27364f] bg-[#101827] px-2 py-1 text-xs font-semibold text-[#dbe7ff]'>{stateLabel(family)}: {count}</span>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Why this matters</p>
                        <p className='mt-2 text-sm leading-6 text-[#aab7cc]'>{routingContext.reason}</p>
                        <p className='mt-1 text-xs font-semibold text-[#8fa0ba]'>Customer-safe evidence: {stateLabel(routingContext.customerVisibleEvidence)} · Alert key {alert.webhookDelivery.dedupeKey}</p>
                    </div>
                </div>
            </section>

            <section className='grid gap-3 rounded-lg border border-[#26344d] bg-[#0b121e] p-4 lg:grid-cols-[0.55fr_1fr_auto] lg:items-end'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#edf4ff]'>
                        <UserRound className='h-4 w-4 text-[#9db8ff]' />
                        Owner
                    </span>
                    <input
                        value={assignee === 'Unassigned' ? '' : assignee}
                        onChange={event => onLocalStateChange({ assignee: event.target.value.trim() || 'Unassigned' })}
                        placeholder='Assign owner'
                        className='h-10 rounded-lg border border-[#27364f] bg-[#101827] px-3 text-sm text-[#edf4ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
                    />
                    <span className='text-[11px] text-[#8fa0ba]'>Saved to the shared case when you save the note or decision.</span>
                </label>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#edf4ff]'>
                        <MessageSquareText className='h-4 w-4 text-[#9db8ff]' />
                        Decision note
                    </span>
                    <textarea
                        value={analystNote}
                        onChange={event => onLocalStateChange({ note: event.target.value })}
                        placeholder='What was checked, who owns follow-up, and why this was escalated, suppressed, or closed'
                        className='min-h-20 resize-y rounded-lg border border-[#27364f] bg-[#101827] px-3 py-2 text-sm text-[#edf4ff] outline-none transition focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
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

            <section className='grid gap-3 rounded-lg border border-[#26344d] bg-[#0b121e] p-4 md:grid-cols-2'>
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
        <section data-dwm-analyst-brief className='grid gap-4 rounded-lg border border-[#334762] bg-[#0b121e] p-4'>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-[#9db8ff]'>Analyst brief</p>
                    <h3 className='mt-1 wrap-break-word text-xl font-semibold tracking-normal text-[#edf4ff]'>{brief.headline}</h3>
                </div>
                <span className={brief.readyForCustomer ? 'rounded-full border border-[#1f6f48] bg-[#0c261c] px-3 py-1 text-xs font-semibold text-[#9cf0bc]' : 'rounded-full border border-[#6f5417] bg-[#2a220f] px-3 py-1 text-xs font-semibold text-[#ffd879]'}>
                    {brief.readyForCustomer ? 'Customer-ready after review' : 'Review before customer update'}
                </span>
            </div>
            <div className='grid gap-3 lg:grid-cols-3'>
                <BriefStep label='What happened' value={brief.whatHappened} />
                <BriefStep label='Why it matters' value={brief.whyItMatters} />
                <BriefStep label='What to do next' value={brief.nextAction} />
            </div>
            <div className='grid gap-3 border-t border-[#1f2c42] pt-3 md:grid-cols-3'>
                <BriefFact label='Evidence boundary' value={brief.evidenceBoundary} />
                <BriefFact label='Source records' value={brief.sourceRecords} />
                <BriefFact label='Action status' value={brief.workflowReadiness} />
            </div>
        </section>
    )
}

function BriefStep({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#26344d] bg-[#101827] p-3'>
            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>{label}</p>
            <p className='mt-2 line-clamp-4 text-sm leading-6 text-[#dbe7ff]'>{value}</p>
        </div>
    )
}

function BriefFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0'>
            <p className='text-[10px] font-semibold uppercase text-[#8fa0ba]'>{label}</p>
            <p className='mt-1 text-sm leading-6 text-[#aab7cc]'>{value}</p>
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
    const casePath = actualCaseId ? `/dashboard/dwm/cases/${encodeURIComponent(actualCaseId)}${workflowContext.organizationId ? `?organizationId=${encodeURIComponent(workflowContext.organizationId)}${alert.id ? `&alertId=${encodeURIComponent(alert.id)}` : ''}` : alert.id ? `?alertId=${encodeURIComponent(alert.id)}` : ''}` : alert.sourceHandoffReadiness?.analystWorkflowConsumer?.actionReadiness?.actions?.find(action => action.action === 'case_link' && action.casePath)?.casePath
    const canOpenCase = Boolean(alert.id && alert.evidence?.some(item => item.id || item.provenance?.captureId))
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
        <section data-dwm-workflow-spine className='rounded-lg border border-[#334762] bg-[#0b121e]'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#9db8ff]'>Workflow</p>
                    <h3 className='mt-0.5 text-base font-semibold text-[#edf4ff]'>Watchlist match to customer handoff</h3>
                </div>
                <a href='#dwm-workflow-actions' className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#101827] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a]'>
                    Run first setup
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
        ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]'
        : step.state === 'action'
            ? 'border-[#6f5417] bg-[#2a220f] text-[#ffd879]'
            : 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'
    const body = (
        <div className='min-h-[136px] rounded-lg border border-[#26344d] bg-[#101827] p-3'>
            <div className='flex items-center justify-between gap-2'>
                <span className='grid h-7 w-7 place-items-center rounded-full border border-[#27364f] bg-[#0b121e] text-xs font-semibold text-[#edf4ff]'>{index}</span>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${toneClass}`}>{step.state}</span>
            </div>
            <p className='mt-3 text-[10px] font-semibold uppercase text-[#8fa0ba]'>{step.label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-[#edf4ff]' title={step.value}>{step.value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#8fa0ba]'>{step.detail}</p>
            {step.action ? (
                <button type='button' disabled={step.action.busy} onClick={(event) => { event.preventDefault(); step.action?.onClick() }} className='mt-3 inline-flex h-8 items-center rounded-lg border border-[#5f86ff] bg-[#122449] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#183064] disabled:cursor-not-allowed disabled:opacity-60'>
                    {step.action.busy ? 'Opening' : step.action.label}
                </button>
            ) : null}
        </div>
    )
    if (step.href && !step.action) {
        return <a href={step.href} className='block rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1f3f7a]'>{body}</a>
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
        <div className='flex gap-2 overflow-x-auto rounded-lg border border-[#26344d] bg-[#0b121e] p-2'>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    type='button'
                    onClick={() => onChange(tab.id)}
                    className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${active === tab.id ? 'border-[#5f86ff] bg-[#122449] text-[#9db8ff]' : 'border-[#27364f] bg-[#101827] text-[#aab7cc] hover:bg-[#162033]'}`}
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
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Source coverage</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Coverage, newest pull, and evidence count for this case.</p>
                </div>
                <button type='button' onClick={() => onSourceFilter('all')} className={`h-8 rounded-lg border px-3 text-xs font-semibold transition ${sourceFilter === 'all' ? 'border-[#5f86ff] bg-[#122449] text-[#9db8ff]' : 'border-[#27364f] bg-[#101827] text-[#aab7cc] hover:bg-[#162033]'}`}>
                    All sources
                </button>
            </div>
            <div className='grid gap-2 p-3 md:grid-cols-2 xl:grid-cols-5'>
                {rows.map(row => (
                    <button
                        key={row.family}
                        type='button'
                        onClick={() => onSourceFilter(row.family)}
                        className={`min-w-0 rounded-lg border p-3 text-left transition ${sourceFilter === row.family ? 'border-[#5f86ff] bg-[#111b2b]' : 'border-[#1f2c42] bg-[#0b121e] hover:border-[#27364f]'}`}
                    >
                        <div className='flex items-center justify-between gap-2'>
                            <span className='truncate text-sm font-semibold text-[#edf4ff]' title={row.label}>{row.label}</span>
                            <span className={row.health === 'healthy' ? 'rounded-full bg-[#0c261c] px-2 py-0.5 text-[11px] font-semibold text-[#9cf0bc]' : 'rounded-full bg-[#2a1c0e] px-2 py-0.5 text-[11px] font-semibold text-[#ffd58a]'}>
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
        <section className='overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Watched entities</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>{entities.length} watched item{entities.length === 1 ? '' : 's'} tied to this case.</p>
                </div>
                <a href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} className='inline-flex h-8 items-center rounded-lg border border-[#27364f] bg-[#101827] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                    Open organization
                </a>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[760px] text-left text-xs'>
                    <thead className='bg-[#0b121e] text-[10px] uppercase text-[#8fa0ba]'>
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
                    <tbody className='divide-y divide-[#1f2c42]'>
                        {entities.map(entity => (
                            <tr key={entity.key} onClick={() => onSelectEntity(entity.key)} className={`cursor-pointer align-top transition hover:bg-[#111b2b] ${selectedEntityKey === entity.key ? 'bg-[#111b2b]' : 'bg-[#101827]'}`}>
                                <td className='px-4 py-3'>
                                    <p className='font-semibold text-[#edf4ff]'>{entity.name}</p>
                                    <p className='mt-0.5 text-[11px] text-[#8fa0ba]'>{entity.scope}</p>
                                </td>
                                <td className='px-4 py-3 font-semibold text-[#aab7cc]'>{stateLabel(entity.kind)}</td>
                                <td className='px-4 py-3 font-semibold text-[#aab7cc]'>{entity.evidenceCount}</td>
                                <td className='px-4 py-3'>
                                    <div className='flex flex-wrap gap-1.5'>
                                        {entity.sourceFamilies.map(family => <span key={family} className='rounded-full bg-[#122449] px-2 py-0.5 font-semibold text-[#9db8ff]'>{stateLabel(family)}</span>)}
                                    </div>
                                </td>
                                <td className='px-4 py-3 font-semibold text-[#aab7cc]'>{relativeTimeLabel(entity.newestAt)}</td>
                                <td className='px-4 py-3 font-semibold text-[#aab7cc]'>{entity.confidence}%</td>
                                <td className='px-4 py-3'>
                                    <button type='button' onClick={(event) => { event.stopPropagation(); onSelectEntity(entity.key) }} className='inline-flex h-8 items-center rounded-lg border border-[#27364f] bg-[#101827] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                                        Review
                                    </button>
                                    <p className='mt-1 text-[11px] text-[#8fa0ba]'>{entity.nextAction}</p>
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
        <div className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Evidence details</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>{selectedEntity ? `${selectedEntity.name} · ${visibleEvidence.length} row${visibleEvidence.length === 1 ? '' : 's'}` : 'Timeline, source family, capture state, and customer-safe excerpts.'}</p>
                </div>
                <RotateCcw className='h-4 w-4 text-[#9db8ff]' />
            </div>
            <div className='border-b border-[#1f2c42] px-4 py-3'>
                <div className='flex gap-2 overflow-x-auto pb-1'>
                    <SourceFilterChip label='All' active={sourceFilter === 'all'} onClick={() => onSourceFilter('all')} />
                    {sourceFamilies.map(family => (
                        <SourceFilterChip key={family} label={stateLabel(family)} active={sourceFilter === family} onClick={() => onSourceFilter(family)} />
                    ))}
                </div>
            </div>
            <div className='grid gap-3 p-4'>
                {selectedEvidence && (
                    <div className='rounded-lg border border-[#27364f] bg-[#111b2b] p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-semibold text-[#edf4ff]'>{selectedEvidence.sourceName}</span>
                            <span className='rounded-full bg-[#101827] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{stateLabel(selectedEvidence.sourceFamily)}</span>
                            <span className='rounded-full bg-[#101827] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{selectedEvidence.observedAt ? relativeTimeLabel(selectedEvidence.observedAt) : relativeTimeLabel(selectedEvidence.firstSeenAt || alert.firstSeenAt)}</span>
                        </div>
                        <p className='mt-2 text-sm leading-6 text-[#aab7cc]'>{safeEvidenceExcerpt(selectedEvidence.excerpt)}</p>
                        <div className='mt-3 grid gap-2 text-[11px] text-[#8fa0ba] sm:grid-cols-2'>
                            <p><span className='font-semibold text-[#aab7cc]'>Evidence ID:</span> {selectedEvidence.provenance?.captureId ?? selectedEvidence.id}</p>
                            <p><span className='font-semibold text-[#aab7cc]'>Source:</span> {selectedEvidence.provenance?.sourceId ?? selectedEvidence.sourceName}</p>
                            <p><span className='font-semibold text-[#aab7cc]'>State:</span> {stateLabel(selectedEvidence.redactionState)}</p>
                            <p className='flex flex-wrap items-center gap-2'>
                                <span><span className='font-semibold text-[#aab7cc]'>Hash:</span> <span className='font-mono'>{selectedEvidence.contentHash}</span></span>
                                <button type='button' onClick={() => onCopyHash(selectedEvidence.contentHash)} className='inline-flex h-8 items-center gap-1 rounded-md border border-[#27364f] bg-[#101827] px-2 text-[11px] font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                                    <Copy className='h-3.5 w-3.5' />
                                    {copiedHash === selectedEvidence.contentHash ? 'Copied' : 'Copy'}
                                </button>
                            </p>
                        </div>
                    </div>
                )}
                <div className='overflow-x-auto rounded-lg border border-[#1f2c42]'>
                    <table className='w-full min-w-[720px] text-left text-xs'>
                        <thead className='bg-[#0b121e] text-[10px] uppercase text-[#8fa0ba]'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Time</th>
                                <th className='px-3 py-2 font-semibold'>Source</th>
                                <th className='px-3 py-2 font-semibold'>Family</th>
                                <th className='px-3 py-2 font-semibold'>State</th>
                                <th className='px-3 py-2 font-semibold'>Snippet</th>
                                <th className='px-3 py-2 font-semibold'>Hash</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#1f2c42]'>
                            {visibleEvidence.map(item => (
                                <tr key={item.id} className={`cursor-pointer align-top transition hover:bg-[#111b2b] ${selectedEvidence?.id === item.id ? 'bg-[#111b2b]' : 'bg-[#101827]'}`} onClick={() => onSelectEvidence(item.id)}>
                                    <td className='px-3 py-2 font-semibold text-[#aab7cc]'>{shortTime(item.observedAt || item.firstSeenAt || alert.firstSeenAt)}</td>
                                    <td className='px-3 py-2'>
                                        <p className='max-w-[180px] truncate font-semibold text-[#edf4ff]' title={item.sourceName}>{item.sourceName}</p>
                                        <p className='mt-0.5 text-[11px] text-[#8fa0ba]'>{item.provenance?.sourceId ?? item.provenance?.captureId ?? item.id}</p>
                                    </td>
                                    <td className='px-3 py-2 font-semibold text-[#aab7cc]'>{stateLabel(item.sourceFamily)}</td>
                                    <td className='px-3 py-2'>
                                        <span className='rounded-full bg-[#122449] px-2 py-0.5 font-semibold text-[#9db8ff]'>{stateLabel(item.redactionState)}</span>
                                    </td>
                                    <td className='px-3 py-2 text-[#aab7cc]'><p className='line-clamp-2 max-w-[280px]'>{safeEvidenceExcerpt(item.excerpt)}</p></td>
                                    <td className='px-3 py-2 font-mono text-[11px] text-[#8fa0ba]'>{item.contentHash}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!visibleEvidence.length && <p className='rounded-lg border border-dashed border-[#334762] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>No evidence for this source family yet.</p>}
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
        <section className='overflow-hidden rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Evidence decisions</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>{visibleEvidence.length} row{visibleEvidence.length === 1 ? '' : 's'} · {route} · {watchlist}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <ImpactChip label='Entity' value={selectedEntity?.name || alert.matchedTerm.value} />
                    <ImpactChip label='Path' value={route} />
                    <ImpactChip label='Case' value={workflowContext.caseId || 'candidate'} />
                </div>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[980px] text-left text-xs'>
                    <thead className='bg-[#0b121e] text-[10px] uppercase text-[#8fa0ba]'>
                        <tr>
                            <th className='px-3 py-2 font-semibold'>Evidence</th>
                            <th className='px-3 py-2 font-semibold'>Source</th>
                            <th className='px-3 py-2 font-semibold'>Impact</th>
                            <th className='px-3 py-2 font-semibold'>Status</th>
                            <th className='px-3 py-2 font-semibold'>Actions</th>
                        </tr>
                    </thead>
                    <tbody className='divide-y divide-[#1f2c42]'>
                        {visibleEvidence.map(item => {
                            const disposition = dispositions[item.id]
                            return (
                                <tr key={item.id} onClick={() => onSelectEvidence(item.id)} className={`cursor-pointer align-top transition hover:bg-[#111b2b] ${selectedEvidence?.id === item.id ? 'bg-[#111b2b]' : 'bg-[#101827]'}`}>
                                    <td className='px-3 py-3'>
                                        <p className='line-clamp-2 max-w-80 text-sm leading-5 text-[#edf4ff]'>{safeEvidenceExcerpt(item.excerpt)}</p>
                                        <p className='mt-1 font-mono text-[11px] text-[#8fa0ba]'>{item.contentHash}</p>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <p className='max-w-[180px] truncate font-semibold text-[#edf4ff]' title={item.sourceName}>{item.sourceName}</p>
                                        <p className='mt-1 text-[11px] text-[#8fa0ba]'>{stateLabel(item.sourceFamily)} · {relativeTimeLabel(item.observedAt || item.firstSeenAt || alert.firstSeenAt)}</p>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <div className='grid gap-1.5'>
                                            <ImpactChip label='Watchlist' value={alert.matchedTerm.value} />
                                            <ImpactChip label='Delivery' value={workflowContext.lastDelivery ? stateLabel(workflowContext.lastDelivery.status) : alert.deliveryState || 'pending_review'} />
                                        </div>
                                    </td>
                                    <td className='px-3 py-3'>
                                        <span className={dispositionClass(disposition?.state)}>{disposition ? stateLabel(disposition.state) : 'Unworked'}</span>
                                        {disposition?.at && <p className='mt-1 text-[11px] font-semibold text-[#8fa0ba]'>{relativeTimeLabel(disposition.at)}</p>}
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
            {!visibleEvidence.length && <p className='p-4 text-sm text-[#8fa0ba]'>Evidence filters are clear.</p>}
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
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Customer impact</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>{workedCount}/{alert.evidence.length} evidence rows worked</p>
                </div>
                <ShieldCheck className='h-4 w-4 text-[#9db8ff]' />
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
        <span className='inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg border border-[#27364f] bg-[#101827] px-2 text-[11px] font-semibold text-[#aab7cc]'>
            <span className='text-[#8fa0ba]'>{label}:</span>
            <span className='truncate text-[#edf4ff]' title={value}>{value}</span>
        </span>
    )
}

function DispositionButton({ onClick, children }: { onClick: (event: MouseEvent<HTMLButtonElement>) => void, children: string }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex h-8 items-center rounded-lg border border-[#27364f] bg-[#101827] px-2.5 text-[11px] font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
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
        <section className='grid gap-2 rounded-lg border border-[#27364f] bg-[#111b2b] p-3 lg:grid-cols-[1fr_1fr_auto] lg:items-center'>
            <div className='min-w-0'>
                <p className='text-[10px] font-semibold text-[#8fa0ba]'>Selected context</p>
                <p className='mt-1 truncate text-sm font-semibold text-[#edf4ff]' title={selectedEntity?.name || selectedEvidence?.sourceName || alert.company}>
                    {selectedEntity?.name || selectedEvidence?.sourceName || alert.company}
                </p>
                <p className='mt-0.5 truncate text-xs text-[#8fa0ba]' title={selectedEvidence ? safeEvidenceExcerpt(selectedEvidence.excerpt) : safeAlertSummary(alert)}>
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
                    <button type='button' onClick={() => onCopyHash(selectedEvidence.contentHash)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#27364f] bg-[#101827] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
                        <Copy className='h-4 w-4' />
                        {copiedHash === selectedEvidence.contentHash ? 'Copied' : 'Copy hash'}
                    </button>
                )}
                <a href={workflowContext.organizationId ? `/organizations?organizationId=${encodeURIComponent(workflowContext.organizationId)}` : '/organizations'} className='inline-flex h-9 items-center rounded-lg border border-[#27364f] bg-[#101827] px-3 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033]'>
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
        <div className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Delivery and case activity</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>{timeline.length} event{timeline.length === 1 ? '' : 's'} · {deliveries.length} delivery attempt{deliveries.length === 1 ? '' : 's'}</p>
                </div>
                <Clock3 className='h-4 w-4 text-[#9db8ff]' />
            </div>
            <div className='grid gap-3 p-4'>
                <div className='grid gap-2 sm:grid-cols-2'>
                    <ActionStatus label='Last delivery' value={latestDelivery ? `${stateLabel(latestDelivery.status)} · ${relativeTimeLabel(latestDelivery.attemptedAt)}` : 'no delivery yet'} tone={latestDelivery?.status === 'failed' ? 'warn' : 'neutral'} />
                    <ActionStatus label='Case' value={caseId || 'case is being prepared'} />
                    <ActionStatus label='Replay count' value={`${alert.replayCount ?? 0}`} />
                    <ActionStatus label='Destination' value={workflowContext.webhookDestinationIds.length ? `${workflowContext.webhookDestinationIds.length} destination${workflowContext.webhookDestinationIds.length === 1 ? '' : 's'}` : workflowContext.hasWebhookRoute ? 'delivery available' : 'checking delivery'} tone={workflowContext.hasWebhookRoute ? 'neutral' : 'warn'} />
                </div>
                {failedDelivery?.error && <p className='rounded-lg border border-[#7a3520] bg-[#2c160f] px-3 py-2 text-xs text-[#ffb598]'>{failedDelivery.error}</p>}
                <div className='overflow-hidden rounded-lg border border-[#1f2c42]'>
                    <table className='w-full text-left text-xs'>
                        <thead className='bg-[#0b121e] text-[10px] uppercase text-[#8fa0ba]'>
                            <tr>
                                <th className='px-3 py-2 font-semibold'>Time</th>
                                <th className='px-3 py-2 font-semibold'>Event</th>
                                <th className='px-3 py-2 font-semibold'>Detail</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#1f2c42]'>
                            {timeline.slice(0, 8).map(item => (
                                <tr key={item.id} className='align-top'>
                                    <td className='px-3 py-2 font-semibold text-[#aab7cc]'>{relativeTimeLabel(item.at)}</td>
                                    <td className='px-3 py-2 font-semibold text-[#edf4ff]'>{item.title}</td>
                                    <td className='px-3 py-2 text-[#8fa0ba]'>{item.detail}</td>
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
        <button type='button' onClick={onClick} className={`h-8 min-w-12 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${active ? 'border-[#5f86ff] bg-[#122449] text-[#9db8ff]' : 'border-[#27364f] bg-[#101827] text-[#aab7cc] hover:bg-[#162033]'}`}>
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
    const hasCase = Boolean(alert.caseId)
    const caseReady = Boolean(alert.id && alert.evidence?.some(item => item.id || item.provenance?.captureId))
    return (
        <section className='grid min-w-0 gap-3 rounded-lg border border-[#334762] bg-[#111b2b] p-3'>
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
                    <CaseButton busy={busyAction === `case:${alert.id}`} disabled={hasCase || !caseReady} icon='case' onClick={onOpenCase}>{hasCase ? 'Case open' : 'Open case'}</CaseButton>
                    <CaseButton busy={busyAction === `replay:${alert.id}`} disabled={!replayReady} icon='replay' onClick={() => onReplay(alert.id)}>Replay</CaseButton>
                    <CaseButton busy={busyAction === `test:${alert.id}`} disabled={!deliverReady} icon='send' onClick={() => onTest(alert.id)}>Test</CaseButton>
                    <CaseButton busy={busyAction === `send:${alert.id}`} disabled={!deliverReady} icon='send' onClick={() => onSend(alert.id)}>Send</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!suppressReady} icon='false' onClick={() => onUpdate(alert.id, 'false_positive', 'muted', 'Suppressed as false positive.', persistedOwner)}>Suppress</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!closeReady} icon='ready' onClick={() => onUpdate(alert.id, 'resolved', alert.deliveryState === 'delivered' ? 'delivered' : 'muted', 'Closed by analyst.', persistedOwner)}>Close</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} disabled={!reopenReady} icon='review' onClick={() => onUpdate(alert.id, 'needs_review', 'pending_review', 'Reopened for analyst review.', persistedOwner)}>Reopen</CaseButton>
                </div>
                {actionMessage && (
                    <p className={`justify-self-start rounded-lg border px-3 py-2 text-xs font-semibold xl:justify-self-end ${actionMessage.ok ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]' : 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'}`}>
                        {actionMessage.text}
                    </p>
                )}
            </div>
        </section>
    )
}

function ActionAvailability({ label, ready }: { label: string, ready: boolean }) {
    return (
        <span className={`min-w-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${ready ? 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]' : 'border-[#6f5417] bg-[#2a220f] text-[#ffd879]'}`}>
            {label}: {ready ? 'ready' : 'syncing'}
        </span>
    )
}

function ActionStatus({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'warn' }) {
    return (
        <div className='min-w-0 rounded-lg border border-[#27364f] bg-[#101827] px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-[#8fa0ba]'>{label}</p>
            <p className={`mt-1 truncate text-xs font-semibold ${tone === 'warn' ? 'text-[#ffd58a]' : 'text-[#edf4ff]'}`} title={value}>{value}</p>
        </div>
    )
}

function CaseBrief({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0'>
            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>{label}</p>
            <p className='mt-1 line-clamp-3 text-sm leading-6 text-[#aab7cc]'>{value}</p>
        </div>
    )
}

function NoCaseWorkspace({ latestCaptures }: { latestCaptures: OperationsSnapshot['latestCaptures'] }) {
    const newestCapture = [...latestCaptures].sort((first, second) => second.collectedAt.localeCompare(first.collectedAt))[0]
    const monitoringBrief = {
        headline: latestCaptures.length ? 'Monitoring is collecting safe source records' : 'No customer alerts match the watchlist right now',
        whatHappened: latestCaptures.length
            ? `${latestCaptures.length} recent capture${latestCaptures.length === 1 ? '' : 's'} passed duplicate and safety checks, but none currently require a customer alert.`
            : 'Monitoring is active, but no accepted source record currently matches the saved watchlist strongly enough to open a case.',
        whyItMatters: 'A quiet case list is only useful when source collection, watch terms, and delivery routes are still visible.',
        nextAction: latestCaptures.length
            ? 'Review recent captures, tune watched terms, and run a webhook test before the first customer alert.'
            : 'Check watch terms, confirm source health, and add a delivery route before relying on customer notifications.',
        readyForCustomer: false,
        evidenceBoundary: 'Show only safe excerpts and metadata; keep raw leaked files and secrets out of customer updates.',
        sourceRecords: newestCapture ? `Newest capture from ${newestCapture.sourceName} ${relativeTimeLabel(newestCapture.collectedAt)}.` : 'No accepted captures are available in this view yet.',
        workflowReadiness: 'No customer alert is waiting; keep source collection and webhook testing ready for the next match.',
    }
    return (
        <div className='grid gap-5 p-5'>
            <AnalystBriefPanel brief={monitoringBrief} />
            <section data-dwm-zero-case-recovery className='grid gap-3 rounded-lg border border-[#334762] bg-[#111b2b] p-4'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#9db8ff]'>Next operational steps</p>
                    <h3 className='mt-1 text-lg font-semibold text-[#edf4ff]'>Turn source activity into customer alerts.</h3>
                    <p className='mt-1 text-sm leading-6 text-[#aab7cc]'>Use the controls below this console to tune matching, collect public Telegram sources, and test delivery before the next alert fires.</p>
                </div>
                <div className='grid gap-2 sm:grid-cols-3'>
                    <NoCaseActionLink href='#dwm-workflow-actions' label='Edit watchlist' detail='Add company, supplier, domain, and product terms.' />
                    <NoCaseActionLink href='#dwm-workflow-actions' label='Run collection' detail='Pull approved public sources and rebuild alerts.' />
                    <NoCaseActionLink href='#dwm-workflow-actions' label='Test delivery' detail='Verify the webhook path before customer send.' />
                </div>
            </section>
            <div className='grid gap-3 rounded-lg border border-[#26344d] bg-[#0b121e] p-4 md:grid-cols-3'>
                <WorkTile title='1. Watch terms' body='Keep company, domain, supplier, brand, and product terms current.' state='active' />
                <WorkTile title='2. Collect sources' body='Run Telegram and no-stolen-file dark web checks after watchlist changes.' state='active' />
                <WorkTile title='3. Send alerts' body='Test the webhook before the first real customer alert.' state='pending' />
            </div>
            <div className='rounded-lg border border-dashed border-[#334762] bg-[#101827] p-5'>
                <div className='flex items-center justify-between gap-3'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-[#edf4ff]'>
                        <ShieldCheck className='h-4 w-4 text-[#9cf0bc]' />
                        No recent attacks
                    </div>
                    <span className='rounded-full bg-[#0c261c] px-2 py-1 text-xs font-semibold text-[#9cf0bc]'>Monitoring live</span>
                </div>
                <p className='mt-2 text-sm leading-6 text-[#aab7cc]'>Fresh captures are still useful here: they show what the system is collecting and whether the watchlist needs better terms.</p>
            </div>
            <div className='rounded-lg border border-[#26344d] bg-[#101827]'>
                <div className='border-b border-[#1f2c42] px-4 py-3'>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Recent capture review</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Useful for tuning watchlist terms without dumping raw rows.</p>
                </div>
                <div className='grid gap-2 p-4'>
                    {latestCaptures.slice(0, 8).map(capture => (
                        <div key={capture.id} className='rounded-lg border border-[#26344d] bg-[#0b121e] p-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <span className='font-mono text-xs font-semibold text-[#edf4ff]'>{capture.sourceName}</span>
                                <span className='rounded-full bg-[#122449] px-2 py-0.5 text-[11px] font-semibold text-[#9db8ff]'>{stateLabel(capture.family)}</span>
                                <span className='text-xs text-[#8fa0ba]'>{relativeTimeLabel(capture.collectedAt)}</span>
                            </div>
                            <p className='mt-2 line-clamp-2 text-sm leading-6 text-[#aab7cc]'>{capture.safeExcerpt}</p>
                        </div>
                    ))}
                    {!latestCaptures.length && <p className='rounded-lg border border-dashed border-[#334762] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>Collectors are checking sources. Accepted captures appear here after duplicate and safety checks.</p>}
                </div>
            </div>
        </div>
    )
}

function NoCaseActionLink({ href, label, detail }: { href: string, label: string, detail: string }) {
    return (
        <a href={href} className='rounded-lg border border-[#27364f] bg-[#101827] p-3 transition hover:border-[#5f86ff] hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a]'>
            <span className='text-sm font-semibold text-[#edf4ff]'>{label}</span>
            <span className='mt-1 block text-xs leading-5 text-[#8fa0ba]'>{detail}</span>
        </a>
    )
}

function SourcePosture({ snapshot, operations }: { snapshot: DwmProductSnapshot, operations: OperationsSnapshot | null }) {
    const sourceRows = operations?.sourceHealth ?? []
    return (
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Source health</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>{operations ? `${operations.counts.activeSourceCount}/${operations.counts.sourceCount} active sources` : 'Source inventory'}</p>
                </div>
                <SlidersHorizontal className='h-4 w-4 text-[#9db8ff]' />
            </div>
            <div className='p-3'>
                {sourceRows.length ? (
                    <div className='overflow-hidden rounded-lg border border-[#1f2c42]'>
                        <table className='w-full text-left text-xs'>
                            <thead className='bg-[#0b121e] text-[10px] uppercase text-[#8fa0ba]'>
                                <tr>
                                    <th className='px-3 py-2 font-semibold'>Source</th>
                                    <th className='px-3 py-2 font-semibold'>State</th>
                                    <th className='px-3 py-2 font-semibold'>Last pull</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#1f2c42]'>
                                {sourceRows.slice(0, 8).map(source => (
                                    <tr key={source.sourceId} className='bg-[#101827] align-top'>
                                        <td className='px-3 py-2'>
                                            <p className='max-w-[150px] truncate font-semibold text-[#edf4ff]' title={source.sourceName}>{source.sourceName}</p>
                                            <p className='mt-0.5 text-[11px] text-[#8fa0ba]'>{stateLabel(source.family)} · {source.approvedMetadataOnly ? 'metadata only' : 'message capture'}</p>
                                        </td>
                                        <td className='px-3 py-2'>
                                            <span className={source.status === 'active' ? 'rounded-full bg-[#0c261c] px-2 py-0.5 font-semibold text-[#9cf0bc]' : 'rounded-full bg-[#2a1c0e] px-2 py-0.5 font-semibold text-[#ffd58a]'}>
                                                {stateLabel(source.status)}
                                            </span>
                                        </td>
                                        <td className='px-3 py-2 font-semibold text-[#aab7cc]'>{source.lastCollectedAt ? relativeTimeLabel(source.lastCollectedAt) : 'never'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className='grid gap-2'>
                        {snapshot.sourceCoverage.map(source => (
                            <div key={source.family} className='rounded-lg border border-[#1f2c42] bg-[#0b121e] p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-semibold text-[#edf4ff]'>{source.label}</span>
                                    <span className='rounded-full bg-[#101827] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{source.activeCount}/{source.sourceCount}</span>
                                </div>
                                <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#8fa0ba]'>{source.detail}</p>
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
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Customer delivery</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Webhook attempts and test sends.</p>
                </div>
                <Webhook className='h-4 w-4 text-[#9db8ff]' />
            </div>
            <div className='grid gap-2 p-3'>
                {visible.slice(0, 6).map(delivery => (
                    <div key={delivery.id} className='grid gap-2 rounded-lg border border-[#1f2c42] bg-[#0b121e] p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <span className={deliveryClass(delivery.status)}>{stateLabel(delivery.status)}</span>
                            <span className='text-xs font-semibold text-[#8fa0ba]'>{relativeTimeLabel(delivery.attemptedAt)}</span>
                        </div>
                        <div className='grid grid-cols-2 gap-2 text-[11px] text-[#8fa0ba]'>
                            <p><span className='font-semibold text-[#aab7cc]'>HTTP:</span> {delivery.httpStatus ?? (delivery.dryRun ? 'dry run' : 'pending')}</p>
                            <p><span className='font-semibold text-[#aab7cc]'>Payload:</span> {delivery.payloadHash}</p>
                            <p className='col-span-2 break-all'><span className='font-semibold text-[#aab7cc]'>Endpoint:</span> {delivery.endpointHash}</p>
                            <p className='col-span-2 break-all'><span className='font-semibold text-[#aab7cc]'>Alert key:</span> {delivery.dedupeKey}</p>
                        </div>
                        {delivery.error && <p className='text-xs text-[#ffb598]'>{delivery.error}</p>}
                    </div>
                ))}
                {!visible.length && <p className='rounded-lg border border-dashed border-[#334762] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>Delivery route is ready for the next alert. Test sends and customer deliveries stream here.</p>}
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
        <section className='rounded-lg border border-[#26344d] bg-[#101827]'>
            <div className='flex items-center justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#edf4ff]'>Actor context</h3>
                    <p className='mt-0.5 text-xs text-[#8fa0ba]'>Actor, sources, latest sighting, and watch state.</p>
                </div>
                <Fingerprint className='h-4 w-4 text-[#9db8ff]' />
            </div>
            <div className='grid gap-2 p-3'>
                {snapshot.actorOverviews.slice(0, 4).map(actor => (
                    <div key={actor.actor} className='rounded-lg border border-[#1f2c42] bg-[#0b121e] p-3'>
                        <div className='flex items-center justify-between gap-3'>
                            <span className='text-sm font-semibold text-[#edf4ff]'>{actor.actor}</span>
                            <span className='rounded-full bg-[#122449] px-2 py-0.5 text-[11px] font-semibold text-[#9db8ff]'>{actor.confidence}%</span>
                        </div>
                        <div className='mt-3 grid grid-cols-3 gap-2 text-[11px]'>
                            <QueueCell label='sources' value={`${actor.sourceCount}`} />
                            <QueueCell label='captures' value={`${actor.captureCount}`} />
                            <QueueCell label='latest' value={relativeTimeLabel(actor.latestSeenAt)} />
                        </div>
                        <div className='mt-2 flex flex-wrap gap-2'>
                            <span className='rounded-full bg-[#101827] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{stateLabel(actor.watchState)}</span>
                            {actor.sourceFamilies.slice(0, 2).map(family => (
                                <span key={family} className='rounded-full bg-[#101827] px-2 py-0.5 text-[11px] font-semibold text-[#aab7cc]'>{stateLabel(family)}</span>
                            ))}
                        </div>
                    </div>
                ))}
                {!snapshot.actorOverviews.length && <p className='rounded-lg border border-dashed border-[#334762] bg-[#0b121e] p-3 text-sm text-[#aab7cc]'>Actor profiles are checking metadata. Linked profiles stream here as evidence attaches to known actors.</p>}
            </div>
        </section>
    )
}

function StatusPill({ label, value, tone }: { label: string, value: string, tone: 'good' | 'warn' | 'neutral' }) {
    const toneClass = tone === 'good' ? 'border-[#2f8f56]/40 bg-[#163822] text-[#d9f8e5]' : tone === 'warn' ? 'border-[#f97316]/40 bg-[#3a2418] text-[#ffedd5]' : 'border-[#30415f] bg-[#132033] text-[#e7edf8]'
    return (
        <div className={`shrink-0 rounded-lg border px-3 py-2 ${toneClass}`}>
            <p className='text-[10px] font-semibold uppercase opacity-75'>{label}</p>
            <p className='mt-0.5 text-sm font-semibold'>{value}</p>
        </div>
    )
}

function CaseMetric({ label, value, detail, tone = 'neutral' }: { label: string, value: string, detail: string, tone?: 'neutral' | 'warn' | 'bad' }) {
    const toneClass = tone === 'bad'
        ? 'text-[#ffb598]'
        : tone === 'warn'
            ? 'text-[#ffd58a]'
            : 'text-[#9db8ff]'
    return (
        <div className='border-b border-r border-[#1f2c42] p-4 last:border-r-0 md:border-b-0'>
            <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>{label}</p>
            <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 text-xs font-semibold text-[#8fa0ba]'>{detail}</p>
        </div>
    )
}

function QueueCell({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'bad' }) {
    return (
        <div className='rounded-lg border border-[#1f2c42] bg-[#101827] px-2 py-1.5'>
            <p className='text-[9px] font-semibold uppercase text-[#98a2b3]'>{label}</p>
            <p className={`mt-0.5 truncate font-semibold ${tone === 'bad' ? 'text-[#ffb598]' : 'text-[#aab7cc]'}`} title={value}>{value}</p>
        </div>
    )
}

function ContextChip({ label, value, href }: { label: string, value: string, href?: string }) {
    const content = (
        <>
            <p className='text-[10px] font-semibold uppercase text-[#8fa0ba]'>{label}</p>
            <p className='mt-1 truncate text-xs font-semibold text-[#edf4ff]' title={value}>{value}</p>
        </>
    )
    if (href) {
        return (
            <a href={href} className='min-w-0 rounded-lg border border-[#27364f] bg-[#101827] px-3 py-2 transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a]'>
                {content}
            </a>
        )
    }
    return <div className='min-w-0 rounded-lg border border-[#26344d] bg-[#101827] px-3 py-2'>{content}</div>
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

function WorkTile({ title, body, state }: { title: string, body: string, state: 'active' | 'pending' }) {
    return (
        <div className='rounded-lg border border-[#26344d] bg-[#101827] p-3'>
            <div className='flex items-center justify-between gap-2'>
                <h3 className='text-sm font-semibold text-[#edf4ff]'>{title}</h3>
                <span className={state === 'active' ? 'rounded-full bg-[#0c261c] px-2 py-0.5 text-[11px] font-semibold text-[#9cf0bc]' : 'rounded-full bg-[#2a1c0e] px-2 py-0.5 text-[11px] font-semibold text-[#ffd58a]'}>
                    {state}
                </span>
            </div>
            <p className='mt-2 text-xs leading-5 text-[#aab7cc]'>{body}</p>
        </div>
    )
}

function CaseButton({ busy, disabled = false, icon, onClick, children }: { busy: boolean, disabled?: boolean, icon: 'review' | 'ready' | 'replay' | 'send' | 'false' | 'case', onClick: () => void, children: string }) {
    const Icon = busy ? Loader2 : icon === 'case' ? FolderOpen : icon === 'send' ? Send : icon === 'false' ? XCircle : icon === 'replay' ? RotateCcw : icon === 'ready' ? CheckCircle2 : Play
    return (
        <button type='button' onClick={onClick} disabled={busy || disabled} title={disabled ? 'Action is not available for this alert state.' : undefined} className='inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-lg border border-[#27364f] bg-[#101827] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] disabled:cursor-not-allowed disabled:opacity-60 sm:px-3'>
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

async function readPayload(response: Response): Promise<{ error?: { message?: string }, attemptedCount?: number, case?: { id?: string } }> {
    return await response.json().catch(() => ({}))
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-[#30170f] px-2 py-0.5 text-xs font-semibold text-[#ffb598]'
    if (severity === 'high') return 'rounded-full bg-[#2a1c0e] px-2 py-0.5 text-xs font-semibold text-[#ffd58a]'
    return 'rounded-full bg-[#122449] px-2 py-0.5 text-xs font-semibold text-[#9db8ff]'
}

function deliveryClass(status: string) {
    if (status === 'delivered') return 'rounded-full bg-[#0c261c] px-2 py-0.5 text-xs font-semibold text-[#9cf0bc]'
    if (status === 'failed') return 'rounded-full bg-[#2c160f] px-2 py-0.5 text-xs font-semibold text-[#ffb598]'
    return 'rounded-full bg-[#122449] px-2 py-0.5 text-xs font-semibold text-[#9db8ff]'
}

function dispositionClass(state?: EvidenceDispositionState) {
    if (state === 'escalated') return 'rounded-full bg-[#2a1c0e] px-2 py-0.5 text-xs font-semibold text-[#ffd58a]'
    if (state === 'suppressed' || state === 'false_positive') return 'rounded-full bg-[#2c160f] px-2 py-0.5 text-xs font-semibold text-[#ffb598]'
    if (state === 'reviewed') return 'rounded-full bg-[#0c261c] px-2 py-0.5 text-xs font-semibold text-[#9cf0bc]'
    return 'rounded-full bg-[#122449] px-2 py-0.5 text-xs font-semibold text-[#9db8ff]'
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
