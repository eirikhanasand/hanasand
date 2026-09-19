'use client'
import { type ReactNode } from 'react'
import { Bug, ShieldAlert, Activity, AlertTriangle, Copy, ChevronDown } from 'lucide-react'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import type { ErrorEvent, ErrorEventsResponse } from '@/utils/logs/getLogs'
const countFormatter = new Intl.NumberFormat('nb-NO')
function when(value: string) { return new Date(value).toLocaleString() }
export default function ErrorsPanel({
    events,
    expanded,
    onToggle,
    onCopy,
}: {
    events: ErrorEventsResponse
    expanded: Record<string, boolean>
    onToggle: (id: string | number) => void
    onCopy: (event: ErrorEvent) => void
}) {
    const topCodes = events.summary.code_counts.slice(0, 8)
    const topSurfaces = events.summary.surface_counts.slice(0, 8)

    return (
        <section className='grid select-text gap-4'>
            <div className='grid gap-3 sm:grid-cols-2'>
                <SummaryCard icon={<Bug className='h-4 w-4' />} label='Scans against projects' value={events.summary.project_scans} note='404 probes folded out of errors' />
                <SummaryCard icon={<ShieldAlert className='h-4 w-4' />} label='Scans against shares' value={events.summary.share_scans} note='Share and tree 404 probes' />
            </div>

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <SummaryCard icon={<Bug className='h-4 w-4' />} label='Errors' value={events.summary.total} note='API, auth, and website' />
                <SummaryCard icon={<Activity className='h-4 w-4' />} label='Last hour' value={events.summary.last_hour} note='Fresh incidents' />
                <SummaryCard icon={<AlertTriangle className='h-4 w-4' />} label='Server errors' value={events.summary.server_errors} note='HTTP 5xx' />
                <SummaryCard icon={<ShieldAlert className='h-4 w-4' />} label='Client errors' value={events.summary.client_errors} note='HTTP 4xx' />
            </div>

            <section className='grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.34fr)]'>
                <div className={`${dashboardPanelClass} min-w-0 overflow-hidden`} data-logs-error-table>
                    <div className='border-b border-ui-border px-4 py-3'>
                        <h2 className='text-base font-semibold text-ui-text'>Recent errors</h2>
                        <p className='mt-1 text-xs leading-5 text-ui-muted'>Showing {events.errors.length} recent rows from {events.summary.total} errors. Select an error code for context.</p>
                    </div>
                    <div className='divide-y divide-ui-border'>
                        {events.errors.map((event) => {
                            const isOpen = expanded[event.id] ?? false
                            return <article key={event.id} className='min-w-0 p-4'>
                                <div className='flex flex-wrap items-center justify-between gap-3'>
                                    <button
                                        type='button'
                                        onClick={() => onToggle(event.id)}
                                        aria-expanded={isOpen}
                                        aria-controls={`error-details-${event.id}`}
                                        className='flex min-w-0 items-center gap-2 break-all text-left font-mono text-xs font-semibold text-ui-text hover:text-ui-primary'
                                    >
                                        <ChevronDown size={16} aria-hidden className={`shrink-0 ${isOpen ? '' : '-rotate-90'}`} />
                                        {event.error_code || 'uncategorized'}
                                    </button>
                                    <div className='flex items-center gap-2'>
                                        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${event.status_code >= 500 ? 'border-ui-danger bg-ui-danger/15 text-ui-danger' : 'border-ui-warning bg-ui-warning/15 text-ui-warning'}`}>
                                            {event.status_code || 'unreported'}
                                        </span>
                                        <button type='button' aria-label='Copy error JSON' onClick={() => onCopy(event)} className='rounded-md p-1.5 text-ui-muted hover:text-ui-primary'><Copy size={16} aria-hidden /></button>
                                    </div>
                                </div>
                                <p className='mt-2 text-xs text-ui-muted'>{when(event.created_at)} · {event.surface || event.source} · User: {event.user_id || 'anonymous'}</p>
                                <p className='mt-2 select-text wrap-break-word font-mono text-xs text-ui-text'>{event.method} {event.path}</p>
                                {isOpen && <pre id={`error-details-${event.id}`} className='mt-3 max-h-96 select-text overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-ui-border bg-ui-raised p-3 font-mono text-xs leading-5 text-ui-text'>
                                    {JSON.stringify(event, null, 2)}
                                </pre>}
                            </article>
                        })}
                    </div>
                    {!events.errors.length && (
                        <div className='grid min-h-48 place-content-center border-t border-ui-border px-5 text-center text-sm text-ui-muted'>
                            No tracked errors in the current window.
                        </div>
                    )}
                </div>

                <section className='grid min-w-0 content-start gap-4'>
                    <BreakdownCard title='Top codes' rows={topCodes.map(row => ({ label: row.error_code || 'uncategorized', count: row.count }))} />
                    <BreakdownCard title='Top surfaces' rows={topSurfaces.map(row => ({ label: row.surface || 'api', count: row.count }))} />
                </section>
            </section>
        </section>
    )
}

function BreakdownCard({ title, rows }: { title: string, rows: Array<{ label: string, count: number }> }) {
    return (
        <div className={`${dashboardPanelClass} min-w-0 p-4`}>
            <h3 className='text-base font-semibold text-ui-text'>{title}</h3>
            <div className='mt-3 grid gap-1.5'>
                {rows.map((row) => (
                    <div key={row.label} className='flex min-w-0 items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
                        <span className='min-w-0 break-all font-mono text-xs text-ui-text'>{row.label}</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-0.5 text-xs font-semibold text-ui-muted'>{row.count}</span>
                    </div>
                ))}
                {!rows.length && <p className='rounded-md border border-dashed border-ui-border p-3 text-sm text-ui-muted'>No errors in this window.</p>}
            </div>
        </div>
    )
}

function SummaryCard({ icon, label, value, note }: { icon: ReactNode, label: string, value: number, note: string }) {
    return (
        <article className={`${dashboardPanelClass} p-3 sm:p-4`} data-logs-metric-card>
            <div className='flex items-center justify-between gap-3 text-ui-muted'>
                <span className='text-xs font-medium'>{label}</span>
                <span className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-raised text-ui-muted'>{icon}</span>
            </div>
            <p className='mt-2 text-xl font-semibold text-ui-text'>{countFormatter.format(value)}</p>
            <p className='mt-1 text-xs font-medium text-ui-muted'>{note}</p>
        </article>
    )
}
