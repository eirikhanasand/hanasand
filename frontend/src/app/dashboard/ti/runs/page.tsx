import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, PlayCircle, Rows3 } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiAdminOverview, getTiCollectionRunsPage, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import TiDataAvailability from '../ti-data-availability'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiRunsPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    // Collection runs are global collector operations, not a customer tenant's
    // watchlist data. The default tenant lane is intentionally empty here.
    const params = await props.searchParams
    const cursor = value(params?.cursor) || ''
    const [{ runs, total: runTotal, nextCursor, available }, overview] = await Promise.all([
        getTiCollectionRunsPage(null, { cursor, limit: 50 }),
        getTiAdminOverview(null, { limit: 50, includeSamples: false, includeCandidates: true }),
    ])
    const { sources } = overview
    const runQueries = [...new Set(sources.flatMap(source => source.domains).filter(domain => !domain.includes('only')))]
    const orderedRuns = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    const running = runs.filter(run => run.status === 'running' || run.status === 'queued').length
    const failed = runs.filter(run => run.status === 'failed').length
    const completed = runs.filter(run => run.status === 'completed').length
    const captureTotal = runs.reduce((sum, run) => sum + run.captures, 0)
    const screenshotTotal = runs.reduce((sum, run) => sum + run.screenshots, 0)
    const rowTotal = runs.reduce((sum, run) => sum + run.rows, 0)
    const nextRun = [...runs].filter(run => run.nextRunAt).sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const nextSource = [...sources].filter(source => Number.isFinite(new Date(source.nextRunAt).getTime())).sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const attentionRuns = orderedRuns.filter(run => run.status !== 'completed' || Boolean(run.nextRunAt && isOverdue(run.nextRunAt)))
    const runUnavailable = !available

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Collection runs'
                description='Watch collectors run, publish evidence, and surface stale sources.'
                actions={<ManualRunButton label='Start manual run' queries={runQueries} />}
            />
            <TiDataAvailability availability={overview.availability} />

            <section className='grid gap-3 xl:grid-cols-[1.2fr_1fr_1fr]'>
                <LiveRunCard
                    title='Collector now'
                    run={orderedRuns.find(run => run.status === 'running' || run.status === 'queued') || orderedRuns[0]}
                    sourceName={orderedRuns[0]?.sourceName}
                />
                <LiveFact title='Evidence produced' value={`${captureTotal} captures`} detail={`${screenshotTotal} screenshots, ${rowTotal} parsed rows`} tone={captureTotal ? 'ok' : 'neutral'} />
                <LiveFact title='Next source due' value={nextRun ? relativeUntil(nextRun.nextRunAt) : nextSource ? relativeUntil(nextSource.nextRunAt) : 'No upcoming source'} detail={nextRun?.sourceName || nextSource?.name || 'No active source is queued'} tone={(nextRun || nextSource) && isOverdue((nextRun || nextSource)!.nextRunAt) ? 'watch' : 'neutral'} />
            </section>

            {runUnavailable ? <DashboardPanel className='border-ui-danger/35 bg-ui-danger/5 p-4'><p className='font-semibold text-ui-danger'>Collection history unavailable</p><p className='mt-1 text-sm text-ui-muted'>The collector status is available, but its run history could not be read. This is not the same as zero runs.</p></DashboardPanel> : null}

            {runs.length ? <details data-ti-runs-summary-disclosure className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 [&::-webkit-details-marker]:hidden'>
                    <span className='inline-flex items-center gap-2'>
                        <Rows3 className='h-4 w-4 text-ui-primary' />
                        Run totals
                    </span>
                    <span className='inline-flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                        {running} active · {completed} complete · {failed} failed
                        <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                    </span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3 sm:grid-cols-2 xl:grid-cols-5'>
                    <Metric title='Running' value={String(running)} detail='queued or active' tone={running ? 'hold' : 'ok'} />
                    <Metric title='Completed' value={String(completed)} detail='successful jobs' tone='ok' />
                    <Metric title='Failed' value={String(failed)} detail='needs retry' tone={failed ? 'warn' : 'ok'} />
                    <Metric title='Evidence' value={`${captureTotal} captures`} detail={`${screenshotTotal} screenshots · ${rowTotal} parsed rows`} tone='hold' />
                    <Metric title='Next run' value={nextRun ? relativeUntil(nextRun.nextRunAt) : nextSource ? relativeUntil(nextSource.nextRunAt) : 'No upcoming source'} detail={nextRun?.sourceName || nextSource?.name || 'No active source is queued'} tone='hold' />
                </div>
            </details> : null}

            {runs.length ? <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
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
                            return (
                                <div key={run.id} className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 border-b border-ui-border px-4 py-2.5 text-sm last:border-b-0 hover:bg-ui-panel'>
                                    <div className='min-w-0'>
                                        <p className='truncate font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                                        <p className='mt-1 line-clamp-1 text-xs text-ui-muted'>{run.message}</p>
                                    </div>
                                    {run.sourceId ? <Link href={`/ti/sources/${run.sourceId}`} className='min-w-0 font-semibold text-ui-text hover:text-ui-primary'>
                                        <span className='block truncate'>{run.sourceName}</span>
                                        <span className='mt-1 block truncate text-xs font-normal text-ui-muted'>{run.sourceFamily.replaceAll('_', ' ')}</span>
                                    </Link> : <div className='min-w-0'>
                                        <span className='block truncate font-semibold text-ui-text'>{run.sourceName}</span>
                                        <span className='mt-1 block truncate text-xs text-ui-muted'>{run.sourceFamily.replaceAll('_', ' ')}</span>
                                    </div>}
                                    <span className={statusClass(run.status)}>{run.status}</span>
                                    <span className='text-ui-muted'>{shortDate(run.startedAt)}</span>
                                    <span className='font-semibold text-ui-text'>{durationLabel(run.startedAt, run.finishedAt)}</span>
                                    <span className='text-ui-primary'>{run.captures} cap · {run.screenshots} shots · {run.rows} rows</span>
                                    <span className='text-ui-muted'>{run.nextRunAt ? relativeUntil(run.nextRunAt) : run.trigger === 'automated' ? 'automated run' : run.trigger === 'manual' ? 'manual run' : 'run origin unavailable'}</span>
                                    {run.sourceId ? <Link href={`/ti/sources/${run.sourceId}`} className='inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                                        Source
                                        <ArrowRight className='h-3.5 w-3.5' />
                                    </Link> : <span className='text-xs text-ui-muted'>Fleet run</span>}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <nav className='flex items-center justify-between gap-3 border-t border-ui-border bg-ui-panel px-4 py-3 text-sm' aria-label='Collection run pages'>
                    <span className='text-ui-muted'>{runTotal ? `${runs.length} shown · ${runTotal} total` : '0 runs'}</span>
                    <div className='flex gap-2'>
                        {nextCursor ? <Link href={`/ti/runs?cursor=${nextCursor}`} className='rounded-md border border-ui-border px-3 py-1.5 font-semibold text-ui-text hover:bg-ui-raised'>Next</Link> : null}
                    </div>
                </nav>
            </DashboardPanel> : <DashboardPanel className='border-ui-border bg-ui-panel p-6'><div className='mx-auto max-w-xl text-center'><div className='mx-auto grid h-12 w-12 place-items-center rounded-full bg-ui-primary/10 text-ui-primary'><PlayCircle className='h-6 w-6' /></div><h2 className='mt-4 text-lg font-semibold text-ui-text'>{runUnavailable ? 'Run history is unavailable' : 'No collection history yet'}</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>{runUnavailable ? 'Retry when the collection service is available.' : sources.length ? 'The collector is configured, but no completed or active run has been recorded for the global source fleet yet.' : 'Add an executable source first. Collection history starts after the first source run.'}</p><div className='mt-4 flex justify-center gap-2'><Link href='/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas'>Open source inventory <ArrowRight className='h-4 w-4' /></Link></div></div></DashboardPanel>}

            <div className='grid gap-4 xl:grid-cols-[1fr_0.9fr]'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>{attentionRuns.length ? 'Runs needing attention' : runs.length ? 'No runs need attention' : 'No run history to assess'}</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{attentionRuns.length ? 'Failures, long-running jobs, and overdue next checks stay in the live attention stream.' : runs.length ? 'Recorded runs are completing without a failure or overdue check.' : 'A missing run record is not evidence that all systems are operational.'}</p>
                        </div>
                        {attentionRuns.length ? (
                            <AlertTriangle className='h-4 w-4 text-ui-warning' />
                        ) : (
                            <span className='grid h-7 w-7 place-items-center rounded-full bg-ui-success/15 text-ui-success'>
                                <CheckCircle2 className='h-4 w-4' />
                            </span>
                        )}
                    </div>
                    {attentionRuns.length ? (
                        <div className='mt-4 grid gap-2'>
                            {attentionRuns.map(run => (
                                <Link key={run.id} href={run.sourceId ? `/ti/sources/${run.sourceId}` : '/ti/sources'} className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-ui-primary/35'>
                                    <div>
                                        <p className='font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                                        <p className='mt-1 text-sm text-ui-muted'>{run.sourceName} · {run.status}{run.nextRunAt ? ` · next ${relativeUntil(run.nextRunAt)}` : ''}</p>
                                    </div>
                                    <span className='inline-flex items-center gap-1 text-sm font-semibold text-ui-primary'>Open source <ArrowRight className='h-3.5 w-3.5' /></span>
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </DashboardPanel>

                <details data-ti-runs-evidence-disclosure className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                    <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 [&::-webkit-details-marker]:hidden'>
                        <span>
                            <span className='block text-base font-semibold text-ui-text'>Evidence by source</span>
                            <span className='mt-1 block text-sm text-ui-muted'>Collectors producing usable captures.</span>
                        </span>
                        <span className='inline-flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                            {captureTotal} captures · {screenshotTotal} screenshots
                            <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                        </span>
                    </summary>
                    <div className='grid gap-3 border-t border-ui-border p-4'>
                        {sources.map(source => {
                            const sourceRuns = runs.filter(run => run.sourceId === source.id)
                            const sourceCaptures = source.retainedEvidenceCount
                            const sourceScreenshots = sourceRuns.reduce((sum, run) => sum + run.screenshots, 0)
                            return (
                                <div key={source.id} className='rounded-md border border-ui-border bg-ui-canvas p-3'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <p className='truncate text-sm font-semibold text-ui-text'>{source.name}</p>
                                        <span className='text-sm font-semibold text-ui-primary'>{sourceCaptures}</span>
                                    </div>
                                    <p className='mt-1 text-xs text-ui-muted'>{sourceScreenshots} screenshots in bounded sample · {sourceRuns.length} sampled runs</p>
                                    <div className='mt-3 h-2 overflow-hidden rounded-full bg-ui-raised'>
                                        <div className='h-full rounded-full bg-ui-primary' style={{ width: `${Math.min(100, Math.max(sourceCaptures ? 8 : 0, sourceCaptures / Math.max(captureTotal, 1) * 100))}%` }} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </details>
            </div>
        </DashboardPage>
    )
}

function value(input: string | string[] | undefined) { return Array.isArray(input) ? input[0] : input }

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

function LiveRunCard({ title, run, sourceName }: { title: string, run?: TiAdminOverview['runs'][number], sourceName?: string }) {
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
                <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{sourceName || (run ? 'Unknown source' : 'No active collection')}</p>
                <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{run?.message || 'No collector run is currently recorded.'}</p>
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
    const base = 'inline-flex w-fit self-start whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold capitalize leading-5'
    if (status === 'completed') return `${base} border-ui-success/35 bg-ui-success/10 text-ui-success`
    if (status === 'failed') return `${base} border-ui-danger/35 bg-ui-danger/10 text-ui-danger`
    return `${base} border-ui-border bg-ui-panel text-ui-primary`
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
    if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))} hrs overdue`
    if (minutes < 0) return `${Math.abs(minutes)} min overdue`
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}

function isOverdue(value: string) {
    return new Date(value).getTime() < Date.now()
}
