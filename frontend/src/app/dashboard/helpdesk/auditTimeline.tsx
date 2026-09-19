'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bell } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { param, type AdminAuditEvent, type AuditSearchParams } from './audit'

const fieldClass = 'h-9 min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const selectClass = `${fieldClass} appearance-none`
const quietButtonClass = 'grid h-9 place-items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel'
const severities = ['', 'info', 'notice', 'warning', 'critical']
const outcomes = ['', 'success', 'denied', 'failed']
const limits = ['50', '100', '200', '500']
function auditDisplayText(value: string, kind = 'account') {
    // Legacy test names remain in the audit records; only their display wording changes.
    return value.replace(/\b(?:Hanasand )?Commercial Acceptance\b/gi, kind === 'organization' ? 'Test organization' : 'Test account')
}

function formatTime(value: string) {
    const date = new Date(value)
    return Number.isFinite(date.getTime())
        ? date.toLocaleString()
        : value
}

function auditTargetName(event: AdminAuditEvent) {
    const organizationName = event.object_type === 'organization'
        ? ((!event.organization_id || event.organization_id === event.object_id) ? event.organization_name : '')
            || (typeof event.context?.name === 'string' ? event.context.name : '')
        : ''
    const name = event.target_name || organizationName
    return name ? auditDisplayText(name, event.object_type || undefined) : event.object_id || event.object_type || ''
}

function severityClass(severity: AdminAuditEvent['severity']) {
    if (severity === 'critical') return 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    if (severity === 'warning') return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
    if (severity === 'notice') return 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary'
    return 'border-ui-border bg-ui-raised text-ui-muted'
}

function outcomeClass(outcome: AdminAuditEvent['outcome']) {
    if (outcome === 'success') return 'border-ui-success/35 bg-ui-success/10 text-ui-success'
    if (outcome === 'denied') return 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
    return 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
}

function activeFilterEntries(params: AuditSearchParams) {
    return (['q', 'org', 'actor', 'target', 'action', 'severity', 'source', 'service', 'entity', 'request', 'outcome', 'from', 'to'] as const)
        .map(key => [key, param(params, key).trim()] as const)
        .filter(([, value]) => value)
}

function stats(events: AdminAuditEvent[]) {
    return {
        denied: events.filter(event => event.outcome === 'denied').length,
        critical: events.filter(event => event.severity === 'critical').length,
        impersonation: events.filter(event => event.event_type.startsWith('impersonation')).length,
        recovery: events.filter(event => event.event_type.includes('recovery') || event.event_type.includes('invite')).length,
    }
}

function selectedAuditEvent(events: AdminAuditEvent[], params: AuditSearchParams) {
    const eventId = param(params, 'event').trim()
    if (eventId) return events.find(event => String(event.id) === eventId) || events[0]
    const request = param(params, 'request').trim()
    const entity = param(params, 'entity').trim()
    const action = param(params, 'action').trim()
    const target = param(params, 'target').trim()

    return events.find(event => (
        (request && event.request_id === request)
        || (entity && event.subject_id === entity)
        || (action && event.event_type === action)
        || (target && (event.object_id === target || event.target_name === target))
    )) || events[0]
}

function auditDetailRows(event: AdminAuditEvent) {
    return [
        ['Actor', event.actor_name ? auditDisplayText(event.actor_name) : event.actor_id],
        ['Target', auditTargetName(event)],
        ['Organization', event.object_type === 'organization' && event.object_id === event.organization_id
            ? undefined
            : event.organization_name ? auditDisplayText(event.organization_name, 'organization') : event.organization_id],
        ['Request', event.request_id],
        ['Entity', event.subject_id],
        ['Source', `${event.source}/${event.service}`],
    ].filter(([, value]) => value)
}

export default function AuditTimeline({ events, params, responseError }: { events: AdminAuditEvent[], params: AuditSearchParams, responseError: string }) {
    const searchParams = useSearchParams()
    const selectedEvent = selectedAuditEvent(events, { ...params, event: searchParams?.get('event') || undefined })
    const notificationPanel = useRef<HTMLDetailsElement>(null)
    const timeline = useRef<HTMLDivElement>(null)
    const eventStats = stats(events)
    const reviewEvents = events.filter(event => event.severity === 'critical' || event.outcome === 'denied' || event.outcome === 'failed')
    const filterEntries = activeFilterEntries(params)
    const primarySearch = param(params, 'q')
    const advancedFilterCount = filterEntries.filter(([key]) => key !== 'q').length

    function selectEvent(id: number, reveal = false) {
        const url = new URL(window.location.href)
        url.searchParams.set('event', String(id))
        // Native history updates Next's search params without fetching the page again.
        window.history.pushState(null, '', url)
        if (reveal) {
            if (notificationPanel.current) notificationPanel.current.open = false
            const row = timeline.current?.querySelector<HTMLElement>(`[data-audit-event-id="${id}"]`)
            row?.scrollIntoView({ block: 'nearest' })
            row?.querySelector('button')?.focus({ preventScroll: true })
        }
    }

    return (
        <DashboardPage className='gap-3'>
            <DashboardHeader
                eyebrow='Support'
                title='Helpdesk operations'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link className={quietButtonClass} href='/dashboard'>Dashboard</Link>
                    </div>
                )}
            />
            <section className='grid gap-3'>
                <div className='grid min-w-0 content-start gap-3'>
                    <DashboardPanel className='p-4'>
                        <form className='grid gap-3' action='/helpdesk'>
                            <div className='grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-center'>
                                <label className='sr-only' htmlFor='audit-search'>Search audit events</label>
                                <input id='audit-search' className={`${fieldClass} col-span-3 md:col-span-1`} name='q' defaultValue={primarySearch} placeholder='Search audit events' />
                                <button className='h-9 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90' type='submit'>Search</button>
                                <Link className={quietButtonClass} href='/helpdesk'>Clear</Link>
                                <details className='relative' ref={notificationPanel} onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
                                    <summary aria-label={`Notifications: ${reviewEvents.length} event${reviewEvents.length === 1 ? '' : 's'} to review`} className={`${quietButtonClass} flex cursor-pointer list-none gap-1 [&::-webkit-details-marker]:hidden`}>
                                        <Bell size={18} aria-hidden='true' />
                                        {reviewEvents.length ? <span className='text-xs text-ui-warning'>{reviewEvents.length}</span> : null}
                                    </summary>
                                    <div className='absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-3rem)] rounded-lg border border-ui-border bg-ui-panel p-3 shadow-lg' aria-label='Audit notifications'>
                                        <h2 className='text-sm font-semibold text-ui-text'>In these results</h2>
                                        <div className='my-3 grid grid-cols-3 gap-2 text-xs text-ui-muted'>
                                            <SnapshotFact label='Events' value={String(events.length)} />
                                            <SnapshotFact label='Critical' value={String(eventStats.critical)} />
                                            <SnapshotFact label='Denied' value={String(eventStats.denied)} />
                                            <SnapshotFact label='Recovery' value={String(eventStats.recovery)} />
                                            <SnapshotFact label='Sessions' value={String(eventStats.impersonation)} />
                                        </div>
                                        <div className='grid max-h-72 gap-2 overflow-auto'>
                                            {responseError ? <p className='text-sm text-ui-warning'>Events could not be loaded.</p> : reviewEvents.length ? reviewEvents.map(event => (
                                                <button type='button' key={event.id} onClick={() => selectEvent(event.id, true)} className='grid gap-1 rounded-md border border-ui-border p-2 text-left text-sm hover:bg-ui-raised focus-visible:outline-2 focus-visible:outline-ui-primary'>
                                                    <span className='font-semibold text-ui-text'>{event.event_type}</span>
                                                    <span className='text-xs text-ui-warning'>{event.severity} · {event.outcome}</span>
                                                    <span className='wrap-break-word text-xs text-ui-muted'>{auditTargetName(event) || auditDisplayText(event.reason)}</span>
                                                </button>
                                            )) : <p className='text-sm text-ui-muted'>No critical, denied or failed events in these results.</p>}
                                        </div>
                                    </div>
                                </details>
                            </div>
                            <details className='group rounded-lg border border-ui-border bg-ui-raised'>
                                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                                    <span>Filters{advancedFilterCount ? ` (${advancedFilterCount})` : ''}</span>
                                    <span className='text-xs font-medium text-ui-muted group-open:hidden'>Refine timeline</span>
                                    <span className='hidden text-xs font-medium text-ui-muted group-open:inline'>Hide filters</span>
                                </summary>
                                <div className='grid gap-3 border-t border-ui-border p-3'>
                                    <div className='grid gap-2 lg:grid-cols-4'>
                                        <input className={fieldClass} name='org' defaultValue={param(params, 'org')} placeholder='Organization' />
                                        <input className={fieldClass} name='actor' defaultValue={param(params, 'actor')} placeholder='Actor' />
                                        <input className={fieldClass} name='target' defaultValue={param(params, 'target')} placeholder='Target' />
                                        <input className={fieldClass} name='action' defaultValue={param(params, 'action')} placeholder='Action type' />
                                    </div>
                                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-4'>
                                        <input className={fieldClass} name='source' defaultValue={param(params, 'source')} placeholder='Source' />
                                        <input className={fieldClass} name='service' defaultValue={param(params, 'service')} placeholder='Service' />
                                        <input className={fieldClass} name='entity' defaultValue={param(params, 'entity')} placeholder='Entity id' />
                                        <input className={fieldClass} name='request' defaultValue={param(params, 'request')} placeholder='Request id' />
                                    </div>
                                    <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_9rem_8rem_auto] lg:items-center'>
                                        <select className={selectClass} name='severity' defaultValue={param(params, 'severity').toLowerCase()}>
                                            {severities.map(severity => <option key={severity} value={severity}>{severity || 'Severity'}</option>)}
                                        </select>
                                        <select className={selectClass} name='outcome' defaultValue={param(params, 'outcome').toLowerCase()}>
                                            {outcomes.map(outcome => <option key={outcome} value={outcome}>{outcome || 'Outcome'}</option>)}
                                        </select>
                                        <input className={fieldClass} name='from' defaultValue={param(params, 'from')} type='datetime-local' aria-label='From' />
                                        <input className={fieldClass} name='to' defaultValue={param(params, 'to')} type='datetime-local' aria-label='To' />
                                        <select className={selectClass} name='limit' defaultValue={param(params, 'limit') || '200'} aria-label='Result limit'>
                                            {limits.map(limit => <option key={limit} value={limit}>{limit}</option>)}
                                        </select>
                                        <button className='h-9 rounded-md border border-ui-border px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel' type='submit'>Apply filters</button>
                                    </div>
                                </div>
                            </details>
                            {filterEntries.length ? (
                                <div className='flex flex-wrap gap-2 border-t border-ui-border pt-3' aria-label='Active audit filters'>
                                    {filterEntries.map(([key, value]) => (
                                        <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-xs text-ui-muted' key={key}>{key}: {value}</span>
                                    ))}
                                </div>
                            ) : null}
                        </form>
                    </DashboardPanel>
                    {responseError ? (
                        <DashboardPanel className='border-ui-warning/35 bg-ui-warning/10 p-4 text-sm text-ui-warning'>
                            {responseError} Check API availability or narrow the query.
                        </DashboardPanel>
                    ) : null}
                    <DashboardPanel className='overflow-hidden'>
                        <div className='border-b border-ui-border px-4 py-3'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <h2 className='text-sm font-semibold text-ui-text'>Audit timeline</h2>
                                <span className='rounded-md bg-ui-raised px-2 py-1 text-xs font-medium text-ui-muted'>{events.length} events</span>
                            </div>
                        </div>
                        <div className='grid max-h-[72vh] gap-0 divide-y divide-ui-border overflow-auto' ref={timeline}>
                            {!events.length ? (
                                <div className='grid gap-3 p-5 text-sm text-ui-muted'>
                                    <p className='font-medium text-ui-text'>No matching support events</p>
                                    {filterEntries.length ? <Link className={quietButtonClass} href='/helpdesk'>Clear filters</Link> : null}
                                </div>
                            ) : events.map((event) => {
                                const focused = selectedEvent?.id === event.id
                                return (
                                    <article key={event.id} data-audit-event-id={event.id} data-helpdesk-focused-event={focused ? 'true' : undefined}>
                                        <button type='button' onClick={() => selectEvent(event.id)} aria-expanded={focused} aria-controls={`audit-detail-${event.id}`} className={`grid w-full gap-3 text-left p-4 transition hover:bg-ui-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ui-primary md:grid-cols-[minmax(0,1fr)_11rem] md:items-start ${focused ? 'bg-ui-primary/5 ring-1 ring-inset ring-ui-primary/25' : ''}`}>
                                            <div className='min-w-0'>
                                                <div className='flex flex-wrap items-center gap-2 text-sm text-ui-text'>
                                                    <strong className='min-w-0 truncate'>{event.event_type}</strong>
                                                    {focused ? <span className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold uppercase text-ui-primary'>Selected</span> : null}
                                                    <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(event.severity)}`}>{event.severity}</span>
                                                    <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass(event.outcome)}`}>{event.outcome}</span>
                                                    <span className='rounded-md bg-ui-raised px-2 py-1 text-xs text-ui-muted'>{event.source}/{event.service}</span>
                                                </div>
                                                <div className='mt-2 flex flex-wrap gap-2 text-xs text-ui-muted'>
                                                    {event.actor_name || event.actor_id ? <span className='rounded-md bg-ui-raised px-2 py-1'>actor {event.actor_name ? auditDisplayText(event.actor_name) : event.actor_id}</span> : null}
                                                    {event.object_id ? <span className='rounded-md bg-ui-raised px-2 py-1'>{event.object_type || 'target'} {auditTargetName(event)}</span> : null}
                                                    {event.organization_id && !(event.object_type === 'organization' && event.object_id === event.organization_id) ? <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-ui-primary'>{event.organization_name ? auditDisplayText(event.organization_name, 'organization') : event.organization_id}</span> : null}
                                                    {event.subject_id ? <span className='rounded-md bg-ui-raised px-2 py-1 font-mono'>entity {event.subject_id}</span> : null}
                                                    {event.request_id ? <span className='rounded-md bg-ui-raised px-2 py-1 font-mono'>request {event.request_id}</span> : null}
                                                </div>
                                                {event.reason ? <p className='mt-2 text-sm text-ui-muted'>{auditDisplayText(event.reason, event.object_type || undefined)}</p> : null}
                                            </div>
                                            <div className='text-left text-xs text-ui-muted md:text-right'>
                                                <time dateTime={event.created_at} suppressHydrationWarning>{formatTime(event.created_at)}</time>
                                                <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                                                <span className='mt-2 inline-flex rounded-md border border-ui-border px-2 py-1 font-semibold text-ui-text'>
                                                    Details
                                                </span>
                                            </div>
                                        </button>
                                        <div id={`audit-detail-${event.id}`} hidden={!focused}>
                                            {focused ? <dl className='grid gap-2 border-t border-ui-border bg-ui-raised/50 px-4 py-3 text-xs text-ui-muted sm:grid-cols-2 lg:grid-cols-3' aria-label='Event details'>
                                                {auditDetailRows(event).map(([label, value]) => (
                                                    <div className='min-w-0' key={label}>
                                                        <dt className='font-semibold'>{label}</dt>
                                                        <dd className='mt-1 whitespace-pre-wrap wrap-break-word text-ui-text'>{value}</dd>
                                                    </div>
                                                ))}
                                            </dl> : null}
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    </DashboardPanel>
                </div>
            </section>
        </DashboardPage>
    )
}
function SnapshotFact({ label, value, tone = 'quiet' }: { label: string, value: string, tone?: 'quiet' | 'warn' }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised px-3 py-2'>
            <div className='font-semibold uppercase text-ui-muted'>{label}</div>
            <div className={`mt-0.5 text-sm font-semibold ${tone === 'warn' ? 'text-ui-warning' : 'text-ui-text'}`}>{value}</div>
        </div>
    )
}
