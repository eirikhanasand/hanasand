import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, Globe2, Radar } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { domainCaptures, formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default function TiDomainsPage() {
    const { domains } = getTiAdminOverview()
    const rows = domains.map(domain => ({
        domain,
        captures: domainCaptures(domain.domain),
        sources: domain.sourceIds.map(id => sourceById(id)).filter(Boolean),
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

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Needs review' value={String(reviewCount)} detail='operator triage' tone={reviewCount ? 'warn' : 'ok'} />
                <Metric title='Watching' value={String(watchingCount)} detail='active monitored entities' tone='ok' />
                <Metric title='Quiet' value={String(quietCount)} detail='no current action' tone='hold' />
                <Metric title='Results' value={String(resultCount)} detail='surfaced records' tone='hold' />
                <Metric title='Newest' value={newest ? relativeAge(newest.lastSeenAt) : 'none'} detail={newest?.domain || 'no entity'} tone='hold' />
            </div>

            <DashboardPanel className='overflow-hidden p-0'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#e8edf5] bg-[#f8fafc] px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-[#171a21]'>Entity queue</h2>
                        <p className='mt-1 text-sm text-[#596170]'>Review first, then watching, then quiet. Open an entity to inspect evidence and source coverage.</p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <QueuePill label='Review' count={reviewCount} />
                        <QueuePill label='Watching' count={watchingCount} />
                        <QueuePill label='Quiet' count={quietCount} />
                    </div>
                </div>

                <div className='overflow-x-auto'>
                    <div className='min-w-[72rem]'>
                        <div className='grid grid-cols-[1fr_0.9fr_0.7fr_0.75fr_0.8fr_1fr_0.9fr_0.65fr] gap-3 bg-white px-4 py-2 text-xs font-semibold uppercase text-[#667085]'>
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
                            <div key={row.domain.domain} className='grid grid-cols-[1fr_0.9fr_0.7fr_0.75fr_0.8fr_1fr_0.9fr_0.65fr] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm hover:bg-[#fbfcfe]'>
                                <div className='min-w-0'>
                                    <Link href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`} className='font-semibold text-[#171a21] hover:text-[#3056d3]'>{row.domain.company}</Link>
                                    <p className='mt-1 truncate font-mono text-xs text-[#667085]'>{row.domain.domain}</p>
                                </div>
                                <span className={statusClass(row.domain.status)}>{row.domain.status}</span>
                                <span className='font-semibold text-[#3056d3]'>{row.domain.resultCount}</span>
                                <div>
                                    <p className='font-semibold text-[#171a21]'>{relativeAge(row.domain.lastSeenAt)}</p>
                                    <p className='mt-1 text-xs text-[#667085]'>{formatTiDate(row.domain.lastSeenAt)}</p>
                                </div>
                                <span className='font-semibold text-[#344054]'>{row.captures.length} captures</span>
                                <p className='truncate text-[#596170]'>{row.sources.map(source => source?.name).join(', ')}</p>
                                <p className='truncate font-mono text-xs text-[#344054]'>{row.domain.matchedTerms.join(', ')}</p>
                                <Link href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`} className='inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                                    Open
                                    <ArrowRight className='h-3.5 w-3.5' />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1fr_0.85fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Review queue</h2>
                            <p className='mt-1 text-sm text-[#596170]'>Entities that should be validated before customer routing.</p>
                        </div>
                        <AlertTriangle className='h-4 w-4 text-[#b45309]' />
                    </div>
                    <div className='mt-4 grid gap-2'>
                        {rows.filter(row => row.domain.status === 'review').map(row => (
                            <Link key={row.domain.domain} href={`/dashboard/ti/domains/${encodeURIComponent(row.domain.domain)}`} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center hover:border-[#b8c5ff]'>
                                <div>
                                    <p className='font-semibold text-[#171a21]'>{row.domain.company}</p>
                                    <p className='mt-1 text-sm text-[#596170]'>{row.domain.domain} · {row.domain.resultCount} results · {row.captures.length} captures</p>
                                </div>
                                <span className='inline-flex items-center gap-1 text-sm font-semibold text-[#3056d3]'>Review <ArrowRight className='h-3.5 w-3.5' /></span>
                            </Link>
                        ))}
                        {!rows.some(row => row.domain.status === 'review') && (
                            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-4 text-sm text-[#596170]'>No entity is waiting for review.</div>
                        )}
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Source coverage</h2>
                            <p className='mt-1 text-sm text-[#596170]'>How many sources are producing evidence per entity.</p>
                        </div>
                        <Radar className='h-4 w-4 text-[#3056d3]' />
                    </div>
                    <div className='mt-4 grid gap-3'>
                        {rows.map(row => (
                            <div key={row.domain.domain} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <p className='truncate text-sm font-semibold text-[#171a21]'>{row.domain.domain}</p>
                                    <span className='text-sm font-semibold text-[#3056d3]'>{row.sources.length}</span>
                                </div>
                                <div className='mt-3 h-2 overflow-hidden rounded-full bg-[#e9edf4]'>
                                    <div className='h-full rounded-full bg-[#3056d3]' style={{ width: `${Math.min(100, Math.max(row.sources.length ? 12 : 0, row.sources.length * 34))}%` }} />
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
    return <span className='inline-flex items-center gap-1 rounded-full border border-[#d8dee9] bg-white px-3 py-1 text-xs font-semibold text-[#344054]'><Globe2 className='h-3.5 w-3.5' />{label}: {count}</span>
}

function statusClass(status: string) {
    if (status === 'review') return 'w-fit rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold capitalize text-[#b45309]'
    if (status === 'watching') return 'w-fit rounded-full bg-[#f4fbf7] px-2 py-0.5 text-xs font-semibold capitalize text-[#147a3b]'
    return 'w-fit rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold capitalize text-[#475467]'
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
    if (!Number.isFinite(minutes)) return 'unknown'
    if (minutes < 60) return `${minutes} min ago`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours} hr ago`
    return `${Math.round(hours / 24)} d ago`
}
