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
    const runDuration = latestRun ? runDurationLabel(latestRun.startedAt, latestRun.finishedAt) : 'checking'
    const freshness = sourceFreshness(source)
    const actionItems = sourceActionItems(source, runs, captures, health, freshness)
    const captureDomains = captureDomainCounts(captures)
    const activeDays = Math.max(1, ageDays(source.monitoredSince))
    const dailyRows = Math.round(source.usefulRows / activeDays)
    const dailyCaptures = Math.round((captures.length / activeDays) * 10) / 10
    const operation = sourceOperation(source, latestRun, captures.length, freshness)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence source'
                title={source.name}
                description={`${health.label}. Last update ${relativeAge(source.lastRunAt)}. Next run ${relativeUntil(source.nextRunAt)}.`}
                actions={<ManualRunButton sourceId={source.id} label='Run source now' queries={source.domains.filter(domain => !domain.includes('only'))} />}
            />

            <div className='flex'>
                <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised'>
                    <ArrowLeft className='h-4 w-4' />
                    Sources
                </Link>
            </div>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='grid gap-4 border-b border-ui-border bg-ui-panel p-4 text-ui-text xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center'>
                    <div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <HealthBadge state={health.state} label={health.label} />
                            <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold capitalize text-ui-text'>{operationalStateLabel(source.status)}</span>
                            <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-text'>{source.family.replaceAll('_', ' ')}</span>
                            <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-text'>{source.risk}</span>
                        </div>
                        <div className='mt-4 grid gap-3 md:grid-cols-3'>
                            <DarkStat icon={<RadioTower className='h-4 w-4' />} label='State' value={freshness.stateLabel} detail={freshness.detail} tone={freshness.tone} />
                            <DarkStat icon={<Gauge className='h-4 w-4' />} label='Success' value={`${successRate}%`} detail={`${completedRuns}/${runs.length || 0} completed · ${failedRuns} failed`} tone={failedRuns ? 'warn' : 'ok'} />
                            <DarkStat icon={<TimerReset className='h-4 w-4' />} label='Last run' value={runDuration} detail={latestRun?.message || 'Checking this source'} tone='neutral' />
                        </div>
                    </div>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[42rem]'>
                        <TopStat label='Last seen' value={relativeAge(source.lastRunAt)} />
                        <TopStat label='Lease due' value={relativeUntil(source.nextRunAt)} />
                        <TopStat label='Interval' value={cadenceLabel(source.cadenceMinutes)} />
                        <TopStat label='Yield' value={`${avgRows} rows/run`} />
                    </div>
                </div>

                <div className='grid gap-0 xl:grid-cols-[minmax(0,1fr)_360px]'>
                    <main className='grid gap-4 p-5'>
                        <section className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 xl:grid-cols-[1fr_1fr_1fr]'>
                            <OperationCard
                                icon={<RadioTower className='h-4 w-4' />}
                                label='Current operation'
                                value={operation.label}
                                detail={operation.detail}
                                tone={operation.tone}
                            />
                            <OperationCard
                                icon={<Activity className='h-4 w-4' />}
                                label='Worker output'
                                value={latestRun ? `${latestRun.rows} rows` : 'Lease pending'}
                                detail={latestRun ? `${latestRun.captures} captures · ${latestRun.screenshots} screenshots · ${runDurationLabel(latestRun.startedAt, latestRun.finishedAt)}` : 'Worker output streams into this source view.'}
                                tone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'warn'}
                            />
                            <OperationCard
                                icon={<Camera className='h-4 w-4' />}
                                label='Evidence stream'
                                value={captures.length ? `${captures.length} captures` : 'Checking'}
                                detail={captures[0] ? `${captures[0].actor} · ${captures[0].domain} · ${relativeAge(captures[0].capturedAt)}` : 'Collector is checking this source; safe capture rows stream here after review.'}
                                tone={captures.length ? 'ok' : 'warn'}
                            />
                        </section>

                        <section className='grid gap-3 md:grid-cols-4'>
                            <MiniMetric title='Runs' value={String(runs.length)} detail={latestRun ? operationalStateLabel(latestRun.status) : 'checking'} />
                            <MiniMetric title='Captures' value={String(captures.length)} detail={`${avgCaptures} per run avg`} />
                            <MiniMetric title='Rows/day' value={`${dailyRows}/d`} detail={`${source.usefulRows.toLocaleString()} rows total`} />
                            <MiniMetric title='Evidence rate' value={`${dailyCaptures}/d`} detail={`${activeDays} d monitored`} />
                        </section>

                        <section className='grid gap-4 xl:grid-cols-[0.95fr_1.05fr]'>
                            <div className='rounded-md border border-ui-border bg-ui-panel'>
                                <PanelHeader title='Action queue' detail={`${actionItems.length} open item${actionItems.length === 1 ? '' : 's'}`} icon={<AlertTriangle className='h-4 w-4 text-ui-warning' />} />
                                <div className='grid gap-2 p-4'>
                                    {actionItems.map(item => (
                                        <div key={item.title} className='rounded-md border border-ui-border bg-ui-canvas p-3'>
                                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                                <p className='font-semibold text-ui-text'>{item.title}</p>
                                                <span className={item.tone === 'bad' ? 'rounded-full border border-ui-danger/35 bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold text-ui-danger' : item.tone === 'warn' ? 'rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning' : 'rounded-full border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-primary'}>{item.owner}</span>
                                            </div>
                                            <p className='mt-1 text-sm leading-6 text-ui-muted'>{item.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className='rounded-md border border-ui-border bg-ui-panel'>
                                <PanelHeader title='Source activity' detail='Domains and capture yield' icon={<Activity className='h-4 w-4 text-ui-primary' />} />
                                <div className='grid gap-3 p-4'>
                                    {captureDomains.map(item => (
                                        <div key={item.domain} className='grid gap-3 rounded-md border border-ui-border bg-ui-canvas p-3 sm:grid-cols-[1fr_auto] sm:items-center'>
                                            <div className='min-w-0'>
                                                <Link href={`/dashboard/ti/domains/${encodeURIComponent(item.domain)}`} className='truncate font-mono text-sm font-semibold text-ui-text hover:text-ui-primary'>{item.domain}</Link>
                                                <p className='mt-1 text-xs text-ui-muted'>{item.actors.join(', ') || 'Actor label syncing'}</p>
                                            </div>
                                            <div className='text-right'>
                                                <p className='text-sm font-semibold text-ui-primary'>{item.count} capture{item.count === 1 ? '' : 's'}</p>
                                                <p className='mt-1 text-xs text-ui-muted'>latest {relativeAge(item.lastCapturedAt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {!captureDomains.length && <p className='rounded-md border border-dashed border-ui-border p-4 text-sm text-ui-muted'>The worker is checking matched domains; evidence attaches here as captures pass review.</p>}
                                </div>
                            </div>
                        </section>

                        <section className='rounded-md border border-ui-border bg-ui-panel'>
                            <PanelHeader title='Run history' detail='Rows, captures, screenshots, duration, and next scheduled run' icon={<Clock3 className='h-4 w-4 text-ui-primary' />} />
                            <div className='overflow-x-auto'>
                                <div className='min-w-[48rem]'>
                                    <div className='grid grid-cols-[1.1fr_0.7fr_0.55fr_0.55fr_0.55fr_0.65fr_1fr] gap-3 bg-ui-canvas px-4 py-2 text-xs font-semibold uppercase text-ui-muted'>
                                        <span>Run</span>
                                        <span>Status</span>
                                        <span>Rows</span>
                                        <span>Captures</span>
                                        <span>Screens</span>
                                        <span>Duration</span>
                                        <span>Started</span>
                                    </div>
                                    {runs.map(run => (
                                        <div key={run.id} className='grid grid-cols-[1.1fr_0.7fr_0.55fr_0.55fr_0.55fr_0.65fr_1fr] gap-3 border-t border-ui-border px-4 py-2.5 text-sm hover:bg-ui-panel'>
                                            <div className='min-w-0'>
                                                <p className='truncate font-mono text-xs font-semibold text-ui-text'>{run.id}</p>
                                                <p className='mt-1 line-clamp-1 text-xs text-ui-muted'>{run.message}</p>
                                            </div>
                                            <span className={run.status === 'completed' ? 'inline-flex min-h-8 w-fit items-center justify-center rounded-full border border-ui-success/35 bg-ui-success/10 px-3 text-xs font-semibold text-ui-success' : 'inline-flex min-h-8 w-fit items-center justify-center rounded-full border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-primary'}>{operationalStateLabel(run.status)}</span>
                                            <span className='font-semibold text-ui-text'>{run.rows}</span>
                                            <span className='font-semibold text-ui-text'>{run.captures}</span>
                                            <span className='font-semibold text-ui-text'>{run.screenshots}</span>
                                            <span className='font-semibold text-ui-text'>{runDurationLabel(run.startedAt, run.finishedAt)}</span>
                                            <span className='text-ui-muted'>{formatTiDate(run.startedAt)}</span>
                                        </div>
                                    ))}
                                    {!runs.length && <p className='border-t border-ui-border p-4 text-sm text-ui-muted'>Use Run source now to start the first visible run for this source.</p>}
                                </div>
                            </div>
                        </section>

                        <section className='rounded-md border border-ui-border bg-ui-panel'>
                            <PanelHeader title='Capture review' detail='Safe screenshots, metadata, owner, and capture timing' icon={<Camera className='h-4 w-4 text-ui-primary' />} />
                            {captures.length > 0 && (
                                <div className='overflow-x-auto border-b border-ui-border'>
                                    <div className='min-w-[54rem]'>
                                        <div className='grid grid-cols-[1fr_0.75fr_0.75fr_0.85fr_0.85fr_0.8fr] gap-3 bg-ui-canvas px-4 py-2 text-xs font-semibold uppercase text-ui-muted'>
                                            <span>Evidence</span>
                                            <span>Actor</span>
                                            <span>Domain</span>
                                            <span>Published</span>
                                            <span>Captured</span>
                                            <span>Owner</span>
                                        </div>
                                        {captures.map(capture => (
                                            <a key={capture.id} href={`#${capture.id}`} className='grid grid-cols-[1fr_0.75fr_0.75fr_0.85fr_0.85fr_0.8fr] gap-3 border-t border-ui-border px-4 py-2.5 text-sm hover:bg-ui-panel'>
                                                <span className='truncate font-semibold text-ui-text'>{capture.title}</span>
                                                <span className='truncate text-ui-muted'>{capture.actor}</span>
                                                <span className='truncate font-mono text-xs text-ui-text'>{capture.domain}</span>
                                                <span className='text-ui-muted'>{relativeAge(capture.publishedAt)}</span>
                                                <span className='text-ui-muted'>{relativeAge(capture.capturedAt)}</span>
                                                <span className='font-semibold text-ui-text'>{capture.owner}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className='grid gap-4 p-4'>
                                {captures.map(capture => (
                                    <article key={capture.id} id={capture.id} className='grid gap-4 rounded-md border border-ui-border bg-ui-canvas p-4 xl:grid-cols-[minmax(18rem,0.72fr)_1fr]'>
                                        <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-canvas'>
                                            <div className='border-b border-ui-border/10 px-3 py-2 text-xs text-ui-primary'>{capture.screenshotLabel}</div>
                                            <div className='grid min-h-56 content-between p-4 text-ui-text'>
                                                <div className='flex items-center justify-between gap-3'>
                                                    <span className='rounded-full border border-ui-border bg-ui-panel px-2 py-1 text-xs text-ui-text'>{capture.actor}</span>
                                                    <span className='text-xs text-ui-muted'>{formatTiDate(capture.screenshotTakenAt)}</span>
                                                </div>
                                                <div>
                                                    <p className='text-xl font-semibold'>{capture.domain}</p>
                                                    <p className='mt-2 text-sm text-ui-muted'>{capture.resultSummary}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className='min-w-0'>
                                            <h3 className='text-base font-semibold text-ui-text'>{capture.title}</h3>
                                            <p className='mt-2 text-sm leading-6 text-ui-muted'>{capture.resultSummary}</p>
                                            <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                                                <Info label='Published' value={formatTiDate(capture.publishedAt)} />
                                                <Info label='Captured' value={formatTiDate(capture.capturedAt)} />
                                                <Info label='Page type' value={capture.pageType} />
                                                <Info label='Owner' value={capture.owner} />
                                            </div>
                                            <div className='mt-3 flex flex-wrap gap-2'>
                                                {capture.metadata.map(item => (
                                                    <span key={item.label} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-xs text-ui-text'>{item.label}: {item.value}</span>
                                                ))}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                                {!captures.length && <p className='rounded-md border border-dashed border-ui-border p-4 text-sm text-ui-muted'>Safe screenshot review is live; accepted captures stream here after dedupe and safety checks.</p>}
                            </div>
                        </section>
                    </main>

                    <aside className='grid content-start gap-4 border-t border-ui-border bg-ui-canvas p-5 xl:border-l xl:border-t-0'>
                        <SidePanel title='Safety rules' icon={<ShieldCheck className='h-4 w-4' />}>
                            <p className='text-sm leading-6 text-ui-muted'>{source.legalNotes}</p>
                            <div className='mt-3 grid gap-2'>
                                <Info label='Risk' value={source.risk} />
                                <Info label='Access' value={source.accessMethod} />
                                <Info label='Type' value={source.type} />
                            </div>
                        </SidePanel>

                        <SidePanel title='Watched targets' icon={<ExternalLink className='h-4 w-4' />}>
                            <div className='flex flex-wrap gap-2'>
                                {source.domains.map(domain => (
                                    <Link key={domain} href={`/dashboard/ti/domains/${encodeURIComponent(domain)}`} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 font-mono text-xs text-ui-text hover:bg-ui-raised'>{domain}</Link>
                                ))}
                            </div>
                            <div className='mt-4 flex flex-wrap gap-2'>
                                {source.resultTypes.map(type => (
                                    <span key={type} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 font-mono text-xs text-ui-primary'>{type}</span>
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
        ? 'text-ui-danger'
        : tone === 'warn'
            ? 'text-ui-warning'
            : tone === 'ok'
                ? 'text-ui-success'
                : 'text-ui-text'
    return (
        <div className='rounded-md border border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center gap-2 text-ui-muted'>
                {icon}
                <p className='text-[10px] font-semibold uppercase'>{label}</p>
            </div>
            <p className={`mt-2 text-sm font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted'>{detail}</p>
        </div>
    )
}

function TopStat({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-panel px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function MiniMetric({ title, value, detail }: { title: string, value: string, detail: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas p-3'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
            <p className='mt-2 text-lg font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 text-xs text-ui-muted'>{detail}</p>
        </div>
    )
}

function OperationCard({ icon, label, value, detail, tone }: { icon: React.ReactNode, label: string, value: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'bad'
        ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
        : tone === 'warn'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : tone === 'ok'
                ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
                : 'border-ui-border bg-ui-panel text-ui-text'
    return (
        <div className={`rounded-md border p-3 ${toneClass}`}>
            <div className='flex items-center gap-2'>
                {icon}
                <p className='text-xs font-semibold uppercase opacity-80'>{label}</p>
            </div>
            <p className='mt-2 truncate text-sm font-semibold text-ui-text'>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-ui-muted'>{detail}</p>
        </div>
    )
}

function SidePanel({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
    return (
        <section className='rounded-md border border-ui-border bg-ui-panel p-4'>
            <div className='mb-3 flex items-center justify-between gap-3 text-ui-primary'>
                <h2 className='text-sm font-semibold text-ui-text'>{title}</h2>
                {icon}
            </div>
            {children}
        </section>
    )
}

function PanelHeader({ title, detail, icon }: { title: string, detail: string, icon: React.ReactNode }) {
    return (
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
            <div>
                <h2 className='text-base font-semibold text-ui-text'>{title}</h2>
                <p className='mt-1 text-sm text-ui-muted'>{detail}</p>
            </div>
            {icon}
        </div>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-canvas p-3'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text'>{value}</p>
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
    if (source.status === 'candidate' || source.status === 'review') return { state: 'review', label: 'Reviewing' }
    if (minutes > source.cadenceMinutes * 2) return { state: 'stale', label: 'Stale' }
    return { state: 'healthy', label: 'Healthy' }
}

function HealthBadge({ state, label }: { state: SourceHealth['state'], label: string }) {
    const Icon = state === 'healthy' ? CheckCircle2 : AlertTriangle
    const className = state === 'healthy'
        ? 'border border-ui-success/35 bg-ui-success/10 text-ui-success'
        : state === 'stale'
            ? 'border border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : 'border border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}>
            <Icon className='h-3.5 w-3.5' />
            {label}
        </span>
    )
}

function sourceFreshness(source: TiAdminSource): SourceFreshness {
    if (source.status === 'paused') {
        return { stateLabel: 'Paused', detail: 'Collection is paused until the source is re-enabled.', tone: 'neutral' }
    }
    if (source.status === 'candidate' || source.status === 'review') {
        return { stateLabel: 'Needs review', detail: 'Approve safety rules, access method, and stored evidence rules.', tone: 'warn' }
    }
    const minutes = minutesSince(source.lastRunAt)
    const overdue = new Date(source.nextRunAt).getTime() < Date.now()
    if (minutes > source.cadenceMinutes * 2) {
        return { stateLabel: 'Stale', detail: `${Math.round(minutes / 60)} hr since the last update. Expected every ${cadenceLabel(source.cadenceMinutes)}.`, tone: 'bad' }
    }
    if (overdue) {
        return { stateLabel: 'Due now', detail: `Next run is ${relativeUntil(source.nextRunAt)}.`, tone: 'warn' }
    }
    return { stateLabel: 'On schedule', detail: `Next run ${relativeUntil(source.nextRunAt)}.`, tone: 'ok' }
}

function sourceActionItems(source: TiAdminSource, runs: Array<{ status: string }>, captures: Array<{ id: string }>, health: SourceHealth, freshness: SourceFreshness): SourceActionItem[] {
    const items: SourceActionItem[] = []
    if (health.state === 'stale') {
        items.push({
            title: 'Run source and review accepted fields',
            detail: freshness.detail,
            owner: source.owner,
            tone: 'bad',
        })
    }
    if (source.status === 'candidate' || source.status === 'review') {
        items.push({
            title: 'Approve source safety rules',
            detail: `${source.accessMethod}. ${source.legalNotes}`,
            owner: source.owner,
            tone: 'warn',
        })
    }
    if (!captures.length && source.status === 'active') {
        items.push({
            title: 'Collector checking for evidence',
            detail: 'Matching, screenshots, and metadata storage stream accepted captures as this source produces rows.',
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
            title: 'Source healthy',
            detail: 'Source is producing on schedule and has reviewable evidence.',
            owner: source.owner,
            tone: 'neutral',
        })
    }
    return items
}

function sourceOperation(source: TiAdminSource, latestRun: { status: string, rows: number, captures: number, startedAt: string, finishedAt?: string } | undefined, captureCount: number, freshness: SourceFreshness): { label: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' } {
    if (source.status === 'paused') {
        return { label: 'Paused', detail: 'Source is not leasing work until it is re-enabled.', tone: 'neutral' }
    }
    if (latestRun?.status === 'running' || latestRun?.status === 'queued') {
        return { label: operationalStateLabel(latestRun.status), detail: `Worker is processing ${source.name}. Started ${relativeAge(latestRun.startedAt)}.`, tone: 'warn' }
    }
    if (latestRun?.status === 'failed') {
        return { label: 'Run failed', detail: 'Latest source worker run failed; review run history before relying on this source.', tone: 'bad' }
    }
    if (freshness.tone === 'bad') {
        return { label: 'Stale', detail: freshness.detail, tone: 'bad' }
    }
    if (freshness.tone === 'warn') {
        return { label: freshness.stateLabel, detail: freshness.detail, tone: 'warn' }
    }
    return {
        label: captureCount ? 'Collecting' : 'Checking',
        detail: captureCount ? 'Source is producing safe evidence rows on schedule.' : 'Source is running on schedule; no safe capture rows are attached yet.',
        tone: 'ok',
    }
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
    if (!Number.isFinite(ms) || ms < 0) return 'running'
    const seconds = Math.round(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    if (minutes < 60) return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
}

function relativeAge(value: string) {
    const minutes = minutesSince(value)
    if (!Number.isFinite(minutes)) return 'checking'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}

function relativeUntil(value: string) {
    const diff = new Date(value).getTime() - Date.now()
    if (!Number.isFinite(diff)) return 'checking'
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
