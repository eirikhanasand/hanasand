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
    const attention = scanStatus.blocker || scanStatus.lastError || scanStatus.staleReason || ''
    const headline = scanStatus.isRunning
        ? 'Scan running'
        : attention
            ? 'Scanner needs review'
            : 'Scanner is quiet'

    return (
        <div className='grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)] lg:items-start'>
            <div className='min-w-0'>
                <p className='text-[10px] font-semibold uppercase text-[#9db4ff]'>Container image risks</p>
                <h1 className='mt-1 text-lg font-semibold text-[#edf4ff]'>{headline}</h1>
                <p className='mt-1 max-w-2xl text-sm text-[#aab7cc]'>
                    {attention || 'Review image findings by impact, then expand only the rows that need action.'}
                </p>
            </div>
            <div className='grid gap-2 rounded-lg border border-[#22334d] bg-[#0f172a] p-3 text-sm text-[#aab7cc] sm:grid-cols-3 lg:grid-cols-1'>
                <TriageFact label='Targets' value={targetLabel(data, scanStatus)} />
                <TriageFact label='Last scan' value={timeLabel(scanStatus.finishedAt || data?.generatedAt, 'No completed scan')} />
                <TriageFact label='Next scan' value={scanStatus.paused ? 'Paused' : timeLabel(scanStatus.nextRunAt, 'Watching')} />
            </div>
            <details className='rounded-lg border border-[#22334d] bg-[#0f172a] lg:col-span-2' data-testid='vulnerability-scan-telemetry'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#edf4ff] outline-none transition hover:bg-[#142033] focus-visible:ring-2 focus-visible:ring-[#7aa5ff]'>
                    <span>Scan telemetry</span>
                    <span className='text-xs font-medium text-[#8fa0ba]'>{scanStatus.failureCount ? `${scanStatus.failureCount} failures` : 'Healthy counters'}</span>
                </summary>
                <div className='grid gap-3 border-t border-[#22334d] p-3 sm:grid-cols-2 xl:grid-cols-6'>
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
                        value={attention || 'Clear'}
                        icon={attention || scanStatus.stale ? CircleAlert : ShieldAlert}
                        tone={attention || scanStatus.stale ? 'rose' : 'slate'}
                    />
                </div>
            </details>
        </div>
    )
}

function TriageFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0 rounded-md border border-[#22334d] bg-[#0b1220] px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-[#8795ad]'>{label}</p>
            <p className='mt-0.5 truncate font-semibold text-[#edf4ff]'>{value}</p>
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
