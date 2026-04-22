import type { GetVulnerabilities } from '@/utils/monitoring/types'
import { AlertTriangle, CircleAlert, Container, Layers3, ShieldAlert, ShieldCheck } from 'lucide-react'
import SummaryCard from './summaryCard'

export default function SummaryGrid({
    data,
    scanStatus,
}: {
    data: GetVulnerabilities | null
    scanStatus: GetVulnerabilities['scanStatus']
}) {
    return (
        <div className='flex flex-col gap-4 lg:flex-row lg:justify-between'>
            <div>
                <h1 className='font-semibold text-lg text-white'>Vulnerabilities</h1>
                <p className='mt-1 max-w-2xl text-sm text-white/80'>
                    Docker Scout results across active images, with severity rollups and package-level findings.
                </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2 md:min-w-120 md:grid-cols-4'>
                <SummaryCard title='Images' value={String(data?.imageCount || 0)} icon={Container} tone='blue' />
                <SummaryCard
                    title='Status'
                    value={scanStatus.isRunning ? 'Scanning' : 'Idle'}
                    icon={scanStatus.isRunning ? AlertTriangle : ShieldCheck}
                    tone={scanStatus.isRunning ? 'amber' : 'emerald'}
                />
                <SummaryCard
                    title='Last Scan'
                    value={scanStatus.finishedAt ? new Date(scanStatus.finishedAt).toLocaleString('nb-NO') : 'No completed scan'}
                    icon={Layers3}
                    tone='violet'
                />
                <SummaryCard
                    title='Last Error'
                    value={scanStatus.lastError || 'No recent scan error'}
                    icon={scanStatus.lastError ? CircleAlert : ShieldAlert}
                    tone={scanStatus.lastError ? 'rose' : 'slate'}
                />
            </div>
        </div>
    )
}
