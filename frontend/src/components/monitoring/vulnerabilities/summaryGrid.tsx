import type { GetVulnerabilities } from '@/utils/monitoring/types'
import { AlertTriangle, CalendarClock, CircleAlert, Container, ShieldAlert, ShieldCheck } from 'lucide-react'
import SummaryCard from './summaryCard'

export default function SummaryGrid({
    data,
    scanStatus,
}: {
    data: GetVulnerabilities | null
    scanStatus: GetVulnerabilities['scanStatus']
}) {
    return (
        <div className='flex flex-col gap-3 lg:flex-row lg:justify-between'>
            <div>
                <h1 className='text-lg font-semibold text-[#edf4ff]'>Container image risks</h1>
                <p className='mt-1 max-w-2xl text-sm text-[#aab7cc]'>
                    Live scan results with severity, timing, and the next action to take.
                </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-2 xl:min-w-180 xl:grid-cols-6'>
                <SummaryCard
                    title='Status'
                    value={scanStatus.isRunning ? 'Scanning' : scanStatus.paused ? 'Paused' : scanStatus.stale || scanStatus.lastError ? 'Attention' : 'Fresh'}
                    icon={scanStatus.isRunning || scanStatus.stale || scanStatus.lastError ? AlertTriangle : ShieldCheck}
                    tone={scanStatus.isRunning || scanStatus.stale || scanStatus.lastError ? 'amber' : 'emerald'}
                />
                <SummaryCard
                    title='Targets'
                    value={targetLabel(data, scanStatus)}
                    icon={Container}
                    tone='blue'
                />
                <SummaryCard
                    title='Last scan'
                    value={timeLabel(scanStatus.finishedAt || data?.generatedAt, 'No completed scan')}
                    icon={CalendarClock}
                    tone={scanStatus.stale ? 'amber' : 'slate'}
                />
                <SummaryCard
                    title='Next scan'
                    value={scanStatus.paused ? 'Paused' : timeLabel(scanStatus.nextRunAt, 'Watching')}
                    icon={CalendarClock}
                    tone='violet'
                />
                <SummaryCard
                    title='Failures'
                    value={scanStatus.failureCount ? `${scanStatus.failureCount}` : 'None'}
                    icon={CircleAlert}
                    tone={scanStatus.failureCount ? 'rose' : 'slate'}
                />
                <SummaryCard
                    title='Attention'
                    value={scanStatus.blocker || scanStatus.lastError || scanStatus.staleReason || 'Clear'}
                    icon={scanStatus.blocker || scanStatus.lastError || scanStatus.stale ? CircleAlert : ShieldAlert}
                    tone={scanStatus.blocker || scanStatus.lastError || scanStatus.stale ? 'rose' : 'slate'}
                />
            </div>
        </div>
    )
}

function targetLabel(data: GetVulnerabilities | null, scanStatus: GetVulnerabilities['scanStatus']) {
    if (scanStatus.targetCount) return `${scanStatus.targetCount} targets`
    if (data?.imageCount) return `${data.imageCount} images`
    if (scanStatus.blocker || scanStatus.lastError) return 'Unavailable'
    return 'Discovering'
}

function timeLabel(value: string | null | undefined, fallback: string) {
    if (!value) return fallback
    const time = new Date(value)
    if (Number.isNaN(time.getTime())) return fallback
    return time.toLocaleString('nb-NO')
}
