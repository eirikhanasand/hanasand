import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Rows3 } from 'lucide-react'
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
                description='Track job state, output, source coverage, next checks, and failures.'
                actions={<ManualRunButton label='Start manual run' queries={runQueries} />}
            />

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Running' value={String(running)} detail='queued or active' tone={running ? 'hold' : 'ok'} />
                <Metric title='Completed' value={String(completed)} detail='successful jobs' tone='ok' />
                <Metric title='Failed' value={String(failed)} detail='needs retry' tone={failed ? 'warn' : 'ok'} />
                <Metric title='Evidence' value={`${captureTotal} captures`} detail={`${screenshotTotal} screenshots · ${rowTotal} parsed rows`} tone='hold' />
                <Metric title='Next run' value={nextRun ? relativeUntil(nextRun.nextRunAt) : 'none'} detail={nextRun ? sourceById(nextRun.sourceId)?.name || nextRun.sourceId : 'no schedule'} tone='hold' />
            </div>

            <DashboardPanel className='overflow-hidden p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf5] bg-[#f8fafc] px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-[#171a21]'>Run queue</h2>
                        <p className='mt-1 text-sm text-[#596170]'>Newest jobs first. Open the source to review cadence, boundaries, and captured evidence.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <QueuePill label='Captures' count={captureTotal} />
                        <QueuePill label='Screenshots' count={screenshotTotal} />
                        <QueuePill label='Rows' count={rowTotal} />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <div className='min-w-[78rem]'>
                        <div className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 bg-white px-4 py-2 text-xs font-semibold uppercase text-[#667085]'>
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
                                <div key={run.id} className='grid grid-cols-[1.15fr_1.25fr_0.7fr_0.75fr_0.75fr_0.75fr_0.9fr_0.85fr] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm hover:bg-[#fbfcfe]'>
                                    <div className='min-w-0'>
                                        <p className='truncate font-mono text-xs font-semibold text-[#171a21]'>{run.id}</p>
                                        <p className='mt-1 line-clamp-1 text-xs text-[#667085]'>{run.message}</p>
                                    </div>
                                    <Link href={`/dashboard/ti/sources/${run.sourceId}`} className='min-w-0 font-semibold text-[#344054] hover:text-[#3056d3]'>
                                        <span className='block truncate'>{source?.name || run.sourceId}</span>
                                        <span className='mt-1 block truncate text-xs font-normal text-[#667085]'>{source?.family.replaceAll('_', ' ') || 'unknown family'}</span>
                                    </Link>
                                    <span className={statusClass(run.status)}>{run.status}</span>
                                    <span className='text-[#596170]'>{shortDate(run.startedAt)}</span>
                                    <span className='font-semibold text-[#171a21]'>{durationLabel(run.startedAt, run.finishedAt)}</span>
                                    <span className='text-[#3056d3]'>{run.captures} cap · {run.screenshots} shots · {run.rows} rows</span>
                                    <span className='text-[#596170]'>{relativeUntil(run.nextRunAt)}</span>
                                    <Link href={`/dashboard/ti/sources/${run.sourceId}`} className='inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
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
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Runs needing attention</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Failures, long-running jobs, and overdue next checks land here.</p>
                        </div>
                        <AlertTriangle className='h-4 w-4 text-[#b45309]' />
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {orderedRuns.filter(run => run.status !== 'completed' || isOverdue(run.nextRunAt)).map(run => (
                            <Link key={run.id} href={`/dashboard/ti/sources/${run.sourceId}`} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-[#b8c5ff]'>
                                <div>
                                    <p className='font-mono text-xs font-semibold text-[#171a21]'>{run.id}</p>
                                    <p className='mt-1 text-sm text-[#596170]'>{sourceById(run.sourceId)?.name || run.sourceId} · {run.status} · next {relativeUntil(run.nextRunAt)}</p>
                                </div>
                                <span className='inline-flex items-center gap-1 text-sm font-semibold text-[#3056d3]'>Open source <ArrowRight className='h-3.5 w-3.5' /></span>
                            </Link>
                        ))}
                        {!orderedRuns.some(run => run.status !== 'completed' || isOverdue(run.nextRunAt)) && (
                            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-4 text-sm text-[#596170]'>No run needs attention.</div>
                        )}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Evidence by source</h2>
                    <p className='mt-1 text-sm text-[#596170]'>Shows which collectors are producing usable captures.</p>
                    <div className='mt-4 grid gap-3'>
                        {sources.map(source => {
                            const sourceRuns = runs.filter(run => run.sourceId === source.id)
                            const sourceCaptures = sourceRuns.reduce((sum, run) => sum + run.captures, 0)
                            const sourceScreenshots = sourceRuns.reduce((sum, run) => sum + run.screenshots, 0)
                            return (
                                <div key={source.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <p className='truncate text-sm font-semibold text-[#171a21]'>{source.name}</p>
                                        <span className='text-sm font-semibold text-[#3056d3]'>{sourceCaptures}</span>
                                    </div>
                                    <p className='mt-1 text-xs text-[#667085]'>{sourceScreenshots} screenshots · {sourceRuns.length} runs</p>
                                    <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#e9edf4]'>
                                        <div className='h-full rounded-full bg-[#3056d3]' style={{ width: `${Math.min(100, Math.max(sourceCaptures ? 8 : 0, sourceCaptures / Math.max(captureTotal, 1) * 100))}%` }} />
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
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-xl font-semibold text-[#171a21]'>{value}</p>
            <p className='mt-1 text-sm text-[#596170]'>{detail}</p>
        </DashboardPanel>
    )
}

function QueuePill({ label, count }: { label: string, count: number }) {
    return <span className='inline-flex items-center gap-1 rounded-full border border-[#d8dee9] bg-white px-3 py-1 text-xs font-semibold text-[#344054]'><Rows3 className='h-3.5 w-3.5' />{label}: {count}</span>
}

function statusClass(status: string) {
    if (status === 'completed') return 'w-fit rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold capitalize text-[#147a3b]'
    if (status === 'failed') return 'w-fit rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold capitalize text-[#c2410c]'
    return 'w-fit rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold capitalize text-[#3056d3]'
}

function durationLabel(startedAt: string, finishedAt?: string) {
    if (!finishedAt) return 'running'
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return 'unknown'
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
    if (!Number.isFinite(diff)) return 'unknown'
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
