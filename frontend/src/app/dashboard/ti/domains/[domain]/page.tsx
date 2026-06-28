import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Camera, CheckCircle2, Clock3, DatabaseZap, ExternalLink, ShieldAlert } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { domainCaptures, formatTiDate, getTiAdminDomain, sourceById } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiDomainDetailPage(props: { params: Promise<{ domain: string }> }) {
    const params = await props.params
    const domain = getTiAdminDomain(params.domain)

    if (!domain) {
        return notFound()
    }

    const captures = domainCaptures(domain.domain).sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime())
    const sources = domain.sourceIds.map(id => sourceById(id)).filter(source => Boolean(source))
    const staleSources = sources.filter(source => new Date(source!.nextRunAt).getTime() < Date.now())
    const latestCapture = captures[0]
    const statusTone = domain.status === 'review' ? 'watch' : domain.status === 'watching' ? 'ok' : 'neutral'

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Monitored entity'
                title={domain.company}
                description={`${domain.domain} · ${domain.resultCount} results · ${sources.length} sources`}
            />

            <div className='flex flex-wrap items-center justify-between gap-3'>
                <Link href='/dashboard/ti/domains' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                    <ArrowLeft className='h-4 w-4' />
                    Entities
                </Link>
                <div className='flex flex-wrap gap-2'>
                    <Link href='/dashboard/ti/workbench' className='inline-flex h-9 items-center gap-2 rounded-lg bg-[#171a21] px-3 text-sm font-semibold text-white hover:bg-[#2b2f39]'>
                        <ShieldAlert className='h-4 w-4' />
                        Open in workbench
                    </Link>
                    <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                        Source inventory
                    </Link>
                </div>
            </div>

            <DashboardPanel className='overflow-hidden'>
                <div className='grid gap-0 lg:grid-cols-[1.3fr_0.7fr]'>
                    <div className='bg-[#101522] p-5 text-white'>
                        <div className='flex flex-wrap items-start justify-between gap-4'>
                            <div>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <StatusPill label={domain.status} tone={statusTone} />
                                    {staleSources.length ? <StatusPill label={`${staleSources.length} stale source${staleSources.length === 1 ? '' : 's'}`} tone='watch' /> : <StatusPill label='sources current' tone='ok' />}
                                </div>
                                <h2 className='mt-4 text-2xl font-semibold'>{domain.domain}</h2>
                                <p className='mt-2 text-sm text-[#c7d0df]'>Matched terms: {domain.matchedTerms.join(', ')}</p>
                            </div>
                            <div className='grid gap-2 text-right text-sm'>
                                <span className='text-[#9aa4b5]'>Last seen</span>
                                <span className='font-semibold'>{formatTiDate(domain.lastSeenAt)}</span>
                            </div>
                        </div>
                    </div>
                    <div className='grid grid-cols-2 gap-0 border-l border-[#e0e5ed] bg-white sm:grid-cols-4 lg:grid-cols-2'>
                        <CaseMetric title='Results' value={`${domain.resultCount}`} icon={<DatabaseZap className='h-4 w-4' />} />
                        <CaseMetric title='Evidence' value={`${captures.length}`} icon={<Camera className='h-4 w-4' />} />
                        <CaseMetric title='Sources' value={`${sources.length}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                        <CaseMetric title='Latest' value={latestCapture ? shortTime(latestCapture.capturedAt) : 'None'} icon={<Clock3 className='h-4 w-4' />} />
                    </div>
                </div>
            </DashboardPanel>

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='overflow-hidden'>
                    <div className='border-b border-[#e0e5ed] bg-[#fbfcfe] px-4 py-3'>
                        <h2 className='text-base font-semibold text-[#171a21]'>Evidence review</h2>
                    </div>
                    <div className='overflow-x-auto'>
                        <table className='min-w-full divide-y divide-[#edf0f5] text-sm'>
                            <thead className='bg-white text-left text-xs font-semibold uppercase text-[#667085]'>
                                <tr>
                                    <th className='px-4 py-3'>Evidence</th>
                                    <th className='px-4 py-3'>Actor</th>
                                    <th className='px-4 py-3'>Source</th>
                                    <th className='px-4 py-3'>Captured</th>
                                    <th className='px-4 py-3'>Boundary</th>
                                    <th className='px-4 py-3 text-right'>Action</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-[#edf0f5] bg-white'>
                                {captures.map(capture => {
                                    const source = sourceById(capture.sourceId)
                                    return (
                                        <tr key={capture.id} className='align-top hover:bg-[#fbfcfe]'>
                                            <td className='px-4 py-4'>
                                                <p className='font-semibold text-[#171a21]'>{capture.title}</p>
                                                <p className='mt-1 max-w-xl text-[#596170]'>{capture.resultSummary}</p>
                                            </td>
                                            <td className='px-4 py-4 font-semibold text-[#171a21]'>{capture.actor}</td>
                                            <td className='px-4 py-4'>
                                                <Link href={`/dashboard/ti/sources/${capture.sourceId}`} className='font-semibold text-[#3056d3] hover:underline'>{source?.name || capture.sourceId}</Link>
                                            </td>
                                            <td className='whitespace-nowrap px-4 py-4 text-[#596170]'>{formatTiDate(capture.capturedAt)}</td>
                                            <td className='px-4 py-4 text-[#596170]'>{capture.metadata.find(item => item.label === 'Collection boundary')?.value || source?.legalNotes || 'metadata only'}</td>
                                            <td className='px-4 py-4 text-right'>
                                                <a href={capture.pageUrl} target='_blank' rel='noopener noreferrer' className='inline-flex h-8 items-center gap-1 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                                                    Open
                                                    <ExternalLink className='h-3 w-3' />
                                                </a>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {!captures.length ? (
                                    <tr>
                                        <td colSpan={6} className='px-4 py-8 text-center text-sm text-[#667085]'>No evidence is attached to this entity yet.</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-base font-semibold text-[#171a21]'>Source coverage</h2>
                    <div className='mt-4 grid gap-3'>
                        {sources.map(source => {
                            if (!source) return null
                            const stale = new Date(source.nextRunAt).getTime() < Date.now()
                            const sourceCaptures = captures.filter(capture => capture.sourceId === source.id)
                            return (
                                <Link key={source.id} href={`/dashboard/ti/sources/${source.id}`} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 hover:border-[#c8d1df]'>
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div>
                                            <p className='font-semibold text-[#171a21]'>{source.name}</p>
                                            <p className='mt-1 text-xs text-[#667085]'>{source.family} · {source.accessMethod}</p>
                                        </div>
                                        <StatusPill label={stale ? 'stale' : source.status} tone={stale ? 'watch' : source.status === 'active' ? 'ok' : 'neutral'} />
                                    </div>
                                    <div className='mt-3 grid gap-2 text-sm sm:grid-cols-2'>
                                        <Inline label='Last run' value={formatTiDate(source.lastRunAt)} />
                                        <Inline label='Next run' value={formatTiDate(source.nextRunAt)} />
                                        <Inline label='Cadence' value={`${source.cadenceMinutes}m`} />
                                        <Inline label='Entity captures' value={`${sourceCaptures.length}`} />
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </DashboardPanel>
            </div>

            <DashboardPanel className='p-5'>
                <h2 className='text-base font-semibold text-[#171a21]'>Capture cards</h2>
                <div className='mt-4 grid gap-4 xl:grid-cols-2'>
                    {captures.map(capture => (
                        <article key={capture.id} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 md:grid-cols-[15rem_1fr]'>
                            <div className='grid min-h-44 content-between rounded-lg bg-[#0e1520] p-4 text-white'>
                                <span className='w-fit rounded-full bg-white/10 px-2 py-1 text-xs'>{capture.actor}</span>
                                <div>
                                    <p className='text-lg font-semibold'>{capture.domain}</p>
                                    <p className='mt-1 text-xs text-[#c7d0df]'>{capture.screenshotLabel}</p>
                                </div>
                            </div>
                            <div>
                                <h3 className='text-base font-semibold text-[#171a21]'>{capture.title}</h3>
                                <div className='mt-3 grid gap-2'>
                                    {capture.metadata.map(item => <Inline key={`${capture.id}-${item.label}`} label={item.label} value={item.value} />)}
                                </div>
                            </div>
                        </article>
                    ))}
                    {!captures.length ? <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>No capture cards yet.</p> : null}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function CaseMetric({ title, value, icon }: { title: string, value: string, icon: ReactNode }) {
    return (
        <div className='border-b border-r border-[#edf0f5] p-4 last:border-r-0 lg:last:border-r'>
            <div className='flex items-center justify-between text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                {icon}
            </div>
            <p className='mt-2 text-xl font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}

function Inline({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#edf0f5] bg-white px-3 py-2'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
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
