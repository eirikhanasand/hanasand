import Link from 'next/link'
import { Camera, DatabaseZap, ExternalLink, Globe2, PlayCircle, Radar } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import ManualRunButton from './manualRunButton'

export const dynamic = 'force-dynamic'

export default function TiAdminPage() {
    const { sources, domains, captures, runs } = getTiAdminOverview()
    const activeSources = sources.filter(source => source.status === 'active').length
    const nextRun = [...sources].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())[0]
    const latestRun = [...runs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='TI operations'
                description='Admin view for source ingestion, run timing, domain-to-result surfacing, screenshot captures, and source metadata.'
                actions={<ManualRunButton label='Start all-source run' />}
            />

            <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <Stat title='Sources' value={`${activeSources}/${sources.length}`} detail='active sources' icon={<DatabaseZap className='h-4 w-4' />} />
                <Stat title='Domains surfaced' value={`${domains.length}`} detail='watchlist/domain pivots' icon={<Globe2 className='h-4 w-4' />} />
                <Stat title='Screenshots' value={`${captures.length}`} detail='viewable capture records' icon={<Camera className='h-4 w-4' />} />
                <Stat title='Next run' value={nextRun ? formatTiDate(nextRun.nextRunAt) : 'No schedule'} detail={nextRun?.name || 'No source'} icon={<PlayCircle className='h-4 w-4' />} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.15fr_0.85fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-lg font-semibold text-[#171a21]'>Ingestion schedule</h2>
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
                                    <span className='capitalize text-[#3056d3]'>{source.status}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Latest run</h2>
                    <p className='mt-1 text-sm text-[#596170]'>{latestRun?.message || 'No run found.'}</p>
                    {latestRun ? (
                        <div className='mt-4 grid gap-3'>
                            <Info label='Source' value={sourceById(latestRun.sourceId)?.name || latestRun.sourceId} />
                            <Info label='Started' value={formatTiDate(latestRun.startedAt)} />
                            <Info label='Rows' value={`${latestRun.rows} rows, ${latestRun.captures} captures, ${latestRun.screenshots} screenshots`} />
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
                        <h2 className='text-lg font-semibold text-[#171a21]'>Domain surfacing</h2>
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
                <div className='flex items-center gap-2'>
                    <Radar className='h-4 w-4 text-[#3056d3]' />
                    <h2 className='text-lg font-semibold text-[#171a21]'>Screenshot captures</h2>
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

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
