'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, ClipboardCheck, LoaderCircle, Plus, RefreshCw, Scale } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

type Progress = {
    taskCount: number
    annotationCount: number
    adjudicatedTaskCount: number
    pendingTaskCount: number
    reviewerCount: number
    doubleAnnotatedTaskCount: number
    exactSetAgreement: number | null
}

type Benchmark = {
    id: string
    tenantId?: string
    name: string
    status: 'annotating' | 'complete'
    datasetSplit: 'validation' | 'test'
    labelTypes: string[]
    requiredReviewers: number
    taskCount: number
    createdAt: string
    progress: Progress
}

type Task = {
    id: string
    captureId: string
    labelType: string
    status: 'pending' | 'awaiting_second_review' | 'needs_adjudication' | 'adjudicated'
    annotationCount: number
    submittedByCurrentReviewer: boolean
    evidence: {
        unavailable?: boolean
        reason?: string
        title?: string
        excerpt?: string
        sourceName?: string
        sourceFamily?: string
        publishedAt?: string
        collectedAt?: string
        contentHash?: string
    }
}

type CreateFormState = {
    name: string
    sampleSize: number
    datasetSplit: 'validation' | 'test'
    requiredReviewers: number
    labelTypes: string[]
    scope: 'default' | 'global'
}

const LABEL_TYPES = ['actor', 'victim', 'ttp', 'impact'] as const
const FILTERS = ['open', 'mine', 'adjudication', 'complete'] as const

export default function EvaluationBenchmarkClient() {
    const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
    const [selectedBenchmarkId, setSelectedBenchmarkId] = useState('')
    const [tasks, setTasks] = useState<Task[]>([])
    const [selectedTaskId, setSelectedTaskId] = useState('')
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open')
    const [values, setValues] = useState('')
    const [notes, setNotes] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [createForm, setCreateForm] = useState<CreateFormState>({ name: '', sampleSize: 100, datasetSplit: 'test', requiredReviewers: 2, labelTypes: [...LABEL_TYPES], scope: 'global' })

    const selectedBenchmark = benchmarks.find(item => item.id === selectedBenchmarkId)
    const visibleTasks = useMemo(() => tasks.filter(task => {
        if (filter === 'mine') return task.submittedByCurrentReviewer && task.status !== 'adjudicated'
        if (filter === 'adjudication') return task.status === 'needs_adjudication'
        if (filter === 'complete') return task.status === 'adjudicated'
        return task.status !== 'adjudicated' && !task.submittedByCurrentReviewer
    }), [filter, tasks])
    const selectedTask = visibleTasks.find(item => item.id === selectedTaskId) || visibleTasks[0]

    const loadBenchmarks = useCallback(async (preferredId?: string) => {
        const payloads = await Promise.all([
            api<{ benchmarks: Benchmark[] }>('/api/ti/evaluation/benchmarks?scope=global'),
            api<{ benchmarks: Benchmark[] }>('/api/ti/evaluation/benchmarks?scope=default'),
        ])
        const rows = payloads.flatMap(payload => payload.benchmarks).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setBenchmarks(rows)
        setSelectedBenchmarkId(current => preferredId || current || rows[0]?.id || '')
    }, [])

    const loadTasks = useCallback(async (benchmarkId: string, scope = benchmarkScope(benchmarks.find(item => item.id === benchmarkId))) => {
        if (!benchmarkId) {
            setTasks([])
            return
        }
        const payload = await api<{ tasks: Task[] }>(`/api/ti/evaluation/benchmarks/${benchmarkId}/tasks?scope=${scope}`)
        setTasks(payload.tasks)
        setSelectedTaskId(current => {
            const selected = payload.tasks.find(item => item.id === current)
            if (selected && selected.status !== 'adjudicated' && !selected.submittedByCurrentReviewer) return current
            return payload.tasks.find(item => item.status !== 'adjudicated' && !item.submittedByCurrentReviewer)?.id || payload.tasks[0]?.id || ''
        })
    }, [benchmarks])

    const refresh = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            await loadBenchmarks()
        } catch (cause) {
            setError(message(cause))
        } finally {
            setLoading(false)
        }
    }, [loadBenchmarks])

    useEffect(() => { void refresh() }, [refresh])
    useEffect(() => {
        setValues('')
        setNotes('')
        void loadTasks(selectedBenchmarkId).catch(cause => setError(message(cause)))
    }, [loadTasks, selectedBenchmarkId])
    useEffect(() => { setValues(''); setNotes('') }, [selectedTask?.id])

    async function createBenchmark() {
        if (!createForm.labelTypes.length) return setError('Select at least one label type.')
        setSaving(true)
        setError('')
        try {
            const payload = await api<{ benchmark: Benchmark }>(`/api/ti/evaluation/benchmarks?scope=${createForm.scope}`, {
                method: 'POST',
                body: JSON.stringify({ ...createForm, scope: undefined }),
            })
            await loadBenchmarks(payload.benchmark.id)
            setShowCreate(false)
        } catch (cause) {
            setError(message(cause))
        } finally {
            setSaving(false)
        }
    }

    async function submitReview() {
        if (!selectedBenchmark || !selectedTask) return
        const adjudicating = selectedTask.status === 'needs_adjudication'
        const scope = benchmarkScope(selectedBenchmark)
        const path = adjudicating
            ? `/api/ti/evaluation/benchmarks/${selectedBenchmark.id}/tasks/${selectedTask.id}/adjudicate?scope=${scope}`
            : `/api/ti/evaluation/benchmarks/${selectedBenchmark.id}/annotations?scope=${scope}`
        setSaving(true)
        setError('')
        try {
            await api(path, {
                method: 'POST',
                body: JSON.stringify({ taskId: selectedTask.id, expectedValues: parseValues(values), notes: notes.trim() || undefined }),
            })
            await Promise.all([loadBenchmarks(selectedBenchmark.id), loadTasks(selectedBenchmark.id, scope)])
            setValues('')
            setNotes('')
        } catch (cause) {
            setError(message(cause))
        } finally {
            setSaving(false)
        }
    }

    const blocked = !selectedTask || selectedTask.evidence.unavailable || selectedTask.status === 'adjudicated' || selectedTask.submittedByCurrentReviewer

    return (
        <>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2'>
                    <div className='flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ui-muted'>
                        <Metric label='Benchmarks' value={benchmarks.length} />
                        <Metric label='Completed' value={benchmarks.filter(item => item.status === 'complete').length} />
                        <Metric label='Adjudicated tasks' value={benchmarks.reduce((sum, item) => sum + item.progress.adjudicatedTaskCount, 0)} />
                        <Metric label='Reviewers' value={Math.max(0, ...benchmarks.map(item => item.progress.reviewerCount))} />
                    </div>
                    <div className='flex items-center gap-1.5'>
                        <button type='button' onClick={() => void refresh()} disabled={loading} title='Refresh benchmarks' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text disabled:opacity-50'>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button type='button' onClick={() => setShowCreate(value => !value)} className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas hover:opacity-90'>
                            <Plus className='h-4 w-4' />
                            New benchmark
                        </button>
                    </div>
                </div>
                {showCreate ? <CreateForm value={createForm} onChange={setCreateForm} onSubmit={() => void createBenchmark()} saving={saving} /> : null}
                {error ? <div role='alert' className='flex items-start gap-2 border-t border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div> : null}
            </DashboardPanel>

            <div className='grid min-h-[38rem] gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='border-b border-ui-border p-2'>
                        <label className='text-[10px] font-semibold uppercase text-ui-muted' htmlFor='benchmark-select'>Benchmark</label>
                        <select id='benchmark-select' value={selectedBenchmarkId} onChange={event => setSelectedBenchmarkId(event.target.value)} className='mt-1 h-9 w-full rounded-md border border-ui-border bg-ui-raised px-2 text-sm text-ui-text'>
                            {benchmarks.map(item => <option key={item.id} value={item.id}>{item.name} [{benchmarkScope(item)}]</option>)}
                            {!benchmarks.length ? <option value=''>No benchmarks</option> : null}
                        </select>
                        {selectedBenchmark ? <BenchmarkProgress benchmark={selectedBenchmark} /> : null}
                    </div>
                    <div className='grid grid-cols-4 border-b border-ui-border bg-ui-raised p-1'>
                        {FILTERS.map(item => <button key={item} type='button' onClick={() => setFilter(item)} className={`h-8 px-1 text-[10px] font-semibold capitalize ${filter === item ? 'bg-ui-panel text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>{item}</button>)}
                    </div>
                    <div className='max-h-[calc(100vh-24rem)] min-h-72 overflow-auto'>
                        {visibleTasks.map(task => (
                            <button key={task.id} type='button' onClick={() => setSelectedTaskId(task.id)} className={`flex w-full items-center gap-2 border-b border-ui-border px-3 py-2 text-left hover:bg-ui-raised ${selectedTask?.id === task.id ? 'bg-ui-raised' : ''}`}>
                                <TaskIcon task={task} />
                                <span className='min-w-0 flex-1'>
                                    <span className='block truncate text-xs font-semibold uppercase text-ui-text'>{task.labelType}</span>
                                    <span className='block truncate text-[11px] text-ui-muted'>{task.evidence.sourceName || task.captureId}</span>
                                </span>
                                <ChevronRight className='h-3.5 w-3.5 shrink-0 text-ui-muted' />
                            </button>
                        ))}
                        {!visibleTasks.length ? <div className='grid min-h-48 place-items-center p-4 text-center text-xs text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : 'No tasks in this view.'}</div> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    {selectedTask ? (
                        <div className='grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                            <section className='min-w-0 border-b border-ui-border lg:border-b-0 lg:border-r'>
                                <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border bg-ui-raised px-3 py-2'>
                                    <div>
                                        <p className='text-[10px] font-semibold uppercase text-ui-primary'>{selectedTask.labelType} extraction</p>
                                        <h2 className='mt-0.5 text-sm font-semibold text-ui-text'>{selectedTask.evidence.title || 'Stored evidence'}</h2>
                                    </div>
                                    <Status label={selectedTask.status} />
                                </div>
                                {selectedTask.evidence.unavailable ? (
                                    <div className='flex min-h-72 items-center justify-center gap-2 p-6 text-sm text-ui-danger'><AlertTriangle className='h-4 w-4' />Evidence changed after sampling.</div>
                                ) : (
                                    <div className='grid gap-3 p-3'>
                                        <dl className='grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4'>
                                            <Datum label='Source' value={selectedTask.evidence.sourceName} />
                                            <Datum label='Family' value={selectedTask.evidence.sourceFamily} />
                                            <Datum label='Published' value={formatDate(selectedTask.evidence.publishedAt)} />
                                            <Datum label='Collected' value={formatDate(selectedTask.evidence.collectedAt)} />
                                        </dl>
                                        <pre className='max-h-[calc(100vh-27rem)] min-h-64 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-ui-border bg-ui-canvas p-4 font-sans text-sm leading-6 text-ui-text'>{selectedTask.evidence.excerpt}</pre>
                                        <p className='truncate font-mono text-[10px] text-ui-muted'>SHA {selectedTask.evidence.contentHash}</p>
                                    </div>
                                )}
                            </section>
                            <aside className='grid content-start gap-3 p-3'>
                                <div>
                                    <label htmlFor='expected-values' className='text-xs font-semibold text-ui-text'>Expected {selectedTask.labelType} values</label>
                                    <textarea id='expected-values' value={values} onChange={event => setValues(event.target.value)} disabled={blocked} rows={8} placeholder='One value per line. Leave empty when none are present.' className='mt-1.5 w-full resize-y rounded-md border border-ui-border bg-ui-canvas p-2 text-sm text-ui-text placeholder:text-ui-muted disabled:opacity-60' />
                                </div>
                                <div>
                                    <label htmlFor='review-notes' className='text-xs font-semibold text-ui-text'>Review notes</label>
                                    <textarea id='review-notes' value={notes} onChange={event => setNotes(event.target.value)} disabled={blocked} rows={4} maxLength={1000} className='mt-1.5 w-full resize-y rounded-md border border-ui-border bg-ui-canvas p-2 text-sm text-ui-text disabled:opacity-60' />
                                </div>
                                <button type='button' onClick={() => void submitReview()} disabled={saving || blocked} className='inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'>
                                    {saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : selectedTask.status === 'needs_adjudication' ? <Scale className='h-4 w-4' /> : <ClipboardCheck className='h-4 w-4' />}
                                    {selectedTask.status === 'needs_adjudication' ? 'Submit adjudication' : selectedTask.submittedByCurrentReviewer ? 'Review submitted' : selectedTask.status === 'adjudicated' ? 'Adjudicated' : 'Submit review'}
                                </button>
                                {selectedTask.status === 'needs_adjudication' && selectedTask.submittedByCurrentReviewer ? <p className='text-xs leading-5 text-ui-muted'>An independent reviewer must adjudicate this disagreement.</p> : null}
                            </aside>
                        </div>
                    ) : <div className='grid min-h-96 place-items-center text-sm text-ui-muted'>Select a benchmark task.</div>}
                </DashboardPanel>
            </div>
        </>
    )
}

function CreateForm({ value, onChange, onSubmit, saving }: { value: CreateFormState, onChange: (value: CreateFormState) => void, onSubmit: () => void, saving: boolean }) {
    const toggleLabel = (label: string) => onChange({ ...value, labelTypes: value.labelTypes.includes(label) ? value.labelTypes.filter(item => item !== label) : [...value.labelTypes, label] })
    return (
        <div className='grid gap-3 border-t border-ui-border p-3 lg:grid-cols-[minmax(12rem,1fr)_8rem_auto_auto_auto_auto] lg:items-end'>
            <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Name<input value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} maxLength={160} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm font-normal normal-case text-ui-text' /></label>
            <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Captures<input type='number' min={1} max={200} value={value.sampleSize} onChange={event => onChange({ ...value, sampleSize: Number(event.target.value) })} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm font-normal text-ui-text' /></label>
            <Segment label='Dataset' values={['validation', 'test']} selected={value.datasetSplit} onSelect={selected => onChange({ ...value, datasetSplit: selected as 'validation' | 'test' })} />
            <Segment label='Scope' values={['global', 'default']} selected={value.scope} onSelect={selected => onChange({ ...value, scope: selected as 'global' | 'default' })} />
            <Segment label='Reviewers' values={['2', '3']} selected={String(value.requiredReviewers)} onSelect={selected => onChange({ ...value, requiredReviewers: Number(selected) })} />
            <button type='button' onClick={onSubmit} disabled={saving} className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}Create</button>
            <fieldset className='flex flex-wrap gap-3 lg:col-span-6'>
                <legend className='sr-only'>Label types</legend>
                {LABEL_TYPES.map(label => <label key={label} className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-ui-text'><input type='checkbox' checked={value.labelTypes.includes(label)} onChange={() => toggleLabel(label)} className='h-4 w-4 accent-ui-primary' />{label}</label>)}
            </fieldset>
        </div>
    )
}

function Segment({ label, values, selected, onSelect }: { label: string, values: string[], selected: string, onSelect: (value: string) => void }) {
    return <div><p className='mb-1 text-[10px] font-semibold uppercase text-ui-muted'>{label}</p><div className='grid h-9 grid-flow-col rounded-md border border-ui-border bg-ui-canvas p-0.5'>{values.map(value => <button key={value} type='button' onClick={() => onSelect(value)} className={`px-2 text-xs font-semibold capitalize ${selected === value ? 'bg-ui-raised text-ui-primary' : 'text-ui-muted'}`}>{value}</button>)}</div></div>
}

function BenchmarkProgress({ benchmark }: { benchmark: Benchmark }) {
    const progress = benchmark.progress.taskCount ? Math.round((benchmark.progress.adjudicatedTaskCount / benchmark.progress.taskCount) * 100) : 0
    return <div className='mt-2 grid gap-1'><div className='flex justify-between text-[10px] text-ui-muted'><span>{benchmark.progress.adjudicatedTaskCount}/{benchmark.progress.taskCount} adjudicated</span><span>{progress}%</span></div><div className='h-1.5 overflow-hidden rounded-full bg-ui-canvas'><div className='h-full bg-ui-primary' style={{ width: `${progress}%` }} /></div><div className='flex justify-between text-[10px] text-ui-muted'><span>{benchmark.progress.reviewerCount} reviewers</span><span>{benchmark.progress.exactSetAgreement == null ? 'Agreement pending' : `${Math.round(benchmark.progress.exactSetAgreement * 100)}% exact agreement`}</span></div></div>
}

function Metric({ label, value }: { label: string, value: number }) { return <span><strong className='mr-1 text-sm text-ui-text'>{value}</strong>{label}</span> }
function Datum({ label, value }: { label: string, value?: string }) { return <div><dt className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</dt><dd className='mt-0.5 truncate text-xs text-ui-text'>{value || 'Unknown'}</dd></div> }
function Status({ label }: { label: string }) { return <span className='rounded-full bg-ui-primary/15 px-2 py-1 text-[10px] font-semibold capitalize text-ui-primary'>{label.replaceAll('_', ' ')}</span> }
function TaskIcon({ task }: { task: Task }) { return task.status === 'adjudicated' ? <Check className='h-4 w-4 shrink-0 text-ui-success' /> : task.status === 'needs_adjudication' ? <Scale className='h-4 w-4 shrink-0 text-ui-warning' /> : <ClipboardCheck className='h-4 w-4 shrink-0 text-ui-muted' /> }
function parseValues(value: string) { return [...new Set(value.split('\n').map(item => item.trim()).filter(Boolean))] }
function benchmarkScope(benchmark?: Benchmark): 'default' | 'global' { return benchmark?.tenantId === 'default' ? 'default' : 'global' }
function formatDate(value?: string) { return value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : undefined }
function message(error: unknown) { return error instanceof Error ? error.message : 'The evaluation request failed.' }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, { ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || `Evaluation request failed (${response.status}).`)
    return payload
}
