'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CheckCircle2, Clock3, ExternalLink, FileText, Filter, Fingerprint, ListChecks, MessageSquareText, Search, ShieldAlert, UserRound } from 'lucide-react'

export type WorkbenchEvidence = {
    id: string
    sourceName: string
    sourceFamily: string
    captureMode: string
    redactionState: string
    contentHash: string
    excerpt: string
    metadata?: Array<{ label: string, value: string }>
}

export type WorkbenchTimelineItem = {
    id: string
    at: string
    title: string
    body: string
}

export type WorkbenchCase = {
    id: string
    kind: 'dwm_alert' | 'ti_domain' | 'source_capture'
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
}

type QueueFilter = 'all' | 'critical' | 'high' | 'persistent' | 'evidence'

export default function AnalystWorkbenchClient({ initialCases }: { initialCases: WorkbenchCase[] }) {
    const router = useRouter()
    const [selectedId, setSelectedId] = useState(initialCases[0]?.id ?? '')
    const [filter, setFilter] = useState<QueueFilter>('all')
    const [query, setQuery] = useState('')
    const [notes, setNotes] = useState<Record<string, string>>({})
    const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({})
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [message, setMessage] = useState<{ ok: boolean, text: string } | null>(null)
    const cases = useMemo(() => filterCases(initialCases, filter, query), [initialCases, filter, query])
    const selected = initialCases.find(item => item.id === selectedId) ?? cases[0] ?? initialCases[0]
    const queues = queueSummary(initialCases)
    const selectedDecision = selected ? localDecisions[selected.id] : undefined

    async function applyDecision(item: WorkbenchCase, decision: LocalDecision) {
        const nextDecision = {
            ...(localDecisions[item.id] ?? {}),
            ...decision,
            decidedAt: new Date().toISOString(),
        }

        const decisionStatus = decision.status
        if (item.kind !== 'dwm_alert' || !decisionStatus) {
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            return
        }

        await runPersistentAction(`decision:${item.id}`, async () => {
            const mapped = mapDwmDecision(decisionStatus, item.status)
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(item.id)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    reviewState: mapped.reviewState,
                    deliveryState: mapped.deliveryState,
                    note: decision.reason || 'Updated from the analyst workbench.',
                    actor: 'dashboard',
                }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setLocalDecisions(current => ({ ...current, [item.id]: nextDecision }))
            return `${label(decisionStatus)} saved to the DWM workflow.`
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
            return 'Evidence replay recorded in the DWM workflow.'
        })
    }

    async function sendDwmAlert(item: WorkbenchCase) {
        await runPersistentAction(`send:${item.id}`, async () => {
            const response = await fetch('/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ tenantId: 'default', alertId: item.id, limit: 1 }),
            })
            const payload = await readJson(response)
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            return payload.attemptedCount ? 'Webhook delivery attempted.' : 'No webhook delivery was attempted.'
        })
    }

    async function runPersistentAction(key: string, action: () => Promise<string>) {
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
                <div className='border-b border-[#e8edf5] bg-[#171a21] px-5 py-4 text-white'>
                    <div className='flex flex-wrap items-start justify-between gap-4'>
                        <div>
                            <p className='text-[10px] font-semibold uppercase text-[#9db4ff]'>XDR-style analyst work</p>
                            <h2 className='mt-1 text-xl font-semibold'>Threat operations queue</h2>
                            <p className='mt-1 max-w-3xl text-sm leading-6 text-[#d8deea]'>Investigate DWM alerts, domain correlations, and safe source captures from one queue instead of jumping across dashboard tiles.</p>
                        </div>
                        <div className='grid grid-cols-3 gap-2 text-right'>
                            <Metric label='Cases' value={String(initialCases.length)} />
                            <Metric label='Persistent' value={String(initialCases.filter(item => item.persistent).length)} />
                            <Metric label='Critical' value={String(initialCases.filter(item => item.severity === 'critical').length)} />
                        </div>
                    </div>
                </div>

                <div className='grid min-h-[720px] xl:grid-cols-[340px_minmax(0,1fr)_330px]'>
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
                        <div className='max-h-[620px] overflow-auto p-2'>
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
                                busyAction={busyAction}
                                onNoteChange={value => setNotes(current => ({ ...current, [selected.id]: value }))}
                                onDecision={(decision) => applyDecision(selected, decision)}
                                onReplay={() => replayDwmAlert(selected)}
                                onSend={() => sendDwmAlert(selected)}
                            />
                        ) : (
                            <div className='p-5 text-sm text-[#596170]'>No analyst cases are available yet.</div>
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

function CaseDetail({ item, decision, note, busyAction, onNoteChange, onDecision, onReplay, onSend }: {
    item: WorkbenchCase
    decision?: LocalDecision
    note: string
    busyAction: string | null
    onNoteChange: (value: string) => void
    onDecision: (decision: LocalDecision) => void | Promise<void>
    onReplay: () => void | Promise<void>
    onSend: () => void | Promise<void>
}) {
    const effectiveStatus = decision?.status ?? item.status
    const effectiveOwner = decision?.owner ?? item.owner
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
        <div className='grid gap-5 p-5'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <span className={severityClass(item.severity)}>{item.severity}</span>
                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{item.confidence}% confidence</span>
                        <span className='rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{label(item.kind)}</span>
                        <span className='rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#596170]'>{label(effectiveStatus)}</span>
                        {item.persistent && <span className='rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]'>persistent workflow</span>}
                    </div>
                    <h2 className='mt-3 text-2xl font-semibold tracking-normal text-[#171a21]'>{item.title}</h2>
                    <p className='mt-1 text-sm text-[#596170]'>{item.queue} · {item.routeLabel} · {relativeTime(item.updatedAt)}</p>
                </div>
                <div className='grid gap-1 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] px-3 py-2 text-xs text-[#667085]'>
                    <span className='font-semibold text-[#171a21]'>{effectiveOwner}</span>
                    <span>{item.company || item.matchedTerm}</span>
                </div>
            </div>

            <section className='grid gap-3 rounded-lg border border-[#dfe5ee] bg-[#fbfcfe] p-4 lg:grid-cols-[0.55fr_1fr_auto] lg:items-end'>
                <label className='grid gap-2'>
                    <span className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <UserRound className='h-4 w-4 text-[#3056d3]' />
                        Owner
                    </span>
                    <input
                        value={effectiveOwner === 'unassigned' ? '' : effectiveOwner}
                        onChange={event => onDecision({ owner: event.target.value.trim() || 'unassigned' })}
                        placeholder='Assign analyst'
                        className='h-10 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                    />
                    <span className='text-[11px] text-[#667085]'>Session-local until TI case ownership persistence is wired.</span>
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
                <div className='flex flex-wrap gap-2 lg:justify-end'>
                    <DecisionButton onClick={() => onDecision({ status: 'reviewing', reason: note || 'Review started.' })}>Review</DecisionButton>
                    <DecisionButton onClick={() => onDecision({ status: 'escalated', reason: note || 'Escalated for customer or incident response.' })}>Escalate</DecisionButton>
                    {item.kind === 'dwm_alert' && (
                        <>
                            <DecisionButton busy={busyAction === `replay:${item.id}`} onClick={onReplay}>Replay</DecisionButton>
                            <DecisionButton busy={busyAction === `send:${item.id}`} onClick={onSend}>Send</DecisionButton>
                        </>
                    )}
                    <DecisionButton onClick={() => onDecision({ status: 'suppressed', reason: note || 'Suppressed as low-value or false positive.' })}>Suppress</DecisionButton>
                    <DecisionButton onClick={() => onDecision({ status: effectiveStatus === 'closed' ? 'needs_review' : 'closed', reason: note || (effectiveStatus === 'closed' ? 'Reopened for review.' : 'Closed in analyst workbench.') })}>
                        {effectiveStatus === 'closed' ? 'Reopen' : 'Close'}
                    </DecisionButton>
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

            <section className='grid gap-4 lg:grid-cols-[1fr_0.78fr]'>
                <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                    <div className='flex items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
                        <div>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Evidence</h3>
                            <p className='mt-0.5 text-xs text-[#667085]'>Safe excerpts, hashes, source labels, and metadata.</p>
                        </div>
                        <ListChecks className='h-4 w-4 text-[#3056d3]' />
                    </div>
                    <div className='grid gap-3 p-4'>
                        {item.evidence.map(evidence => (
                            <div key={evidence.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-sm font-semibold text-[#171a21]'>{evidence.sourceName}</span>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{evidence.redactionState}</span>
                                    <span className='rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[#596170]'>{evidence.captureMode}</span>
                                </div>
                                <p className='mt-2 text-sm leading-6 text-[#3d4656]'>{evidence.excerpt}</p>
                                <p className='mt-3 break-all font-mono text-[11px] text-[#667085]'>{evidence.contentHash}</p>
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
                        <div className='grid gap-3 p-4'>
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
                        <p className='mt-2 text-xs leading-5 text-[#667085]'>This general TI workbench records decisions locally for now. DWM alert workflow decisions persist through the DWM API.</p>
                    </div>
                </div>
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

function DecisionButton({ busy = false, onClick, children }: { busy?: boolean, onClick: () => void | Promise<void>, children: string }) {
    return (
        <button type='button' onClick={onClick} disabled={busy} className='inline-flex h-9 items-center rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#dbe5ff] disabled:cursor-not-allowed disabled:opacity-60'>
            {children}
        </button>
    )
}

async function readJson(response: Response) {
    try {
        return await response.json() as { error?: { message?: string }, attemptedCount?: number }
    } catch {
        return {}
    }
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

function Metric({ label: metricLabel, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#3a4252] bg-[#222936] px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-[#cbd6ee]'>{metricLabel}</p>
            <p className='mt-1 text-lg font-semibold text-white'>{value}</p>
        </div>
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
