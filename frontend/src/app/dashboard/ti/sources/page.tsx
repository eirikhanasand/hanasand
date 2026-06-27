import Link from 'next/link'
import { Camera, ExternalLink } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default function TiSourcesPage() {
    const { sources, captures } = getTiAdminOverview()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Sources'
                description='Ingestion sources, owners, cadence, latest run timing, screenshots, legal boundaries, and buyer value.'
                actions={<ManualRunButton label='Start source run' />}
            />

            <div className='grid gap-4'>
                {sources.map(source => {
                    const sourceCaptureCount = captures.filter(capture => capture.sourceId === source.id).length

                    return (
                        <DashboardPanel key={source.id} className='p-5'>
                            <div className='grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start'>
                                <div className='min-w-0'>
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <h2 className='text-lg font-semibold text-[#171a21]'>{source.name}</h2>
                                        <span className='rounded-full bg-[#eef3ff] px-2 py-1 text-xs font-semibold capitalize text-[#3056d3]'>{source.status}</span>
                                        <span className='rounded-full bg-[#f8fafc] px-2 py-1 text-xs font-semibold text-[#596170]'>{source.type}</span>
                                    </div>
                                    <p className='mt-2 max-w-4xl text-sm leading-6 text-[#596170]'>{source.buyerValue}</p>
                                </div>
                                <div className='flex flex-wrap gap-2'>
                                    <ManualRunButton sourceId={source.id} label='Run now' queries={source.domains.filter(domain => !domain.includes('only'))} />
                                    <Link href={`/dashboard/ti/sources/${source.id}`} className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'>
                                        Details
                                        <ExternalLink className='h-4 w-4' />
                                    </Link>
                                </div>
                            </div>

                            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
                                <Info label='Owner' value={source.owner} />
                                <Info label='Last run' value={formatTiDate(source.lastRunAt)} />
                                <Info label='Next run' value={formatTiDate(source.nextRunAt)} />
                                <Info label='Useful rows' value={source.usefulRows.toLocaleString()} />
                                <Info label='Screenshots' value={`${sourceCaptureCount}`} icon={<Camera className='h-4 w-4' />} />
                            </div>

                            <div className='mt-4 grid gap-3 lg:grid-cols-[0.75fr_1fr]'>
                                <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                    <p className='text-xs font-semibold uppercase text-[#667085]'>Domains surfaced</p>
                                    <div className='mt-2 flex flex-wrap gap-2'>
                                        {source.domains.map(domain => (
                                            <Link key={domain} href={`/dashboard/ti/domains/${encodeURIComponent(domain)}`} className='rounded-full border border-[#d8dee9] bg-white px-2.5 py-1 font-mono text-xs text-[#344054] hover:bg-[#f2f5f9]'>{domain}</Link>
                                        ))}
                                    </div>
                                </div>
                                <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
                                    <p className='text-xs font-semibold uppercase text-[#667085]'>Result types</p>
                                    <div className='mt-2 flex flex-wrap gap-2'>
                                        {source.resultTypes.map(type => (
                                            <span key={type} className='rounded-full bg-[#eef3ff] px-2.5 py-1 font-mono text-xs text-[#3056d3]'>{type}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </DashboardPanel>
                    )
                })}
            </div>
        </DashboardPage>
    )
}

function Info({ label, value, icon }: { label: string, value: string, icon?: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <div className='flex items-center justify-between gap-2 text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{label}</p>
                {icon}
            </div>
            <p className='mt-1 text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
