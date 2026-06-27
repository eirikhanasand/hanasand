import Link from 'next/link'
import { PlayCircle } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, sourceById } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../manualRunButton'

export const dynamic = 'force-dynamic'

export default function TiRunsPage() {
    const { runs } = getTiAdminOverview()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Runs'
                description='Recent collection runs, row counts, screenshots, and next scheduled checks.'
                actions={<ManualRunButton label='Start manual run' />}
            />

            <DashboardPanel className='overflow-x-auto'>
                <div className='min-w-[56rem]'>
                    <div className='grid grid-cols-[1.15fr_1fr_0.8fr_0.5fr_0.5fr_0.5fr] gap-3 bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase text-[#667085]'>
                        <span>Run</span>
                        <span>Source</span>
                        <span>Started</span>
                        <span>Rows</span>
                        <span>Captures</span>
                        <span>Status</span>
                    </div>
                    {runs.map(run => {
                        const source = sourceById(run.sourceId)

                        return (
                            <Link key={run.id} href={`/dashboard/ti/sources/${run.sourceId}`} className='grid grid-cols-[1.15fr_1fr_0.8fr_0.5fr_0.5fr_0.5fr] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm hover:bg-[#fbfcfe]'>
                                <span className='min-w-0 truncate font-mono text-[#171a21]'>{run.id}</span>
                                <span className='min-w-0 truncate font-semibold text-[#344054]'>{source?.name || run.sourceId}</span>
                                <span className='text-[#596170]'>{formatTiDate(run.startedAt)}</span>
                                <span className='text-[#3056d3]'>{run.rows}</span>
                                <span className='text-[#3056d3]'>{run.captures}</span>
                                <span className='capitalize text-[#147a3b]'>{run.status}</span>
                            </Link>
                        )
                    })}
                </div>
            </DashboardPanel>

            <div className='grid gap-4 lg:grid-cols-3'>
                {runs.map(run => (
                    <DashboardPanel key={run.id} className='p-5'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <p className='text-xs font-semibold uppercase text-[#3056d3]'>{run.status}</p>
                                <h2 className='mt-1 wrap-break-word font-mono text-sm font-semibold text-[#171a21]'>{run.id}</h2>
                            </div>
                            <PlayCircle className='h-5 w-5 text-[#667085]' />
                        </div>
                        <p className='mt-3 text-sm leading-6 text-[#596170]'>{run.message}</p>
                        <div className='mt-4 grid gap-2'>
                            <Info label='Source' value={sourceById(run.sourceId)?.name || run.sourceId} />
                            <Info label='Started' value={formatTiDate(run.startedAt)} />
                            <Info label='Finished' value={run.finishedAt ? formatTiDate(run.finishedAt) : 'Still running'} />
                            <Info label='Next run' value={formatTiDate(run.nextRunAt)} />
                            <Info label='Output' value={`${run.rows} rows · ${run.captures} captures · ${run.screenshots} screenshots`} />
                        </div>
                    </DashboardPanel>
                ))}
            </div>
        </DashboardPage>
    )
}

function Info({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3'>
            <p className='text-xs font-semibold uppercase text-[#667085]'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-[#171a21]'>{value}</p>
        </div>
    )
}
