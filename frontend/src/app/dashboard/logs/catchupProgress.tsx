'use client'

export type CatchupProgress = { remaining: number, processed: number, total: number, rate: number | null, estimated_seconds: number | null, updated_at: string, last_error?: string | null }

function relativeChecked(value: string, now: string) {
    const seconds = Math.max(0, Math.floor((Date.parse(now) - Date.parse(value)) / 1000))
    if (seconds < 60) return `Checked ${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `Checked ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Checked ${hours}h ago`
    const then = new Date(value)
    const current = new Date(now)
    return then.toDateString() === current.toDateString()
        ? `Checked ${then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
        : `Checked ${then.toLocaleDateString('en-US', { day: '2-digit', month: '2-digit' })}`
}

function duration(seconds: number) {
    const minutes = Math.max(1, Math.ceil(seconds / 60))
    if (minutes < 60) return `About ${minutes} min remaining`
    const hours = Math.ceil(minutes / 60)
    return hours < 48 ? `About ${hours} hours remaining` : `About ${Math.ceil(hours / 24)} days remaining`
}

export default function LogCatchupProgress({ progress, now, stalled }: { progress?: CatchupProgress | null, now: string, stalled?: boolean }) {
    if (!progress || progress.remaining <= 1000) return null
    const stale = !!progress.last_error || !!stalled || Date.parse(now) - Date.parse(progress.updated_at) > 120_000
    const percent = progress.total > 0 ? Math.min(100, Math.max(0, progress.processed / progress.total * 100)) : 0
    const eta = stale ? 'Time remaining unavailable' : progress.estimated_seconds === null ? 'Estimating time remaining…' : duration(progress.estimated_seconds)
    return <section aria-label='Historical log lag' className='rounded-xl border border-ui-primary/25 bg-ui-primary/5 p-4 sm:p-5'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2'>
            <div><h2 className='text-sm font-semibold text-ui-text'>Historical log lag</h2><p className='mt-1 text-xl font-semibold tabular-nums text-ui-primary'>{`${progress.remaining.toLocaleString('en-US')} logs remaining`}</p></div>
            <p className='text-sm text-ui-muted'><time suppressHydrationWarning dateTime={now}>{relativeChecked(progress.updated_at, now)}</time></p>
        </div>
        <div role='progressbar' aria-label='Historical log lag' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={`${progress.remaining.toLocaleString('en-US')} logs remaining${stale ? ', awaiting update' : ''}`} className='mt-4 h-2.5 overflow-hidden rounded-full bg-ui-primary/10'>
            <div className='h-full rounded-full bg-gradient-to-r from-ui-primary/60 to-ui-primary transition-[width] duration-500 motion-reduce:transition-none' style={{ width: `${percent}%` }} />
        </div>
        <p className='mt-2 text-right text-xs tabular-nums text-ui-muted'>{`${percent.toFixed(1)}% · `}{eta}</p>
    </section>
}
