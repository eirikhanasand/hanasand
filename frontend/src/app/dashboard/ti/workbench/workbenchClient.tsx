'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ExternalLink, FileText, Filter, Fingerprint, ListChecks, MessageSquareText, Search, ShieldAlert, UserRound } from 'lucide-react'

export type WorkbenchEvidence = {
    id: string
    sourceName: string
    sourceFamily: string
    captureMode: string
    redactionState: string
    contentHash: string
    excerpt: string
    observedAt?: string
    provenance?: string
    confidence?: number
    metadata?: Array<{ label: string, value: string }>
}

export type WorkbenchTimelineItem = {
    id: string
    at: string
    title: string
    body: string
}

export type WorkbenchWorkflowStep = {
    id: string
    label: string
    status: 'ready' | 'needs_action' | 'blocked'
    owner: string
    source: string
    detail: string
    entityId?: string
    href?: string
}

export type WorkbenchAction = {
    id: string
    label: string
    method: 'GET' | 'POST' | 'PATCH'
    href: string
    body?: Record<string, unknown>
    disabledReason?: string
}

export type WorkbenchCaseMutationAction = 'assign' | 'note' | 'escalate' | 'suppress' | 'close' | 'reopen' | 'false_positive'

export type WorkbenchCaseMutationPayload = {
    action: WorkbenchCaseMutationAction
    actor: string
    note?: string
    assignedOwner?: string
}

export type WorkbenchDeliveryEvidence = {
    id: string
    alertId: string
    status: string
    deliveryKind?: string
    attemptedAt: string
    webhookDestinationId?: string
    endpointHash: string
    payloadHash: string
    httpStatus?: number
    error?: string
}

export type WorkbenchCase = {
    id: string
    kind: 'dwm_alert' | 'ti_domain' | 'source_capture' | 'org_readiness' | 'watchlist_readiness' | 'webhook_readiness' | 'source_readiness' | 'alert_readiness'
    queue: string
    title: string
    subtitle: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    status: string
    priority: number
    confidence: number
    owner: string
    createdAt: string
    updatedAt: string
    company: string
    matchedTerm: string
    actor: string
    sourceLabel: string
    recommendedAction: string
    routeLabel: string
    persistent: boolean
    evidence: WorkbenchEvidence[]
    timeline: WorkbenchTimelineItem[]
    nextTasks: string[]
    relatedLinks: Array<{ href: string, label: string }>
    workflowPath?: WorkbenchWorkflowStep[]
    actions?: WorkbenchAction[]
    caseDetailHref?: string
    deliveryEvidence?: WorkbenchDeliveryEvidence[]
    missingDependency?: string
}

type QueueFilter = 'all' | 'critical' | 'high' | 'persistent' | 'evidence'

export default function AnalystWorkbenchClient({ initialCases, chrome = 'full' }: { initialCases: WorkbenchCase[], chrome?: 'full' | 'compact' }) {
    const router = useRouter()
    const compact = chrome === 'compact'
    const [selectedId, setSelectedId] = useState(initialCases[0]?.id ?? '')
    const [filter, setFilter] = useState<QueueFilter>('all')
    const [query, setQuery] = useState('')
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [ownerDrafts, setOwnerDrafts] = useState<Record<string, string>>({})
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [caseDetails, setCaseDetails] = useState<Record<string, CaseDetailState>>({})
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const cases = useMemo(() => filterCases(initialCases, filter, query), [initialCases, filter, query])
    const selected = initialCases.find(item => item.id === selectedId) ?? cases[0] ?? initialCases[0]
    const queues = queueSummary(initialCases)
    const selectedDecision = selected ? localDecisions[selected.id] : undefined
    const selectedCaseDetail = selected ? caseDetails[selected.id] : undefined

    const refreshCaseDetail = useCallback(async (itemId: string, href: string, options: { loading?: boolean } = {}) => {
        if (options.loading !== false) setCaseDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        const response = await fetch(href, { cache: 'no-store' })
        const payload = await readCaseDetailJson(response)
        if (!response.ok) throw new Error(payload.error?.message || response.statusText)
        setCaseDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
        return payload
    }, [])

    useEffect(() => {
        if (!selected?.caseDetailHref) return
        let cancelled = false
        const itemId = selected.id
        const href = selected.caseDetailHref
        setCaseDetails(current => ({ ...current, [itemId]: { status: 'loading' } }))
        fetch(href, { cache: 'no-store' })
            .then(async response => {
                const payload = await readCaseDetailJson(response)
                if (!response.ok) throw new Error(payload.error?.message || response.statusText)
                if (!cancelled) setCaseDetails(current => ({ ...current, [itemId]: { status: 'ready', detail: payload } }))
            })
            .catch(error => {
                if (!cancelled) setCaseDetails(current => ({ ...current, [itemId]: { status: 'error', error: error instanceof Error ? error.message : String(error) } }))
            })
        return () => {
            cancelled = true
        }
    }, [selected?.id, selected?.caseDetailHref])

    async function applyDecision(item: WorkbenchCase, decision: LocalDecision) {
        const nextDecision = {
            ...(localDecisions[item.id] ?? {}),
            ...decision,
            decidedAt: new Date().toISOString(),
        }

        const decisionStatus = decision.status
        if (item.kind !== 'dwm_alert' || (!decisionStatus && !decision.owner)) {
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            return
        }

        await runPersistentAction(`decision:${item.id}`, async () => {
            const mapped: Partial<{ reviewState: string, deliveryState: string }> = decisionStatus ? mapDwmDecision(decisionStatus, item.status) : {}
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(item.id)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    reviewState: mapped.reviewState,
                    deliveryState: mapped.deliveryState,
                    note: decision.reason || (decision.owner ? `Assigned to ${decision.owner}.` : 'Updated from the analyst workbench.'),
                    assignedOwner: decision.owner,
                    actor: 'dashboard',
                }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            return decisionStatus ? `${label(decisionStatus)} saved to the DWM workflow.` : 'Owner saved to the DWM workflow.'
        })
    }

    async function replayDwmAlert(item: WorkbenchCase) {
        await runPersistentAction(`replay:${item.id}`, async () => {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(item.id)}/replay`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ actor: 'dashboard' }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            if (item.caseDetailHref) await refreshCaseDetail(item.id, item.caseDetailHref, { loading: false })
            return 'Evidence replay recorded in the DWM workflow.'
        })
    }

    async function sendDwmAlert(item: WorkbenchCase) {
        await runPersistentAction(`send:${item.id}`, async () => {
            const action = item.actions?.find(candidate => candidate.id === 'send_alert')
            const response = await fetch(action?.href || '/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(action?.body || { tenantId: 'default', alertId: item.id, limit: 1 }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            if (item.caseDetailHref) await refreshCaseDetail(item.id, item.caseDetailHref, { loading: false })
            return payload.attemptedCount ? 'Webhook delivery attempted.' : 'No webhook delivery was attempted.'
        })
    }

    async function runWorkbenchAction(item: WorkbenchCase, action: WorkbenchAction, note: string) {
        if (action.method === 'GET') return
        await runPersistentAction(`action:${item.id}:${action.id}`, async () => {
            const body = {
                ...(action.body || {}),
                note: note || action.body?.note,
                assignedOwner: localDecisions[item.id]?.owner,
                actor: 'dashboard',
            }
            const response = await fetch(action.href, {
                method: action.method,
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            if (item.caseDetailHref) await refreshCaseDetail(item.id, item.caseDetailHref, { loading: false })
            return actionResultMessage(action, payload)
        })
    }

    async function runBackedCaseMutation(item: WorkbenchCase, mutation: CaseMutationInput) {
        if (!item.caseDetailHref) {
            setMessage({ ok: false, text: item.missingDependency || 'This selected item has no backed /api/cases/:id route. Use session-local triage or open/create the case first.' })
            return
        }
        await runPersistentAction(`case:${item.id}:${mutation.action}`, async () => {
            const body: WorkbenchCaseMutationPayload = {
                action: mutation.action,
                actor: 'dashboard',
                note: mutation.note || undefined,
                assignedOwner: mutation.assignedOwner || undefined,
            }
            const response = await fetch(item.caseDetailHref as string, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            await refreshCaseDetail(item.id, item.caseDetailHref as string, { loading: false })
            setLocalDecisions(current => {
                const next = { ...current }
                delete next[item.id]
                return next
            })
            return caseMutationResultMessage(mutation.action, payload)
        })
    }

    async function runPersistentAction(key: string, action: () => Promise<string>) {
        if (busyAction) return
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
        <div className='grid gap-3'>
            {message && (
                <p className={`rounded-lg border px-3 py-2 text-sm ${message.ok ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]' : 'border-[#fde2d6] bg-[#fff7f3] text-[#9a3412]'}`}>
                    {message.text}
                </p>
            )}

            <div className='overflow-hidden rounded-lg border border-[#dfe5ee] bg-white'>
                <div className='flex flex-wrap items-center gap-2 border-b border-[#e8edf5] bg-[#171a21] px-3 py-2 text-xs text-white'>
                    <StatusPill label='Cases' value={String(initialCases.length)} />
                    <StatusPill label='Persistent' value={String(initialCases.filter(item => item.persistent).length)} />
                    <StatusPill label='Critical' value={String(initialCases.filter(item => item.severity === 'critical').length)} />
                    <StatusPill label='DWM actions' value='API route' tone='good' />
                    <StatusPill label='TI decisions' value='session-local' tone='warn' />
                </div>

                <div className={`grid ${compact ? 'min-h-[calc(100vh-150px)] xl:grid-cols-[350px_minmax(0,1fr)_300px]' : 'min-h-[720px] xl:grid-cols-[340px_minmax(0,1fr)_330px]'}`}>
                    <aside className='border-b border-[#e8edf5] bg-[#f8fafc] xl:border-b-0 xl:border-r'>
                        <div className='grid gap-3 border-b border-[#e8edf5] p-4'>
                            <label className='relative block'>
                                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#98a2b3]' />
                                <input
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder='Search cases, actors, domains'
                                    className='h-10 w-full rounded-lg border border-[#d8dee9] bg-white pl-9 pr-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                                />
                            </label>
                            <div className='flex flex-wrap gap-2'>
                                {(['all', 'critical', 'high', 'persistent', 'evidence'] as QueueFilter[]).map(item => (
                                    <button
                                        key={item}
                                        type='button'
                                        onClick={() => setFilter(item)}
                                        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition ${filter === item ? 'border-[#3056d3] bg-[#eef3ff] text-[#3056d3]' : 'border-[#d8dee9] bg-white text-[#475467] hover:bg-[#f2f5f9]'}`}
                                    >
                                        {item === 'all' ? <Filter className='h-3.5 w-3.5' /> : null}
                                        {label(item)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={`${compact ? 'max-h-[calc(100vh-250px)]' : 'max-h-[620px]'} overflow-auto p-2`}>
                            {cases.map(item => (
                                <button
                                    key={item.id}
                                    type='button'
                                    onClick={() => setSelectedId(item.id)}
                                    className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === item.id ? 'border-[#3056d3] bg-white shadow-sm' : 'border-transparent hover:border-[#dfe5ee] hover:bg-white'}`}
                                >
                                    <div className='flex items-center justify-between gap-2'>
                                        <span className='truncate text-sm font-semibold text-[#171a21]'>{item.title}</span>
                                        <span className={severityClass(item.severity)}>{item.severity}</span>
                                    </div>
                                    <p className='mt-1 truncate text-xs text-[#667085]'>{item.queue} · {item.owner}</p>
                                    <p className='mt-2 line-clamp-2 text-xs leading-5 text-[#596170]'>{item.subtitle}</p>
                                    <div className='mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#667085]'>
                                        <span className='rounded-full bg-white px-2 py-0.5'>{label(item.status)}</span>
                                        <span>{item.confidence}%</span>
                                        <span>{relativeTime(item.updatedAt)}</span>
                                    </div>
                                </button>
                            ))}
                            {!cases.length && <p className='rounded-lg border border-dashed border-[#cfd8e6] bg-white p-4 text-sm text-[#596170]'>No cases match this filter.</p>}
                        </div>
                    </aside>

                    <main className='min-w-0'>
                        {selected ? (
                            <CaseDetail
                                item={selected}
                                decision={selectedDecision}
                                note={notes[selected.id] ?? ''}
                                ownerDraft={ownerDrafts[selected.id]}
                                busyAction={busyAction}
                                compact={compact}
                                caseDetail={selectedCaseDetail}
                                onNoteChange={value => setNotes(current => ({ ...current, [selected.id]: value }))}
                                onOwnerDraftChange={value => setOwnerDrafts(current => ({ ...current, [selected.id]: value }))}
                                onDecision={(decision) => applyDecision(selected, decision)}
                                onBackedCaseMutation={(mutation) => runBackedCaseMutation(selected, mutation)}
                                onReplay={() => replayDwmAlert(selected)}
                                onSend={() => sendDwmAlert(selected)}
                                onAction={(action) => runWorkbenchAction(selected, action, notes[selected.id] ?? '')}
                            />
                        ) : (
                            <EmptyWorkspace />
                        )}
                    </main>

                    <aside className='border-t border-[#e8edf5] bg-[#fbfcfe] xl:border-l xl:border-t-0'>
                        <div className='grid gap-4 p-4'>
                            <section className='rounded-lg border border-[#e0e5ed] bg-white'>
                                <div className='border-b border-[#eef1f5] px-4 py-3'>
                                    <h3 className='text-sm font-semibold text-[#171a21]'>Queue posture</h3>
                                    <p className='mt-0.5 text-xs text-[#667085]'>Operational load by workflow queue.</p>
                                </div>
                                <div className='grid gap-2 p-3'>
                                    {queues.map(queue => (
                                        <div key={queue.name} className='flex items-center justify-between gap-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] px-3 py-2 text-xs'>
                                            <span className='font-semibold text-[#171a21]'>{queue.name}</span>
                                            <span className='text-[#667085]'>{queue.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className='rounded-lg border border-[#e0e5ed] bg-white'>
                                <div className='border-b border-[#eef1f5] px-4 py-3'>
                                    <h3 className='text-sm font-semibold text-[#171a21]'>Analyst controls</h3>
                                    <p className='mt-0.5 text-xs text-[#667085]'>Fast links to the systems behind this case.</p>
                                </div>
                                <div className='grid gap-2 p-3'>
                                    {selected?.relatedLinks.map(link => (
                                        <Link key={link.href} href={link.href} className='inline-flex h-9 items-center justify-between gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                            {link.label}
                                            <ExternalLink className='h-3.5 w-3.5' />
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}

function EmptyWorkspace() {
    return (
        <div className='grid gap-4 p-5'>
            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-5'>
                <h2 className='text-lg font-semibold text-[#171a21]'>No cases in the work queue</h2>
                <p className='mt-2 text-sm leading-6 text-[#596170]'>Create a DWM watchlist, review source coverage, or run the TI source workflow to produce the first actionable case.</p>
                <div className='mt-4 flex flex-wrap gap-2'>
                    <Link href='/dashboard/dwm' className='inline-flex h-9 items-center rounded-lg bg-[#171a21] px-3 text-xs font-semibold text-white transition hover:bg-[#2b2f39]'>Open DWM setup</Link>
                    <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>Review TI sources</Link>
                    <Link href='/dashboard/automations?setup=dwm' className='inline-flex h-9 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>Configure delivery</Link>
                </div>
            </div>
        </div>
    )
}

function BackedInspection({ item, caseDetail, compact }: { item: WorkbenchCase, caseDetail?: CaseDetailState, compact: boolean }) {
    const localDeliveries = item.deliveryEvidence || []
    const detailDeliveries = caseDetail?.status === 'ready' ? caseDetail.detail.deliveries || [] : []
    const deliveries = detailDeliveries.length ? detailDeliveries : localDeliveries
    const blockedDependency = item.missingDependency || (!item.caseDetailHref && item.kind === 'dwm_alert' ? 'No backed case ID is available for this selected alert. Use Open case after live alerts load; fallback alerts cannot load /api/cases/:id.' : '')

    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                <div>
                    <h3 className='text-sm font-semibold text-[#171a21]'>Backed inspection</h3>
                    <p className='mt-0.5 text-xs text-[#667085]'>Case detail, workflow timeline, evidence, delivery attempts, and missing dependencies.</p>
                </div>
                {item.caseDetailHref && (
                    <Link href={item.caseDetailHref} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d8dee9] bg-white px-2.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                        Case API
                        <ExternalLink className='h-3.5 w-3.5' />
                    </Link>
                )}
            </div>
            <div className={`grid gap-3 p-4 ${compact ? 'xl:grid-cols-[0.85fr_1fr]' : 'xl:grid-cols-[0.8fr_1fr]'}`}>
                <div className='grid gap-3'>
                    {caseDetail?.status === 'loading' && <InspectionNotice tone='neutral' title='Loading case detail' body='Fetching /api/cases/:id through the dashboard proxy.' />}
                    {caseDetail?.status === 'error' && <InspectionNotice tone='blocked' title='Case detail unavailable' body={caseDetail.error} />}
                    {blockedDependency && !caseDetail && <InspectionNotice tone='blocked' title='Blocked dependency' body={blockedDependency} />}
                    {caseDetail?.status === 'ready' ? (
                        <>
                            <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-semibold text-[#171a21]'>{caseDetail.detail.case?.id || 'case'}</span>
                                    <span className={workflowStatusClass(caseDetail.detail.case?.status === 'closed' ? 'blocked' : 'ready')}>{label(caseDetail.detail.case?.status || 'unknown')}</span>
                                    {caseDetail.detail.access?.mode && <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{caseDetail.detail.access.mode}</span>}
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{caseDetail.detail.case?.summary || 'No case summary returned.'}</p>
                                <div className='mt-3 grid gap-1 text-xs text-[#667085] sm:grid-cols-2'>
                                    <p><span className='font-semibold text-[#475467]'>Owner:</span> {caseDetail.detail.case?.assignedOwner || 'unassigned'}</p>
                                    <p><span className='font-semibold text-[#475467]'>Alert:</span> {caseDetail.detail.case?.alertId || caseDetail.detail.alert?.id || 'none'}</p>
                                    <p><span className='font-semibold text-[#475467]'>Delivery:</span> {caseDetail.detail.deliveryContext?.deliveryCount ?? 0} attempt(s)</p>
                                    <p><span className='font-semibold text-[#475467]'>Updated:</span> {relativeTime(caseDetail.detail.case?.updatedAt || caseDetail.detail.generatedAt)}</p>
                                </div>
                            </div>
                            <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <h4 className='text-sm font-semibold text-[#171a21]'>Allowed next actions</h4>
                                <div className='mt-2 flex flex-wrap gap-2'>
                                    {(caseDetail.detail.nextAllowedActions || []).map(action => (
                                        <span key={action.id} title={action.disabledReason} className={workflowStatusClass(action.enabled ? 'ready' : 'blocked')}>{action.label}</span>
                                    ))}
                                    {!(caseDetail.detail.nextAllowedActions || []).length && (caseDetail.detail.nextActions || []).map(action => (
                                        <span key={String(action)} className='rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[#596170]'>{String(action)}</span>
                                    ))}
                                    {!(caseDetail.detail.nextAllowedActions || caseDetail.detail.nextActions || []).length && <span className='text-xs text-[#667085]'>No next actions returned by the case API.</span>}
                                </div>
                            </div>
                        </>
                    ) : null}
                    <DeliveryEvidenceRows deliveries={deliveries} />
                </div>
                <div className='grid gap-3'>
                    {caseDetail?.status === 'ready' && (
                        <>
                            <TimelineRows title='Case timeline' rows={caseDetail.detail.timeline || []} />
                            <CaseEvidenceRows evidence={caseDetail.detail.evidence || []} />
                        </>
                    )}
                    {caseDetail?.status !== 'ready' && !deliveries.length && (
                        <InspectionNotice
                            tone='neutral'
                            title='No delivery rows loaded'
                            body='Delivery evidence appears after POST /api/dwm/webhooks/test or POST /api/dwm/webhooks/deliver writes rows to listDwmWebhookDeliveries.'
                        />
                    )}
                </div>
            </div>
        </section>
    )
}

function InspectionNotice({ tone, title, body }: { tone: 'neutral' | 'blocked', title: string, body: string }) {
    return (
        <div className={`rounded-lg border p-3 ${tone === 'blocked' ? 'border-[#fed7aa] bg-[#fff7ed]' : 'border-[#d8dee9] bg-[#fbfcfe]'}`}>
            <h4 className={`text-sm font-semibold ${tone === 'blocked' ? 'text-[#9a3412]' : 'text-[#171a21]'}`}>{title}</h4>
            <p className='mt-1 text-xs leading-5 text-[#596170]'>{body}</p>
        </div>
    )
}

function DeliveryEvidenceRows({ deliveries }: { deliveries: Array<WorkbenchDeliveryEvidence | CaseDelivery> }) {
    if (!deliveries.length) {
        return (
            <InspectionNotice
                tone='blocked'
                title='Webhook delivery evidence missing'
                body='No delivery rows are available. Run Test org webhook or Send alert; if rows still do not appear, wire listDwmWebhookDeliveries through the scraper store and /api/dwm/webhooks/deliveries.'
            />
        )
    }

    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <h4 className='text-sm font-semibold text-[#171a21]'>Webhook delivery evidence</h4>
            <div className='mt-3 grid gap-2'>
                {deliveries.map(delivery => (
                    <div key={delivery.id} className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='font-mono text-xs font-semibold text-[#171a21]'>{delivery.id}</span>
                            <span className={workflowStatusClass(delivery.status === 'delivered' || delivery.status === 'dry_run' ? 'ready' : delivery.status === 'failed' || delivery.status === 'skipped' ? 'blocked' : 'needs_action')}>{label(delivery.status)}</span>
                            {delivery.deliveryKind && <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{delivery.deliveryKind}</span>}
                        </div>
                        <div className='mt-2 grid gap-1 text-xs text-[#667085] sm:grid-cols-2'>
                            <p><span className='font-semibold text-[#475467]'>Alert:</span> {delivery.alertId}</p>
                            <p><span className='font-semibold text-[#475467]'>Destination:</span> {delivery.webhookDestinationId || 'watchlist url'}</p>
                            <p><span className='font-semibold text-[#475467]'>Attempted:</span> {relativeTime(delivery.attemptedAt)}</p>
                            {'httpStatus' in delivery && delivery.httpStatus !== undefined && <p><span className='font-semibold text-[#475467]'>HTTP:</span> {delivery.httpStatus}</p>}
                        </div>
                        <p className='mt-2 break-all font-mono text-[11px] text-[#667085]'>{delivery.endpointHash} · {delivery.payloadHash}</p>
                        {delivery.error && <p className='mt-2 text-xs font-semibold text-[#9a3412]'>{delivery.error}</p>}
                    </div>
                ))}
            </div>
        </div>
    )
}

function TimelineRows({ title, rows }: { title: string, rows: CaseTimelineItem[] }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <h4 className='text-sm font-semibold text-[#171a21]'>{title}</h4>
            <div className='mt-3 grid gap-3'>
                {rows.map(row => (
                    <div key={row.id} className='grid grid-cols-[auto_1fr] gap-3'>
                        <span className='mt-1 h-2.5 w-2.5 rounded-full bg-[#3056d3]' />
                        <div>
                            <p className='text-sm font-semibold text-[#171a21]'>{row.title}</p>
                            <p className='mt-1 text-xs leading-5 text-[#667085]'>{row.detail}</p>
                            <p className='mt-1 text-[11px] text-[#98a2b3]'>{relativeTime(row.at)}</p>
                        </div>
                    </div>
                ))}
                {!rows.length && <p className='text-xs text-[#667085]'>No case timeline returned.</p>}
            </div>
        </div>
    )
}

function CaseEvidenceRows({ evidence }: { evidence: CaseEvidence[] }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <h4 className='text-sm font-semibold text-[#171a21]'>Case API evidence</h4>
            <div className='mt-3 grid gap-2'>
                {evidence.map(item => (
                    <div key={item.id} className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <span className='text-sm font-semibold text-[#171a21]'>{item.sourceName || item.id}</span>
                            {item.redactionState && <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{String(item.redactionState).replaceAll('_', ' ')}</span>}
                        </div>
                        <p className='mt-2 text-xs leading-5 text-[#596170]'>{item.excerpt || 'No safe excerpt returned.'}</p>
                        <p className='mt-2 break-all font-mono text-[11px] text-[#667085]'>{item.contentHash || item.id}</p>
                    </div>
                ))}
                {!evidence.length && <p className='text-xs text-[#667085]'>No evidence returned by the case API.</p>}
            </div>
        </div>
    )
}

function CaseActionRail({ item, note, owner, effectiveStatus, busyAction, caseDetail, onDecision, onBackedCaseMutation, onReplay, onSend }: {
    item: WorkbenchCase
    note: string
    owner: string
    effectiveStatus: string
    busyAction: string | null
    caseDetail?: CaseDetailState
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onBackedCaseMutation: (mutation: CaseMutationInput) => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
}) {
    const readyCase = caseDetail?.status === 'ready' ? caseDetail.detail.case : undefined
    const hasBackedCase = Boolean(readyCase)
    const busy = Boolean(busyAction)
    const closeAction = effectiveStatus === 'closed' ? 'reopen' : 'close'

    if (!hasBackedCase) {
        return (
            <div className='grid gap-2 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-[#9a3412]'>Session-local triage</p>
                    <p className='mt-1 text-xs leading-5 text-[#596170]'>{item.missingDependency || 'Backed case mutations require a live /api/cases/:id detail response. These controls only update this browser session.'}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'reviewing', owner, reason: note || 'Review started.' })}>Review</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'escalated', owner, reason: note || 'Escalated for customer or incident response.' })}>Escalate</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: 'suppressed', owner, reason: note || 'Suppressed as low-value or false positive.' })}>Suppress</DecisionButton>
                    <DecisionButton busy={busy} onClick={() => onDecision({ status: effectiveStatus === 'closed' ? 'needs_review' : 'closed', owner, reason: note || (effectiveStatus === 'closed' ? 'Reopened for review.' : 'Closed in analyst workbench.') })}>
                        {effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    </DecisionButton>
                    {item.kind === 'dwm_alert' && (
                        <>
                            <DecisionButton busy={busy || busyAction === `replay:${item.id}`} onClick={onReplay}>Replay</DecisionButton>
                            <DecisionButton busy={busy || busyAction === `send:${item.id}`} onClick={onSend}>Send</DecisionButton>
                        </>
                    )}
                </div>
            </div>
        )
    }

    const hasOwner = owner.trim() && owner.trim() !== 'unassigned'
    const noteText = note.trim()
    return (
        <div className='grid gap-2 rounded-lg border border-[#d6e9de] bg-[#f4fbf7] p-3'>
            <div>
                <p className='text-xs font-semibold uppercase text-[#147a3b]'>Backed case actions</p>
                <p className='mt-1 text-xs leading-5 text-[#596170]'>These controls PATCH /api/cases/:id, then reload the case detail pane before reporting success.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
                <CaseMutationButton
                    item={item}
                    action='assign'
                    label='Assign owner'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!hasOwner ? 'Owner is required.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'assign', assignedOwner: owner.trim(), note: noteText || `Assigned to ${owner.trim()}.` })}
                />
                <CaseMutationButton
                    item={item}
                    action='note'
                    label='Add note'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Decision rationale is required.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'note', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText })}
                />
                <CaseMutationButton
                    item={item}
                    action='escalate'
                    label='Escalate'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Escalation requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'escalate', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || 'Escalated for customer or incident response.' })}
                />
                <CaseMutationButton
                    item={item}
                    action='suppress'
                    label='Suppress'
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={!noteText ? 'Suppression requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: 'suppress', assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || 'Suppressed as low-value or false positive.' })}
                />
                <CaseMutationButton
                    item={item}
                    action={closeAction}
                    label={effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    busy={busy}
                    busyAction={busyAction}
                    allowedActions={caseDetail?.status === 'ready' ? caseDetail.detail.nextAllowedActions || [] : []}
                    disabledReason={closeAction === 'close' && !noteText ? 'Closing requires rationale.' : undefined}
                    onClick={() => onBackedCaseMutation({ action: closeAction, assignedOwner: hasOwner ? owner.trim() : undefined, note: noteText || (closeAction === 'reopen' ? 'Reopened for review.' : 'Closed from analyst workbench.') })}
                />
                {item.kind === 'dwm_alert' && (
                    <>
                        <DecisionButton busy={busy || busyAction === `replay:${item.id}`} onClick={onReplay}>Replay</DecisionButton>
                        <DecisionButton busy={busy || busyAction === `send:${item.id}`} onClick={onSend}>Send</DecisionButton>
                    </>
                )}
            </div>
        </div>
    )
}

function CaseMutationButton({ item, action, label: actionLabel, busy, busyAction, allowedActions, disabledReason, onClick }: {
    item: WorkbenchCase
    action: WorkbenchCaseMutationAction
    label: string
    busy: boolean
    busyAction: string | null
    allowedActions: CaseAllowedAction[]
    disabledReason?: string
    onClick: () => void | Promise<void>
}) {
    const allowed = allowedActions.find(candidate => candidate.id === action)
    const blockedReason = disabledReason || allowed?.disabledReason || (allowed && !allowed.enabled ? 'Not applicable for current case status.' : undefined)
    const disabled = busy || Boolean(blockedReason)
    return (
        <button
            type='button'
            onClick={onClick}
            disabled={disabled}
            title={blockedReason}
            className='inline-flex h-9 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] disabled:cursor-not-allowed disabled:opacity-60'
        >
            {busyAction === `case:${item.id}:${action}` ? 'Saving...' : actionLabel}
        </button>
    )
}

function CaseDetail({ item, decision, note, ownerDraft, busyAction, compact, caseDetail, onNoteChange, onOwnerDraftChange, onDecision, onBackedCaseMutation, onReplay, onSend, onAction }: {
    item: WorkbenchCase
    decision?: LocalDecision
    note: string
    ownerDraft?: string
    busyAction: string | null
    compact: boolean
    caseDetail?: CaseDetailState
    onNoteChange: (value: string) => void
    onOwnerDraftChange: (value: string) => void
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onBackedCaseMutation: (mutation: CaseMutationInput) => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
    onAction: (action: WorkbenchAction) => void | Promise<void>
}) {
    const backedCase = caseDetail?.status === 'ready' ? caseDetail.detail.case : undefined
    const backedStatus = backedCase?.status
    const backedOwner = backedCase?.assignedOwner || 'unassigned'
    const effectiveStatus = decision?.status ?? backedStatus ?? item.status
    const effectiveOwner = decision?.owner ?? backedOwner ?? item.owner
    const ownerValue = ownerDraft ?? (effectiveOwner === 'unassigned' ? '' : effectiveOwner)
    const timeline = decision?.status ? [
        {
            id: `${item.id}_session_decision`,
            at: decision.decidedAt || new Date().toISOString(),
            title: 'Session decision',
            body: `${label(decision.status)}${decision.owner ? ` by ${decision.owner}` : ''}${decision.reason ? `: ${decision.reason}` : ''}`,
        },
        ...item.timeline,
    ] : item.timeline
    return (
        <div className={`${compact ? 'grid gap-4 p-4' : 'grid gap-5 p-5'}`}>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className={severityClass(item.severity)}>{item.severity}</span>
                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{item.confidence}% confidence</span>
                        <span className='rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{label(item.kind)}</span>
                        <span className='rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#596170]'>{label(effectiveStatus)}</span>
                        {item.persistent && <span className='rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]'>persistent workflow</span>}
                    </div>
                    <h2 className={`${compact ? 'mt-2 text-xl' : 'mt-3 text-2xl'} font-semibold tracking-normal text-[#171a21]`}>{item.title}</h2>
                    <p className='mt-1 text-sm text-[#596170]'>{item.queue} · {item.routeLabel} · {relativeTime(item.updatedAt)}</p>
                </div>
                <div className='grid gap-1 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-3 py-2 text-xs text-[#667085]'>
                    <span className='font-semibold text-[#171a21]'>{effectiveOwner}</span>
                    <span>{item.company || item.matchedTerm}</span>
                </div>
            </div>

            <section className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4 lg:grid-cols-[0.48fr_minmax(0,1fr)]'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <UserRound className='h-4 w-4 text-[#3056d3]' />
                        Owner
                    </span>
                    <input
                        value={ownerValue}
                        onChange={event => onOwnerDraftChange(event.target.value)}
                        placeholder='Assign analyst'
                        className='h-10 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                    />
                    <span className='text-[11px] text-[#667085]'>{caseDetail?.status === 'ready' ? 'Saved by Assign owner against PATCH /api/cases/:id.' : 'Draft only until a backed case detail is loaded.'}</span>
                </label>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <MessageSquareText className='h-4 w-4 text-[#3056d3]' />
                        Decision rationale
                    </span>
                    <textarea
                        value={note}
                        onChange={event => onNoteChange(event.target.value)}
                        placeholder='Record validation, customer route, suppression reason, or follow-up owner'
                        className='min-h-20 resize-y rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                    />
                </label>
                <CaseActionRail
                    item={item}
                    note={note}
                    owner={ownerValue.trim() || effectiveOwner}
                    effectiveStatus={effectiveStatus}
                    busyAction={busyAction}
                    caseDetail={caseDetail}
                    onDecision={onDecision}
                    onBackedCaseMutation={onBackedCaseMutation}
                    onReplay={onReplay}
                    onSend={onSend}
                />
            </section>

            {(item.workflowPath?.length || item.actions?.length) ? (
                <section className='rounded-lg border border-[#e0e5ed] bg-white'>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                        <div>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Operator path</h3>
                            <p className='mt-0.5 text-xs text-[#667085]'>Backed path from organization scope to watchlist, alert/case, and delivery evidence.</p>
                        </div>
                        {item.actions?.length ? (
                            <div className='flex flex-wrap gap-2'>
                                {item.actions.map(action => action.method === 'GET' ? (
                                    <Link key={action.id} href={action.href} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d8dee9] bg-white px-2.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                        {action.label}
                                        <ExternalLink className='h-3.5 w-3.5' />
                                    </Link>
                                ) : (
                                    <DecisionButton key={action.id} busy={busyAction === `action:${item.id}:${action.id}`} onClick={() => onAction(action)}>
                                        {action.label}
                                    </DecisionButton>
                                ))}
                            </div>
                        ) : null}
                    </div>
                    {item.workflowPath?.length ? (
                        <div className='grid gap-2 p-3 lg:grid-cols-4'>
                            {item.workflowPath.map(step => (
                                <div key={step.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                    <div className='flex items-center justify-between gap-2'>
                                        <h4 className='text-sm font-semibold text-[#171a21]'>{step.label}</h4>
                                        <span className={workflowStatusClass(step.status)}>{label(step.status)}</span>
                                    </div>
                                    <p className='mt-2 text-xs leading-5 text-[#596170]'>{step.detail}</p>
                                    <div className='mt-3 grid gap-1 text-[11px] text-[#667085]'>
                                        <p><span className='font-semibold text-[#475467]'>Owner:</span> {step.owner}</p>
                                        {step.entityId && <p className='break-all'><span className='font-semibold text-[#475467]'>ID:</span> {step.entityId}</p>}
                                        <p className='break-all'><span className='font-semibold text-[#475467]'>Source:</span> {step.source}</p>
                                    </div>
                                    {step.href && (
                                        <Link href={step.href} className='mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d8dee9] bg-white px-2.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                            Open
                                            <ExternalLink className='h-3.5 w-3.5' />
                                        </Link>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </section>
            ) : null}

            <BackedInspection item={item} caseDetail={caseDetail} compact={compact} />

            <section className='grid gap-4 lg:grid-cols-[1fr_0.78fr]'>
                <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                    <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                        <div>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Evidence</h3>
                            <p className='mt-0.5 text-xs text-[#667085]'>Source, timestamp, confidence, provenance, safe excerpt, and content hash.</p>
                        </div>
                        <ListChecks className='h-4 w-4 text-[#3056d3]' />
                    </div>
                    <div className={`grid gap-3 p-4 ${compact ? 'max-h-[310px] overflow-auto' : ''}`}>
                        {item.evidence.map(evidence => (
                            <div key={evidence.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-semibold text-[#171a21]'>{evidence.sourceName}</span>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{evidence.redactionState}</span>
                                    <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{evidence.captureMode}</span>
                                    <span className='text-[11px] text-[#667085]'>{relativeTime(evidence.observedAt || item.updatedAt)}</span>
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{evidence.excerpt}</p>
                                <div className='mt-3 grid gap-1 text-xs text-[#667085] sm:grid-cols-2'>
                                    <p><span className='font-semibold text-[#475467]'>Confidence:</span> {evidence.confidence ?? item.confidence}%</p>
                                    <p><span className='font-semibold text-[#475467]'>Provenance:</span> {evidence.provenance || item.routeLabel}</p>
                                </div>
                                <p className='mt-2 break-all font-mono text-[11px] text-[#667085]'>{evidence.contentHash}</p>
                                {evidence.metadata?.length ? (
                                    <div className='mt-3 grid gap-1'>
                                        {evidence.metadata.slice(0, 4).map(meta => (
                                            <p key={`${evidence.id}-${meta.label}`} className='text-xs text-[#667085]'><span className='font-semibold text-[#475467]'>{meta.label}:</span> {meta.value}</p>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>

                <div className='grid gap-4'>
                    <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                        <div className='border-b border-[#eef1f5] px-4 py-3'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Timeline</h3>
                            <p className='mt-0.5 text-xs text-[#667085]'>Case state and source observations.</p>
                        </div>
                        <div className={`grid gap-3 p-4 ${compact ? 'max-h-[220px] overflow-auto' : ''}`}>
                            {timeline.map(event => (
                                <div key={event.id} className='grid grid-cols-[auto_1fr] gap-3'>
                                    <span className='mt-1 h-2.5 w-2.5 rounded-full bg-[#3056d3]' />
                                    <div>
                                        <p className='text-sm font-semibold text-[#171a21]'>{event.title}</p>
                                        <p className='mt-1 text-xs leading-5 text-[#667085]'>{event.body}</p>
                                        <p className='mt-1 text-[11px] text-[#98a2b3]'>{relativeTime(event.at)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='rounded-lg border border-[#e0e5ed] bg-white p-4'>
                        <h3 className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                            <MessageSquareText className='h-4 w-4 text-[#3056d3]' />
                            Session decision state
                        </h3>
                        <p className='mt-2 text-sm leading-6 text-[#596170]'>
                            {decision?.status ? `${label(decision.status)}${decision.reason ? `: ${decision.reason}` : ''}` : 'No local decision recorded yet.'}
                        </p>
                        <p className='mt-2 text-xs leading-5 text-[#667085]'>DWM alert decisions persist through the DWM API. General TI ownership and notes are session-local.</p>
                    </div>
                </div>
            </section>

            <section className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4'>
                <div className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                    <ShieldAlert className='h-4 w-4 text-[#c2410c]' />
                    Case brief
                </div>
                <p className='mt-3 text-sm leading-6 text-[#3d4656]'>{item.subtitle}</p>
                <p className='mt-3 text-sm font-semibold leading-6 text-[#3056d3]'>{item.recommendedAction}</p>
                <div className='mt-4 grid gap-3 sm:grid-cols-3'>
                    <BriefStat icon={<Fingerprint className='h-4 w-4' />} label='Actor' value={item.actor} />
                    <BriefStat icon={<FileText className='h-4 w-4' />} label='Matched term' value={item.matchedTerm || 'none'} />
                    <BriefStat icon={<UserRound className='h-4 w-4' />} label='Sources' value={item.sourceLabel} />
                </div>
            </section>

            <section className='grid gap-3 lg:grid-cols-3'>
                {item.nextTasks.map((task, index) => (
                    <div key={task} className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
                        <div className='flex items-center gap-2'>
                            {index === 0 ? <Clock3 className='h-4 w-4 text-[#667085]' /> : <CheckCircle2 className='h-4 w-4 text-[#147a3b]' />}
                            <h3 className='text-sm font-semibold text-[#171a21]'>Task {index + 1}</h3>
                        </div>
                        <p className='mt-2 text-xs leading-5 text-[#596170]'>{task}</p>
                    </div>
                ))}
            </section>

        </div>
    )
}

type LocalDecision = {
    status?: string
    owner?: string
    reason?: string
    decidedAt?: string
}

type CaseMutationInput = {
    action: WorkbenchCaseMutationAction
    note?: string
    assignedOwner?: string
}

type CaseDetailState =
    | { status: 'loading' }
    | { status: 'ready', detail: CaseDetailPayload }
    | { status: 'error', error: string }

type CaseDetailPayload = {
    schemaVersion?: string
    generatedAt: string
    error?: { message?: string }
    access?: { mode?: string, role?: string, canMutate?: boolean }
    case?: {
        id: string
        alertId?: string
        title?: string
        summary?: string
        status?: string
        priority?: string
        assignedOwner?: string
        updatedAt: string
    }
    alert?: { id?: string }
    alertContext?: {
        id?: string
        reviewState?: string
        deliveryState?: string
        assignedOwner?: string
        workflowNote?: string
    }
    deliveryContext?: {
        deliveryCount: number
        latestDelivery?: CaseDelivery
        delivered?: boolean
        retryable?: boolean
        failed?: CaseDelivery[]
    }
    deliveries?: CaseDelivery[]
    evidence?: CaseEvidence[]
    timeline?: CaseTimelineItem[]
    nextActions?: string[]
    nextAllowedActions?: CaseAllowedAction[]
}

type CaseAllowedAction = {
    id: WorkbenchCaseMutationAction | 'deliver_webhook'
    label: string
    method: 'PATCH' | 'POST'
    requiresRationale?: boolean
    enabled: boolean
    disabledReason?: string
}

type CaseDelivery = WorkbenchDeliveryEvidence & {
    dryRun?: boolean
}

type CaseEvidence = {
    id: string
    sourceName?: string
    redactionState?: string
    contentHash?: string
    excerpt?: string
}

type CaseTimelineItem = {
    id: string
    at: string
    title: string
    detail: string
}

function DecisionButton({ busy = false, onClick, children }: { busy?: boolean, onClick: () => void | Promise<void>, children: string }) {
    return (
        <button type='button' onClick={onClick} disabled={busy} className='inline-flex h-9 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] disabled:cursor-not-allowed disabled:opacity-60'>
            {children}
        </button>
    )
}

async function readCaseDetailJson(response: Response) {
    try {
        return await response.json() as CaseDetailPayload
    } catch {
        return { generatedAt: new Date().toISOString(), error: { message: 'Case detail response was not JSON.' } }
    }
}

async function readJson(response: Response) {
    try {
        return await response.json() as {
            error?: { message?: string }
            attemptedCount?: number
            savedAlertCount?: number
            testedAt?: string
            delivery?: { id?: string, status?: string }
            deliveries?: Array<{ id?: string, status?: string }>
            case?: { id?: string, status?: string }
        }
    } catch {
        return {}
    }
}

function actionResultMessage(action: WorkbenchAction, payload: Awaited<ReturnType<typeof readJson>>) {
    if (payload.case?.id) return `Case ${payload.case.id} is ${payload.case.status || 'open'}.`
    if (typeof payload.savedAlertCount === 'number') return `Rebuilt ${payload.savedAlertCount} alert${payload.savedAlertCount === 1 ? '' : 's'}.`
    if (typeof payload.attemptedCount === 'number') return `Webhook delivery attempted for ${payload.attemptedCount} alert${payload.attemptedCount === 1 ? '' : 's'}.`
    if (payload.delivery?.id) return `Webhook test ${payload.delivery.status || 'recorded'} as ${payload.delivery.id}.`
    if (payload.deliveries?.[0]?.id) return `Latest delivery ${payload.deliveries[0].id} is ${payload.deliveries[0].status || 'recorded'}.`
    if (payload.testedAt) return `Webhook test recorded at ${payload.testedAt}.`
    return `${action.label} completed.`
}

function caseMutationResultMessage(action: WorkbenchCaseMutationAction, payload: Awaited<ReturnType<typeof readJson>>) {
    const caseId = payload.case?.id ? `Case ${payload.case.id}` : 'Case'
    const status = payload.case?.status ? ` is ${payload.case.status}` : ' updated'
    if (action === 'assign') return `${caseId} owner saved.`
    if (action === 'note') return `${caseId} rationale saved.`
    if (action === 'escalate') return `${caseId}${status} and ready for routing.`
    if (action === 'suppress') return `${caseId}${status}; delivery muted.`
    if (action === 'close') return `${caseId}${status}.`
    if (action === 'reopen') return `${caseId} reopened.`
    if (action === 'false_positive') return `${caseId} marked false positive.`
    return `${caseId}${status}.`
}

function mapDwmDecision(status: string, currentStatus: string) {
    if (status === 'reviewing') return { reviewState: 'reviewing', deliveryState: 'pending_review' }
    if (status === 'escalated') return { reviewState: 'route_to_customer', deliveryState: 'ready_to_send' }
    if (status === 'suppressed') return { reviewState: 'false_positive', deliveryState: 'muted' }
    if (status === 'closed') return { reviewState: 'resolved', deliveryState: currentStatus === 'delivered' ? 'delivered' : 'muted' }
    return { reviewState: 'needs_review', deliveryState: 'pending_review' }
}

function BriefStat({ icon, label: statLabel, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
            <div className='flex items-center gap-2 text-[#667085]'>
                {icon}
                <span className='text-[10px] font-semibold uppercase'>{statLabel}</span>
            </div>
            <p className='mt-2 truncate text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}

function StatusPill({ label: statusLabel, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'good' | 'warn' }) {
    const toneClass = tone === 'good'
        ? 'border-[#2f7047] bg-[#1f3c2c] text-[#d8f5e0]'
        : tone === 'warn'
            ? 'border-[#7a6228] bg-[#3d341e] text-[#f8e7b8]'
            : 'border-[#3a4252] bg-[#222936] text-[#d8deea]'

    return (
        <span className={`inline-flex min-h-8 items-center gap-2 rounded-md border px-2.5 ${toneClass}`}>
            <span className='font-semibold uppercase text-[#cbd6ee]'>{statusLabel}</span>
            <span className='font-semibold text-white'>{value}</span>
        </span>
    )
}

function filterCases(cases: WorkbenchCase[], filter: QueueFilter, query: string) {
    const clean = query.trim().toLowerCase()
    return cases.filter(item => {
        if (filter === 'critical' && item.severity !== 'critical') return false
        if (filter === 'high' && item.severity !== 'high') return false
        if (filter === 'persistent' && !item.persistent) return false
        if (filter === 'evidence' && item.kind !== 'source_capture') return false
        if (!clean) return true
        return `${item.title} ${item.subtitle} ${item.actor} ${item.company} ${item.matchedTerm} ${item.queue}`.toLowerCase().includes(clean)
    })
}

function queueSummary(cases: WorkbenchCase[]) {
    const counts = new Map<string, number>()
    for (const item of cases) counts.set(item.queue, (counts.get(item.queue) ?? 0) + 1)
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 8)
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold text-[#c2410c]'
    if (severity === 'high') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]'
    if (severity === 'medium') return 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'
    return 'rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#596170]'
}

function workflowStatusClass(status: WorkbenchWorkflowStep['status']) {
    if (status === 'ready') return 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-[11px] font-semibold text-[#147a3b]'
    if (status === 'blocked') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]'
    return 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'
}

function label(value: string) {
    return value.replaceAll('_', ' ')
}

function relativeTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000))
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}
