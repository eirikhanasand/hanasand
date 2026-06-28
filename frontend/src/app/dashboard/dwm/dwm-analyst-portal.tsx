'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock3, Fingerprint, Loader2, Play, Radar, RotateCcw, Send, ShieldAlert, ShieldCheck, SlidersHorizontal, Webhook, XCircle } from 'lucide-react'
import type { DwmAlert, DwmProductSnapshot } from '@/utils/dwm/product'
import { DwmWorkflowActions } from './dwm-workflow-actions'

type PortalAlert = DwmAlert & {
    deliveryState?: string
    workflowNote?: string
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
}

export function DwmAnalystPortal({ snapshot, operations, alerts, deliveries }: PortalProps) {
    const router = useRouter()
    const [selectedId, setSelectedId] = useState(alerts[0]?.id ?? '')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const selectedAlert = alerts.find(alert => alert.id === selectedId) ?? alerts[0]
    const selectedDeliveries = selectedAlert ? deliveries.filter(delivery => delivery.alertId === selectedAlert.id) : []
    const queue = useMemo(() => orderAlerts(alerts), [alerts])
    const criticalCount = alerts.filter(alert => alert.severity === 'critical').length
    const readyCount = alerts.filter(alert => alert.deliveryState === 'ready_to_send').length
    const latestCaptures = operations?.latestCaptures ?? []
    const latestRunLabel = operations?.latestRun ? `${operations.latestRun.captureCount} captures` : 'No run yet'
    const watchTermCount = snapshot.watchlist.length
    const webhookState = deliveries.some(delivery => delivery.alertId === 'webhook_test' && (delivery.status === 'dry_run' || delivery.status === 'delivered')) ? 'Tested' : 'Not tested'

    async function updateAlert(alertId: string, reviewState: string, deliveryState: string, note: string) {
        await runAction(`update:${alertId}`, async () => {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ reviewState, deliveryState, note, actor: 'dashboard' }),
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

                <div className='grid min-h-[680px] xl:grid-cols-[320px_minmax(0,1fr)_360px]'>
                    <aside className='border-b border-[#e8edf5] bg-[#f8fafc] xl:border-b-0 xl:border-r'>
                        <div className='border-b border-[#e8edf5] p-4'>
                            <div className='flex items-center justify-between gap-3'>
                                <div>
                                    <h3 className='text-sm font-semibold text-[#171a21]'>Case queue</h3>
                                    <p className='mt-1 text-xs text-[#667085]'>{alerts.length ? 'Sorted by delivery state and severity.' : 'No matches for the saved watchlist yet.'}</p>
                                </div>
                                <Radar className='h-4 w-4 text-[#3056d3]' />
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
                                    <p className='mt-2 line-clamp-2 text-xs leading-5 text-[#596170]'>{alert.claimSummary}</p>
                                    <div className='mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#667085]'>
                                        <span className='rounded-full bg-white px-2 py-0.5'>{stateLabel(alert.deliveryState || 'pending_review')}</span>
                                        <span>{alert.workflowEvents?.length || 0} events</span>
                                        <span>{relativeTimeLabel(alert.firstSeenAt)}</span>
                                    </div>
                                </button>
                            )) : (
                                <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-white p-4 text-sm leading-6 text-[#596170]'>
                                    No open cases. Monitoring is live, but the saved watchlist terms have not matched recent captures.
                                </div>
                            )}
                        </div>
                    </aside>

                    <main className='min-w-0 bg-white'>
                        {selectedAlert ? (
                            <CaseWorkspace
                                alert={selectedAlert}
                                deliveries={selectedDeliveries}
                                busyAction={busyAction}
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

function CaseWorkspace({ alert, deliveries, busyAction, onUpdate, onReplay, onSend }: {
    alert: PortalAlert
    deliveries: DeliveryItem[]
    busyAction: string | null
    onUpdate: (alertId: string, reviewState: string, deliveryState: string, note: string) => Promise<void>
    onReplay: (alertId: string) => Promise<void>
    onSend: (alertId: string) => Promise<void>
}) {
    const timeline = buildTimeline(alert, deliveries)
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
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='review' onClick={() => onUpdate(alert.id, 'reviewing', 'pending_review', 'Analyst review started.')}>Review</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='ready' onClick={() => onUpdate(alert.id, 'route_to_customer', 'ready_to_send', 'Ready for customer delivery.')}>Ready</CaseButton>
                    <CaseButton busy={busyAction === `replay:${alert.id}`} icon='replay' onClick={() => onReplay(alert.id)}>Replay</CaseButton>
                    <CaseButton busy={busyAction === `send:${alert.id}`} icon='send' onClick={() => onSend(alert.id)}>Send</CaseButton>
                    <CaseButton busy={busyAction === `update:${alert.id}`} icon='false' onClick={() => onUpdate(alert.id, 'false_positive', 'muted', 'Marked false positive.')}>False</CaseButton>
                </div>
            </div>

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
                            <p className='mt-0.5 text-xs text-[#667085]'>Safe excerpts, hashes, source families, and retention state.</p>
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
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Source posture</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>{operations ? `${operations.counts.activeSourceCount}/${operations.counts.sourceCount} active sources` : 'Source inventory'}</p>
                </div>
                <SlidersHorizontal className='h-4 w-4 text-[#3056d3]' />
            </div>
            <div className='grid gap-2 p-3'>
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
                    <div key={delivery.id} className='rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className={deliveryClass(delivery.status)}>{stateLabel(delivery.status)}</span>
                            <span className='text-xs text-[#667085]'>{relativeTimeLabel(delivery.attemptedAt)}</span>
                        </div>
                        <p className='mt-2 break-all font-mono text-[11px] text-[#667085]'>{delivery.endpointHash}</p>
                        {delivery.error && <p className='mt-2 text-xs text-[#9a3412]'>{delivery.error}</p>}
                    </div>
                ))}
                {!visible.length && <p className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-3 text-sm text-[#596170]'>No webhook attempts yet.</p>}
            </div>
        </section>
    )
}

function ActorPanel({ snapshot }: { snapshot: DwmProductSnapshot }) {
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Actor context</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>UI-friendly summaries for fast triage.</p>
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
                        <p className='mt-2 line-clamp-3 text-xs leading-5 text-[#667085]'>{actor.summary}</p>
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
            detail: event.note || `${stateLabel(event.fromDeliveryState || 'pending')} to ${stateLabel(event.toDeliveryState || 'pending')}`,
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
