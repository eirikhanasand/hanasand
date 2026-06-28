import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, Camera, Clock3, DatabaseZap, ExternalLink, PlayCircle, Radar, Send, ShieldCheck, Webhook } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import ManualRunButton from './manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiAdminPage() {
    const { sources, domains, captures, runs } = getTiAdminOverview()
    const enrichment = await getTiEnrichmentOverview()
    const now = Date.now()

    const activeSources = sources.filter(source => source.status === 'active')
    const candidateSources = sources.filter(source => source.status === 'candidate' || source.status === 'review')
    const staleSources = sources.filter(source => now - new Date(source.lastRunAt).getTime() > 12 * 60 * 60 * 1000)
    const reviewDomains = domains.filter(domain => domain.status === 'review')
    const queuedRuns = runs.filter(run => run.status === 'queued' || run.status === 'running')
    const failedRuns = runs.filter(run => run.status === 'failed')
    const nextRun = [...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const latestRun = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
    const latestCapture = [...captures].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0]
    const runQueries = [...new Set(sources.flatMap(source => source.domains).filter(domain => !domain.includes('only')))]
    const actionItems = buildActionItems({ reviewDomains, candidateSources, staleSources, failedRuns, latestCapture })

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Operations center'
                description='Sources, runs, entity matches, evidence, enrichment, and delivery state.'
                actions={<ManualRunButton label='Run collection' queries={runQueries} />}
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-6'>
                <Metric title='Active sources' value={`${activeSources.length}/${sources.length}`} icon={<DatabaseZap className='h-4 w-4' />} />
                <Metric title='Needs review' value={`${reviewDomains.length + candidateSources.length + failedRuns.length}`} tone={reviewDomains.length || candidateSources.length || failedRuns.length ? 'watch' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Stale sources' value={`${staleSources.length}`} tone={staleSources.length ? 'bad' : 'ok'} icon={<Clock3 className='h-4 w-4' />} />
                <Metric title='Captures' value={`${captures.length}`} icon={<Camera className='h-4 w-4' />} />
                <Metric title='Actor worker' value={enrichment.worker.state} tone={enrichment.worker.state === 'running' ? 'ok' : enrichment.worker.state === 'error' || enrichment.worker.state === 'unavailable' ? 'bad' : 'watch'} icon={<Radar className='h-4 w-4' />} />
                <Metric title='Next run' value={nextRun ? shortTime(nextRun.nextRunAt) : 'None'} icon={<PlayCircle className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='overflow-hidden'>
                <div className='border-b border-[#e0e5ed] bg-[#101522] p-4 text-white'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold'>Action queue</h2>
                            <p className='mt-1 text-sm text-[#c7d0df]'>{actionItems.length} items sorted by operator impact.</p>
                        </div>
                        <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                            <StatusPill label={`${queuedRuns.length} running/queued`} tone={queuedRuns.length ? 'watch' : 'neutral'} />
                            <StatusPill label={`latest ${latestRun?.status || 'none'}`} tone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'neutral'} />
                            <StatusPill label={`${enrichment.stats.updatedLastHour} actor updates 1h`} tone='neutral' />
                        </div>
                    </div>
                </div>
                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                        <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                            <tr>
                                <th className='px-4 py-3'>Priority</th>
                                <th className='px-4 py-3'>Item</th>
                                <th className='px-4 py-3'>Reason</th>
                                <th className='px-4 py-3'>State</th>
                                <th className='px-4 py-3 text-right'>Open</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#edf0f5] bg-white'>
                            {actionItems.map(item => (
                                <tr key={`${item.kind}-${item.title}`} className='hover:bg-[#fbfcfe]'>
                                    <td className='px-4 py-4'><StatusPill label={item.priority} tone={item.tone} /></td>
                                    <td className='px-4 py-4 font-semibold text-[#171a21]'>{item.title}</td>
                                    <td className='px-4 py-4 text-[#596170]'>{item.reason}</td>
                                    <td className='px-4 py-4 text-[#596170]'>{item.state}</td>
                                    <td className='px-4 py-4 text-right'>
                                        <Link href={item.href} className='inline-flex h-8 items-center gap-1 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                                            Open
                                            <ArrowRight className='h-3.5 w-3.5' />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {!actionItems.length ? (
                                <tr>
                                    <td colSpan={5} className='px-4 py-8 text-center text-sm text-[#667085]'>No operator actions in the current snapshot.</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='overflow-hidden'>
                    <PanelTitle title='Source matrix' actionHref='/dashboard/ti/sources' actionLabel='Sources' />
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                            <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-4 py-3'>Source</th>
                                    <th className='px-4 py-3'>Health</th>
                                    <th className='px-4 py-3'>Typical activity</th>
                                    <th className='px-4 py-3'>Last run</th>
                                    <th className='px-4 py-3'>Next run</th>
                                    <th className='px-4 py-3'>Scope</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#edf0f5] bg-white'>
                                {[...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()).map(source => {
                                    const stale = staleSources.includes(source)
                                    const sourceRuns = runs.filter(run => run.sourceId === source.id)
                                    const rowsPerRun = sourceRuns.length ? Math.round(sourceRuns.reduce((sum, run) => sum + run.rows, 0) / sourceRuns.length) : 0
                                    return (
                                        <tr key={source.id} className='hover:bg-[#fbfcfe]'>
                                            <td className='px-4 py-4'>
                                                <Link href={`/dashboard/ti/sources/${source.id}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{source.name}</Link>
                                                <p className='mt-1 text-xs text-[#667085]'>{source.family}</p>
                                            </td>
                                            <td className='px-4 py-4'><StatusPill label={stale ? 'stale' : source.status} tone={stale ? 'bad' : source.status === 'active' ? 'ok' : 'watch'} /></td>
                                            <td className='px-4 py-4 text-[#596170]'>{rowsPerRun || source.usefulRows} rows/run</td>
                                            <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(source.lastRunAt)}</td>
                                            <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(source.nextRunAt)}</td>
                                            <td className='px-4 py-4 text-[#596170]'>{source.domains.length} terms · {source.resultTypes.length} result types</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden'>
                    <PanelTitle title='Delivery state' actionHref='/dashboard/dwm' actionLabel='DWM' />
                    <div className='grid gap-3 p-4'>
                        <DeliveryRow icon={<ShieldCheck className='h-4 w-4' />} title='Review queue' value={`${reviewDomains.length} entity matches`} tone={reviewDomains.length ? 'watch' : 'ok'} />
                        <DeliveryRow icon={<Webhook className='h-4 w-4' />} title='Webhook delivery' value='DWM workflow owns delivery records' tone='neutral' />
                        <DeliveryRow icon={<Send className='h-4 w-4' />} title='Customer routing' value={`${domains.length} monitored entities`} tone='neutral' />
                        <DeliveryRow icon={<Activity className='h-4 w-4' />} title='Latest collection' value={latestRun ? `${latestRun.status} · ${formatTiDate(latestRun.startedAt)}` : 'No run'} tone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'neutral'} />
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 xl:grid-cols-2'>
                <DashboardPanel className='overflow-hidden'>
                    <PanelTitle title='Entity queue' actionHref='/dashboard/ti/domains' actionLabel='Entities' />
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                            <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-4 py-3'>Entity</th>
                                    <th className='px-4 py-3'>State</th>
                                    <th className='px-4 py-3'>Results</th>
                                    <th className='px-4 py-3'>Last seen</th>
                                    <th className='px-4 py-3'>Sources</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#edf0f5] bg-white'>
                                {domains.map(domain => (
                                    <tr key={domain.domain} className='hover:bg-[#fbfcfe]'>
                                        <td className='px-4 py-4'>
                                            <Link href={`/dashboard/ti/domains/${encodeURIComponent(domain.domain)}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{domain.company}</Link>
                                            <p className='mt-1 font-mono text-xs text-[#667085]'>{domain.domain}</p>
                                        </td>
                                        <td className='px-4 py-4'><StatusPill label={domain.status} tone={domain.status === 'review' ? 'watch' : domain.status === 'watching' ? 'ok' : 'neutral'} /></td>
                                        <td className='px-4 py-4 font-semibold text-[#171a21]'>{domain.resultCount}</td>
                                        <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(domain.lastSeenAt)}</td>
                                        <td className='px-4 py-4 text-[#596170]'>{domain.sourceIds.map(id => sourceById(id)?.name || id).join(', ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden'>
                    <PanelTitle title='Evidence queue' actionHref='/dashboard/ti/sources' actionLabel='Evidence' />
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                            <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-4 py-3'>Capture</th>
                                    <th className='px-4 py-3'>Actor</th>
                                    <th className='px-4 py-3'>Source</th>
                                    <th className='px-4 py-3'>Captured</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#edf0f5] bg-white'>
                                {captures.map(capture => (
                                    <tr key={capture.id} className='hover:bg-[#fbfcfe]'>
                                        <td className='px-4 py-4'>
                                            <Link href={`/dashboard/ti/sources/${capture.sourceId}#${capture.id}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{capture.title}</Link>
                                            <p className='mt-1 text-xs text-[#667085]'>{capture.domain}</p>
                                        </td>
                                        <td className='px-4 py-4 font-semibold text-[#171a21]'>{capture.actor}</td>
                                        <td className='px-4 py-4 text-[#596170]'>{sourceById(capture.sourceId)?.name || capture.sourceId}</td>
                                        <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(capture.capturedAt)}</td>
                                    </tr>
                                ))}
                                {!captures.length ? (
                                    <tr>
                                        <td colSpan={4} className='px-4 py-8 text-center text-sm text-[#667085]'>No capture evidence in the current snapshot.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>
            </div>

            <DashboardPanel className='overflow-hidden'>
                <PanelTitle title='Actor enrichment' actionHref='/dashboard/ti/enrichment' actionLabel='Enrichment' />
                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                        <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                            <tr>
                                <th className='px-4 py-3'>Actor</th>
                                <th className='px-4 py-3'>Status</th>
                                <th className='px-4 py-3'>Confidence</th>
                                <th className='px-4 py-3'>Sources</th>
                                <th className='px-4 py-3'>Last update</th>
                                <th className='px-4 py-3'>Next refresh</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-[#edf0f5] bg-white'>
                            {[...enrichment.updatedActors, ...enrichment.queuedActors].slice(0, 8).map(actor => (
                                <tr key={`${actor.id}-${actor.status}`} className='hover:bg-[#fbfcfe]'>
                                    <td className='px-4 py-4'>
                                        <Link href={`/ti/${encodeURIComponent(actor.id)}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{actor.name}</Link>
                                        <p className='mt-1 text-xs text-[#667085]'>{actor.changedFields.length ? actor.changedFields.join(', ') : 'queued'}</p>
                                    </td>
                                    <td className='px-4 py-4'><StatusPill label={actor.status} tone={actor.status === 'queued' ? 'neutral' : actor.status === 'review' ? 'watch' : 'ok'} /></td>
                                    <td className='px-4 py-4 font-semibold text-[#171a21]'>{actor.confidence}%</td>
                                    <td className='px-4 py-4 text-[#596170]'>{actor.sourceLinks.length}</td>
                                    <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(actor.lastUpdatedAt)}</td>
                                    <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(actor.nextRefreshAt)}</td>
                                </tr>
                            ))}
                            {!enrichment.updatedActors.length && !enrichment.queuedActors.length ? (
                                <tr>
                                    <td colSpan={6} className='px-4 py-8 text-center text-sm text-[#667085]'>No actor enrichment rows returned by the API.</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function buildActionItems({ reviewDomains, candidateSources, staleSources, failedRuns, latestCapture }: {
    reviewDomains: ReturnType<typeof getTiAdminOverview>['domains']
    candidateSources: ReturnType<typeof getTiAdminOverview>['sources']
    staleSources: ReturnType<typeof getTiAdminOverview>['sources']
    failedRuns: ReturnType<typeof getTiAdminOverview>['runs']
    latestCapture?: ReturnType<typeof getTiAdminOverview>['captures'][number]
}) {
    return [
        ...reviewDomains.map(domain => ({
            kind: 'domain',
            priority: 'review',
            tone: 'watch' as const,
            title: domain.company,
            reason: `${domain.resultCount} source-backed result${domain.resultCount === 1 ? '' : 's'} for ${domain.domain}`,
            state: `Last seen ${formatTiDate(domain.lastSeenAt)}`,
            href: `/dashboard/ti/domains/${encodeURIComponent(domain.domain)}`,
        })),
        ...failedRuns.map(run => ({
            kind: 'run',
            priority: 'failed',
            tone: 'bad' as const,
            title: run.id,
            reason: run.message,
            state: `Started ${formatTiDate(run.startedAt)}`,
            href: '/dashboard/ti/runs',
        })),
        ...staleSources.map(source => ({
            kind: 'source',
            priority: 'stale',
            tone: 'bad' as const,
            title: source.name,
            reason: `Last collected ${formatTiDate(source.lastRunAt)}`,
            state: `${source.cadenceMinutes}m cadence`,
            href: `/dashboard/ti/sources/${source.id}`,
        })),
        ...candidateSources.map(source => ({
            kind: 'source',
            priority: source.status,
            tone: 'watch' as const,
            title: source.name,
            reason: `Approve ${source.accessMethod}; risk ${source.risk}; ${source.resultTypes.length} result types.`,
            state: `Last ${formatTiDate(source.lastRunAt)} · next ${formatTiDate(source.nextRunAt)} · ${source.cadenceMinutes}m cadence`,
            href: `/dashboard/ti/sources/${source.id}`,
        })),
        ...(latestCapture ? [{
            kind: 'capture',
            priority: 'evidence',
            tone: 'neutral' as const,
            title: latestCapture.title,
            reason: latestCapture.resultSummary,
            state: `Captured ${formatTiDate(latestCapture.capturedAt)}`,
            href: `/dashboard/ti/sources/${latestCapture.sourceId}#${latestCapture.id}`,
        }] : []),
    ].slice(0, 10)
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='p-4'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-xs font-semibold uppercase text-[#667085]'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-xl font-semibold capitalize text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}

function PanelTitle({ title, actionHref, actionLabel }: { title: string, actionHref: string, actionLabel: string }) {
    return (
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#e0e5ed] bg-[#fbfcfe] px-4 py-3'>
            <h2 className='text-base font-semibold text-[#171a21]'>{title}</h2>
            <Link href={actionHref} className='inline-flex h-8 items-center gap-1 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                {actionLabel}
                <ExternalLink className='h-3.5 w-3.5' />
            </Link>
        </div>
    )
}

function DeliveryRow({ icon, title, value, tone }: { icon: ReactNode, title: string, value: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <div className='flex items-start justify-between gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <div className='flex min-w-0 gap-3'>
                <span className={toneClass(tone).text}>{icon}</span>
                <div className='min-w-0'>
                    <p className='font-semibold text-[#171a21]'>{title}</p>
                    <p className='mt-1 text-sm text-[#596170]'>{value}</p>
                </div>
            </div>
            <StatusPill label={tone === 'ok' ? 'ok' : tone === 'bad' ? 'blocked' : tone === 'watch' ? 'watch' : 'tracked'} tone={tone} />
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-[#e9f8ef]', text: 'text-[#147a3b]' }
    if (tone === 'watch') return { bg: 'bg-[#fff4d6]', text: 'text-[#8a5a00]' }
    if (tone === 'bad') return { bg: 'bg-[#fff4f2]', text: 'text-[#a33428]' }
    return { bg: 'bg-[#eef3ff]', text: 'text-[#3056d3]' }
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
