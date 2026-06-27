import { ClipboardList } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getTiEnrichmentOverview } from '@/utils/tiAdmin/enrichment'
import { formatTiDate } from '@/utils/tiAdmin/ops'

export const dynamic = 'force-dynamic'

export default async function TiAuditPage() {
    const { auditLog, stats, worker } = await getTiEnrichmentOverview()

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='TI management audit log'
                description='Full audit trail for management actions, automatic enrichment, queue decisions, and profile-cache changes.'
            />

            <div className='grid gap-4 sm:grid-cols-3'>
                <Stat title='Audit events' value={`${stats.auditedEvents}`} />
                <Stat title='Refreshes' value={`${stats.totalRefreshes}`} />
                <Stat title='Worker' value={worker.state} />
            </div>

            <DashboardPanel className='overflow-x-auto'>
                <div className='min-w-[62rem]'>
                    <div className='grid grid-cols-[0.9fr_0.9fr_0.9fr_1fr_0.7fr_1.6fr] gap-3 bg-[#f8fafc] px-4 py-3 text-xs font-semibold uppercase text-[#667085]'>
                        <span>Time</span>
                        <span>Actor</span>
                        <span>Action</span>
                        <span>Target</span>
                        <span>Result</span>
                        <span>Detail</span>
                    </div>
                    {auditLog.map(event => (
                        <div key={event.id} className='grid grid-cols-[0.9fr_0.9fr_0.9fr_1fr_0.7fr_1.6fr] gap-3 border-t border-[#eef1f5] px-4 py-3 text-sm'>
                            <span className='text-[#596170]'>{formatTiDate(event.happenedAt)}</span>
                            <span className='font-mono text-[#171a21]'>{event.actor}</span>
                            <span className='font-mono text-[#3056d3]'>{event.action}</span>
                            <span className='font-mono text-[#344054]'>{event.target}</span>
                            <span className='capitalize text-[#147a3b]'>{event.result}</span>
                            <span className='text-[#596170]'>{event.detail}</span>
                        </div>
                    ))}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function Stat({ title, value }: { title: string, value: string }) {
    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{title}</p>
                <ClipboardList className='h-4 w-4' />
            </div>
            <p className='mt-3 text-xl font-semibold text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}
