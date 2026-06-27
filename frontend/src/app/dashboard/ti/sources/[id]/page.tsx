import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, Camera, ExternalLink, ShieldCheck } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { ageDays, formatTiDate, getTiAdminSource, sourceCaptures, sourceRuns } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../../manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiSourceDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const source = getTiAdminSource(params.id)

    if (!source) {
        return notFound()
    }

    const captures = sourceCaptures(source.id)
    const runs = sourceRuns(source.id)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence source'
                title={source.name}
                description={source.buyerValue}
                actions={<ManualRunButton sourceId={source.id} label='Run this source' />}
            />

            <div className='flex'>
                <Link href='/dashboard/ti/sources' className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] hover:bg-[#f2f5f9]'>
                    <ArrowLeft className='h-4 w-4' />
                    Sources
                </Link>
            </div>

            <div className='grid gap-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Source metadata</h2>
                    <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                        <Info label='Status' value={source.status} />
                        <Info label='Risk' value={source.risk} />
                        <Info label='Owner' value={source.owner} />
                        <Info label='Family' value={source.family} />
                        <Info label='Type' value={source.type} />
                        <Info label='Access' value={source.accessMethod} />
                        <Info label='Cadence' value={`${source.cadenceMinutes} min`} />
                        <Info label='Monitored' value={`${ageDays(source.monitoredSince)} days`} />
                        <Info label='Last run' value={formatTiDate(source.lastRunAt)} />
                        <Info label='Next run' value={formatTiDate(source.nextRunAt)} />
                    </div>
                    <div className='mt-4 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                        <p className='text-xs font-semibold uppercase text-[#667085]'>Source URL</p>
                        <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{source.url}</p>
                    </div>
                    <div className='mt-4 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                        <div className='flex items-center gap-2 text-[#667085]'>
                            <ShieldCheck className='h-4 w-4' />
                            <p className='text-xs font-semibold uppercase'>Boundary</p>
                        </div>
                        <p className='mt-2 text-sm leading-6 text-[#596170]'>{source.legalNotes}</p>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Recent runs</h2>
                    <div className='mt-4 grid gap-2'>
                        {runs.map(run => (
                            <div key={run.id} className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                <div className='flex flex-wrap items-center justify-between gap-2'>
                                    <p className='font-mono text-sm font-semibold text-[#171a21]'>{run.id}</p>
                                    <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold capitalize text-[#3056d3]'>{run.status}</span>
                                </div>
                                <p className='mt-2 text-sm text-[#596170]'>{run.message}</p>
                                <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                                    <Info label='Started' value={formatTiDate(run.startedAt)} />
                                    <Info label='Rows' value={`${run.rows}`} />
                                    <Info label='Screenshots' value={`${run.screenshots}`} />
                                </div>
                            </div>
                        ))}
                        {!runs.length && <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>No runs recorded for this source yet.</p>}
                    </div>
                </DashboardPanel>
            </div>

            <DashboardPanel className='p-5'>
                <div className='flex items-center gap-2'>
                    <Camera className='h-4 w-4 text-[#3056d3]' />
                    <h2 className='text-lg font-semibold text-[#171a21]'>Screenshots and captured pages</h2>
                </div>
                <div className='mt-4 grid gap-4'>
                    {captures.map(capture => (
                        <article key={capture.id} id={capture.id} className='grid gap-4 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-4 xl:grid-cols-[minmax(20rem,0.8fr)_1fr]'>
                            <div className='overflow-hidden rounded-lg border border-[#243044] bg-[#0e1520]'>
                                <div className='border-b border-white/10 px-3 py-2 text-xs text-[#9db4ff]'>{capture.screenshotLabel}</div>
                                <div className='grid min-h-64 content-between p-4 text-white'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <span className='rounded-full bg-white/10 px-2 py-1 text-xs'>{capture.actor}</span>
                                        <span className='text-xs text-[#c7d0df]'>{formatTiDate(capture.screenshotTakenAt)}</span>
                                    </div>
                                    <div>
                                        <p className='text-2xl font-semibold'>{capture.domain}</p>
                                        <p className='mt-2 text-sm text-[#c7d0df]'>{capture.resultSummary}</p>
                                    </div>
                                </div>
                            </div>
                            <div className='min-w-0'>
                                <h3 className='text-lg font-semibold text-[#171a21]'>{capture.title}</h3>
                                <p className='mt-2 text-sm leading-6 text-[#596170]'>{capture.resultSummary}</p>
                                <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                                    <Info label='Published' value={formatTiDate(capture.publishedAt)} icon={<CalendarClock className='h-4 w-4' />} />
                                    <Info label='Captured' value={formatTiDate(capture.capturedAt)} />
                                    <Info label='Monitored since' value={formatTiDate(capture.monitoredSince)} />
                                    <Info label='Owner' value={capture.owner} />
                                    <Info label='Page type' value={capture.pageType} />
                                    <Info label='Page reference' value={capture.pageUrl} icon={<ExternalLink className='h-4 w-4' />} />
                                </div>
                                <div className='mt-4 grid gap-2'>
                                    {capture.metadata.map(item => <Info key={item.label} label={item.label} value={item.value} />)}
                                </div>
                            </div>
                        </article>
                    ))}
                    {!captures.length && <p className='rounded-lg border border-dashed border-[#d8dee9] p-4 text-sm text-[#667085]'>This source has no screenshot captures yet.</p>}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function Info({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-white p-3'>
            <div className='flex items-center justify-between gap-2 text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{label}</p>
                {icon}
            </div>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
