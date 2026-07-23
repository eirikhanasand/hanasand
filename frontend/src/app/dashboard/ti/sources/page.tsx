import Link from 'next/link'
import { AlertTriangle, ArrowRight, Bot, Camera, CheckCircle2, ChevronDown, Clock3, ExternalLink, PauseCircle, ShieldAlert } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, type TiAdminSource } from '@/utils/tiAdmin/ops'
import TiDataAvailability from '../ti-data-availability'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiSourcesPage(props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await props.searchParams
    const cursor = Math.max(0, Number(typeof params?.cursor === 'string' ? params.cursor : 0) || 0)
    const overview = await getTiAdminOverview('default', { cursor, limit: 100 })
    const { sources, captures, runs } = overview
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

    const activeCount = overview.sourceTotals.active
    const staleCount = sourceRows.filter(row => row.health.state === 'stale').length
    const reviewCount = sources.filter(source => source.aiReview?.status === 'needs_human' || source.status === 'candidate' || source.status === 'review').length
    const aiReviewedCount = sources.filter(source => source.aiReview).length
    const restrictedCount = sources.filter(source => source.risk === 'restricted').length
    const qualifyingCount = overview.sourceTotals.qualifying
    const qualifyingClearWeb = overview.sourceTotals.qualifyingClearWeb
    const qualifyingDarkWeb = overview.sourceTotals.qualifyingLawfulDarkWeb
    const qualifyingTelegram = overview.sourceTotals.qualifyingPublicTelegram
    const nextDue = sourceRows.filter(row => Number.isFinite(Date.parse(row.source.nextRunAt)))
        .sort((a, b) => Date.parse(a.source.nextRunAt) - Date.parse(b.source.nextRunAt))[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Source inventory'
                description='Operate collection sources, review findings, and keep stale feeds moving.'
                actions={<ManualRunButton label='Run all sources' />}
            />
            <TiDataAvailability availability={overview.availability} />

            <details className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-ti-source-inventory-summary-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span className='inline-flex items-center gap-2'>
                        <Bot className='h-4 w-4 text-ui-primary' />
                        Source inventory summary
                    </span>
                    <span className='inline-flex items-center gap-2 text-xs font-medium text-ui-muted'>
                        {activeCount}/{overview.sourcePage.total} active · {reviewCount} in review on this page · {staleCount} stale on this page
                        <ChevronDown className='h-4 w-4 transition group-open:rotate-180' />
                    </span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3 sm:grid-cols-2 xl:grid-cols-6' data-ti-source-inventory-metrics>
                    <Metric title='Active' value={`${activeCount}/${overview.sourcePage.total}`} detail='collecting sources' tone='ok' />
                    <Metric title='Qualified' value={`${qualifyingCount}/6,100`} detail={`${qualifyingClearWeb}/5,000 web · ${qualifyingDarkWeb}/1,000 Tor · ${qualifyingTelegram}/100 Telegram`} tone={qualifyingCount >= 6100 && qualifyingClearWeb >= 5000 && qualifyingDarkWeb >= 1000 && qualifyingTelegram >= 100 ? 'ok' : 'warn'} />
                    <Metric title='Reviewed' value={String(aiReviewedCount)} detail={reviewCount ? `${reviewCount} in review` : 'ready for monitoring'} tone={reviewCount ? 'warn' : 'ok'} />
                    <Metric title='Stale' value={String(staleCount)} detail='late or not collecting' tone={staleCount ? 'warn' : 'ok'} />
                    <Metric title='Sensitive' value={String(restrictedCount)} detail='safe-field sources' tone='hold' />
                    <Metric title='Due next' value={nextDue ? shortTime(nextDue.source.nextRunAt) : 'Listening'} detail={nextDue?.source.name || 'waiting for the next source check'} tone='hold' />
                </div>
            </details>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='grid border-b border-ui-border bg-ui-panel px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Source health</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Stale and review-heavy sources float to the top.</p>
                    </div>
                    <div className='mt-3 flex flex-wrap gap-2 lg:mt-0'>
                        <QueuePill label='Stale' count={staleCount} />
                        <QueuePill label='Reviewed' count={aiReviewedCount} />
                        <QueuePill label='Runs' count={runs.length} />
                    </div>
                </div>

                <div className='grid gap-3 p-3 lg:hidden'>
                    {sourceRows.map(row => (
                        <Link key={row.source.id} href={`/dashboard/ti/sources/${row.source.id}`} className='rounded-md border border-ui-border bg-ui-canvas p-3 text-left shadow-sm'>
                            <div className='flex items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <p className='line-clamp-2 text-sm font-semibold leading-5 text-ui-text'>{row.source.name}</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{row.source.family.replaceAll('_', ' ')}</p>
                                </div>
                                <HealthBadge state={row.health.state} label={row.health.label} />
                            </div>
                            <div className='mt-3 grid grid-cols-2 gap-2 text-xs'>
                                <MobileFact label='Last content' value={relativeAge(row.source.lastContentAt)} />
                                <MobileFact label='Due' value={relativeUntil(row.source.nextRunAt)} />
                                <MobileFact label='Productive' value={`${row.source.productiveCycleCount} cycles`} />
                                <MobileFact label='Risk' value={row.source.risk} />
                            </div>
                            <div className='mt-3 flex flex-wrap gap-1.5'>
                                <span className={statusClass(row.source.status, row.source.aiReview)}>{statusLabel(row.source)}</span>
                                <span className={riskClass(row.source.risk)}>{row.source.risk}</span>
                                {row.source.aiReview ? <span className='inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[10px] font-semibold text-ui-primary'><Bot className='h-3 w-3' /> {row.source.aiReview.qualityScore}% QA</span> : null}
                            </div>
                            <p className='mt-3 line-clamp-2 text-xs leading-5 text-ui-muted'>{row.source.aiReview?.summary || row.source.buyerValue}</p>
                        </Link>
                    ))}
                </div>

                <div className='hidden overflow-x-auto lg:block'>
                    <div className='min-w-[86rem]'>
                        <div className='grid grid-cols-[1.45fr_0.72fr_0.72fr_0.7fr_0.62fr_0.9fr_0.72fr_0.82fr] gap-2 border-b border-ui-border bg-ui-canvas px-4 py-2 text-[11px] font-semibold uppercase text-ui-muted'>
                            <span>Source</span>
                            <span>Status</span>
                            <span>Findings</span>
                            <span>Last content</span>
                            <span>Due</span>
                            <span>Matches</span>
                            <span>Risk</span>
                            <span>Actions</span>
                        </div>

                        {sourceRows.map(row => (
                            <div key={row.source.id} className='grid grid-cols-[1.45fr_0.72fr_0.72fr_0.7fr_0.62fr_0.9fr_0.72fr_0.82fr] gap-2 border-b border-ui-border px-4 py-2 text-sm last:border-b-0 hover:bg-ui-panel'>
                                <div className='min-w-0'>
                                    <Link href={`/dashboard/ti/sources/${row.source.id}`} className='line-clamp-1 font-semibold text-ui-text hover:text-ui-primary'>{row.source.name}</Link>
                                    <div className='mt-1 flex flex-wrap gap-1'>
                                        <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[10px] font-semibold text-ui-primary'>{row.source.family.replaceAll('_', ' ')}</span>
                                        <span className={statusClass(row.source.status, row.source.aiReview)}>{statusLabel(row.source)}</span>
                                        {row.source.aiReview ? <span className='inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[10px] font-semibold text-ui-primary'><Bot className='h-3 w-3' /> {row.source.aiReview.qualityScore}% QA</span> : null}
                                    </div>
                                </div>
                                <div className='min-w-0'>
                                    <HealthBadge state={row.health.state} label={row.health.label} />
                                    <p className='mt-1 line-clamp-1 text-xs text-ui-muted'>{row.health.detail}</p>
                                </div>
                                <div className='text-ui-text'>
                                    <p className='font-semibold'>{row.source.productiveCycleCount} productive</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{row.source.retainedEvidenceCount} retained · {row.source.qualifiesForBaseline ? 'qualifies' : row.source.qualificationReasons[0]?.replaceAll('_', ' ') || 'not qualified'}</p>
                                </div>
                                <div>
                                    <p className='font-semibold text-ui-text'>{relativeAge(row.source.lastContentAt)}</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{formatTiDate(row.source.lastContentAt)}</p>
                                </div>
                                <div>
                                    <p className='font-semibold text-ui-text'>{relativeUntil(row.source.nextRunAt)}</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{shortTime(row.source.nextRunAt)}</p>
                                </div>
                                <div className='min-w-0'>
                                    <p className='truncate font-mono text-xs text-ui-text'>{row.source.domains.slice(0, 2).join(', ')}</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{row.source.resultTypes.length} result types</p>
                                </div>
                                <div className='min-w-0'>
                                    <p className={riskClass(row.source.risk)}>{row.source.risk}</p>
                                    <p className='mt-1 line-clamp-1 text-xs text-ui-muted'>{riskDetail(row.source)}</p>
                                </div>
                                <div className='flex flex-wrap gap-1.5'>
                                    <ManualRunButton sourceId={row.source.id} label='Run' queries={row.source.domains.filter(domain => !domain.includes('only'))} />
                                    <Link href={`/dashboard/ti/sources/${row.source.id}`} className='inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                                        Open
                                        <ArrowRight className='h-3.5 w-3.5' />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DashboardPanel>

            <nav className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm' aria-label='Source inventory pages'>
                <span className='text-ui-muted'>
                    {overview.sourcePage.total ? `${cursor + 1}–${Math.min(cursor + sources.length, overview.sourcePage.total)} of ${overview.sourcePage.total}` : 'No sources recorded'}
                </span>
                <div className='flex gap-2'>
                    {cursor > 0 ? <Link href={`/dashboard/ti/sources?cursor=${Math.max(0, cursor - overview.sourcePage.limit)}`} className='rounded-md border border-ui-border px-3 py-1.5 font-semibold text-ui-text hover:bg-ui-raised'>Previous</Link> : null}
                    {overview.sourcePage.nextCursor ? <Link href={`/dashboard/ti/sources?cursor=${overview.sourcePage.nextCursor}`} className='rounded-md border border-ui-border px-3 py-1.5 font-semibold text-ui-text hover:bg-ui-raised'>Next</Link> : null}
                </div>
            </nav>

            <div className='grid gap-4 xl:grid-cols-[1.05fr_0.95fr]'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Sources to review</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Check sensitive or stale sources before adding more collection volume.</p>
                        </div>
                        <AlertTriangle className='h-4 w-4 text-ui-warning' />
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {sourceRows.filter(row => row.health.state !== 'healthy' || row.source.aiReview?.status === 'needs_human').map(row => (
                            <Link key={row.source.id} href={`/dashboard/ti/sources/${row.source.id}`} className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-ui-primary/35'>
                                <div>
                                    <p className='font-semibold text-ui-text'>{row.source.name}</p>
                                    <p className='mt-1 text-sm text-ui-muted'>{row.health.label} · {statusLabel(row.source)} · {row.source.owner}</p>
                                </div>
                                <span className='inline-flex items-center gap-1 text-sm font-semibold text-ui-primary'>Open <ExternalLink className='h-3.5 w-3.5' /></span>
                            </Link>
                        ))}
                        {!sourceRows.some(row => row.health.state !== 'healthy' || row.source.aiReview?.status === 'needs_human') && (
                            <div className='rounded-md border border-dashed border-ui-border bg-ui-canvas p-4 text-sm text-ui-muted'>No sources need review right now. Stale, failed, and review-tagged sources appear here.</div>
                        )}
                    </div>
                </DashboardPanel>

                <details className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-ti-source-capture-coverage-disclosure>
                    <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised [&::-webkit-details-marker]:hidden'>
                        <span className='inline-flex items-center gap-2'><Camera className='h-4 w-4 text-ui-primary' /> Capture coverage</span>
                        <span className='inline-flex items-center gap-2 text-xs font-medium text-ui-muted'>
                            Bounded recent sample · {overview.sourceTotals.active} active sources
                            <ChevronDown className='h-4 w-4 transition group-open:rotate-180' />
                        </span>
                    </summary>
                    <div className='grid gap-3 border-t border-ui-border p-4' data-ti-source-capture-coverage>
                        {sourceRows.map(row => (
                            <div key={row.source.id} className='rounded-md border border-ui-border bg-ui-canvas p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <p className='truncate text-sm font-semibold text-ui-text'>{row.source.name}</p>
                                    <span className='text-sm font-semibold text-ui-primary'>{row.source.retainedEvidenceCount}</span>
                                </div>
                                <div className='mt-3 h-2 overflow-hidden rounded-full bg-ui-raised'>
                                    <div className='h-full rounded-full bg-ui-primary' style={{ width: `${Math.min(100, Math.max(row.source.retainedEvidenceCount ? 8 : 0, row.source.retainedEvidenceCount * 18))}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
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

function QueuePill({ label, count }: { label: string, count: number }) {
    return <span className='rounded-full border border-ui-border bg-ui-panel px-3 py-1 text-xs font-semibold text-ui-text'>{label}: {count}</span>
}

function MobileFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas px-2.5 py-2'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 truncate text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function HealthBadge({ state, label }: { state: SourceHealth['state'], label: string }) {
    const Icon = state === 'healthy' ? CheckCircle2 : state === 'stale' ? AlertTriangle : state === 'paused' ? PauseCircle : ShieldAlert
    const className = state === 'healthy'
        ? 'border border-ui-success/35 bg-ui-success/10 text-ui-success'
        : state === 'stale'
            ? 'border border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : state === 'paused'
                ? 'border border-ui-border bg-ui-panel text-ui-muted'
                : 'border border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
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
    if (source.aiReview?.status === 'needs_human') return { state: 'review', label: 'Human review', detail: source.aiReview.summary }
    if (source.status === 'candidate' || source.status === 'review') return { state: 'review', label: 'Review', detail: 'Needs approval or access check.' }
    if (!source.lastRunAt) return { state: 'review', label: 'Not observed', detail: 'No source check has been recorded.' }
    if (minutesSinceRun > source.cadenceMinutes * 2) return { state: 'stale', label: 'Stale', detail: `${Math.round(minutesSinceRun / 60)} hr since run.` }
    return { state: 'healthy', label: 'Healthy', detail: 'Running on schedule.' }
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
    if (!Number.isFinite(minutes)) return 'not recorded'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}

function relativeUntil(value: string) {
    const diff = new Date(value).getTime() - Date.now()
    if (!Number.isFinite(diff)) return 'not recorded'
    const minutes = Math.round(diff / 60000)
    if (minutes < -60) return `${Math.abs(Math.round(minutes / 60))} hr overdue`
    if (minutes < 0) return `${Math.abs(minutes)} min overdue`
    if (minutes < 60) return `${minutes} min`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr`
    return `${Math.round(hours / 24)} d`
}

function shortTime(value: string) {
    if (!Number.isFinite(Date.parse(value))) return 'not recorded'
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

function statusLabel(source: TiAdminSource) {
    if (source.aiReview?.status === 'approved') return 'AI approved'
    if (source.aiReview?.status === 'monitoring') return 'AI monitoring'
    if (source.aiReview?.status === 'needs_human') return 'human review'
    return source.status
}

function statusClass(status: TiAdminSource['status'], aiReview?: TiAdminSource['aiReview']) {
    if (aiReview?.status === 'approved') return 'rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[10px] font-semibold text-ui-primary'
    if (aiReview?.status === 'monitoring') return 'rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[10px] font-semibold text-ui-muted'
    if (status === 'active') return 'rounded-full border border-ui-success/35 bg-ui-success/10 px-2 py-0.5 text-[10px] font-semibold text-ui-success'
    if (status === 'paused') return 'rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-[10px] font-semibold text-ui-muted'
    return 'rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-[10px] font-semibold text-ui-warning'
}

function riskClass(risk: TiAdminSource['risk']) {
    if (risk === 'restricted') return 'w-fit rounded-full border border-ui-danger/35 bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold text-ui-danger'
    if (risk === 'medium') return 'w-fit rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning'
    return 'w-fit rounded-full border border-ui-success/35 bg-ui-success/10 px-2 py-0.5 text-xs font-semibold text-ui-success'
}

function riskDetail(source: TiAdminSource) {
    if (source.risk === 'restricted') return 'safe fields'
    if (source.risk === 'medium') return 'watch closely'
    return source.aiReview?.status === 'approved' ? 'approved' : 'normal'
}
