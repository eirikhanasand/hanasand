'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bot, Check, LoaderCircle, Play, RefreshCw, RotateCcw, ShieldAlert } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

type QueueState = 'queued' | 'running' | 'retrying' | 'dead_letter' | 'quarantined' | 'terminal'
type Evidence = {
    id: string
    relationship: string
    evidenceStage: string
    confidence?: number
    source: { id: string, name?: string, type?: string, trustScore?: number }
    capture: { id: string, title?: string, safeExcerpt?: string, publishedAt?: string, collectedAt?: string, storageKind?: string }
}
type Decision = {
    action: string
    claimValidity: string
    actorAttribution: { canonicalName: string | null, aliases: string[] }
    supportingEvidenceIds: string[]
    contradictoryEvidenceIds: string[]
    uncertainty: string[]
    rationale: string
    confidence: number
    modelVersion: string
    promptVersion: string
    calibrationContext: Record<string, unknown>
}
type HistoryEvent = { id: string, state: string, attempt: number, occurredAt: string, evidenceIds: string[], error?: string, decision?: Decision }
type ReviewTask = {
    id: string
    subject: { type: 'claim' | 'incident', id: string, claimId?: string, incidentId?: string, summary?: string }
    evidence: Evidence[]
    evidenceIds: string[]
    state: QueueState
    outcome?: string
    attempt: number
    maxAttempts: number
    replayCount: number
    requestedModelVersion: string
    promptVersion: string
    queuedAt: string
    nextAttemptAt: string
    completedAt?: string
    updatedAt: string
    lastError?: string
    decision?: Decision
    history: HistoryEvent[]
}
type QueueResponse = { counts: Record<QueueState, number>, total: number, tasks: ReviewTask[] }
const filters: Array<'active' | QueueState | 'all'> = ['active', 'dead_letter', 'quarantined', 'terminal', 'all']

export default function AutomaticReviewQueue() {
    const [scope, setScope] = useState<'default' | 'global'>('default')
    const [filter, setFilter] = useState<(typeof filters)[number]>('active')
    const [queue, setQueue] = useState<QueueResponse>({ counts: emptyCounts(), total: 0, tasks: [] })
    const [selectedId, setSelectedId] = useState('')
    const [loading, setLoading] = useState(true)
    const [acting, setActing] = useState(false)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const payload = await api<QueueResponse>(`/api/ti/claims/automatic-reviews?scope=${scope}&limit=250`)
            setQueue(payload)
            setSelectedId(current => payload.tasks.some(task => task.id === current) ? current : payload.tasks[0]?.id || '')
        } catch (cause) {
            setError(message(cause))
        } finally {
            setLoading(false)
        }
    }, [scope])

    useEffect(() => { void load() }, [load])

    const visible = useMemo(() => queue.tasks.filter(task => matchesFilter(task.state, filter)), [filter, queue.tasks])
    const selected = visible.find(task => task.id === selectedId) || visible[0]

    async function control(action: 'sync' | 'run') {
        setActing(true)
        setError('')
        try {
            await api(`/api/ti/claims/automatic-reviews/${action}?scope=${scope}`, { method: 'POST', body: action === 'run' ? JSON.stringify({ limit: 10 }) : '{}' })
            await load()
        } catch (cause) {
            setError(message(cause))
        } finally {
            setActing(false)
        }
    }

    async function replay(task: ReviewTask) {
        setActing(true)
        setError('')
        try {
            await api(`/api/ti/claims/automatic-reviews/${encodeURIComponent(task.id)}/replay?scope=${scope}`, { method: 'POST', body: '{}' })
            await load()
        } catch (cause) {
            setError(message(cause))
        } finally {
            setActing(false)
        }
    }

    return (
        <div className='grid gap-3'>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2'>
                    <div className='flex items-center gap-1' aria-label='Automatic review scope'>
                        {(['default', 'global'] as const).map(item => <button key={item} type='button' onClick={() => setScope(item)} className={`h-8 rounded-md px-3 text-xs font-semibold ${scope === item ? 'bg-ui-primary text-ui-canvas' : 'text-ui-muted hover:bg-ui-panel hover:text-ui-text'}`}>{item === 'default' ? 'Customer tenant' : 'Global intelligence'}</button>)}
                    </div>
                    <div className='flex flex-wrap gap-1'>
                        <button type='button' onClick={() => void control('sync')} disabled={acting} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-raised disabled:opacity-50'><RefreshCw className='h-4 w-4' />Queue eligible</button>
                        <button type='button' onClick={() => void control('run')} disabled={acting} className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{acting ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Play className='h-4 w-4' />}Run next batch</button>
                    </div>
                </div>
                <div className='grid grid-cols-2 gap-px bg-ui-border sm:grid-cols-6'>
                    <Metric label='Total' value={queue.total} />
                    <Metric label='Queued' value={queue.counts.queued} />
                    <Metric label='Running' value={queue.counts.running} />
                    <Metric label='Retrying' value={queue.counts.retrying} tone={queue.counts.retrying ? 'warn' : 'neutral'} />
                    <Metric label='Dead letter' value={queue.counts.dead_letter} tone={queue.counts.dead_letter ? 'danger' : 'neutral'} />
                    <Metric label='Quarantined' value={queue.counts.quarantined} tone={queue.counts.quarantined ? 'danger' : 'neutral'} />
                </div>
                {error ? <div role='alert' className='flex items-start gap-2 border-t border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div> : null}
            </DashboardPanel>

            <div className='grid min-h-[38rem] gap-3 xl:grid-cols-[23rem_minmax(0,1fr)]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='grid grid-cols-5 border-b border-ui-border bg-ui-raised p-1'>
                        {filters.map(item => <button key={item} type='button' onClick={() => setFilter(item)} className={`h-8 px-1 text-[10px] font-semibold capitalize ${filter === item ? 'bg-ui-panel text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>{label(item)}</button>)}
                    </div>
                    <div className='max-h-[calc(100vh-18rem)] min-h-72 overflow-auto'>
                        {visible.map(task => (
                            <button key={task.id} type='button' onClick={() => setSelectedId(task.id)} className={`flex w-full items-start gap-2 border-b border-ui-border px-3 py-2.5 text-left hover:bg-ui-raised ${selected?.id === task.id ? 'bg-ui-raised' : ''}`}>
                                <StateIcon state={task.state} />
                                <span className='min-w-0 flex-1'>
                                    <span className='block truncate text-xs font-semibold text-ui-text'>{task.subject.summary || task.subject.id}</span>
                                    <span className='mt-0.5 block truncate text-[11px] text-ui-muted'>{task.subject.type} · {label(task.state)} · attempt {task.attempt}/{task.maxAttempts}</span>
                                </span>
                            </button>
                        ))}
                        {!visible.length ? <div className='grid min-h-56 place-items-center p-5 text-center text-xs text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : 'No automatic review tasks match this view.'}</div> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    {selected ? <TaskDetail task={selected} acting={acting} replay={replay} /> : <div className='grid min-h-96 place-items-center p-6 text-sm text-ui-muted'>Select an automatic review task.</div>}
                </DashboardPanel>
            </div>
        </div>
    )
}

function TaskDetail({ task, acting, replay }: { task: ReviewTask, acting: boolean, replay: (task: ReviewTask) => Promise<void> }) {
    return (
        <div className='grid gap-0'>
            <div className='border-b border-ui-border bg-ui-raised px-4 py-3'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='min-w-0'>
                        <p className='text-[10px] font-semibold uppercase text-ui-primary'>{task.subject.type} automatic review</p>
                        <h2 className='mt-1 wrap-break-word text-base font-semibold text-ui-text'>{task.subject.summary || task.subject.id}</h2>
                        <p className='mt-1 break-all text-[11px] text-ui-muted'>{task.subject.id}</p>
                    </div>
                    <div className='flex items-center gap-2'>
                        <StateBadge state={task.state} />
                        {['dead_letter', 'quarantined'].includes(task.state) ? <button type='button' onClick={() => void replay(task)} disabled={acting} className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border px-2 text-xs font-semibold text-ui-text hover:bg-ui-panel disabled:opacity-50'><RotateCcw className='h-3.5 w-3.5' />Replay</button> : null}
                    </div>
                </div>
            </div>
            <div className='grid gap-5 p-4'>
                <dl className='grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4'>
                    <Datum label='Model' value={task.requestedModelVersion} />
                    <Datum label='Attempt' value={`${task.attempt}/${task.maxAttempts}`} />
                    <Datum label='Evidence' value={String(task.evidence.length)} />
                    <Datum label='Updated' value={formatDate(task.updatedAt)} />
                    <Datum label='Prompt contract' value={task.promptVersion} wide />
                    <Datum label='Task ID' value={task.id} wide />
                </dl>
                {task.lastError ? <div className='rounded-md border border-ui-danger/30 bg-ui-danger/10 p-3 text-xs text-ui-danger'>{task.lastError}</div> : null}
                <section>
                    <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Governed evidence sent to Hanasand AI</h3>
                    <div className='mt-2 grid gap-2 md:grid-cols-2'>
                        {task.evidence.map(item => <div key={item.id} className='rounded-md border border-ui-border bg-ui-canvas p-3 text-xs'><p className='font-semibold text-ui-text'>{item.capture.title || item.source.name || item.id}</p><p className='mt-1 text-ui-muted'>{item.source.name || item.source.id} · {label(item.evidenceStage)} · {formatConfidence(item.confidence)}</p>{item.capture.safeExcerpt ? <p className='mt-2 leading-5 text-ui-text'>{item.capture.safeExcerpt}</p> : null}<p className='mt-2 break-all text-[10px] text-ui-muted'>{item.id}</p></div>)}
                        {!task.evidence.length ? <p className='text-xs text-ui-muted'>No governed evidence is linked. This task cannot become a successful model decision.</p> : null}
                    </div>
                </section>
                {task.decision ? <DecisionView decision={task.decision} /> : null}
                <section>
                    <h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Persisted decision history</h3>
                    <ol className='mt-2 grid gap-2'>
                        {task.history.map(event => <li key={event.id} className='rounded-md border border-ui-border bg-ui-canvas p-3 text-xs'><div className='flex flex-wrap justify-between gap-2'><span className='font-semibold text-ui-text'>{label(event.state)}</span><time className='text-ui-muted'>{formatDate(event.occurredAt)}</time></div><p className='mt-1 text-ui-muted'>Attempt {event.attempt} · {event.evidenceIds.length} evidence record(s)</p>{event.error ? <p className='mt-1 text-ui-danger'>{event.error}</p> : null}</li>)}
                    </ol>
                </section>
            </div>
        </div>
    )
}

function DecisionView({ decision }: { decision: Decision }) {
    return <section className='rounded-md border border-ui-success/30 bg-ui-success/5 p-3'><div className='flex flex-wrap items-center justify-between gap-2'><h3 className='text-[10px] font-semibold uppercase text-ui-success'>Persisted automatic decision</h3><span className='text-xs font-semibold text-ui-text'>{label(decision.action)} · {formatConfidence(decision.confidence)}</span></div><p className='mt-2 text-sm leading-6 text-ui-text'>{decision.rationale}</p><dl className='mt-3 grid gap-2 text-xs sm:grid-cols-2'><Datum label='Claim validity' value={label(decision.claimValidity)} /><Datum label='Proposed actor' value={decision.actorAttribution.canonicalName || 'No supported attribution'} /><Datum label='Aliases' value={decision.actorAttribution.aliases.join(', ') || 'None'} /><Datum label='Model' value={decision.modelVersion} /><Datum label='Supporting evidence' value={decision.supportingEvidenceIds.join(', ') || 'None'} wide /><Datum label='Contradictory evidence' value={decision.contradictoryEvidenceIds.join(', ') || 'None'} wide /><Datum label='Uncertainty' value={decision.uncertainty.join('; ') || 'None recorded'} wide /></dl></section>
}

function matchesFilter(state: QueueState, filter: (typeof filters)[number]) { return filter === 'all' || filter === 'active' ? filter === 'all' || ['queued', 'running', 'retrying'].includes(state) : state === filter }
function emptyCounts(): Record<QueueState, number> { return { queued: 0, running: 0, retrying: 0, dead_letter: 0, quarantined: 0, terminal: 0 } }
function label(value: string) { return value.replaceAll('_', ' ') }
function formatConfidence(value?: number) { return Number.isFinite(value) ? `${Math.round(Number(value) * 100)}%` : 'Not scored' }
function formatDate(value?: string) { return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unknown' }
function message(error: unknown) { return error instanceof Error ? error.message : 'The automatic review request failed.' }

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, { ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Request failed (${response.status}).`)
    return payload as T
}

function Metric({ label: metricLabel, value, tone = 'neutral' }: { label: string, value: number, tone?: 'neutral' | 'warn' | 'danger' }) { return <div className='bg-ui-panel px-3 py-2.5'><p className='text-[10px] font-semibold uppercase text-ui-muted'>{metricLabel}</p><p className={`mt-1 text-lg font-semibold ${tone === 'danger' ? 'text-ui-danger' : tone === 'warn' ? 'text-ui-warning' : 'text-ui-text'}`}>{value}</p></div> }
function Datum({ label: datumLabel, value, wide = false }: { label: string, value: string, wide?: boolean }) { return <div className={wide ? 'min-w-0 sm:col-span-2' : 'min-w-0'}><dt className='text-[10px] font-semibold uppercase text-ui-muted'>{datumLabel}</dt><dd className='mt-1 break-all font-medium text-ui-text'>{value}</dd></div> }
function StateIcon({ state }: { state: QueueState }) { return state === 'terminal' ? <Check className='mt-0.5 h-4 w-4 shrink-0 text-ui-success' /> : state === 'dead_letter' || state === 'quarantined' ? <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0 text-ui-danger' /> : state === 'running' ? <LoaderCircle className='mt-0.5 h-4 w-4 shrink-0 animate-spin text-ui-primary' /> : <Bot className='mt-0.5 h-4 w-4 shrink-0 text-ui-warning' /> }
function StateBadge({ state }: { state: QueueState }) { const tone = state === 'terminal' ? 'border-ui-success/30 bg-ui-success/10 text-ui-success' : state === 'dead_letter' || state === 'quarantined' ? 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger' : 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'; return <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${tone}`}>{label(state)}</span> }
