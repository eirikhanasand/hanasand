import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Activity, AlertTriangle, ArrowLeft, Camera, CheckCircle2, Clock3, ExternalLink, Gauge, RadioTower, ShieldCheck, TimerReset } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { ageDays, formatTiDate, getTiAdminSource, sourceCaptures, sourceRuns, type TiAdminSource } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../../manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiSourceDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const source = getTiAdminSource(params.id)

    if (!source) return notFound()

    const captures = sourceCaptures(source.id)
    const runs = sourceRuns(source.id).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    const latestRun = runs[0]
    const avgRows = runs.length ? Math.round(runs.reduce((sum, run) => sum + run.rows, 0) / runs.length) : 0
    const avgCaptures = runs.length ? Math.round(runs.reduce((sum, run) => sum + run.captures, 0) / runs.length) : 0
    const health = sourceHealth(source)
    const completedRuns = runs.filter(run => run.status === 'completed').length
    const failedRuns = runs.filter(run => run.status === 'failed').length
    const successRate = runs.length ? Math.round((completedRuns / runs.length) * 100) : 0
    const runDuration = latestRun ? runDurationLabel(latestRun.startedAt, latestRun.finishedAt) : 'none'
    const freshness = sourceFreshness(source)
    const actionItems = sourceActionItems(source, runs, captures, health, freshness)
    const captureDomains = captureDomainCounts(captures)
    const activeDays = Math.max(1, ageDays(source.monitoredSince))
    const dailyRows = Math.round(source.usefulRows / activeDays)
    const dailyCaptures = Math.round((captures.length / activeDays) * 10) / 10

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence source'
                title={source.name}
                description={`${health.label}. Last update ${relativeAge(source.lastRunAt)}. Next run ${relativeUntil(source.nextRunAt)}.`}
                actions={<ManualRunButton sourceId={source.id} label='Run source now' queries={source.domains.filter(domain => !domain.includes('only'))} />}
            />

            <div className='flex'>
                <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                    <ArrowLeft className='h-4 w-4' />
                    Sources
                </Link>
            </div>

            <DashboardPanel className='overflow-hidden p-0'>
                <div className='grid gap-4 border-b border-[#e8edf5] bg-[#171a21] p-4 text-white xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
                    <div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <HealthBadge state={health.state} label={health.label} />
                            <span className='rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold capitalize'>{source.status}</span>
                            <span className='rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold'>{source.family.replaceAll('_', ' ')}</span>
                            <span className='rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold'>{source.risk}</span>
                        </div>
                        <div className='mt-4 grid gap-3 md:grid-cols-3'>
                            <DarkStat icon={<RadioTower className='h-4 w-4' />} label='State' value={freshness.stateLabel} detail={freshness.detail} tone={freshness.tone} />
                            <DarkStat icon={<Gauge className='h-4 w-4' />} label='Success' value={`${successRate}%`} detail={`${completedRuns}/${runs.length || 0} completed · ${failedRuns} failed`} tone={failedRuns ? 'warn' : 'ok'} />
                            <DarkStat icon={<TimerReset className='h-4 w-4' />} label='Last run' value={runDuration} detail={latestRun?.message || 'No run recorded'} tone='neutral' />
                        </div>
                    </div>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[42rem]'>
                        <TopStat label='Last update' value={relativeAge(source.lastRunAt)} />
                        <TopStat label='Next run' value={relativeUntil(source.nextRunAt)} />
                        <TopStat label='Cadence' value={cadenceLabel(source.cadenceMinutes)} />
                        <TopStat label='Typical' value={`${avgRows} rows/run`} />
                    </div>
                </div>

                <div className='grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]'>
                    <main className='grid gap-4 p-5'>
                        <section className='grid gap-3 md:grid-cols-4'>
                            <MiniMetric title='Runs' value={String(runs.length)} detail={latestRun ? latestRun.status : 'none'} />
                            <MiniMetric title='Captures' value={String(captures.length)} detail={`${avgCaptures} per run avg`} />
                            <MiniMetric title='Activity' value={`${dailyRows}/d`} detail={`${source.usefulRows.toLocaleString()} rows total`} />
                            <MiniMetric title='Evidence rate' value={`${dailyCaptures}/d`} detail={`${activeDays} d monitored`} />
                        </section>

                        <section className='grid gap-4 xl:grid-cols-[0.95fr_1.05fr]'>
                            <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                                <PanelHeader title='Action queue' detail={`${actionItems.length} open item${actionItems.length === 1 ? '' : 's'}`} icon={<AlertTriangle className='h-4 w-4 text-[#b45309]' />} />
                                <div className='grid gap-2 p-4'>
                                    {actionItems.map(item => (
                                        <div key={item.title} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                                <p className='font-semibold text-[#171a21]'>{item.title}</p>
                                                <span className={item.tone === 'bad' ? 'rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold text-[#c2410c]' : item.tone === 'warn' ? 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]' : 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'}>{item.owner}</span>
                                            </div>
                                            <p className='mt-1 text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className='rounded-lg border border-[#e0e5ed] bg-white'>
                                <PanelHeader title='Source activity' detail='Domains and capture yield' icon={<Activity className='h-4 w-4 text-[#3056d3]' />} />
                                <div className='grid gap-3 p-4'>
                                    {captureDomains.map(item => (
                                        <div key={item.domain} className='grid gap-3 rounded-lg border border-[#eef1f5] bg-[#fbfcfe] p-3 sm:grid-cols-[1fr_auto] sm:items-center'>
                                            <div className='min-w-0'>
                                                <Link href={`/dashboard/ti/domains/${encodeURIComponent(item.domain)}`} className='truncate font-mono text-sm font-semibold text-[#171a21] hover:text-[#3056d3]'>{item.domain}</Link>
                                                <p className='mt-1 text-xs text-[#667085]'>{item.actors.join(', ') || 'No actor label'}</p>
                                            </div>
                                            <div className='text-right'>
                                                <p className='text-sm font-semibold text-[#3056d3]'>{item.count} capture{item.count === 1 ? '' : 's'}</p>
                                                <p className='mt-1 text-xs text-[#667085]'>latest {relativeAge(item.lastCapturedAt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {!captureDomains.length && <p className='rounded-lg border border-dashed border-[#cfd8e6] p-4 text-sm text-[#667085]'>No captured domains yet.</p>}
                                </div>
                            </div>
                        </section>

                        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
                            <PanelHeader title='Run history' detail='Rows, captures, screenshots, duration, and next scheduled run' icon={<Clock3 className='h-4 w-4 text-[#3056d3]' />} />
                            <div className='overflow-x-auto'>
                                <div className='min-w-[48rem]'>
                                    <div className='grid grid-cols-[1.1fr_0.7fr_0.55fr_0.55fr_0.55fr_0.65fr_1fr] gap-3 bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase text-[#667085]'>
                                        <span>Run</span>
                                        <span>Status</span>
                                        <span>Rows</span>
                                        <span>Captures</span>
                                        <span>Screens</span>
                                        <span>Duration</span>
                                        <span>Started</span>
                                    </div>
                                    {runs.map(run => (
                                        <div key={run.id} className='grid grid-cols-[1.1fr_0.7fr_0.55fr_0.55fr_0.55fr_0.65fr_1fr] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm'>
                                            <div className='min-w-0'>
                                                <p className='truncate font-mono text-xs font-semibold text-[#171a21]'>{run.id}</p>
                                                <p className='mt-1 line-clamp-1 text-xs text-[#667085]'>{run.message}</p>
                                            </div>
                                            <span className={run.status === 'completed' ? 'w-fit rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold text-[#147a3b]' : 'w-fit rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'}>{run.status}</span>
                                            <span className='font-semibold text-[#171a21]'>{run.rows}</span>
                                            <span className='font-semibold text-[#171a21]'>{run.captures}</span>
                                            <span className='font-semibold text-[#171a21]'>{run.screenshots}</span>
                                            <span className='font-semibold text-[#344054]'>{runDurationLabel(run.startedAt, run.finishedAt)}</span>
                                            <span className='text-[#596170]'>{formatTiDate(run.startedAt)}</span>
                                        </div>
                                    ))}
                                    {!runs.length && <p className='border-t border-[#eef1f5] p-4 text-sm text-[#667085]'>No runs recorded for this source yet.</p>}
                                </div>
                            </div>
                        </section>

                        <section className='rounded-lg border border-[#e0e5ed] bg-white'>
                            <PanelHeader title='Capture review' detail='Safe screenshots, metadata, owner, and capture timing' icon={<Camera className='h-4 w-4 text-[#3056d3]' />} />
                            {captures.length > 0 && (
                                <div className='overflow-x-auto border-b border-[#eef1f5]'>
                                    <div className='min-w-[54rem]'>
                                        <div className='grid grid-cols-[1fr_0.75fr_0.75fr_0.85fr_0.85fr_0.8fr] gap-3 bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase text-[#667085]'>
                                            <span>Evidence</span>
                                            <span>Actor</span>
                                            <span>Domain</span>
                                            <span>Published</span>
                                            <span>Captured</span>
                                            <span>Owner</span>
                                        </div>
                                        {captures.map(capture => (
                                            <a key={capture.id} href={`#${capture.id}`} className='grid grid-cols-[1fr_0.75fr_0.75fr_0.85fr_0.85fr_0.8fr] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm hover:bg-[#fbfcfe]'>
                                                <span className='truncate font-semibold text-[#171a21]'>{capture.title}</span>
                                                <span className='truncate text-[#596170]'>{capture.actor}</span>
                                                <span className='truncate font-mono text-xs text-[#344054]'>{capture.domain}</span>
                                                <span className='text-[#596170]'>{relativeAge(capture.publishedAt)}</span>
                                                <span className='text-[#596170]'>{relativeAge(capture.capturedAt)}</span>
                                                <span className='font-semibold text-[#344054]'>{capture.owner}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className='grid gap-4 p-4'>
                                {captures.map(capture => (
                                    <article key={capture.id} id={capture.id} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 xl:grid-cols-[minmax(18rem,0.72fr)_1fr]'>
                                        <div className='overflow-hidden rounded-lg border border-[#243044] bg-[#0e1520]'>
                                            <div className='border-b border-white/10 px-3 py-2 text-xs text-[#9db4ff]'>{capture.screenshotLabel}</div>
                                            <div className='grid min-h-56 content-between p-4 text-white'>
                                                <div className='flex items-center justify-between gap-3'>
                                                    <span className='rounded-full bg-white/10 px-2 py-1 text-xs'>{capture.actor}</span>
                                                    <span className='text-xs text-[#c7d0df]'>{formatTiDate(capture.screenshotTakenAt)}</span>
                                                </div>
                                                <div>
                                                    <p className='text-xl font-semibold'>{capture.domain}</p>
                                                    <p className='mt-2 text-sm text-[#c7d0df]'>{capture.resultSummary}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='min-w-0'>
                                            <h3 className='text-base font-semibold text-[#171a21]'>{capture.title}</h3>
                                            <p className='mt-2 text-sm leading-6 text-[#596170]'>{capture.resultSummary}</p>
                                            <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                                                <Info label='Published' value={formatTiDate(capture.publishedAt)} />
                                                <Info label='Captured' value={formatTiDate(capture.capturedAt)} />
                                                <Info label='Page type' value={capture.pageType} />
                                                <Info label='Owner' value={capture.owner} />
                                            </div>
                                            <div className='mt-3 flex flex-wrap gap-2'>
                                                {capture.metadata.map(item => (
                                                    <span key={item.label} className='rounded-full border border-[#d8dee9] bg-white px-2.5 py-1 text-xs text-[#344054]'>{item.label}: {item.value}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                                {!captures.length && <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>This source has no screenshot captures yet.</p>}
                            </div>
                        </section>
                    </main>

                    <aside className='grid content-start gap-4 border-t border-[#e8edf5] bg-[#fbfcfe] p-5 xl:border-l xl:border-t-0'>
                        <SidePanel title='Collection boundary' icon={<ShieldCheck className='h-4 w-4' />}>
                            <p className='text-sm leading-6 text-[#596170]'>{source.legalNotes}</p>
                            <div className='mt-3 grid gap-2'>
                                <Info label='Risk' value={source.risk} />
                                <Info label='Access' value={source.accessMethod} />
                                <Info label='Type' value={source.type} />
                            </div>
                        </SidePanel>

                        <SidePanel title='Monitored scope' icon={<ExternalLink className='h-4 w-4' />}>
                            <div className='flex flex-wrap gap-2'>
                                {source.domains.map(domain => (
                                    <Link key={domain} href={`/dashboard/ti/domains/${encodeURIComponent(domain)}`} className='rounded-full border border-[#d8dee9] bg-white px-2.5 py-1 font-mono text-xs text-[#344054] hover:bg-[#f2f5f9]'>{domain}</Link>
                                ))}
                            </div>
                            <div className='mt-4 flex flex-wrap gap-2'>
                                {source.resultTypes.map(type => (
                                    <span key={type} className='rounded-full bg-[#eef3ff] px-2.5 py-1 font-mono text-xs text-[#3056d3]'>{type}</span>
                                ))}
                            </div>
                        </SidePanel>

                        <SidePanel title='Ownership' icon={<CheckCircle2 className='h-4 w-4' />}>
                            <div className='grid gap-2'>
                                <Info label='Owner' value={source.owner} />
                                <Info label='Source ref' value={source.url} />
                                <Info label='Next run' value={formatTiDate(source.nextRunAt)} />
                                <Info label='Monitored since' value={formatTiDate(source.monitoredSince)} />
                            </div>
                        </SidePanel>
                    </aside>
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function DarkStat({ icon, label, value, detail, tone }: { icon: React.ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'bad'
        ? 'text-[#ffb088]'
        : tone === 'warn'
            ? 'text-[#ffd38a]'
            : tone === 'ok'
                ? 'text-[#8ee4ad]'
                : 'text-[#d8deea]'
    return (
        <div className='rounded-lg border border-white/10 bg-white/6 p-3'>
            <div className='flex items-center gap-2 text-[#bdc9e6]'>
                {icon}
                <p className='text-[10px] font-semibold uppercase'>{label}</p>
            </div>
            <p className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#bdc9e6]'>{detail}</p>
        </div>
    )
}

function TopStat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-white/15 bg-white/8 px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-[#bdc9e6]'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-white'>{value}</p>
        </div>
    )
}

function MiniMetric({ title, value, detail }: { title: string, value: string, detail: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{title}</p>
            <p className='mt-2 text-lg font-semibold text-[#171a21]'>{value}</p>
            <p className='mt-1 text-xs text-[#667085]'>{detail}</p>
        </div>
    )
}

function SidePanel({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <section className='rounded-lg border border-[#e0e5ed] bg-white p-4'>
            <div className='mb-3 flex items-center justify-between gap-3 text-[#667085]'>
                <h2 className='text-sm font-semibold text-[#171a21]'>{title}</h2>
                {icon}
            </div>
            {children}
        </section>
    )
}

function PanelHeader({ title, detail, icon }: { title: string, detail: string, icon: React.ReactNode }) {
    return (
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#eef1f5] px-4 py-3'>
            <div>
                <h2 className='text-base font-semibold text-[#171a21]'>{title}</h2>
                <p className='mt-1 text-sm text-[#596170]'>{detail}</p>
            </div>
            {icon}
        </div>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}

type SourceHealth = {
    state: 'healthy' | 'stale' | 'paused' | 'review'
    label: string
}

type SourceFreshness = {
    stateLabel: string
    detail: string
    tone: 'ok' | 'warn' | 'bad' | 'neutral'
}

type SourceActionItem = {
    title: string
    detail: string
    owner: string
    tone: 'warn' | 'bad' | 'neutral'
}

function sourceHealth(source: TiAdminSource): SourceHealth {
    const minutes = minutesSince(source.lastRunAt)
    if (source.status === 'paused') return { state: 'paused', label: 'Paused' }
    if (source.status === 'candidate' || source.status === 'review') return { state: 'review', label: 'Needs review' }
    if (minutes > source.cadenceMinutes * 2) return { state: 'stale', label: 'Stale' }
    return { state: 'healthy', label: 'Healthy' }
}

function HealthBadge({ state, label }: { state: SourceHealth['state'], label: string }) {
    const Icon = state === 'healthy' ? CheckCircle2 : AlertTriangle
    const className = state === 'healthy'
        ? 'bg-[#f4fbf7] text-[#147a3b]'
        : state === 'stale'
            ? 'bg-[#fff7ed] text-[#b45309]'
            : 'bg-[#fff0eb] text-[#c2410c]'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
            <Icon className='h-3.5 w-3.5' />
            {label}
        </span>
    )
}

function sourceFreshness(source: TiAdminSource): SourceFreshness {
    if (source.status === 'paused') {
        return { stateLabel: 'Paused', detail: 'No collection will run until the source is re-enabled.', tone: 'neutral' }
    }
    if (source.status === 'candidate' || source.status === 'review') {
        return { stateLabel: 'Needs review', detail: 'Approve source boundary, access method, and stored evidence rules.', tone: 'warn' }
    }
    const minutes = minutesSince(source.lastRunAt)
    const overdue = new Date(source.nextRunAt).getTime() < Date.now()
    if (minutes > source.cadenceMinutes * 2) {
        return { stateLabel: 'Stale', detail: `${Math.round(minutes / 60)} hr since the last update. Expected every ${cadenceLabel(source.cadenceMinutes)}.`, tone: 'bad' }
    }
    if (overdue) {
        return { stateLabel: 'Due now', detail: `Next run is ${relativeUntil(source.nextRunAt)}.`, tone: 'warn' }
    }
    return { stateLabel: 'On cadence', detail: `Next scheduled run ${relativeUntil(source.nextRunAt)}.`, tone: 'ok' }
}

function sourceActionItems(source: TiAdminSource, runs: Array<{ status: string }>, captures: Array<{ id: string }>, health: SourceHealth, freshness: SourceFreshness): SourceActionItem[] {
    const items: SourceActionItem[] = []
    if (health.state === 'stale') {
        items.push({
            title: 'Run source and check parser output',
            detail: freshness.detail,
            owner: source.owner,
            tone: 'bad',
        })
    }
    if (source.status === 'candidate' || source.status === 'review') {
        items.push({
            title: 'Approve source boundary',
            detail: `${source.accessMethod}. ${source.legalNotes}`,
            owner: source.owner,
            tone: 'warn',
        })
    }
    if (!captures.length && source.status === 'active') {
        items.push({
            title: 'No captured evidence yet',
            detail: 'Verify that matching, screenshots, and metadata storage are wired for this source.',
            owner: source.owner,
            tone: 'warn',
        })
    }
    if (runs.some(run => run.status === 'failed')) {
        items.push({
            title: 'Failed run present',
            detail: 'Review the latest failed run before relying on source coverage.',
            owner: source.owner,
            tone: 'bad',
        })
    }
    if (!items.length) {
        items.push({
            title: 'No immediate action',
            detail: 'Source is producing within the expected cadence and has reviewable evidence.',
            owner: source.owner,
            tone: 'neutral',
        })
    }
    return items
}

function captureDomainCounts(captures: Array<{ domain: string, actor: string, capturedAt: string }>) {
    const grouped = new Map<string, { domain: string, count: number, actors: string[], lastCapturedAt: string }>()
    captures.forEach(capture => {
        const current = grouped.get(capture.domain) ?? { domain: capture.domain, count: 0, actors: [], lastCapturedAt: capture.capturedAt }
        current.count += 1
        if (!current.actors.includes(capture.actor)) current.actors.push(capture.actor)
        if (new Date(capture.capturedAt).getTime() > new Date(current.lastCapturedAt).getTime()) current.lastCapturedAt = capture.capturedAt
        grouped.set(capture.domain, current)
    })
    return [...grouped.values()].sort((a, b) => new Date(b.lastCapturedAt).getTime() - new Date(a.lastCapturedAt).getTime())
}

function minutesSince(value: string) {
    const parsed = new Date(value).getTime()
    if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
    return Math.max(0, Math.round((Date.now() - parsed) / 60000))
}

function runDurationLabel(startedAt: string, finishedAt?: string) {
    if (!finishedAt) return 'running'
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    if (!Number.isFinite(ms) || ms < 0) return 'unknown'
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
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

function cadenceLabel(minutes: number) {
    if (minutes < 60) return `${minutes} min`
    const hours = minutes / 60
    if (hours < 24) return `${Math.round(hours)} hr`
    return `${Math.round(hours / 24)} d`
}
