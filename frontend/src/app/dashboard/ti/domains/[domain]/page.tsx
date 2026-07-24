import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Camera, CheckCircle2, Clock3, DatabaseZap, ExternalLink, Radio, ShieldAlert, Zap } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { domainCaptures, formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import TiDataAvailability from '../../ti-data-availability'

export const dynamic = 'force-dynamic'

export default async function TiDomainDetailPage(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params
    const overview = await getTiAdminOverview()
    const domain = overview.domains.find(item => item.domain === decodeURIComponent(params.domain))

    if (!domain && overview.availability.state === 'live') return notFound()
    if (!domain) return (
        <DashboardPage>
            <DashboardHeader eyebrow='Monitored entity' title='Entity unavailable' description='The live evidence record could not be loaded.' />
            <TiDataAvailability availability={overview.availability} />
        </DashboardPage>
    )

    const captures = domainCaptures(overview, domain.domain).sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    const sources = domain.sourceIds.map(id => sourceById(overview, id)).filter(source => Boolean(source))
    const staleSources = sources.filter(source => new Date(source!.nextRunAt).getTime() < Date.now())
    const latestCapture = captures[0]
    const statusTone = domain.status === 'review' ? 'watch' : domain.status === 'watching' ? 'ok' : 'neutral'
    const hotSource = sources
        .filter(source => Boolean(source))
        .sort((a, b) => new Date(b!.lastRunAt).getTime() - new Date(a!.lastRunAt).getTime())[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitored entity'
                title={domain.company}
                description={`${domain.domain} is being watched across ${sources.length} source${sources.length === 1 ? '' : 's'}.`}
            />
            <TiDataAvailability availability={overview.availability} />

            <div className='flex flex-wrap items-center justify-between gap-3'>
                <Link href='/dashboard/ti/domains' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text hover:border-ui-border hover:bg-ui-raised'>
                    <ArrowLeft className='h-4 w-4' />
                    Entities
                </Link>
                <div className='flex flex-wrap gap-2'>
                    <Link href='/dashboard/ti/workbench' className='inline-flex h-9 items-center gap-2 rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-text hover:bg-ui-primary'>
                        <ShieldAlert className='h-4 w-4' />
                        Open recent attacks
                    </Link>
                    <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text hover:border-ui-border hover:bg-ui-raised'>
                        Source inventory
                    </Link>
                </div>
            </div>

            <DashboardPanel className='overflow-hidden'>
                <div className='grid gap-0 lg:grid-cols-[1.3fr_0.7fr]'>
                    <div className='bg-ui-raised p-5 text-ui-text'>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <StatusPill label={operationalStateLabel(domain.status)} tone={statusTone} />
                                    {staleSources.length ? <StatusPill label={`${staleSources.length} stale source${staleSources.length === 1 ? '' : 's'}`} tone='watch' /> : <StatusPill label='sources current' tone='ok' />}
                                </div>
                                <h2 className='mt-4 text-2xl font-semibold'>{domain.domain}</h2>
                                <p className='mt-2 text-sm text-ui-muted'>Matched terms: {domain.matchedTerms.join(', ')}</p>
                            </div>
                            <div className='grid gap-2 text-right text-sm'>
                                <span className='text-ui-muted'>Last seen</span>
                                <span className='font-semibold'>{formatTiDate(domain.lastSeenAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div className='grid grid-cols-2 gap-0 border-l border-ui-border bg-ui-canvas sm:grid-cols-4 lg:grid-cols-2'>
                        <CaseMetric title='Results' value={`${domain.resultCount}`} icon={<DatabaseZap className='h-4 w-4' />} />
                        <CaseMetric title='Evidence' value={`${captures.length}`} icon={<Camera className='h-4 w-4' />} />
                        <CaseMetric title='Sources' value={`${sources.length}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                        <CaseMetric title='Latest' value={latestCapture ? shortTime(latestCapture.capturedAt) : 'checking'} icon={<Clock3 className='h-4 w-4' />} />
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-3 xl:grid-cols-3'>
                <OperationCard
                    icon={<Radio className='h-4 w-4' />}
                    title='Entity operation'
                    value={domain.status === 'review' ? 'analyst review' : domain.status === 'watching' ? 'watching' : 'low-noise watch'}
                    detail={`${domain.resultCount} result${domain.resultCount === 1 ? '' : 's'} tracked for ${domain.company}`}
                    tone={statusTone}
                />
                <OperationCard
                    icon={<Zap className='h-4 w-4' />}
                    title='Active source'
                    value={hotSource?.name || 'source queue'}
                    detail={hotSource ? `last checked ${shortAge(hotSource.lastRunAt)}; next check ${shortAge(hotSource.nextRunAt)}` : 'source registry is checking coverage'}
                    tone={staleSources.length ? 'watch' : 'ok'}
                />
                <OperationCard
                    icon={<DatabaseZap className='h-4 w-4' />}
                    title='Evidence stream'
                    value={latestCapture ? latestCapture.title : 'checking'}
                    detail={latestCapture ? `${latestCapture.actor} via ${sourceById(overview, latestCapture.sourceId)?.name || latestCapture.sourceId}` : 'collectors are checking this entity for new mentions'}
                    tone={captures.length ? 'ok' : 'neutral'}
                />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='overflow-hidden'>
                    <div className='border-b border-ui-border bg-ui-panel px-4 py-3'>
                        <h2 className='text-base font-semibold text-ui-text'>Evidence stream</h2>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-ui-border text-sm'>
                            <thead className='bg-ui-raised text-left text-xs font-semibold uppercase text-ui-muted'>
                                <tr>
                                    <th className='px-4 py-3'>Evidence</th>
                                    <th className='px-4 py-3'>Actor</th>
                                    <th className='px-4 py-3'>Source</th>
                                    <th className='px-4 py-3'>Seen</th>
                                    <th className='px-4 py-3'>Handling</th>
                                    <th className='px-4 py-3 text-right'>Action</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border bg-ui-canvas'>
                                {captures.map(capture => {
                                    const source = sourceById(overview, capture.sourceId)
                                    return (
                                        <tr key={capture.id} className='align-top hover:bg-ui-panel'>
                                            <td className='px-4 py-3'>
                                                <p className='font-semibold text-ui-text'>{capture.title}</p>
                                                <p className='mt-1 max-w-xl text-ui-muted'>{capture.resultSummary}</p>
                                            </td>
                                            <td className='px-4 py-3 font-semibold text-ui-text'>{capture.actor}</td>
                                            <td className='px-4 py-3'>
                                                <Link href={`/dashboard/ti/sources/${capture.sourceId}`} className='font-semibold text-ui-primary hover:underline'>{source?.name || capture.sourceId}</Link>
                                            </td>
                                            <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatTiDate(capture.capturedAt)}</td>
                                            <td className='px-4 py-3 text-ui-muted'>{capture.metadata.find(item => item.label === 'Collection boundary')?.value || source?.legalNotes || 'metadata only'}</td>
                                            <td className='px-4 py-3 text-right'>
                                                <a href={capture.pageUrl} target='_blank' rel='noopener noreferrer' className='inline-flex h-8 items-center gap-1 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:border-ui-border hover:bg-ui-raised'>
                                                    Open
                                                    <ExternalLink className='h-3 w-3' />
                                                </a>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {!captures.length ? (
                                    <tr>
                                        <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>Evidence for this entity streams here as sources report it.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-ui-text'>Source checks</h2>
                    <div className='mt-4 grid gap-3'>
                        {sources.map(source => {
                            if (!source) return null
                            const stale = new Date(source.nextRunAt).getTime() < Date.now()
                            const sourceCaptures = captures.filter(capture => capture.sourceId === source.id)
                            return (
                                <Link key={source.id} href={`/dashboard/ti/sources/${source.id}`} className='rounded-lg border border-ui-border bg-ui-raised p-3 hover:border-ui-border hover:bg-ui-panel'>
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div>
                                            <p className='font-semibold text-ui-text'>{source.name}</p>
                                            <p className='mt-1 text-xs text-ui-muted'>{source.family} · {source.accessMethod}</p>
                                        </div>
                                        <StatusPill label={stale ? 'stale' : operationalStateLabel(source.status)} tone={stale ? 'watch' : source.status === 'active' ? 'ok' : 'neutral'} />
                                    </div>
                                    <div className='mt-3 grid gap-2 text-sm sm:grid-cols-2'>
                                        <Inline label='Checked' value={shortAge(source.lastRunAt)} />
                                        <Inline label='Next check' value={shortAge(source.nextRunAt)} />
                                        <Inline label='Interval' value={`${source.cadenceMinutes}m`} />
                                        <Inline label='Added here' value={`${sourceCaptures.length}`} />
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </DashboardPanel>
            </div>

            <DashboardPanel className='p-5'>
                <h2 className='text-base font-semibold text-ui-text'>Captured evidence</h2>
                <div className='mt-4 grid gap-4 xl:grid-cols-2'>
                    {captures.map(capture => (
                        <article key={capture.id} className='grid gap-4 rounded-lg border border-ui-border bg-ui-raised p-3 md:grid-cols-[15rem_1fr]'>
                            <div className='grid min-h-44 content-between rounded-lg bg-ui-canvas p-4 text-ui-text'>
                                <span className='w-fit rounded-full bg-ui-panel px-2 py-1 text-xs'>{capture.actor}</span>
                                <div>
                                    <p className='text-lg font-semibold'>{capture.domain}</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{capture.screenshotLabel}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className='text-base font-semibold text-ui-text'>{capture.title}</h3>
                                <div className='mt-3 grid gap-2'>
                                    {capture.metadata.map(item => <Inline key={`${capture.id}-${item.label}`} label={item.label} value={item.value} />)}
                                </div>
                            </div>
                        </article>
                    ))}
                    {!captures.length ? <p className='rounded-lg border border-dashed border-ui-border p-4 text-sm text-ui-muted'>Collectors are checking this entity; accepted captures attach here.</p> : null}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function OperationCard({ icon, title, value, detail, tone }: { icon: ReactNode, title: string, value: string, detail: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='overflow-hidden p-0'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'>
                    <span className={toneText(tone)}>{icon}</span>
                    <span className='truncate'>{title}</span>
                </div>
                <span className={`h-2 w-2 rounded-full ${toneDot(tone)}`} />
            </div>
            <div className='p-4'>
                <p className='line-clamp-1 text-base font-semibold text-ui-text'>{value}</p>
                <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{detail}</p>
            </div>
        </DashboardPanel>
    )
}

function CaseMetric({ title, value, icon }: { title: string, value: string, icon: ReactNode }) {
    return (
        <div className='border-b border-r border-ui-border p-4 last:border-r-0 lg:last:border-r'>
            <div className='flex items-center justify-between text-ui-muted'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-2 text-xl font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function Inline({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-canvas px-3 py-2'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function toneText(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'text-ui-success'
    if (tone === 'watch') return 'text-ui-warning'
    if (tone === 'bad') return 'text-ui-danger'
    return 'text-ui-primary'
}

function toneDot(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'bg-ui-success shadow-[0_0_14px_rgba(49,196,141,0.65)]'
    if (tone === 'watch') return 'bg-ui-warning shadow-[0_0_14px_rgba(246,180,95,0.45)]'
    if (tone === 'bad') return 'bg-ui-danger shadow-[0_0_14px_rgba(255,122,89,0.45)]'
    return 'bg-ui-primary shadow-[0_0_14px_rgba(157,180,255,0.45)]'
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-ui-success/10', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/10', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-danger/10', text: 'text-ui-danger' }
    return { bg: 'bg-ui-primary/10', text: 'text-ui-text' }
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

function shortAge(value: string) {
    const parsed = new Date(value).getTime()
    if (!Number.isFinite(parsed)) return 'checking'
    const diffMinutes = Math.round((parsed - Date.now()) / 60000)
    const abs = Math.abs(diffMinutes)
    const unit = abs < 60 ? `${abs}m` : abs < 2880 ? `${Math.round(abs / 60)}h` : `${Math.round(abs / 1440)}d`
    if (diffMinutes > 0) return `in ${unit}`
    return `${unit} ago`
}
