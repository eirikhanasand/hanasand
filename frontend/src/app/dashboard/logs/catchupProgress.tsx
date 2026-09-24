'use client'

export type CatchupProgress = { remaining: number, processed: number, total: number, rate: number | null, estimated_seconds: number | null, updated_at: string, last_error?: string | null }

function duration(seconds: number) {
    const minutes = Math.max(1, Math.ceil(seconds / 60))
    if (minutes < 60) return `About ${minutes} min remaining`
    const hours = Math.ceil(minutes / 60)
    return hours < 48 ? `About ${hours} hours remaining` : `About ${Math.ceil(hours / 24)} days remaining`
}

export default function LogCatchupProgress({ progress, catchingUp, now, stalled }: { progress?: CatchupProgress | null, catchingUp: boolean, now: string, stalled?: boolean }) {
    if (!catchingUp && (!progress || progress.remaining === 0)) return null
    const stale = !progress || !!progress.last_error || !!stalled || Date.parse(now) - Date.parse(progress.updated_at) > 120_000
    const percent = progress?.remaining === 0 ? 100 : progress && progress.total > 0 ? Math.min(100, Math.max(0, progress.processed / progress.total * 100)) : 0
    const eta = stale ? 'Time remaining unavailable' : progress.remaining === 0 ? 'Finishing catch-up…' : progress.estimated_seconds === null ? 'Estimating time remaining…' : duration(progress.estimated_seconds)
    return <section aria-label='Historical log catch-up' className='rounded-xl border border-ui-primary/25 bg-ui-primary/5 p-4 sm:p-5'>
        <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2'>
            <div><h2 className='text-sm font-semibold text-ui-text'>Checking historical logs</h2><p className='mt-1 text-xl font-semibold tabular-nums text-ui-primary'>{progress ? `${progress.remaining.toLocaleString('en-US')} logs remaining` : 'Counting remaining logs…'}</p></div>
            <p className='text-sm text-ui-muted'>Last refreshed <time suppressHydrationWarning dateTime={now}>{new Date(now).toLocaleString('en-US')}</time></p>
        </div>
        <div role='progressbar' aria-label='Historical logs checked' aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ? Math.round(percent) : undefined} aria-valuetext={progress ? `${progress.remaining.toLocaleString('en-US')} logs remaining${stale ? ', awaiting update' : ''}` : 'Counting logs'} className='mt-4 h-2.5 overflow-hidden rounded-full bg-ui-primary/10'>
            <div className={`h-full rounded-full bg-gradient-to-r from-ui-primary/60 to-ui-primary transition-[width] duration-500 motion-reduce:transition-none ${!progress ? 'w-1/4 animate-pulse motion-reduce:animate-none' : ''}`} style={progress ? { width: `${percent}%` } : undefined} />
        </div>
        <p className='mt-2 text-right text-xs tabular-nums text-ui-muted'>{progress && `${percent.toFixed(1)}% · `}{eta}</p>
    </section>
}
