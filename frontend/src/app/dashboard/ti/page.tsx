import Link from 'next/link'
import { Activity, AlertTriangle, ArrowRight, Camera, CheckCircle2, Clock3, DatabaseZap, ExternalLink, Factory, Globe2, HelpCircle, Layers3, PlayCircle, Radar, Route, Send, ShieldCheck, Webhook, Workflow } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import ManualRunButton from './manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiAdminPage() {
    const { sources, domains, captures, runs } = getTiAdminOverview()
    const enrichment = await getTiEnrichmentOverview()
    const activeSources = sources.filter(source => source.status === 'active').length
    const candidateSources = sources.filter(source => source.status === 'candidate' || source.status === 'review').length
    const restrictedSources = sources.filter(source => source.type === 'restricted_metadata').length
    const usefulRows = sources.reduce((sum, source) => sum + source.usefulRows, 0)
    const nextRun = [...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const latestRun = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]
    const runQueries = [...new Set(sources.flatMap(source => source.domains).filter(domain => !domain.includes('only')))]
    const sourceFamilies = [...new Set(sources.map(source => source.family))]
    const reviewDomains = domains.filter(domain => domain.status === 'review')
    const watchingDomains = domains.filter(domain => domain.status === 'watching')
    const sourcesWithCaptures = sources.filter(source => source.screenshotIds.length > 0)
    const freshSources = sources.filter(source => Date.now() - new Date(source.lastRunAt).getTime() <= 6 * 60 * 60 * 1000)
    const staleSources = sources.filter(source => Date.now() - new Date(source.lastRunAt).getTime() > 12 * 60 * 60 * 1000)
    const queuedOrRunningRuns = runs.filter(run => run.status === 'queued' || run.status === 'running')
    const newestCapture = [...captures].sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())[0]
    const workflowStatus = [
        {
            title: 'Watchlist triage',
            value: reviewDomains.length ? `${reviewDomains.length} review` : 'Steady',
            detail: `${watchingDomains.length} domains are actively watched and ${domains.length} have result pivots.`,
            icon: <ShieldCheck className='h-4 w-4' />,
            tone: reviewDomains.length ? 'warn' : 'ok',
        },
        {
            title: 'Webhook delivery',
            value: 'Placeholder',
            detail: 'No webhook delivery rows are exposed in the current TI admin overview shape.',
            icon: <Webhook className='h-4 w-4' />,
            tone: 'hold',
        },
        {
            title: 'Customer workflow',
            value: candidateSources ? `${candidateSources} setup` : 'Ready',
            detail: 'Customer routing is represented by watchlist domains, evidence packages, and source approval state until delivery records land.',
            icon: <Send className='h-4 w-4' />,
            tone: candidateSources ? 'hold' : 'ok',
        },
    ]
    const nextActions = [
        {
            title: reviewDomains.length ? `Review ${reviewDomains.length} watchlist match${reviewDomains.length === 1 ? '' : 'es'}` : 'Watchlist review is clear',
            detail: reviewDomains.length ? reviewDomains.map(domain => domain.domain).join(', ') : 'No domains are currently marked for analyst review.',
            href: '/dashboard/ti/domains',
        },
        {
            title: candidateSources ? 'Approve candidate sources' : 'Source approvals are clear',
            detail: candidateSources ? sources.filter(source => source.status === 'candidate' || source.status === 'review').map(source => source.name).join(', ') : 'No candidate or review sources are pending in the overview data.',
            href: '/dashboard/ti/sources',
        },
        {
            title: newestCapture ? `Promote ${newestCapture.domain}` : 'No capture evidence to promote',
            detail: newestCapture ? `${newestCapture.title} has capture metadata, timing, and source context ready to inspect.` : 'Capture rows will populate once source collectors emit screenshot metadata.',
            href: newestCapture ? `/dashboard/ti/sources/${newestCapture.sourceId}#${newestCapture.id}` : '/dashboard/ti/sources',
        },
    ]
    const machineLanes = [
        { title: 'Source factory', value: `${sourceFamilies.length} families`, detail: `${candidateSources} candidates in approval or canary review`, icon: <Factory className='h-4 w-4' /> },
        { title: 'Collection scheduler', value: nextRun ? formatTiDate(nextRun.nextRunAt) : 'No schedule', detail: `${activeSources} active sources with bounded cadence`, icon: <Route className='h-4 w-4' /> },
        { title: 'Evidence promotion', value: `${captures.length} captures`, detail: 'screenshots, hashes, source timing, and review state', icon: <Layers3 className='h-4 w-4' /> },
        { title: 'Customer delivery', value: `${domains.length} watch pivots`, detail: 'domain, vendor, actor, and webhook-ready alert paths', icon: <Send className='h-4 w-4' /> },
    ]
    const sourceFactory = [
        { stage: 'Public Telegram discovery', target: '3,000 candidate channels', state: 'Needs seeded discovery packs', detail: 'Broker rooms, ransomware mirrors, stealer-log shops, phishing-kit drops, and regional public channels. Private invites stay blocked.' },
        { stage: 'Restricted metadata atlas', target: '60,000 metadata records', state: `${restrictedSources} source families active locally`, detail: 'Actor pages, leak-site mirrors, I2P/Freenet/onion metadata, source hashes, liveness, and no raw leaked files.' },
        { stage: 'Quality gates', target: 'Payworthy rows only', state: `${usefulRows.toLocaleString()} useful rows tracked`, detail: 'Dedupe, source reliability, legal triage, confidence reasons, customer-watchlist match, and evidence retention class.' },
        { stage: 'Delivery contracts', target: 'Webhook/API/customer console', state: `${enrichment.stats.totalRefreshes} actor refreshes`, detail: 'Reviewed alert packets route to identity response, vendor risk, incident response, brand protection, or analyst review.' },
    ]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='TI operations'
                description='Admin view for source ingestion, run timing, domain-to-result surfacing, screenshot captures, and source metadata.'
                actions={<ManualRunButton label='Start all-source run' queries={runQueries} />}
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <Stat title='Sources' value={`${activeSources}/${sources.length}`} detail='active sources' icon={<DatabaseZap className='h-4 w-4' />} />
                <Stat title='Domains surfaced' value={`${domains.length}`} detail='watchlist/domain pivots' icon={<Globe2 className='h-4 w-4' />} />
                <Stat title='Screenshots' value={`${captures.length}`} detail='viewable capture records' icon={<Camera className='h-4 w-4' />} />
                <Stat title='Next run' value={nextRun ? formatTiDate(nextRun.nextRunAt) : 'No schedule'} detail={nextRun?.name || 'No source'} icon={<PlayCircle className='h-4 w-4' />} />
                <Stat title='Actor enrichment' value={`${enrichment.stats.updatedLastHour}`} detail={`${enrichment.worker.state} worker`} icon={<Radar className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='overflow-hidden p-0'>
                <div className='grid xl:grid-cols-[0.95fr_1.05fr]'>
                    <div className='bg-[#0d1320] p-5 text-white'>
                        <div className='flex items-center gap-2 text-[#9db4ff]'>
                            <Workflow className='h-4 w-4' />
                            <p className='text-xs font-semibold uppercase'>Operating machine</p>
                        </div>
                        <h2 className='mt-3 text-2xl font-semibold'>Collection, enrichment, review, and delivery in one loop.</h2>
                        <p className='mt-3 text-sm leading-6 text-[#c8d2e4]'>
                            The overview should prove the system is working: sources are discovered and approved, collectors run on cadence, evidence is promoted safely, and customer-facing alerts leave through known delivery paths.
                        </p>
                        <div className='mt-5 grid gap-3 sm:grid-cols-2'>
                            {machineLanes.map(lane => (
                                <div key={lane.title} className='rounded-lg border border-white/10 bg-white/6 p-3'>
                                    <div className='flex items-center justify-between gap-3 text-[#9db4ff]'>
                                        <p className='text-xs font-semibold uppercase'>{lane.title}</p>
                                        {lane.icon}
                                    </div>
                                    <p className='mt-3 text-lg font-semibold text-white'>{lane.value}</p>
                                    <p className='mt-1 text-xs leading-5 text-[#c8d2e4]'>{lane.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className='grid gap-3 bg-white p-5'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <PanelHeading
                                title='Source factory'
                                description='Discovery targets, approval packets, and active sources are separate states. The product can chase thousands of candidates without pretending incomplete coverage is finished.'
                            />
                            <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                                Source inventory
                            </Link>
                        </div>
                        <div className='grid gap-3'>
                            {sourceFactory.map(item => (
                                <div key={item.stage} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[0.72fr_0.7fr_1fr] md:items-center'>
                                    <div>
                                        <p className='text-sm font-semibold text-[#171a21]'>{item.stage}</p>
                                        <p className='mt-1 text-xs text-[#667085]'>{item.target}</p>
                                    </div>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{item.state}</span>
                                    <p className='text-sm leading-6 text-[#596170]'>{item.detail}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 lg:grid-cols-3'>
                <MachineCard
                    icon={<ShieldCheck className='h-4 w-4' />}
                    title='Safety boundary'
                    body='Restricted sources stay metadata-only: source timing, hashes, screenshots when approved, liveness, actor/victim fields, and no payload or credential retrieval.'
                />
                <MachineCard
                    icon={<Activity className='h-4 w-4' />}
                    title='Freshness loop'
                    body='Sources carry last run, next run, cadence, useful rows, and current queue state so stale promises are visible as operational gaps.'
                />
                <MachineCard
                    icon={<Radar className='h-4 w-4' />}
                    title='Buyer value filter'
                    body='The system promotes company, vendor, actor, domain, session, token, and infrastructure exposure instead of dumping generic scraped rows.'
                />
            </div>

            <div className='grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <DashboardPanel className='p-5'>
                    <PanelHeading
                        title='Freshness and coverage'
                        description='Freshness is calculated from source last-run timestamps. Coverage is based on source watch terms, domain pivots, captures, and current run state.'
                    />
                    <div className='mt-4 grid gap-3'>
                        <HealthRow label='Fresh within 6h' value={freshSources.length} total={sources.length} icon={<CheckCircle2 className='h-4 w-4' />} tone='ok' />
                        <HealthRow label='Stale over 12h' value={staleSources.length} total={sources.length} icon={<AlertTriangle className='h-4 w-4' />} tone={staleSources.length ? 'warn' : 'ok'} />
                        <HealthRow label='Sources with captures' value={sourcesWithCaptures.length} total={sources.length} icon={<Camera className='h-4 w-4' />} tone='ok' />
                        <HealthRow label='Active or queued runs' value={queuedOrRunningRuns.length} total={Math.max(runs.length, 1)} icon={<Clock3 className='h-4 w-4' />} tone={queuedOrRunningRuns.length ? 'hold' : 'ok'} />
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <PanelHeading
                        title='Workflow status'
                        description='Watchlist, webhook, and customer workflow states are separated so real data and explicit placeholders are easy to distinguish.'
                    />
                    <div className='mt-4 grid gap-3 lg:grid-cols-3'>
                        {workflowStatus.map(item => (
                            <div key={item.title} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4'>
                                <div className='flex items-center justify-between gap-3 text-[#667085]'>
                                    <p className='text-xs font-semibold uppercase'>{item.title}</p>
                                    {item.icon}
                                </div>
                                <p className='mt-3 text-lg font-semibold text-[#171a21]'>{item.value}</p>
                                <StatusPill value={item.tone} />
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{item.detail}</p>
                            </div>
                        ))}
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <PanelHeading
                                title='Ingestion schedule'
                                description='Each row is a monitored source. Last run shows when it was checked; next run shows when the background collector will check it again.'
                            />
                            <p className='mt-1 text-sm text-[#596170]'>Last and next source runs, sorted by the next scheduled check.</p>
                        </div>
                        <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                            Sources
                            <ExternalLink className='h-4 w-4' />
                        </Link>
                    </div>
                    <div className='mt-4 overflow-x-auto rounded-lg border border-[#e0e5ed]'>
                        <div className='min-w-[46rem]'>
                            <div className='grid grid-cols-[1.2fr_0.9fr_0.9fr_0.65fr] bg-[#f8fafc] px-3 py-2 text-xs font-semibold uppercase text-[#667085]'>
                                <span>Source</span>
                                <span>Last run</span>
                                <span>Next run</span>
                                <span>Status</span>
                            </div>
                            {[...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()).map(source => (
                                <Link key={source.id} href={`/dashboard/ti/sources/${source.id}`} className='grid grid-cols-[1.2fr_0.9fr_0.9fr_0.65fr] gap-3 border-t border-[#eef1f5] px-3 py-3 text-sm hover:bg-[#fbfcfe]'>
                                    <span className='min-w-0 truncate font-semibold text-[#171a21]'>{source.name}</span>
                                    <span className='text-[#596170]'>{formatTiDate(source.lastRunAt)}</span>
                                    <span className='text-[#596170]'>{formatTiDate(source.nextRunAt)}</span>
                                    <span className='capitalize text-[#3056d3]'>{source.status} · {source.domains.length} terms</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <PanelHeading
                        title='Latest run'
                        description='The newest collection job result: which source ran, when it started, and how many rows, captures, and screenshots it produced.'
                    />
                    <p className='mt-1 text-sm text-[#596170]'>{latestRun?.message || 'No run found.'}</p>
                    {latestRun ? (
                        <div className='mt-4 grid gap-3'>
                            <Info label='Source' value={sourceById(latestRun.sourceId)?.name || latestRun.sourceId} />
                            <Info label='Started' value={formatTiDate(latestRun.startedAt)} />
                            <Info label='Rows' value={`${latestRun.rows} rows, ${latestRun.captures} captures, ${latestRun.screenshots} screenshots`} />
                            <Info label='Queue' value={`${queuedOrRunningRuns.length} active/queued, ${runs.length} visible runs`} />
                            <Link href='/dashboard/ti/runs' className='inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                                View runs
                            </Link>
                        </div>
                    ) : null}
                </DashboardPanel>
            </div>

            <DashboardPanel className='p-5'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <PanelHeading
                            title='Domain surfacing'
                            description='Shows which watched company domains or names appeared in monitored results, and which sources produced those matches.'
                        />
                        <p className='mt-1 text-sm text-[#596170]'>Which monitored domains are producing results, and which sources surfaced them.</p>
                    </div>
                    <Link href='/dashboard/ti/domains' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>All domains</Link>
                </div>
                <div className='mt-4 grid gap-2 md:grid-cols-2'>
                    {domains.map(domain => (
                        <Link key={domain.domain} href={`/dashboard/ti/domains/${encodeURIComponent(domain.domain)}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 hover:border-[#c8d1df]'>
                            <div className='flex items-center justify-between gap-3'>
                                <h3 className='font-semibold text-[#171a21]'>{domain.company}</h3>
                                <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold text-[#3056d3]'>{domain.resultCount} results</span>
                            </div>
                            <p className='mt-1 font-mono text-sm text-[#596170]'>{domain.domain}</p>
                            <p className='mt-2 text-xs text-[#667085]'>{domain.sourceIds.map(id => sourceById(id)?.name || id).join(', ')}</p>
                        </Link>
                    ))}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-5'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <PanelHeading
                        title='Next actions'
                        description='Prioritized operator actions derived from review domains, source activation state, capture records, and the current run queue.'
                    />
                    <Link href='/dashboard/ti/runs' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                        Run log
                        <ExternalLink className='h-4 w-4' />
                    </Link>
                </div>
                <div className='mt-4 grid gap-3 lg:grid-cols-3'>
                    {nextActions.map(action => (
                        <Link key={action.title} href={action.href} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
                            <div className='flex items-start justify-between gap-3'>
                                <div>
                                    <h3 className='font-semibold text-[#171a21]'>{action.title}</h3>
                                    <p className='mt-2 text-sm leading-6 text-[#596170]'>{action.detail}</p>
                                </div>
                                <ArrowRight className='mt-1 h-4 w-4 shrink-0 text-[#3056d3]' />
                            </div>
                        </Link>
                    ))}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-5'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <PanelHeading
                            title='Automatic actor enrichment'
                            description='The background job refreshes stable actor profiles, aliases, sources, targeting, and tradecraft so searches do not depend on one manual profile.'
                        />
                        <p className='mt-1 text-sm text-[#596170]'>The API worker last finished {enrichment.worker.lastSweepFinishedAt ? formatTiDate(enrichment.worker.lastSweepFinishedAt) : 'no recorded sweep'} and has recorded {enrichment.stats.totalRefreshes} profile refreshes.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/ti/activity' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>Activity</Link>
                        <Link href='/dashboard/ti/enrichment' className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white hover:bg-[#2b2f39]'>Enrichment queue</Link>
                        <Link href='/dashboard/ti/audit' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>Audit log</Link>
                    </div>
                </div>
                <div className='mt-4 grid gap-3 lg:grid-cols-3'>
                    {enrichment.updatedActors.slice(0, 3).map(actor => (
                        <Link key={actor.id} href={`/ti/${encodeURIComponent(actor.id)}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'>
                            <div className='flex items-center justify-between gap-3'>
                                <h3 className='font-semibold text-[#171a21]'>{actor.name}</h3>
                                <span className='rounded-full bg-[#e9f8ef] px-2 py-1 text-xs font-semibold text-[#147a3b]'>{actor.status}</span>
                            </div>
                            <p className='mt-2 text-xs text-[#667085]'>Updated {formatTiDate(actor.lastUpdatedAt)}</p>
                            <p className='mt-2 text-sm leading-6 text-[#596170]'>{actor.automationEvidence[0]}</p>
                        </Link>
                    ))}
                    {!enrichment.updatedActors.length ? <p className='text-sm text-[#596170]'>No live actor refreshes have been recorded by the API worker yet.</p> : null}
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2'>
                    <Radar className='h-4 w-4 text-[#3056d3]' />
                    <PanelHeading
                        title='Screenshot captures'
                        description='Visual records from monitored pages. Open a capture to see when it was published, when it was captured, ownership, page type, and metadata.'
                    />
                </div>
                <div className='mt-4 grid gap-3 lg:grid-cols-3'>
                    {captures.map(capture => (
                        <Link key={capture.id} href={`/dashboard/ti/sources/${capture.sourceId}#${capture.id}`} className='overflow-hidden rounded-lg border border-[#e0e5ed] bg-white hover:border-[#c8d1df]'>
                            <div className='grid h-36 content-between bg-[#0e1520] p-3 text-white'>
                                <div className='text-xs uppercase text-[#9db4ff]'>{capture.actor}</div>
                                <div>
                                    <p className='text-lg font-semibold'>{capture.domain}</p>
                                    <p className='mt-1 text-xs text-[#c7d0df]'>{capture.screenshotLabel}</p>
                                </div>
                            </div>
                            <div className='p-3'>
                                <p className='text-sm font-semibold text-[#171a21]'>{capture.title}</p>
                                <p className='mt-1 text-xs text-[#667085]'>Captured {formatTiDate(capture.capturedAt)}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function PanelHeading({ title, description }: { title: string, description: string }) {
    return (
        <div className='flex items-center gap-2'>
            <h2 className='text-lg font-semibold text-[#171a21]'>{title}</h2>
            <span className='group relative inline-flex'>
                <button
                    type='button'
                    aria-label={description}
                    className='inline-flex h-6 w-6 items-center justify-center rounded-full text-[#667085] transition hover:bg-[#eef3ff] hover:text-[#3056d3] focus:outline-none focus:ring-2 focus:ring-[#b8c5ff]'
                >
                    <HelpCircle className='h-3.5 w-3.5' />
                </button>
                <span className='pointer-events-none absolute left-1/2 top-7 z-20 hidden w-72 -translate-x-1/2 rounded-lg border border-[#dfe5ee] bg-white p-3 text-left text-xs font-medium leading-5 text-[#404957] shadow-xl group-hover:block group-focus-within:block'>
                    {description}
                </span>
            </span>
        </div>
    )
}

function Stat({ title, value, detail, icon }: { title: string, value: string, detail: string, icon: React.ReactNode }) {
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

function MachineCard({ icon, title, body }: { icon: React.ReactNode, title: string, body: string }) {
    return (
        <DashboardPanel className='p-5'>
            <div className='text-[#3056d3]'>{icon}</div>
            <h2 className='mt-3 text-base font-semibold text-[#171a21]'>{title}</h2>
            <p className='mt-2 text-sm leading-6 text-[#596170]'>{body}</p>
        </DashboardPanel>
    )
}

function HealthRow({ label, value, total, icon, tone }: { label: string, value: number, total: number, icon: React.ReactNode, tone: 'ok' | 'warn' | 'hold' }) {
    const percent = total ? Math.round((value / total) * 100) : 0
    const barClass = tone === 'warn' ? 'bg-[#d68a00]' : tone === 'hold' ? 'bg-[#3056d3]' : 'bg-[#147a3b]'

    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <div className='flex items-center justify-between gap-3'>
                <div className='flex items-center gap-2 text-[#667085]'>
                    {icon}
                    <p className='text-sm font-semibold text-[#344054]'>{label}</p>
                </div>
                <span className='text-sm font-semibold text-[#171a21]'>{value}/{total}</span>
            </div>
            <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#e9edf4]'>
                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.max(value ? 8 : 0, percent)}%` }} />
            </div>
        </div>
    )
}

function StatusPill({ value }: { value: string }) {
    const toneClass = {
        ok: 'bg-[#e9f8ef] text-[#147a3b]',
        hold: 'bg-[#eef3ff] text-[#3056d3]',
        warn: 'bg-[#fff4d6] text-[#8a5a00]',
    }[value] || 'bg-[#eef3ff] text-[#3056d3]'

    return <span className={`mt-2 inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold capitalize ${toneClass}`}>{value}</span>
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
