'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, ChevronRight, Clock3, History, LoaderCircle, Play, Plus, RefreshCw, RotateCcw, ShieldCheck } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'

type QueueStatus = 'queued' | 'running' | 'retry_scheduled' | 'dead_letter' | 'failed' | 'adjudicated'
type HistoryItem = { status: string, stage?: string, at: string, reason?: string, modelVersion?: string, failure?: { code?: string, message?: string, retryable?: boolean } }
type Review = { id: string, reviewerRole?: string, reviewerModel?: string, reviewerModelVersion?: string, promptVersion?: string, schemaVersion?: string, modelResponseId?: string, decision?: string, confidence?: number, rationale?: string, evidenceIds?: string[], expectedValues?: string[], annotatedAt?: string }
type Adjudication = { id: string, method?: string, adjudicatedBy?: string, reviewerModel?: string, reviewerModelVersion?: string, promptVersion?: string, schemaVersion?: string, modelResponseId?: string, decision?: string, confidence?: number, rationale?: string, evidenceIds?: string[], annotationIds?: string[], expectedValues?: string[], adjudicatedAt?: string }
type Result = { expectedValue: string | null, observedValue: string | null, outcome: 'true_positive' | 'false_positive' | 'false_negative' | 'true_negative' }
type Score = {
    sampleSize?: number
    precision: number | null
    recall: number | null
    specificity: number | null
    f1: number | null
    truePositive: number
    falsePositive: number
    falseNegative: number
    trueNegative: number
    classBalance: { positiveCount: number, negativeCount: number, positiveRate: number | null }
    confidenceIntervals: { level: number, method: string, precision: Interval, recall: Interval, specificity: Interval }
    calibration: { sampleSize: number, brierScore: number | null, expectedCalibrationError: number | null }
}
type Interval = { lower: number | null, upper: number | null, sampleSize: number }
type Breakdown = Score & { name: string, sampleSize: number }

type Benchmark = {
    id: string
    tenantId?: string
    name: string
    status: 'annotating' | 'complete'
    reviewMode: 'human' | 'automatic_model'
    datasetSplit: 'validation' | 'test'
    labelTypes: string[]
    requiredReviewers: number
    taskCount: number
    createdAt: string
    automation?: { status?: string, failedTaskCount?: number }
    protocol?: { testSplitLocked?: boolean, datasetUsage?: string, reviewPromptVersion?: string, reviewSchemaVersion?: string }
    progress: {
        taskCount: number
        annotationCount: number
        adjudicatedTaskCount: number
        pendingTaskCount: number
        reviewerCount: number
        doubleAnnotatedTaskCount: number
        exactSetAgreement: number | null
        queueCounts?: Record<string, number>
        failureCount?: number
    }
}

type Task = {
    id: string
    captureId: string
    labelType: string
    status: QueueStatus | string
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
        references?: Array<{ id: string, kind?: string, validationType?: string, status?: string, referenceHost?: string, publishedAt?: string, collectedAt?: string }>
    }
    automation?: { status: QueueStatus, stage?: string, attemptCount?: number, lifetimeAttemptCount?: number, maxAttempts?: number, replayCount?: number, nextAttemptAt?: string, lastAttemptAt?: string, lastSuccessAt?: string, lastFailure?: { code?: string, message?: string, retryable?: boolean, at?: string }, history?: HistoryItem[] }
    reviewHistory?: Review[]
    adjudicationHistory?: Adjudication[]
    results?: Result[]
    protocol?: { predictionHidden?: boolean, exhaustiveExpectedValues?: boolean, promptVersion?: string, schemaVersion?: string }
}

type EvaluationMetrics = {
    generatedAt: string
    quality: {
        status: string
        evaluatedUnitCount: number
        needsReviewCount: number
        overall: Score
        byLabelType: Breakdown[]
        byParser: Breakdown[]
        bySourceFamily: Breakdown[]
        byReviewerModelVersion: Breakdown[]
        byPromptVersion: Breakdown[]
        bySchemaVersion: Breakdown[]
        benchmarkEvidence: { validationStatus: string, heldOutCaptureCount: number, heldOutReviewerCount: number, stratifiedCoverageComplete: boolean }
        drift: { status: string, latestDelta: { precision: number | null, recall: number | null, specificity: number | null, f1: number | null } | null, series: Array<{ benchmarkId: string, completedAt?: string, datasetSplit: string, sampleSize: number, precision: number | null, recall: number | null, specificity: number | null, f1: number | null, reviewerModelVersions: string[], parserVersions: string[] }> }
    }
}

type CreateFormState = { name: string, sampleSize: number, datasetSplit: 'validation' | 'test', requiredReviewers: number, labelTypes: string[], scope: 'default' | 'global' }

const LABEL_TYPES = ['actor', 'ransomware', 'victim', 'incident', 'cve', 'malware', 'ttp', 'country', 'sector', 'indicator', 'impact', 'dataset', 'business_mechanism'] as const
const FILTERS = ['active', 'retry', 'dead_letter', 'complete'] as const

export default function EvaluationBenchmarkClient() {
    const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
    const [selectedBenchmarkId, setSelectedBenchmarkId] = useState('')
    const [tasks, setTasks] = useState<Task[]>([])
    const [selectedTaskId, setSelectedTaskId] = useState('')
    const [filter, setFilter] = useState<(typeof FILTERS)[number]>('active')
    const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [createForm, setCreateForm] = useState<CreateFormState>({ name: '', sampleSize: 50, datasetSplit: 'validation', requiredReviewers: 2, labelTypes: [...LABEL_TYPES], scope: 'global' })

    const selectedBenchmark = benchmarks.find(item => item.id === selectedBenchmarkId)
    const visibleTasks = useMemo(() => tasks.filter(task => {
        if (filter === 'retry') return task.status === 'retry_scheduled'
        if (filter === 'dead_letter') return task.status === 'dead_letter' || task.status === 'failed'
        if (filter === 'complete') return task.status === 'adjudicated'
        return task.status === 'queued' || task.status === 'running'
    }), [filter, tasks])
    const selectedTask = visibleTasks.find(item => item.id === selectedTaskId) || visibleTasks[0]

    const loadBenchmarks = useCallback(async (preferredId?: string) => {
        const payloads = await Promise.all([
            api<{ benchmarks: Benchmark[] }>('/api/ti/evaluation/benchmarks?scope=global'),
            api<{ benchmarks: Benchmark[] }>('/api/ti/evaluation/benchmarks?scope=default'),
        ])
        const rows = payloads.flatMap(payload => payload.benchmarks).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setBenchmarks(rows)
        setSelectedBenchmarkId(current => preferredId || (rows.some(item => item.id === current) ? current : '') || rows.find(item => item.reviewMode === 'automatic_model')?.id || rows[0]?.id || '')
    }, [])

    const loadTasks = useCallback(async (benchmarkId: string, scope = benchmarkScope(benchmarks.find(item => item.id === benchmarkId))) => {
        if (!benchmarkId) return setTasks([])
        const payload = await api<{ tasks: Task[] }>(`/api/ti/evaluation/benchmarks/${benchmarkId}/tasks?scope=${scope}`)
        setTasks(payload.tasks)
        setSelectedTaskId(current => payload.tasks.some(item => item.id === current) ? current : payload.tasks[0]?.id || '')
    }, [benchmarks])

    const loadMetrics = useCallback(async (benchmark?: Benchmark) => {
        setMetrics(benchmark ? await api<EvaluationMetrics>(`/api/ti/evaluation?scope=${benchmarkScope(benchmark)}&datasetSplit=${benchmark.datasetSplit}`) : null)
    }, [])

    const refresh = useCallback(async () => {
        setLoading(true)
        setError('')
        try { await loadBenchmarks() }
        catch (cause) { setError(message(cause)) }
        finally { setLoading(false) }
    }, [loadBenchmarks])

    useEffect(() => { void refresh() }, [refresh])
    useEffect(() => { void Promise.all([loadTasks(selectedBenchmarkId), loadMetrics(selectedBenchmark)]).catch(cause => setError(message(cause))) }, [loadMetrics, loadTasks, selectedBenchmark, selectedBenchmarkId])
    useEffect(() => { if (!visibleTasks.some(item => item.id === selectedTaskId)) setSelectedTaskId(visibleTasks[0]?.id || '') }, [selectedTaskId, visibleTasks])

    async function createBenchmark() {
        if (!createForm.labelTypes.length) return setError('Select at least one label type.')
        await mutate(async () => {
            const payload = await api<{ benchmark: Benchmark }>(`/api/ti/evaluation/benchmarks?scope=${createForm.scope}`, { method: 'POST', body: JSON.stringify({ ...createForm, automatic: true, scope: undefined }) })
            await loadBenchmarks(payload.benchmark.id)
            setShowCreate(false)
        })
    }

    async function runNow() {
        if (!selectedBenchmark) return
        await mutate(async () => {
            await api(`/api/ti/evaluation/benchmarks/${selectedBenchmark.id}/run?scope=${benchmarkScope(selectedBenchmark)}`, { method: 'POST', body: '{}' })
            await Promise.all([loadBenchmarks(selectedBenchmark.id), loadTasks(selectedBenchmark.id)])
        })
    }

    async function replayTask() {
        if (!selectedBenchmark || !selectedTask) return
        await mutate(async () => {
            await api(`/api/ti/evaluation/benchmarks/${selectedBenchmark.id}/tasks/${selectedTask.id}/retry?scope=${benchmarkScope(selectedBenchmark)}`, { method: 'POST', body: '{}' })
            await Promise.all([loadBenchmarks(selectedBenchmark.id), loadTasks(selectedBenchmark.id)])
            setFilter('active')
        })
    }

    async function mutate(action: () => Promise<void>) {
        setSaving(true)
        setError('')
        try { await action() }
        catch (cause) { setError(message(cause)) }
        finally { setSaving(false) }
    }

    const canReplay = selectedTask && ['retry_scheduled', 'dead_letter', 'failed'].includes(selectedTask.status)
    const queueTotals = aggregateQueue(benchmarks)

    return (
        <>
            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-3 py-2'>
                    <div className='flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ui-muted'>
                        <Metric label='Queued' value={queueTotals.queued || 0} />
                        <Metric label='Running' value={queueTotals.running || 0} />
                        <Metric label='Retrying' value={queueTotals.retry_scheduled || 0} />
                        <Metric label='Dead letter' value={(queueTotals.dead_letter || 0) + (queueTotals.failed || 0)} danger />
                        <Metric label='Adjudicated' value={queueTotals.adjudicated || 0} />
                    </div>
                    <div className='flex items-center gap-1.5'>
                        {selectedBenchmark?.reviewMode === 'automatic_model' ? <button type='button' onClick={() => void runNow()} disabled={saving} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-canvas disabled:opacity-50'><Play className='h-4 w-4' />Run now</button> : null}
                        <button type='button' onClick={() => void refresh()} disabled={loading} title='Refresh evaluation workbench' className='grid h-9 w-9 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted hover:text-ui-text disabled:opacity-50'><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
                        <button type='button' onClick={() => setShowCreate(value => !value)} className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas hover:opacity-90'><Plus className='h-4 w-4' />New automatic benchmark</button>
                    </div>
                </div>
                {showCreate ? <CreateForm value={createForm} onChange={setCreateForm} onSubmit={() => void createBenchmark()} saving={saving} /> : null}
                {error ? <div role='alert' className='flex items-start gap-2 border-t border-ui-danger/30 bg-ui-danger/10 px-3 py-2 text-xs text-ui-danger'><AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />{error}</div> : null}
                {metrics ? <MetricsSummary metrics={metrics} /> : null}
            </DashboardPanel>

            <div className='grid min-h-[38rem] gap-3 xl:grid-cols-[22rem_minmax(0,1fr)]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='border-b border-ui-border p-2'>
                        <label className='text-[10px] font-semibold uppercase text-ui-muted' htmlFor='benchmark-select'>Benchmark</label>
                        <select id='benchmark-select' value={selectedBenchmarkId} onChange={event => setSelectedBenchmarkId(event.target.value)} className='mt-1 h-9 w-full rounded-md border border-ui-border bg-ui-raised px-2 text-sm text-ui-text'>
                            {benchmarks.map(item => <option key={item.id} value={item.id}>{item.name} · {item.reviewMode === 'automatic_model' ? 'automatic' : 'manual'} · {benchmarkScope(item)}</option>)}
                            {!benchmarks.length ? <option value=''>No persisted benchmarks</option> : null}
                        </select>
                        {selectedBenchmark ? <BenchmarkProgress benchmark={selectedBenchmark} /> : null}
                    </div>
                    <div className='grid grid-cols-4 border-b border-ui-border bg-ui-raised p-1'>
                        {FILTERS.map(item => <button key={item} type='button' onClick={() => setFilter(item)} className={`h-8 px-1 text-[10px] font-semibold capitalize ${filter === item ? 'bg-ui-panel text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>{item.replaceAll('_', ' ')}</button>)}
                    </div>
                    <div className='max-h-[calc(100vh-24rem)] min-h-72 overflow-auto'>
                        {visibleTasks.map(task => <button key={task.id} type='button' onClick={() => setSelectedTaskId(task.id)} className={`flex w-full items-center gap-2 border-b border-ui-border px-3 py-2 text-left hover:bg-ui-raised ${selectedTask?.id === task.id ? 'bg-ui-raised' : ''}`}>
                            <TaskIcon status={task.status} />
                            <span className='min-w-0 flex-1'><span className='block truncate text-xs font-semibold uppercase text-ui-text'>{task.labelType}</span><span className='block truncate text-[11px] text-ui-muted'>{task.automation?.stage || task.evidence.sourceName || task.captureId}</span></span>
                            <ChevronRight className='h-3.5 w-3.5 shrink-0 text-ui-muted' />
                        </button>)}
                        {!visibleTasks.length ? <div className='grid min-h-48 place-items-center p-4 text-center text-xs text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : error && !benchmarks.length ? 'Evaluation data could not be loaded.' : benchmarks.length ? 'No persisted tasks in this queue state.' : 'No evaluation benchmarks exist yet.'}</div> : null}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    {selectedTask ? <TaskWorkbench task={selectedTask} saving={saving} canReplay={Boolean(canReplay)} onReplay={() => void replayTask()} /> : <div className='grid min-h-96 place-items-center p-6 text-center text-sm text-ui-muted'>{loading ? <LoaderCircle className='h-5 w-5 animate-spin' /> : error && !benchmarks.length ? 'Evaluation data is unavailable.' : 'Select a task or choose another queue state.'}</div>}
                </DashboardPanel>
            </div>

            {metrics ? <MetricsBreakdowns metrics={metrics} /> : null}
        </>
    )
}

function TaskWorkbench({ task, saving, canReplay, onReplay }: { task: Task, saving: boolean, canReplay: boolean, onReplay: () => void }) {
    return <div className='grid h-full min-h-0 lg:grid-cols-[minmax(0,1fr)_23rem]'>
        <section className='min-w-0 border-b border-ui-border lg:border-b-0 lg:border-r'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border bg-ui-raised px-3 py-2'>
                <div><p className='text-[10px] font-semibold uppercase text-ui-primary'>{task.labelType} extraction</p><h2 className='mt-0.5 text-sm font-semibold text-ui-text'>{task.evidence.title || 'Retained evaluation evidence'}</h2></div>
                <Status label={task.status} />
            </div>
            {task.evidence.unavailable ? <div className='flex min-h-72 items-center justify-center gap-2 p-6 text-sm text-ui-danger'><AlertTriangle className='h-4 w-4' />{task.evidence.reason || 'Required evidence is unavailable.'}</div> : <div className='grid gap-3 p-3'>
                <dl className='grid gap-2 text-xs sm:grid-cols-2 xl:grid-cols-4'><Datum label='Source' value={task.evidence.sourceName} /><Datum label='Family' value={task.evidence.sourceFamily} /><Datum label='Published' value={formatDate(task.evidence.publishedAt)} /><Datum label='Collected' value={formatDate(task.evidence.collectedAt)} /></dl>
                <pre className='max-h-[32rem] min-h-64 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-ui-border bg-ui-canvas p-4 font-sans text-sm leading-6 text-ui-text'>{task.evidence.excerpt || 'Evidence text is missing.'}</pre>
                <p className='truncate font-mono text-[10px] text-ui-muted'>SHA {task.evidence.contentHash || 'missing'}</p>
                <div><h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Governed references</h3><div className='mt-1 grid gap-1'>{task.evidence.references?.map(reference => <div key={reference.id} className='rounded-md border border-ui-border bg-ui-raised px-2 py-1.5 text-xs text-ui-text'><span className='font-semibold'>{reference.kind || 'reference'}</span><span className='ml-2 text-ui-muted'>{reference.referenceHost || reference.validationType || reference.id}</span>{reference.status ? <Status label={reference.status} /> : null}</div>)}{!task.evidence.references?.length ? <p className='text-xs text-ui-danger'>No governed reference metadata is available.</p> : null}</div></div>
            </div>}
        </section>
        <aside className='max-h-[calc(100vh-17rem)] overflow-auto p-3'>
            <section className='grid gap-2 rounded-md border border-ui-border bg-ui-raised p-3'>
                <div className='flex items-center justify-between gap-2'><h3 className='text-xs font-semibold text-ui-text'>Automatic queue</h3><ShieldCheck className='h-4 w-4 text-ui-primary' /></div>
                <dl className='grid grid-cols-2 gap-2'><Datum label='Stage' value={task.automation?.stage} /><Datum label='Attempts' value={task.automation ? `${task.automation.attemptCount || 0}/${task.automation.maxAttempts || 0}` : 'Not automatic'} /><Datum label='Lifetime attempts' value={String(task.automation?.lifetimeAttemptCount || 0)} /><Datum label='Replays' value={String(task.automation?.replayCount || 0)} /><Datum label='Next attempt' value={formatDate(task.automation?.nextAttemptAt)} /><Datum label='Last success' value={formatDate(task.automation?.lastSuccessAt)} /></dl>
                {task.automation?.lastFailure ? <div className='rounded-md border border-ui-danger/30 bg-ui-danger/10 p-2 text-xs text-ui-danger'><strong>{task.automation.lastFailure.code || 'evaluation_failed'}</strong><p className='mt-1 wrap-break-word'>{task.automation.lastFailure.message || 'No failure detail was persisted.'}</p></div> : null}
                {canReplay ? <button type='button' onClick={onReplay} disabled={saving} className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <RotateCcw className='h-4 w-4' />}Replay safely</button> : null}
            </section>
            <Timeline title='Queue history' items={task.automation?.history || []} />
            <ReviewHistory reviews={task.reviewHistory || []} />
            <AdjudicationHistory adjudications={task.adjudicationHistory || []} />
            <Results results={task.results || []} />
        </aside>
    </div>
}

function Timeline({ title, items }: { title: string, items: HistoryItem[] }) {
    return <section className='mt-3'><h3 className='flex items-center gap-1.5 text-[10px] font-semibold uppercase text-ui-muted'><History className='h-3.5 w-3.5' />{title}</h3><div className='mt-1 grid gap-1'>{items.map((item, index) => <div key={`${item.at}-${index}`} className='rounded-md border border-ui-border px-2 py-1.5 text-xs'><div className='flex justify-between gap-2'><span className='font-semibold capitalize text-ui-text'>{item.status.replaceAll('_', ' ')}{item.stage ? ` · ${item.stage}` : ''}</span><time className='shrink-0 text-[10px] text-ui-muted'>{formatDate(item.at)}</time></div>{item.failure ? <p className='mt-1 wrap-break-word text-ui-danger'>{item.failure.code}: {item.failure.message || 'No message'}</p> : item.reason ? <p className='mt-1 text-ui-muted'>{item.reason.replaceAll('_', ' ')}</p> : null}</div>)}{!items.length ? <p className='text-xs text-ui-muted'>No queue events persisted.</p> : null}</div></section>
}

function ReviewHistory({ reviews }: { reviews: Review[] }) {
    return <section className='mt-3'><h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Independent reviewer history</h3><div className='mt-1 grid gap-1'>{reviews.map(review => <div key={review.id} className='rounded-md border border-ui-border p-2 text-xs text-ui-text'><div className='flex flex-wrap justify-between gap-1'><strong>{review.reviewerRole || 'reviewer'} · {review.reviewerModelVersion || review.reviewerModel || 'unknown model'}</strong><span>{percent(review.confidence ?? null)}</span></div><time className='text-[10px] text-ui-muted'>{formatDate(review.annotatedAt)}</time><p className='mt-1 wrap-break-word text-ui-muted'>{review.rationale || 'No rationale persisted.'}</p>{review.expectedValues ? <p className='mt-1'><span className='text-ui-muted'>Expected: </span>{review.expectedValues.length ? review.expectedValues.join(', ') : 'none'}</p> : null}{review.evidenceIds?.length ? <p className='mt-1 truncate font-mono text-[10px] text-ui-muted' title={review.evidenceIds.join(', ')}>Evidence {review.evidenceIds.join(', ')}</p> : null}<VersionLine prompt={review.promptVersion} schema={review.schemaVersion} /></div>)}{!reviews.length ? <p className='text-xs text-ui-muted'>No model review has completed.</p> : null}</div></section>
}

function AdjudicationHistory({ adjudications }: { adjudications: Adjudication[] }) {
    return <section className='mt-3'><h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Adjudication history</h3><div className='mt-1 grid gap-1'>{adjudications.map(item => <div key={item.id} className='rounded-md border border-ui-primary/30 bg-ui-primary/5 p-2 text-xs text-ui-text'><strong>{item.method?.replaceAll('_', ' ') || 'adjudicated'} · {item.reviewerModelVersion || item.adjudicatedBy}</strong><time className='block text-[10px] text-ui-muted'>{formatDate(item.adjudicatedAt)}</time><p className='mt-1 wrap-break-word text-ui-muted'>{item.rationale || 'Consensus was exact.'}</p>{item.expectedValues ? <p className='mt-1'><span className='text-ui-muted'>Expected: </span>{item.expectedValues.length ? item.expectedValues.join(', ') : 'none'}</p> : null}{item.evidenceIds?.length ? <p className='mt-1 truncate font-mono text-[10px] text-ui-muted' title={item.evidenceIds.join(', ')}>Evidence {item.evidenceIds.join(', ')}</p> : null}<VersionLine prompt={item.promptVersion} schema={item.schemaVersion} /></div>)}{!adjudications.length ? <p className='text-xs text-ui-muted'>No terminal adjudication exists.</p> : null}</div></section>
}

function Results({ results }: { results: Result[] }) {
    return <section className='mt-3'><h3 className='text-[10px] font-semibold uppercase text-ui-muted'>Immutable terminal labels</h3><div className='mt-1 grid gap-1'>{results.map((result, index) => <div key={`${result.outcome}-${index}`} className='rounded-md border border-ui-border p-2 text-xs'><Status label={result.outcome} /><p className='mt-1 text-ui-text'><span className='text-ui-muted'>Expected:</span> {result.expectedValue || 'none'}</p><p className='text-ui-text'><span className='text-ui-muted'>Observed:</span> {result.observedValue || 'none'}</p></div>)}{!results.length ? <p className='text-xs text-ui-muted'>No terminal label has been produced.</p> : null}</div></section>
}

function MetricsSummary({ metrics }: { metrics: EvaluationMetrics }) {
    const { overall, benchmarkEvidence, evaluatedUnitCount } = metrics.quality
    return <dl className='grid grid-cols-2 gap-px border-t border-ui-border bg-ui-border sm:grid-cols-4 lg:grid-cols-9'>
        <ScoreDatum label='Validation' value={benchmarkEvidence.validationStatus.replaceAll('_', ' ')} />
        <ScoreDatum label='Units' value={String(evaluatedUnitCount)} />
        <ScoreDatum label='Precision' value={metricWithCi(overall.precision, overall.confidenceIntervals.precision)} />
        <ScoreDatum label='Recall' value={metricWithCi(overall.recall, overall.confidenceIntervals.recall)} />
        <ScoreDatum label='Specificity' value={metricWithCi(overall.specificity, overall.confidenceIntervals.specificity)} />
        <ScoreDatum label='F1' value={percent(overall.f1)} />
        <ScoreDatum label='Calibration / Brier' value={`${decimal(overall.calibration.expectedCalibrationError)} / ${decimal(overall.calibration.brierScore)}`} />
        <ScoreDatum label='Class balance' value={`${overall.classBalance.positiveCount}+ / ${overall.classBalance.negativeCount}−`} />
        <ScoreDatum label='Held-out evidence' value={`${benchmarkEvidence.heldOutCaptureCount} captures / ${benchmarkEvidence.heldOutReviewerCount} reviewers`} />
    </dl>
}

function MetricsBreakdowns({ metrics }: { metrics: EvaluationMetrics }) {
    const quality = metrics.quality
    const delta = quality.drift.latestDelta
    return <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
        <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border bg-ui-raised px-3 py-2'><div><h2 className='text-sm font-semibold text-ui-text'>Reproducible accuracy breakdowns</h2><p className='text-xs text-ui-muted'>Independent terminal labels only · generated {formatDate(metrics.generatedAt)}{delta ? ` · latest Δ P ${signedPercent(delta.precision)}, R ${signedPercent(delta.recall)}, S ${signedPercent(delta.specificity)}, F1 ${signedPercent(delta.f1)}` : ''}</p></div><Status label={quality.drift.status === 'measured' ? 'drift measured' : 'drift pending'} /></div>
        <div className='grid gap-3 p-3 xl:grid-cols-2'><BreakdownTable title='Label type' rows={quality.byLabelType} /><BreakdownTable title='Parser version' rows={quality.byParser} /><BreakdownTable title='Source family' rows={quality.bySourceFamily} /><BreakdownTable title='Reviewer model version' rows={quality.byReviewerModelVersion} /><BreakdownTable title='Review prompt version' rows={quality.byPromptVersion} /><BreakdownTable title='Review schema version' rows={quality.bySchemaVersion} /></div>
        <div className='border-t border-ui-border p-3'><h3 className='text-xs font-semibold text-ui-text'>Drift history</h3><div className='mt-2 overflow-x-auto'><table className='min-w-full text-left text-xs'><thead className='text-ui-muted'><tr><th className='pb-2 pr-3'>Completed</th><th className='pb-2 pr-3'>Split</th><th className='pb-2 pr-3'>Units</th><th className='pb-2 pr-3'>Precision</th><th className='pb-2 pr-3'>Recall</th><th className='pb-2 pr-3'>Specificity</th><th className='pb-2'>F1</th></tr></thead><tbody>{quality.drift.series.map(row => <tr key={row.benchmarkId} className='border-t border-ui-border text-ui-text'><td className='py-2 pr-3'>{formatDate(row.completedAt)}</td><td className='py-2 pr-3'>{row.datasetSplit}</td><td className='py-2 pr-3'>{row.sampleSize}</td><td className='py-2 pr-3'>{percent(row.precision)}</td><td className='py-2 pr-3'>{percent(row.recall)}</td><td className='py-2 pr-3'>{percent(row.specificity)}</td><td className='py-2'>{percent(row.f1)}</td></tr>)}</tbody></table>{!quality.drift.series.length ? <p className='py-3 text-xs text-ui-muted'>Drift remains unmeasured until completed automatic benchmarks exist.</p> : null}</div></div>
    </DashboardPanel>
}

function BreakdownTable({ title, rows }: { title: string, rows: Breakdown[] }) {
    return <div className='overflow-hidden rounded-md border border-ui-border'><h3 className='bg-ui-raised px-2 py-1.5 text-[10px] font-semibold uppercase text-ui-muted'>{title}</h3><div className='overflow-x-auto'><table className='min-w-full text-left text-xs'><thead className='text-ui-muted'><tr><th className='p-2'>Name</th><th className='p-2'>N</th><th className='p-2'>P</th><th className='p-2'>R</th><th className='p-2'>S</th><th className='p-2'>F1</th></tr></thead><tbody>{rows.map(row => <tr key={row.name} className='border-t border-ui-border text-ui-text'><td className='max-w-40 truncate p-2' title={row.name}>{row.name}</td><td className='p-2'>{row.sampleSize}</td><td className='p-2'>{percent(row.precision)}</td><td className='p-2'>{percent(row.recall)}</td><td className='p-2'>{percent(row.specificity)}</td><td className='p-2'>{percent(row.f1)}</td></tr>)}</tbody></table>{!rows.length ? <p className='p-3 text-xs text-ui-muted'>No independently adjudicated rows.</p> : null}</div></div>
}

function CreateForm({ value, onChange, onSubmit, saving }: { value: CreateFormState, onChange: (value: CreateFormState) => void, onSubmit: () => void, saving: boolean }) {
    const toggleLabel = (label: string) => onChange({ ...value, labelTypes: value.labelTypes.includes(label) ? value.labelTypes.filter(item => item !== label) : [...value.labelTypes, label] })
    return <div className='grid gap-3 border-t border-ui-border p-3 lg:grid-cols-[minmax(12rem,1fr)_8rem_auto_auto_auto_auto] lg:items-end'>
        <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Name<input value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} maxLength={160} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm font-normal normal-case text-ui-text' /></label>
        <label className='grid gap-1 text-[10px] font-semibold uppercase text-ui-muted'>Captures<input type='number' min={1} max={200} value={value.sampleSize} onChange={event => onChange({ ...value, sampleSize: Number(event.target.value) })} className='h-9 rounded-md border border-ui-border bg-ui-canvas px-2 text-sm font-normal text-ui-text' /></label>
        <Segment label='Dataset' values={['validation', 'test']} selected={value.datasetSplit} onSelect={selected => onChange({ ...value, datasetSplit: selected as 'validation' | 'test' })} />
        <Segment label='Scope' values={['global', 'default']} selected={value.scope} onSelect={selected => onChange({ ...value, scope: selected as 'global' | 'default' })} />
        <Segment label='Reviewers' values={['2', '3']} selected={String(value.requiredReviewers)} onSelect={selected => onChange({ ...value, requiredReviewers: Number(selected) })} />
        <button type='button' onClick={onSubmit} disabled={saving} className='inline-flex h-9 items-center justify-center gap-2 rounded-md bg-ui-primary px-3 text-xs font-semibold text-ui-canvas disabled:opacity-50'>{saving ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}Create automatic queue</button>
        <p className='text-xs text-ui-muted lg:col-span-6'>{value.datasetSplit === 'test' ? 'The final test split is locked at creation and must not be used for tuning.' : 'Validation benchmarks may be used for model selection and drift monitoring.'}</p>
        <fieldset className='flex flex-wrap gap-3 lg:col-span-6'><legend className='sr-only'>Label types</legend>{LABEL_TYPES.map(label => <label key={label} className='inline-flex items-center gap-1.5 text-xs font-semibold uppercase text-ui-text'><input type='checkbox' checked={value.labelTypes.includes(label)} onChange={() => toggleLabel(label)} className='h-4 w-4 accent-ui-primary' />{label.replaceAll('_', ' ')}</label>)}</fieldset>
    </div>
}

function Segment({ label, values, selected, onSelect }: { label: string, values: string[], selected: string, onSelect: (value: string) => void }) { return <div><p className='mb-1 text-[10px] font-semibold uppercase text-ui-muted'>{label}</p><div className='grid h-9 grid-flow-col rounded-md border border-ui-border bg-ui-canvas p-0.5'>{values.map(value => <button key={value} type='button' onClick={() => onSelect(value)} className={`px-2 text-xs font-semibold capitalize ${selected === value ? 'bg-ui-raised text-ui-primary' : 'text-ui-muted'}`}>{value}</button>)}</div></div> }
function BenchmarkProgress({ benchmark }: { benchmark: Benchmark }) { const progress = benchmark.progress.taskCount ? Math.round((benchmark.progress.adjudicatedTaskCount / benchmark.progress.taskCount) * 100) : 0; return <div className='mt-2 grid gap-1'><div className='flex justify-between text-[10px] text-ui-muted'><span>{benchmark.progress.adjudicatedTaskCount}/{benchmark.progress.taskCount} terminal · {benchmark.datasetSplit}{benchmark.protocol?.testSplitLocked ? ' locked' : ''}</span><span>{progress}%</span></div><div className='h-1.5 overflow-hidden rounded-full bg-ui-canvas'><div className='h-full bg-ui-primary' style={{ width: `${progress}%` }} /></div><div className='flex justify-between text-[10px] text-ui-muted'><span>{benchmark.progress.failureCount || 0} failures</span><span>{benchmark.progress.exactSetAgreement == null ? 'Agreement pending' : `${Math.round(benchmark.progress.exactSetAgreement * 100)}% exact agreement`}</span></div></div> }
function VersionLine({ prompt, schema }: { prompt?: string, schema?: string }) { return <p className='mt-1 truncate font-mono text-[10px] text-ui-muted' title={`${prompt || 'unknown'} · ${schema || 'unknown'}`}>{prompt || 'unknown prompt'} · {schema || 'unknown schema'}</p> }
function Metric({ label, value, danger = false }: { label: string, value: number, danger?: boolean }) { return <span><strong className={`mr-1 text-sm ${danger && value ? 'text-ui-danger' : 'text-ui-text'}`}>{value}</strong>{label}</span> }
function ScoreDatum({ label, value }: { label: string, value: string }) { return <div className='bg-ui-panel px-3 py-2'><dt className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</dt><dd className='mt-0.5 text-xs font-semibold text-ui-text'>{value}</dd></div> }
function Datum({ label, value }: { label: string, value?: string }) { return <div><dt className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</dt><dd className='mt-0.5 truncate text-xs text-ui-text' title={value}>{value || 'Unknown'}</dd></div> }
function Status({ label }: { label: string }) { return <span className='ml-1 inline-flex rounded-full bg-ui-primary/15 px-2 py-0.5 text-[10px] font-semibold capitalize text-ui-primary'>{label.replaceAll('_', ' ')}</span> }
function TaskIcon({ status }: { status: string }) { if (status === 'adjudicated') return <Check className='h-4 w-4 shrink-0 text-ui-success' />; if (status === 'dead_letter' || status === 'failed') return <AlertTriangle className='h-4 w-4 shrink-0 text-ui-danger' />; if (status === 'retry_scheduled') return <RotateCcw className='h-4 w-4 shrink-0 text-ui-warning' />; return <Clock3 className='h-4 w-4 shrink-0 text-ui-muted' /> }
function aggregateQueue(benchmarks: Benchmark[]) { const counts: Record<string, number> = {}; for (const benchmark of benchmarks) for (const [status, count] of Object.entries(benchmark.progress.queueCounts || {})) counts[status] = (counts[status] || 0) + count; return counts }
function benchmarkScope(benchmark?: Benchmark): 'default' | 'global' { return benchmark?.tenantId === 'default' ? 'default' : 'global' }
function formatDate(value?: string) { if (!value) return undefined; const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'Invalid timestamp' }
function percent(value: number | null) { return value === null ? 'Unmeasured' : `${Math.round(value * 1000) / 10}%` }
function signedPercent(value: number | null) { return value === null ? 'unmeasured' : `${value >= 0 ? '+' : ''}${percent(value)}` }
function decimal(value: number | null) { return value === null ? 'Unmeasured' : value.toFixed(3) }
function metricWithCi(value: number | null, interval: Interval) { return value === null || interval.lower === null || interval.upper === null ? 'Unmeasured' : `${percent(value)} (${percent(interval.lower)}–${percent(interval.upper)})` }
function message(error: unknown) { return error instanceof Error ? error.message : 'The evaluation request failed.' }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(path, { ...init, headers: { ...(init?.body ? { 'content-type': 'application/json' } : {}), ...init?.headers }, cache: 'no-store' })
    const payload = await response.json().catch(() => ({})) as T & { error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || `Evaluation request failed (${response.status}).`)
    return payload
}
