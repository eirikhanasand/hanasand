import type { GetVulnerabilities } from '@/utils/monitoring/types'
import type { ReactNode } from 'react'
import { AlertTriangle, CalendarClock, Clock3, ListChecks, PauseCircle, ShieldCheck, TerminalSquare } from 'lucide-react'

export default function ScanStatusPanel({ scanStatus }: { scanStatus: GetVulnerabilities['scanStatus'] }) {
    const state = scanStatus.isRunning
        ? { label: 'Running', className: 'border-ui-primary/20 bg-ui-primary/10 text-ui-primary', icon: ShieldCheck }
        : scanStatus.paused
            ? { label: 'Paused', className: 'border-ui-border bg-ui-panel text-ui-muted', icon: PauseCircle }
            : scanStatus.stale || scanStatus.blocker || scanStatus.lastError
                ? { label: 'Needs attention', className: 'border-ui-warning/20 bg-ui-warning/10 text-ui-warning', icon: AlertTriangle }
                : { label: 'Fresh', className: 'border-ui-success/20 bg-ui-success/10 text-ui-success', icon: ShieldCheck }
    const Icon = state.icon
    const blocker = scanStatus.blocker || scanStatus.lastError || scanStatus.staleReason

    return (
        <section className={`mt-4 rounded-xl border px-4 py-4 ${state.className}`}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <div className='flex items-center gap-2 text-sm font-semibold'>
                        <Icon className='h-4 w-4' />
                        {state.label}
                    </div>
                    <p className='mt-1 text-sm text-ui-muted'>
                        {blocker || 'Scanner is scheduled; results update as scans complete.'}
                    </p>
                    {scanStatus.blockerAction ? (
                        <p className='mt-1 text-sm text-ui-muted'>{scanStatus.blockerAction}</p>
                    ) : null}
                </div>
                <div className='grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:max-w-3xl lg:grid-cols-4'>
                    <StatusFact icon={<ListChecks className='h-4 w-4' />} label='Targets' value={String(scanStatus.targetCount || scanStatus.totalImages || 0)} />
                    <StatusFact icon={<Clock3 className='h-4 w-4' />} label='Last scan' value={formatTime(scanStatus.finishedAt || scanStatus.lastSuccessAt)} />
                    <StatusFact icon={<CalendarClock className='h-4 w-4' />} label='Next scan' value={scanStatus.paused ? 'paused' : formatTime(scanStatus.nextRunAt)} />
                    <StatusFact icon={<AlertTriangle className='h-4 w-4' />} label='Failures' value={String(scanStatus.failureCount || 0)} />
                </div>
            </div>
            {scanStatus.logs.length ? (
                <div className='mt-3 grid gap-2'>
                    {scanStatus.logs.slice(-3).map((log) => (
                        <div key={`${log.at}-${log.message}`} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${logTone(log.level)}`}>
                            <TerminalSquare className='mt-0.5 h-3.5 w-3.5 shrink-0' />
                            <span className='shrink-0 font-mono text-ui-muted'>{formatTime(log.at)}</span>
                            <span className='min-w-0 wrap-break-word'>{log.message}</span>
                        </div>
                    ))}
                </div>
            ) : null}
        </section>
    )
}

function StatusFact({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-canvas/80 p-3'>
            <div className='flex items-center gap-2 text-ui-muted'>
                {icon}
                <span className='text-xs font-semibold uppercase'>{label}</span>
            </div>
            <div className='mt-1 truncate text-sm font-semibold text-ui-text'>{value}</div>
        </div>
    )
}

function formatTime(value: string | null) {
    if (!value) return 'syncing'
    const time = new Date(value)
    if (Number.isNaN(time.getTime())) return 'syncing'
    return time.toLocaleString('nb-NO')
}

function logTone(level: 'info' | 'warn' | 'error') {
    if (level === 'error') return 'border-ui-danger/20 bg-ui-danger/10 text-ui-danger'
    if (level === 'warn') return 'border-ui-warning/20 bg-ui-warning/10 text-ui-warning'
    return 'border-ui-primary/20 bg-ui-primary/10 text-ui-primary'
}
