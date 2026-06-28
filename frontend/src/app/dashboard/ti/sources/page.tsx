import Link from 'next/link'
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, Clock3, ExternalLink, PauseCircle, ShieldAlert } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, type TiAdminSource } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default function TiSourcesPage() {
    const { sources, captures, runs } = getTiAdminOverview()
    const sourceRows = sources.map(source => {
        const sourceCaptures = captures.filter(capture => capture.sourceId === source.id)
        const sourceRuns = runs.filter(run => run.sourceId === source.id)
        const lastRun = [...sourceRuns].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
        const avgRows = sourceRuns.length ? Math.round(sourceRuns.reduce((sum, run) => sum + run.rows, 0) / sourceRuns.length) : 0
        const avgCaptures = sourceRuns.length ? Math.round(sourceRuns.reduce((sum, run) => sum + run.captures, 0) / sourceRuns.length) : 0
        const minutesSinceRun = minutesSince(source.lastRunAt)
        const health = sourceHealth(source, minutesSinceRun)
        return { source, sourceCaptures, sourceRuns, lastRun, avgRows, avgCaptures, minutesSinceRun, health }
    }).sort((a, b) => healthWeight(b.health.state) - healthWeight(a.health.state) || new Date(a.source.nextRunAt).getTime() - new Date(b.source.nextRunAt).getTime())

    const activeCount = sources.filter(source => source.status === 'active').length
    const staleCount = sourceRows.filter(row => row.health.state === 'stale').length
    const reviewCount = sources.filter(source => source.status === 'candidate' || source.status === 'review').length
    const restrictedCount = sources.filter(source => source.risk === 'restricted').length
    const nextDue = [...sourceRows].sort((a, b) => new Date(a.source.nextRunAt).getTime() - new Date(b.source.nextRunAt).getTime())[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Source inventory'
                description='Monitor source health, cadence, activity, ownership, last update, and review state.'
                actions={<ManualRunButton label='Run all sources' />}
            />

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Active' value={`${activeCount}/${sources.length}`} detail='collecting sources' tone='ok' />
                <Metric title='Needs review' value={String(reviewCount)} detail='candidate or review state' tone={reviewCount ? 'warn' : 'ok'} />
                <Metric title='Stale' value={String(staleCount)} detail='past expected cadence' tone={staleCount ? 'warn' : 'ok'} />
                <Metric title='Restricted' value={String(restrictedCount)} detail='metadata-only boundary' tone='hold' />
                <Metric title='Next due' value={nextDue ? shortTime(nextDue.source.nextRunAt) : 'none'} detail={nextDue?.source.name || 'no scheduled source'} tone='hold' />
            </div>

            <DashboardPanel className='overflow-hidden p-0'>
                <div className='grid border-b border-[#e8edf5] bg-[#f8fafc] px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center'>
                    <div>
                        <h2 className='text-base font-semibold text-[#171a21]'>Triage queue</h2>
                        <p className='mt-1 text-sm text-[#596170]'>Sources sorted by stale state, review need, and next scheduled run.</p>
                    </div>
                    <div className='mt-3 flex flex-wrap gap-2 lg:mt-0'>
                        <QueuePill label='Stale first' count={staleCount} />
                        <QueuePill label='Review' count={reviewCount} />
                        <QueuePill label='Runs visible' count={runs.length} />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <div className='min-w-[86rem]'>
                        <div className='grid grid-cols-[1.3fr_0.8fr_0.75fr_0.8fr_0.75fr_0.7fr_1fr_1fr_0.95fr] gap-3 border-b border-[#e8edf5] bg-white px-4 py-2 text-xs font-semibold uppercase text-[#667085]'>
                            <span>Source</span>
                            <span>Health</span>
                            <span>Typical activity</span>
                            <span>Last update</span>
                            <span>Next run</span>
                            <span>Cadence</span>
                            <span>Scope</span>
                            <span>Boundary</span>
                            <span>Actions</span>
                        </div>

                        {sourceRows.map(row => (
                            <div key={row.source.id} className='grid grid-cols-[1.3fr_0.8fr_0.75fr_0.8fr_0.75fr_0.7fr_1fr_1fr_0.95fr] gap-3 border-b border-[#eef1f5] px-4 py-3 text-sm last:border-b-0 hover:bg-[#fbfcfe]'>
                                <div className='min-w-0'>
                                    <Link href={`/dashboard/ti/sources/${row.source.id}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{row.source.name}</Link>
                                    <div className='mt-1 flex flex-wrap gap-1.5'>
                                        <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-[11px] font-semibold text-[#3056d3]'>{row.source.family.replaceAll('_', ' ')}</span>
                                        <span className={statusClass(row.source.status)}>{row.source.status}</span>
                                    </div>
                                </div>
                                <div>
                                    <HealthBadge state={row.health.state} label={row.health.label} />
                                    <p className='mt-1 text-xs text-[#667085]'>{row.health.detail}</p>
                                </div>
                                <div className='text-[#344054]'>
                                    <p className='font-semibold'>{row.avgRows} rows/run</p>
                                    <p className='mt-1 text-xs text-[#667085]'>{row.avgCaptures} captures/run · {row.sourceCaptures.length} stored</p>
                                </div>
                                <div>
                                    <p className='font-semibold text-[#171a21]'>{relativeAge(row.source.lastRunAt)}</p>
                                    <p className='mt-1 text-xs text-[#667085]'>{formatTiDate(row.source.lastRunAt)}</p>
                                </div>
                                <div>
                                    <p className='font-semibold text-[#171a21]'>{relativeUntil(row.source.nextRunAt)}</p>
                                    <p className='mt-1 text-xs text-[#667085]'>{shortTime(row.source.nextRunAt)}</p>
                                </div>
                                <div className='font-semibold text-[#344054]'>{cadenceLabel(row.source.cadenceMinutes)}</div>
                                <div className='min-w-0'>
                                    <p className='truncate font-mono text-xs text-[#344054]'>{row.source.domains.slice(0, 2).join(', ')}</p>
                                    <p className='mt-1 text-xs text-[#667085]'>{row.source.resultTypes.length} result types</p>
                                </div>
                                <div>
                                    <p className={riskClass(row.source.risk)}>{row.source.risk}</p>
                                    <p className='mt-1 line-clamp-2 text-xs text-[#667085]'>{row.source.legalNotes}</p>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                    <ManualRunButton sourceId={row.source.id} label='Run' queries={row.source.domains.filter(domain => !domain.includes('only'))} />
                                    <Link href={`/dashboard/ti/sources/${row.source.id}`} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                                        Open
                                        <ArrowRight className='h-3.5 w-3.5' />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1.05fr_0.95fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Sources needing action</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Review these before adding more collection volume.</p>
                        </div>
                        <AlertTriangle className='h-4 w-4 text-[#b45309]' />
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {sourceRows.filter(row => row.health.state !== 'healthy' || row.source.status !== 'active').map(row => (
                            <Link key={row.source.id} href={`/dashboard/ti/sources/${row.source.id}`} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-[#b8c5ff]'>
                                <div>
                                    <p className='font-semibold text-[#171a21]'>{row.source.name}</p>
                                    <p className='mt-1 text-sm text-[#596170]'>{row.health.label} · {row.source.status} · {row.source.owner}</p>
                                </div>
                                <span className='inline-flex items-center gap-1 text-sm font-semibold text-[#3056d3]'>Open <ExternalLink className='h-3.5 w-3.5' /></span>
                            </Link>
                        ))}
                        {!sourceRows.some(row => row.health.state !== 'healthy' || row.source.status !== 'active') && (
                            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-4 text-sm text-[#596170]'>No source needs action.</div>
                        )}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Capture coverage</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Stored visual evidence by source.</p>
                        </div>
                        <Camera className='h-4 w-4 text-[#3056d3]' />
                    </div>
                    <div className='mt-4 grid gap-3'>
                        {sourceRows.map(row => (
                            <div key={row.source.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <p className='truncate text-sm font-semibold text-[#171a21]'>{row.source.name}</p>
                                    <span className='text-sm font-semibold text-[#3056d3]'>{row.sourceCaptures.length}</span>
                                </div>
                                <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#e9edf4]'>
                                    <div className='h-full rounded-full bg-[#3056d3]' style={{ width: `${Math.min(100, Math.max(row.sourceCaptures.length ? 8 : 0, row.sourceCaptures.length * 18))}%` }} />
                                </div>
                            </div>
                        ))}
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
    return <span className='rounded-full border border-[#d8dee9] bg-white px-3 py-1 text-xs font-semibold text-[#344054]'>{label}: {count}</span>
}

function HealthBadge({ state, label }: { state: SourceHealth['state'], label: string }) {
    const Icon = state === 'healthy' ? CheckCircle2 : state === 'stale' ? AlertTriangle : state === 'paused' ? PauseCircle : ShieldAlert
    const className = state === 'healthy'
        ? 'bg-[#f4fbf7] text-[#147a3b]'
        : state === 'stale'
            ? 'bg-[#fff7ed] text-[#b45309]'
            : state === 'paused'
                ? 'bg-[#f4f7ff] text-[#475467]'
                : 'bg-[#fff0eb] text-[#c2410c]'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
            <Icon className='h-3.5 w-3.5' />
            {label}
        </span>
    )
}

type SourceHealth = {
    state: 'healthy' | 'stale' | 'paused' | 'review'
    label: string
    detail: string
}

function sourceHealth(source: TiAdminSource, minutesSinceRun: number): SourceHealth {
    if (source.status === 'paused') return { state: 'paused', label: 'Paused', detail: 'Collection disabled.' }
    if (source.status === 'candidate' || source.status === 'review') return { state: 'review', label: 'Review', detail: 'Needs approval or access check.' }
    if (minutesSinceRun > source.cadenceMinutes * 2) return { state: 'stale', label: 'Stale', detail: `${Math.round(minutesSinceRun / 60)} hr since run.` }
    return { state: 'healthy', label: 'Healthy', detail: 'Within expected cadence.' }
}

function healthWeight(state: SourceHealth['state']) {
    if (state === 'stale') return 4
    if (state === 'review') return 3
    if (state === 'paused') return 2
    return 1
}

function minutesSince(value: string) {
    const parsed = new Date(value).getTime()
    if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
    return Math.max(0, Math.round((Date.now() - parsed) / 60000))
}

function relativeAge(value: string) {
    const minutes = minutesSince(value)
    if (!Number.isFinite(minutes)) return 'unknown'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
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

function shortTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

function cadenceLabel(minutes: number) {
    if (minutes < 60) return `${minutes} min`
    const hours = minutes / 60
    if (hours < 24) return `${Math.round(hours)} hr`
    return `${Math.round(hours / 24)} d`
}

function statusClass(status: TiAdminSource['status']) {
    if (status === 'active') return 'rounded-full bg-[#f4fbf7] px-2 py-0.5 text-[11px] font-semibold text-[#147a3b]'
    if (status === 'paused') return 'rounded-full bg-[#f4f7ff] px-2 py-0.5 text-[11px] font-semibold text-[#475467]'
    return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#b45309]'
}

function riskClass(risk: TiAdminSource['risk']) {
    if (risk === 'restricted') return 'w-fit rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold text-[#c2410c]'
    if (risk === 'medium') return 'w-fit rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]'
    return 'w-fit rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]'
}
