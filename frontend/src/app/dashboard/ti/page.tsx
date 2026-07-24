import type { ReactNode } from 'react'
import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, Camera, Clock3, DatabaseZap, ExternalLink, PlayCircle, Radar, Send, ShieldCheck, Webhook } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate, getTiAdminOverview, sourceById, type TiAdminOverview } from '@/utils/tiAdmin/ops'
import { evidenceStrengthLabel } from '@/utils/dwm/display'
import ManualRunButton from './manualRunButton'
import TiDataAvailability from './ti-data-availability'

export const dynamic = 'force-dynamic'

export default async function TiAdminPage() {
    const overview = await getTiAdminOverview()
    const { sources, domains, captures, runs } = overview
    const enrichment = await getTiEnrichmentOverview()
    const now = Date.now()

    const candidateSources = sources.filter(source => source.status === 'candidate' || source.status === 'review')
    const staleSources = sources.filter(source => now - new Date(source.lastRunAt).getTime() > 12 * 60 * 60 * 1000)
    const reviewDomains = domains.filter(domain => domain.status === 'review')
    const queuedRuns = runs.filter(run => run.status === 'queued' || run.status === 'running')
    const failedRuns = runs.filter(run => run.status === 'failed')
    const nextRun = [...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const latestRun = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
    const latestCapture = [...captures].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0]
    const actorRows = [...enrichment.updatedActors, ...enrichment.queuedActors]
    const activeActorRun = enrichment.pipeline?.latestRuns.find(run => run.status === 'running') || enrichment.pipeline?.latestRuns[0]
    const currentActor = actorRows.find(actor => activeActorRun && (sameKey(actor.name) === sameKey(activeActorRun.actor_name) || sameKey(actor.id) === sameKey(activeActorRun.actor_key))) || actorRows[0]
    const latestDiscovery = enrichment.pipeline?.latestDiscoveries[0]
    const runQueries = [...new Set(sources.flatMap(source => source.domains).filter(domain => !domain.includes('only')))]
    const actionItems = buildActionItems({ reviewDomains, candidateSources, staleSources, failedRuns, latestCapture })

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Latest activity'
                description='Watch collection, enrichment, evidence, and delivery work move in one place.'
                actions={<ManualRunButton label='Run collection' queries={runQueries} />}
            />
            <TiDataAvailability availability={overview.availability} />

            <section className='grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr]'>
                <LiveLane
                    title='Collection'
                    href='/dashboard/ti/control'
                    icon={<DatabaseZap className='h-4 w-4' />}
                    state={operationalStateLabel(latestRun?.status || 'scheduled')}
                    stateTone={latestRun?.status === 'failed' ? 'bad' : latestRun?.status === 'running' || latestRun?.status === 'queued' ? 'watch' : 'ok'}
                    primary={latestRun?.sourceName || nextRun?.name || 'Selecting source'}
                    secondary={latestRun ? `${latestRun.rows} rows, ${latestRun.captures} captures, ${latestRun.screenshots} screenshots` : `Next due ${nextRun ? shortTime(nextRun.nextRunAt) : 'as soon as a source lease opens'}`}
                    footer={latestRun ? `Started ${shortTime(latestRun.startedAt)}` : 'Scheduler is selecting the next source'}
                />
                <LiveLane
                    title='Actor profiles'
                    href='/dashboard/ti/enrichment'
                    icon={<Radar className='h-4 w-4' />}
                    state={operationalStateLabel(enrichment.worker.state)}
                    stateTone={enrichment.worker.state === 'running' ? 'ok' : enrichment.worker.state === 'error' || enrichment.worker.state === 'unavailable' ? 'bad' : 'watch'}
                    primary={currentActor?.name || activeActorRun?.actor_name || 'Selecting actor'}
                    secondary={latestDiscovery ? latestDiscovery.title : `${enrichment.stats.updatedLastHour} profile updates in the last hour`}
                    footer={activeActorRun ? `Run ${operationalStateLabel(activeActorRun.status)}` : `${enrichment.stats.queued} actors queued`}
                />
                <LiveLane
                    title='Recent evidence'
                    href='/dashboard/ti/activity'
                    icon={<Camera className='h-4 w-4' />}
                    state={latestCapture ? 'captured' : 'watching'}
                    stateTone={latestCapture ? 'ok' : 'neutral'}
                    primary={latestCapture?.title || 'Checking evidence sources'}
                    secondary={latestCapture?.resultSummary || `${captures.length} stored captures ready for review`}
                    footer={latestCapture ? `${latestCapture.actor} · ${shortTime(latestCapture.capturedAt)}` : 'Collectors are checking sources'}
                />
            </section>

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-6'>
                <Metric title='Active sources' value={`${overview.sourceTotals.active}/${overview.sourcePage.total}`} icon={<DatabaseZap className='h-4 w-4' />} />
                <Metric title='Items to review' value={`${reviewDomains.length + candidateSources.length + failedRuns.length}`} tone={reviewDomains.length || candidateSources.length || failedRuns.length ? 'watch' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Stale sources' value={`${staleSources.length}`} tone={staleSources.length ? 'bad' : 'ok'} icon={<Clock3 className='h-4 w-4' />} />
                <Metric title='Recent capture sample' value={`${captures.length}`} icon={<Camera className='h-4 w-4' />} />
                <Metric title='Actor worker' value={operationalStateLabel(enrichment.worker.state)} tone={enrichment.worker.state === 'running' ? 'ok' : enrichment.worker.state === 'error' || enrichment.worker.state === 'unavailable' ? 'bad' : 'watch'} icon={<Radar className='h-4 w-4' />} />
                <Metric title='Next run' value={nextRun ? shortTime(nextRun.nextRunAt) : 'Selecting'} icon={<PlayCircle className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='border-b border-ui-border bg-ui-raised p-4 text-ui-text'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold'>Next actions</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{actionItems.length} items sorted by operator impact.</p>
                        </div>
                        <div className='flex flex-wrap gap-2 text-xs font-semibold'>
                            <StatusPill label={`${queuedRuns.length} running/queued`} tone={queuedRuns.length ? 'watch' : 'neutral'} />
                            <StatusPill label={`latest ${operationalStateLabel(latestRun?.status || 'scheduled')}`} tone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'neutral'} />
                            <StatusPill label={`${enrichment.stats.updatedLastHour} actor updates 1h`} tone='neutral' />
                        </div>
                    </div>
                </div>
                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-ui-border text-sm'>
                        <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                            <tr>
                                <th className='px-4 py-3'>Priority</th>
                                <th className='px-4 py-3'>Item</th>
                                <th className='px-4 py-3'>Reason</th>
                                <th className='px-4 py-3'>State</th>
                                <th className='px-4 py-3 text-right'>Open</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border bg-ui-panel'>
                            {actionItems.map(item => (
                                <tr key={`${item.kind}-${item.title}`} className='hover:bg-ui-panel'>
                                    <td className='px-4 py-4'><StatusPill label={item.priority} tone={item.tone} /></td>
                                    <td className='px-4 py-3 font-semibold text-ui-text'>{item.title}</td>
                                    <td className='px-4 py-3 text-ui-muted'>{item.reason}</td>
                                    <td className='px-4 py-3 text-ui-muted'>{operationalStateLabel(item.state)}</td>
                                    <td className='px-4 py-4 text-right'>
                                        <Link href={item.href} className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                                            Open
                                            <ArrowRight className='h-3.5 w-3.5' />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {!actionItems.length ? (
                                <tr>
                                    <td colSpan={5} className='px-4 py-8 text-center text-sm text-ui-muted'>No items need review right now. Retry and approval rows appear here.</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <PanelTitle title='Sources being checked' actionHref='/dashboard/ti/sources' actionLabel='Sources' />
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-ui-border text-sm'>
                            <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-4 py-3'>Source</th>
                                    <th className='px-4 py-3'>Status</th>
                                    <th className='px-4 py-3'>Findings</th>
                                    <th className='px-4 py-3'>Last seen</th>
                                    <th className='px-4 py-3'>Due</th>
                                    <th className='px-4 py-3'>Matches</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                {[...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()).map(source => {
                                    const stale = staleSources.includes(source)
                                    const sourceRuns = runs.filter(run => run.sourceId === source.id)
                                    const rowsPerRun = sourceRuns.length ? Math.round(sourceRuns.reduce((sum, run) => sum + run.rows, 0) / sourceRuns.length) : 0
                                    return (
                                        <tr key={source.id} className='hover:bg-ui-panel'>
                                            <td className='px-4 py-4'>
                                                <Link href={`/dashboard/ti/sources/${source.id}`} className='font-semibold text-ui-text hover:text-ui-primary'>{source.name}</Link>
                                                <p className='mt-1 text-xs text-ui-muted'>{source.family}</p>
                                            </td>
                                            <td className='px-4 py-4'><StatusPill label={stale ? 'stale' : operationalStateLabel(source.status)} tone={stale ? 'bad' : source.status === 'active' ? 'ok' : 'watch'} /></td>
                                            <td className='px-4 py-3 text-ui-muted'>{rowsPerRun ? `${rowsPerRun} rows/run` : `${source.retainedEvidenceCount} retained captures`}</td>
                                            <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(source.lastRunAt)}</td>
                                            <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(source.nextRunAt)}</td>
                                            <td className='px-4 py-3 text-ui-muted'>{source.domains.length} terms · {source.resultTypes.length} result types</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <PanelTitle title='Delivery state' actionHref='/dashboard/dwm' actionLabel='Dark web cases' />
                    <div className='grid gap-3 p-4'>
                        <DeliveryRow icon={<ShieldCheck className='h-4 w-4' />} title='Matches to review' value={`${reviewDomains.length} entity matches`} tone={reviewDomains.length ? 'watch' : 'ok'} />
                        <DeliveryRow icon={<Webhook className='h-4 w-4' />} title='Webhook delivery' value='Delivery records are linked to dark web alerts' tone='neutral' />
                        <DeliveryRow icon={<Send className='h-4 w-4' />} title='Customer routing' value={`${domains.length} monitored entities`} tone='neutral' />
                        <DeliveryRow icon={<Activity className='h-4 w-4' />} title='Latest collection' value={latestRun ? `${operationalStateLabel(latestRun.status)} · ${formatTiDate(latestRun.startedAt)}` : 'Selecting source'} tone={latestRun?.status === 'failed' ? 'bad' : latestRun ? 'ok' : 'neutral'} />
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 xl:grid-cols-2'>
                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <PanelTitle title='Monitored entities' actionHref='/dashboard/ti/domains' actionLabel='Entities' />
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-ui-border text-sm'>
                            <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-4 py-3'>Entity</th>
                                    <th className='px-4 py-3'>State</th>
                                    <th className='px-4 py-3'>Results</th>
                                    <th className='px-4 py-3'>Last seen</th>
                                    <th className='px-4 py-3'>Sources</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                {domains.map(domain => (
                                    <tr key={domain.domain} className='hover:bg-ui-panel'>
                                        <td className='px-4 py-4'>
                                            <Link href={`/dashboard/ti/domains/${encodeURIComponent(domain.domain)}`} className='font-semibold text-ui-text hover:text-ui-primary'>{domain.company}</Link>
                                            <p className='mt-1 font-mono text-xs text-ui-muted'>{domain.domain}</p>
                                        </td>
                                        <td className='px-4 py-4'><StatusPill label={operationalStateLabel(domain.status)} tone={domain.status === 'review' ? 'watch' : domain.status === 'watching' ? 'ok' : 'neutral'} /></td>
                                        <td className='px-4 py-3 font-semibold text-ui-text'>{domain.resultCount}</td>
                                        <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(domain.lastSeenAt)}</td>
                                        <td className='px-4 py-3 text-ui-muted'>{domain.sourceIds.map(id => sourceById(overview, id)?.name || id).join(', ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <PanelTitle title='Recent evidence' actionHref='/dashboard/ti/sources' actionLabel='Evidence' />
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-ui-border text-sm'>
                            <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-4 py-3'>Capture</th>
                                    <th className='px-4 py-3'>Actor</th>
                                    <th className='px-4 py-3'>Source</th>
                                    <th className='px-4 py-3'>Captured</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border bg-ui-panel'>
                                {captures.map(capture => (
                                    <tr key={capture.id} className='hover:bg-ui-panel'>
                                        <td className='px-4 py-4'>
                                            <Link href={`/dashboard/ti/sources/${capture.sourceId}#${capture.id}`} className='font-semibold text-ui-text hover:text-ui-primary'>{capture.title}</Link>
                                            <p className='mt-1 text-xs text-ui-muted'>{capture.domain}</p>
                                        </td>
                                        <td className='px-4 py-3 font-semibold text-ui-text'>{capture.actor}</td>
                                        <td className='px-4 py-3 text-ui-muted'>{capture.sourceName}</td>
                                        <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(capture.capturedAt)}</td>
                                    </tr>
                                ))}
                                {!captures.length ? (
                                    <tr>
                                        <td colSpan={4} className='px-4 py-8 text-center text-sm text-ui-muted'>Collectors are checking sources; accepted captures stream here.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>
            </div>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <PanelTitle title='Actors being enriched' actionHref='/dashboard/ti/enrichment' actionLabel='Enrichment' />
                <div className='overflow-x-auto'>
                    <table className='min-w-full divide-y divide-ui-border text-sm'>
                        <thead className='bg-ui-canvas text-left text-xs font-semibold uppercase text-ui-muted'>
                            <tr>
                                <th className='px-4 py-3'>Actor</th>
                                <th className='px-4 py-3'>Status</th>
                                <th className='px-4 py-3'>Evidence strength</th>
                                <th className='px-4 py-3'>Sources</th>
                                <th className='px-4 py-3'>Last update</th>
                                <th className='px-4 py-3'>Next refresh</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border bg-ui-panel'>
                            {[...enrichment.updatedActors, ...enrichment.queuedActors].slice(0, 8).map(actor => (
                                <tr key={`${actor.id}-${actor.status}`} className='hover:bg-ui-panel'>
                                    <td className='px-4 py-4'>
                                        <Link href={`/ti/${encodeURIComponent(actor.id)}`} className='font-semibold text-ui-text hover:text-ui-primary'>{actor.name}</Link>
                                        <p className='mt-1 text-xs text-ui-muted'>{actor.changedFields.length ? actor.changedFields.join(', ') : 'queued'}</p>
                                    </td>
                                    <td className='px-4 py-4'><StatusPill label={operationalStateLabel(actor.status)} tone={actor.status === 'queued' ? 'neutral' : actor.status === 'review' ? 'watch' : 'ok'} /></td>
                                    <td className='px-4 py-3 font-semibold text-ui-text'>{evidenceStrengthLabel(actor.confidence)}</td>
                                    <td className='px-4 py-3 text-ui-muted'>{actor.sourceLinks.length}</td>
                                    <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(actor.lastUpdatedAt)}</td>
                                    <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(actor.nextRefreshAt)}</td>
                                </tr>
                            ))}
                            {!enrichment.updatedActors.length && !enrichment.queuedActors.length ? (
                                <tr>
                                    <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>Actor profiles are updating. New profile changes appear here.</td>
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
    reviewDomains: TiAdminOverview['domains']
    candidateSources: TiAdminOverview['sources']
    staleSources: TiAdminOverview['sources']
    failedRuns: TiAdminOverview['runs']
    latestCapture?: TiAdminOverview['captures'][number]
}) {
    return [
        ...reviewDomains.map(domain => ({
            kind: 'domain',
            priority: 'review',
            tone: 'watch' as const,
            title: domain.company,
            reason: `${domain.resultCount} result${domain.resultCount === 1 ? '' : 's'} with linked sources for ${domain.domain}`,
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
        <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-xs font-semibold uppercase text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className='mt-3 text-xl font-semibold capitalize text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function LiveLane({ title, href, icon, state, stateTone, primary, secondary, footer }: {
    title: string
    href: string
    icon: ReactNode
    state: string
    stateTone: 'neutral' | 'ok' | 'watch' | 'bad'
    primary: string
    secondary: string
    footer: string
}) {
    return (
        <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'>
                    <span className='text-ui-primary'>{icon}</span>
                    <span className='truncate'>{title}</span>
                </div>
                <StatusPill label={state} tone={stateTone} />
            </div>
            <div className='grid gap-3 p-4'>
                <div>
                    <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{primary}</p>
                    <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{secondary}</p>
                </div>
                <div className='flex items-center justify-between gap-3'>
                    <span className='truncate text-xs text-ui-muted'>{footer}</span>
                    <Link href={href} className='inline-flex h-8 items-center gap-1.5 rounded-md border border-ui-border bg-ui-panel px-2.5 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                        Open
                        <ArrowRight className='h-3.5 w-3.5' />
                    </Link>
                </div>
            </div>
        </DashboardPanel>
    )
}

function PanelTitle({ title, actionHref, actionLabel }: { title: string, actionHref: string, actionLabel: string }) {
    return (
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
            <h2 className='text-base font-semibold text-ui-text'>{title}</h2>
            <Link href={actionHref} className='inline-flex h-8 items-center gap-1 rounded-md border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-raised'>
                {actionLabel}
                <ExternalLink className='h-3.5 w-3.5' />
            </Link>
        </div>
    )
}

function DeliveryRow({ icon, title, value, tone }: { icon: ReactNode, title: string, value: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <div className='flex items-start justify-between gap-3 rounded-md border border-ui-border bg-ui-canvas p-3'>
            <div className='flex min-w-0 gap-3'>
                <span className={toneClass(tone).text}>{icon}</span>
                <div className='min-w-0'>
                    <p className='font-semibold text-ui-text'>{title}</p>
                    <p className='mt-1 text-sm text-ui-muted'>{value}</p>
                </div>
            </div>
            <StatusPill label={tone === 'ok' ? 'ok' : tone === 'bad' ? 'attention' : tone === 'watch' ? 'watch' : 'tracked'} tone={tone} />
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-ui-success/10 border border-ui-success/35', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/10 border border-ui-warning/35', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-danger/10 border border-ui-danger/35', text: 'text-ui-danger' }
    return { bg: 'bg-ui-panel border border-ui-border', text: 'text-ui-primary' }
}

function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action') return 'reviewing'
    if (value === 'review') return 'reviewing'
    return value.replaceAll('_', ' ')
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

function sameKey(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
