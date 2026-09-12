'use client'

export type CheckDetails = { endpoint: string, checkType: string, timeoutSeconds: number, retryCount: number, followRedirects: boolean, expectedDown: boolean, upsideDown: boolean }
export type CaseEvent = { id: string, startedAt: string, completedAt?: string, durationMs?: number, outcome: string, message: string, details?: CheckDetails }
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Not recorded'

export function CheckFields({ details }: { details: CheckDetails }) {
    return <dl className='grid min-w-0 gap-3 text-sm sm:grid-cols-2'>
        {[['Endpoint', details.endpoint || 'Not recorded'], ['Check type', details.checkType?.toUpperCase() || 'Not recorded'], ['Timeout per attempt', `${details.timeoutSeconds} seconds`], ['Configured retries', String(details.retryCount)], ['Follow redirects', details.followRedirects ? 'Yes' : 'No'], ['Expected result', details.expectedDown || details.upsideDown ? 'Failure / unavailable (inverted check)' : 'Successful response']].map(([label, value]) => <div key={label} className='min-w-0'><dt className='text-ui-muted'>{label}</dt><dd className='[overflow-wrap:anywhere]'>{value}</dd></div>)}
    </dl>
}

export function CaseEvents({ events, total, occurrences, loading, onMore }: { events: CaseEvent[], total: number, occurrences: number, loading: boolean, onMore: () => void }) {
    return <div className='p-5 sm:p-6'>
        <p className='mb-4 text-sm text-ui-muted'>Each event is one check run that contributed to this case. Retries within a run count as one occurrence.</p>
        {total !== occurrences && <p className='mb-4 text-sm text-ui-warning'>{occurrences} occurrences were counted; {total} underlying runs are available.</p>}
        <ol className='grid gap-4'>{events.map(event => <li key={event.id} className='min-w-0 rounded-lg border border-ui-border p-4'>
            <p className='font-medium'>{date(event.startedAt)} · {event.outcome}</p>
            <p className='mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]'>{event.message || 'No diagnostic message was recorded.'}</p>
            <dl className='my-3 grid gap-2 text-sm sm:grid-cols-2'><div><dt>Duration</dt><dd>{event.durationMs == null ? 'Not recorded' : `${event.durationMs.toLocaleString()} ms`}</dd></div><div><dt>Completed</dt><dd>{date(event.completedAt)}</dd></div></dl>
            {event.details ? <CheckFields details={event.details} /> : <p className='text-sm text-ui-muted'>The check configuration was not captured for this older event. Current configuration is shown under Details.</p>}
            <p className='mt-3 wrap-break-word text-xs text-ui-muted'>Run ID: {event.id}</p>
        </li>)}</ol>
        {!events.length && <p>No underlying events are available.</p>}
        {events.length < total && <button className='mt-4 rounded-lg border border-ui-border px-3 py-2 text-sm' disabled={loading} onClick={onMore}>{loading ? 'Loading…' : 'Load more events'}</button>}
    </div>
}
