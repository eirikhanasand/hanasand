import type { GetVulnerabilities } from '@/utils/monitoring/types'

export default function SummaryGrid({
    data,
    scanStatus,
}: {
    data: GetVulnerabilities | null
    scanStatus: GetVulnerabilities['scanStatus']
}) {
    return (
        <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='min-w-0 py-1'>
                <p className='text-[10px] font-semibold uppercase text-ui-primary'>Container image risks</p>
            </div>
            <div className='flex flex-wrap gap-2 sm:justify-end'>
                <TriageFact label='Targets' value={targetLabel(data, scanStatus)} />
                <TriageFact label='Last scan' value={timeLabel(scanStatus.finishedAt || data?.generatedAt, 'No completed scan')} />
                <TriageFact label='Next scan' value={scanStatus.paused ? 'Paused' : timeLabel(scanStatus.nextRunAt, 'Watching')} />
                <TriageFact label='Failures' value={scanStatus.failureCount ? `${scanStatus.failureCount}` : 'None'} />
            </div>
        </div>
    )
}

function TriageFact({ label, value }: { label: string, value: string }) {
    return (
        <div className='min-w-0 rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
            <p className='text-[10px] font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-0.5 truncate font-semibold text-ui-text'>{value}</p>
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
