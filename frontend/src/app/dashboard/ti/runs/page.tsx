import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, PlayCircle, Rows3 } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default function TiRunsPage() {
    const { runs, sources } = getTiAdminOverview()
    const runQueries = [...new Set(sources.flatMap(source => source.domains).filter(domain => !domain.includes('only')))]
    const orderedRuns = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    const running = runs.filter(run => run.status === 'running' || run.status === 'queued').length
    const failed = runs.filter(run => run.status === 'failed').length
    const completed = runs.filter(run => run.status === 'completed').length
    const captureTotal = runs.reduce((sum, run) => sum + run.captures, 0)
    const screenshotTotal = runs.reduce((sum, run) => sum + run.screenshots, 0)
    const rowTotal = runs.reduce((sum, run) => sum + run.rows, 0)
    const nextRun = [...runs].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Collection runs'
                description='Watch collectors run, publish evidence, and surface stale sources.'
                actions={<ManualRunButton label='Start manual run' queries={runQueries} />}
            />

            <section className='grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr]'>
                <LiveRunCard
                    title='Collector now'
                    run={orderedRuns.find(run => run.status === 'running' || run.status === 'queued') || orderedRuns[0]}
                    sourceName={orderedRuns[0] ? sourceById(orderedRuns[0].sourceId)?.name || orderedRuns[0].sourceId : 'Selecting source'}
                />
                <LiveFact title='Evidence produced' value={`${captureTotal} captures`} detail={`${screenshotTotal} screenshots, ${rowTotal} parsed rows`} tone={captureTotal ? 'ok' : 'neutral'} />
                <LiveFact title='Next source due' value={nextRun ? relativeUntil(nextRun.nextRunAt) : 'Selecting'} detail={nextRun ? sourceById(nextRun.sourceId)?.name || nextRun.sourceId : 'Scheduler is choosing the next source'} tone={nextRun && isOverdue(nextRun.nextRunAt) ? 'watch' : 'neutral'} />
            </section>

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Running' value={String(running)} detail='queued or active' tone={running ? 'hold' : 'ok'} />
                <Metric title='Completed' value={String(completed)} detail='successful jobs' tone='ok' />
                <Metric title='Failed' value={String(failed)} detail='needs retry' tone={failed ? 'warn' : 'ok'} />
                <Metric title='Evidence' value={`${captureTotal} captures`} detail={`${screenshotTotal} screenshots · ${rowTotal} parsed rows`} tone='hold' />
                <Metric title='Next run' value={nextRun ? relativeUntil(nextRun.nextRunAt) : 'Selecting'} detail={nextRun ? sourceById(nextRun.sourceId)?.name || nextRun.sourceId : 'Scheduler is choosing the next source'} tone='hold' />
            </div>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Collector activity</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Newest work first; failed and overdue sources stay visible.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <QueuePill label='Captures' count={captureTotal} />
                        <QueuePill label='Screenshots' count={screenshotTotal} />
                        <QueuePill label='Rows' count={rowTotal} />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <div className='min-w-[78rem]'>
                        <div className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 border-b border-ui-border bg-ui-canvas px-4 py-2 text-xs font-semibold uppercase text-ui-muted'>
                            <span>Run</span>
                            <span>Source</span>
                            <span>Status</span>
                            <span>Started</span>
                            <span>Duration</span>
                            <span>Evidence</span>
                            <span>Next check</span>
                            <span>Action</span>
                        </div>
                        {orderedRuns.map(run => {
                            const source = sourceById(run.sourceId)
                            return (
                                <div key={run.id} className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 border-b border-ui-border px-4 py-2.5 text-sm last:border-b-0 hover:bg-ui-panel'>
                                    <div className='min-w-0'>
                                        <p className='truncate font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                                        <p className='mt-1 line-clamp-1 text-xs text-ui-muted'>{run.message}</p>
                                    </div>
                                    <Link href={`/dashboard/ti/sources/${run.sourceId}`} className='min-w-0 font-semibold text-ui-text hover:text-ui-primary'>
                                        <span className='block truncate'>{source?.name || run.sourceId}</span>
                                        <span className='mt-1 block truncate text-xs font-normal text-ui-muted'>{source?.family.replaceAll('_', ' ') || 'source family'}</span>
                                    </Link>
                                    <span className={statusClass(run.status)}>{run.status}</span>
                                    <span className='text-ui-muted'>{shortDate(run.startedAt)}</span>
                                    <span className='font-semibold text-ui-text'>{durationLabel(run.startedAt, run.finishedAt)}</span>
                                    <span className='text-ui-primary'>{run.captures} cap · {run.screenshots} shots · {run.rows} rows</span>
                                    <span className='text-ui-muted'>{relativeUntil(run.nextRunAt)}</span>
                                    <Link href={`/dashboard/ti/sources/${run.sourceId}`} className='inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                                        Source
                                        <ArrowRight className='h-3.5 w-3.5' />
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1fr_0.9fr]'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Runs needing attention</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Failures, long-running jobs, and overdue next checks stay in the live attention stream.</p>
                        </div>
                        <AlertTriangle className='h-4 w-4 text-ui-warning' />
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {orderedRuns.filter(run => run.status !== 'completed' || isOverdue(run.nextRunAt)).map(run => (
                            <Link key={run.id} href={`/dashboard/ti/sources/${run.sourceId}`} className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-ui-primary/35'>
                                <div>
                                    <p className='font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                                    <p className='mt-1 text-sm text-ui-muted'>{sourceById(run.sourceId)?.name || run.sourceId} · {run.status} · next {relativeUntil(run.nextRunAt)}</p>
                                </div>
                                <span className='inline-flex items-center gap-1 text-sm font-semibold text-ui-primary'>Open source <ArrowRight className='h-3.5 w-3.5' /></span>
                            </Link>
                        ))}
                        {!orderedRuns.some(run => run.status !== 'completed' || isOverdue(run.nextRunAt)) && (
                            <div className='rounded-md border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>Collectors are live; no failed or overdue runs.</div>
                        )}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Evidence by source</h2>
                    <p className='mt-1 text-sm text-ui-muted'>Collectors producing usable captures.</p>
                    <div className='mt-4 grid gap-3'>
                        {sources.map(source => {
                            const sourceRuns = runs.filter(run => run.sourceId === source.id)
                            const sourceCaptures = sourceRuns.reduce((sum, run) => sum + run.captures, 0)
                            const sourceScreenshots = sourceRuns.reduce((sum, run) => sum + run.screenshots, 0)
                            return (
                                <div key={source.id} className='rounded-md border border-ui-border bg-ui-canvas p-3'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <p className='truncate text-sm font-semibold text-ui-text'>{source.name}</p>
                                        <span className='text-sm font-semibold text-ui-primary'>{sourceCaptures}</span>
                                    </div>
                                    <p className='mt-1 text-xs text-ui-muted'>{sourceScreenshots} screenshots · {sourceRuns.length} runs</p>
                                    <div className='mt-3 h-2 overflow-hidden rounded-full bg-ui-raised'>
                                        <div className='h-full rounded-full bg-ui-primary' style={{ width: `${Math.min(100, Math.max(sourceCaptures ? 8 : 0, sourceCaptures / Math.max(captureTotal, 1) * 100))}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function Metric({ title, value, detail, tone }: { title: string, value: string, detail: string, tone: 'ok' | 'warn' | 'hold' }) {
    const icon = tone === 'ok' ? <CheckCircle2 className='h-4 w-4' /> : tone === 'warn' ? <AlertTriangle className='h-4 w-4' /> : <Clock3 className='h-4 w-4' />
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between text-ui-muted'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-xl font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 text-sm text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}

function LiveRunCard({ title, run, sourceName }: { title: string, run?: ReturnType<typeof getTiAdminOverview>['runs'][number], sourceName: string }) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                <div className='flex items-center gap-2 text-sm font-semibold text-ui-text'>
                    <PlayCircle className='h-4 w-4 text-ui-primary' />
                    {title}
                </div>
                {run ? <span className={statusClass(run.status)}>{run.status}</span> : null}
            </div>
            <div className='p-4'>
                <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{sourceName}</p>
                <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{run?.message || 'Collector is choosing the next source.'}</p>
                <div className='mt-3 grid grid-cols-3 gap-2'>
                    <Mini label='Rows' value={String(run?.rows ?? 0)} />
                    <Mini label='Captures' value={String(run?.captures ?? 0)} />
                    <Mini label='Runtime' value={run ? durationLabel(run.startedAt, run.finishedAt) : '-'} />
                </div>
            </div>
        </DashboardPanel>
    )
}

function LiveFact({ title, value, detail, tone }: { title: string, value: string, detail: string, tone: 'neutral' | 'ok' | 'watch' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-3'>
                <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
                <span className={tone === 'ok' ? 'text-ui-success' : tone === 'watch' ? 'text-ui-warning' : 'text-ui-primary'}><Rows3 className='h-4 w-4' /></span>
            </div>
            <p className='mt-3 text-xl font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 line-clamp-2 text-sm leading-5 text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}

function Mini({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas px-2.5 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 truncate text-xs font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function QueuePill({ label, count }: { label: string, count: number }) {
    return <span className='inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-3 py-1 text-xs font-semibold text-ui-text'><Rows3 className='h-3.5 w-3.5 text-ui-primary' />{label}: {count}</span>
}

function statusClass(status: string) {
    if (status === 'completed') return 'w-fit rounded-full border border-ui-success/35 bg-ui-success/10 px-2 py-0.5 text-xs font-semibold capitalize text-ui-success'
    if (status === 'failed') return 'w-fit rounded-full border border-ui-danger/35 bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold capitalize text-ui-danger'
    return 'w-fit rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold capitalize text-ui-primary'
}

function durationLabel(startedAt: string, finishedAt?: string) {
    if (!finishedAt) return 'running'
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return 'running'
    const seconds = Math.max(1, Math.round(ms / 1000))
    if (seconds < 60) return `${seconds}s`
    return `${Math.round(seconds / 60)}m`
}

function shortDate(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

function relativeUntil(value: string) {
    const diff = new Date(value).getTime() - Date.now()
    if (!Number.isFinite(diff)) return 'selecting'
    const minutes = Math.round(diff / 60000)
    if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))} hr overdue`
    if (minutes < 0) return `${Math.abs(minutes)} min overdue`
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}

function isOverdue(value: string) {
    return new Date(value).getTime() < Date.now()
}
