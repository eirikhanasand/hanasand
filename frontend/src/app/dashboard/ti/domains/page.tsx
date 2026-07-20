import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock3, Globe2, Radar } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { domainCaptures, formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import TiDataAvailability from '../ti-data-availability'

export const dynamic = 'force-dynamic'

export default async function TiDomainsPage() {
    const overview = await getTiAdminOverview()
    const { domains } = overview
    const rows = domains.map(domain => ({
        domain,
        captures: domainCaptures(overview, domain.domain),
        sources: domain.sourceIds.map(id => sourceById(overview, id)).filter(Boolean),
        ageMinutes: minutesSince(domain.lastSeenAt),
    })).sort((a, b) => statusWeight(b.domain.status) - statusWeight(a.domain.status) || b.domain.resultCount - a.domain.resultCount)
    const reviewCount = domains.filter(domain => domain.status === 'review').length
    const watchingCount = domains.filter(domain => domain.status === 'watching').length
    const quietCount = domains.filter(domain => domain.status === 'quiet').length
    const resultCount = domains.reduce((sum, domain) => sum + domain.resultCount, 0)
    const newest = [...domains].sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Monitored entities'
                description='Triage companies, domains, vendors, and brands surfaced by monitored sources.'
            />
            <TiDataAvailability availability={overview.availability} />

            <details data-ti-domains-summary-disclosure className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 [&::-webkit-details-marker]:hidden'>
                    <span className='inline-flex items-center gap-2'>
                        <Globe2 className='h-4 w-4 text-ui-primary' />
                        Entity totals
                    </span>
                    <span className='inline-flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                        {reviewCount} review · {watchingCount} watching · {resultCount} results
                        <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                    </span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3 sm:grid-cols-2 xl:grid-cols-5' data-ti-domains-summary-metrics>
                    <Metric title='Needs review' value={String(reviewCount)} detail='operator triage' tone={reviewCount ? 'warn' : 'ok'} />
                    <Metric title='Watching' value={String(watchingCount)} detail='active monitored entities' tone='ok' />
                    <Metric title='Low noise' value={String(quietCount)} detail='no current action' tone='hold' />
                    <Metric title='Results' value={String(resultCount)} detail='surfaced records' tone='hold' />
                    <Metric title='Newest' value={newest ? relativeAge(newest.lastSeenAt) : 'Checking'} detail={newest?.domain || 'entity stream'} tone='hold' />
                </div>
            </details>

            <DashboardPanel className='overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Monitored entities</h2>
                        <p className='mt-1 text-sm text-ui-muted'>Review active matches, source coverage, and customer-ready evidence.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <QueuePill label='Review' count={reviewCount} />
                        <QueuePill label='Watching' count={watchingCount} />
                        <QueuePill label='Low noise' count={quietCount} />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <div className='min-w-[72rem]'>
                        <div className='grid grid-cols-[1fr_0.9fr_0.7fr_0.75fr_0.8fr_1fr_0.9fr_0.65fr] gap-3 bg-ui-raised px-4 py-2 text-xs font-semibold uppercase text-ui-muted'>
                            <span>Entity</span>
                            <span>Status</span>
                            <span>Results</span>
                            <span>Last seen</span>
                            <span>Evidence</span>
                            <span>Sources</span>
                            <span>Matched terms</span>
                            <span>Action</span>
                        </div>
                        {rows.map(row => (
                            <div key={row.domain.domain} className='grid grid-cols-[1fr_0.9fr_0.7fr_0.75fr_0.8fr_1fr_0.9fr_0.65fr] gap-3 border-t border-ui-border px-4 py-2.5 text-sm hover:bg-ui-raised'>
                                <div className='min-w-0'>
                                    <Link href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`} className='font-semibold text-ui-text hover:text-ui-primary'>{row.domain.company}</Link>
                                    <p className='mt-1 truncate font-mono text-xs text-ui-muted'>{row.domain.domain}</p>
                                </div>
                                <span className={statusClass(row.domain.status)}>{row.domain.status}</span>
                                <span className='font-semibold text-ui-primary'>{row.domain.resultCount}</span>
                                <div>
                                    <p className='font-semibold text-ui-text'>{relativeAge(row.domain.lastSeenAt)}</p>
                                    <p className='mt-1 text-xs text-ui-muted'>{formatTiDate(row.domain.lastSeenAt)}</p>
                                </div>
                                <span className='font-semibold text-ui-text'>{row.captures.length} captures</span>
                                <p className='truncate text-ui-muted'>{row.sources.map(source => source?.name).join(', ')}</p>
                                <p className='truncate font-mono text-xs text-ui-text'>{row.domain.matchedTerms.join(', ')}</p>
                                <Link href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`} className='inline-flex h-8 w-fit items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text hover:border-ui-primary'>
                                    Open
                                    <ArrowRight className='h-3.5 w-3.5' />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1fr_0.85fr]'>
                <DashboardPanel className='border-ui-border bg-ui-panel p-4'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Matches to review</h2>
                            <p className='mt-1 text-sm text-ui-muted'>Matches needing analyst validation before customer routing.</p>
                        </div>
                        <AlertTriangle className='h-4 w-4 text-ui-warning' />
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {rows.filter(row => row.domain.status === 'review').map(row => (
                            <Link key={row.domain.domain} href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`} className='grid gap-3 rounded-md border border-ui-border bg-ui-raised p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-ui-primary'>
                                <div>
                                    <p className='font-semibold text-ui-text'>{row.domain.company}</p>
                                    <p className='mt-1 text-sm text-ui-muted'>{row.domain.domain} · {row.domain.resultCount} results · {row.captures.length} captures</p>
                                </div>
                                <span className='inline-flex items-center gap-1 text-sm font-semibold text-ui-primary'>Review <ArrowRight className='h-3.5 w-3.5' /></span>
                            </Link>
                        ))}
                        {!rows.some(row => row.domain.status === 'review') && (
                            <div className='rounded-md border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>No matches need review right now. New matches appear here.</div>
                        )}
                    </div>
                </DashboardPanel>

                <details data-ti-domains-source-coverage-disclosure className='group overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
                    <summary className='flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-ui-raised focus-visible:ring-2 focus-visible:ring-ui-primary/25 [&::-webkit-details-marker]:hidden'>
                        <span>
                            <span className='flex items-center gap-2 text-base font-semibold text-ui-text'>
                                <Radar className='h-4 w-4 text-ui-primary' />
                                Source coverage
                            </span>
                            <span className='mt-1 block text-sm text-ui-muted'>Evidence-producing sources per monitored entity.</span>
                        </span>
                        <span className='inline-flex items-center gap-2 text-xs font-semibold text-ui-muted'>
                            {rows.reduce((sum, row) => sum + row.sources.length, 0)} source links
                            <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                        </span>
                    </summary>
                    <div className='grid gap-3 border-t border-ui-border p-4' data-ti-domains-source-coverage>
                        {rows.map(row => (
                            <div key={row.domain.domain} className='rounded-md border border-ui-border bg-ui-raised p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <p className='truncate text-sm font-semibold text-ui-text'>{row.domain.domain}</p>
                                    <span className='text-sm font-semibold text-ui-primary'>{row.sources.length}</span>
                                </div>
                                <div className='mt-3 h-2 overflow-hidden rounded-full bg-ui-panel'>
                                    <div className='h-full rounded-full bg-ui-primary' style={{ width: `${Math.min(100, Math.max(row.sources.length ? 12 : 0, row.sources.length * 34))}%` }} />
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
    return <span className='inline-flex items-center gap-1 rounded-full border border-ui-border bg-ui-panel px-3 py-1 text-xs font-semibold text-ui-text'><Globe2 className='h-3.5 w-3.5' />{label}: {count}</span>
}

function statusClass(status: string) {
    if (status === 'review') return 'w-fit rounded-full border border-ui-warning bg-ui-raised px-2 py-0.5 text-xs font-semibold capitalize text-ui-warning'
    if (status === 'watching') return 'w-fit rounded-full border border-ui-success bg-ui-raised px-2 py-0.5 text-xs font-semibold capitalize text-ui-success'
    return 'w-fit rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold capitalize text-ui-muted'
}

function statusWeight(status: string) {
    if (status === 'review') return 3
    if (status === 'watching') return 2
    return 1
}

function minutesSince(value: string) {
    const parsed = new Date(value).getTime()
    if (!Number.isFinite(parsed)) return Number.POSITIVE_INFINITY
    return Math.max(0, Math.round((Date.now() - parsed) / 60000))
}

function relativeAge(value: string) {
    const minutes = minutesSince(value)
    if (!Number.isFinite(minutes)) return 'checking'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}
