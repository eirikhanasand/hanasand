import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import config from '@/config'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import AccessRecoveryForm from './accessRecoveryForm'

type AdminAuditEvent = {
    id: number
    action_type: string
    severity: 'info' | 'notice' | 'warning' | 'critical'
    source: string
    service: string
    actor_id: string
    actor_name?: string | null
    target_type?: string | null
    target_id?: string | null
    target_name?: string | null
    organization_id?: string | null
    organization_name?: string | null
    entity_id?: string | null
    request_id?: string | null
    outcome: 'success' | 'denied' | 'failed'
    reason: string
    context?: Record<string, unknown> | null
    ip: string
    user_agent: string
    created_at: string
}

type SupportMode = 'inspect' | 'impersonation' | 'recovery' | 'decision' | 'queue'

type AuditSearchParams = {
    q?: string | string[]
    org?: string | string[]
    actor?: string | string[]
    target?: string | string[]
    action?: string | string[]
    severity?: string | string[]
    source?: string | string[]
    service?: string | string[]
    entity?: string | string[]
    request?: string | string[]
    outcome?: string | string[]
    from?: string | string[]
    to?: string | string[]
    limit?: string | string[]
    support?: string | string[]
}

const fieldClass = 'h-9 min-w-0 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
const selectClass = `${fieldClass} appearance-none`
const quietButtonClass = 'grid h-9 place-items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel'
const severities = ['', 'info', 'notice', 'warning', 'critical']
const outcomes = ['', 'success', 'denied', 'failed']
const limits = ['50', '100', '200', '500']
const supportActions = [
    { action: 'support.organization.access_recovery', label: 'Access recovery' },
    { action: 'support.organization.invite', label: 'Organization invite' },
    { action: 'support.organization.member_role_recovery', label: 'Role recovery' },
    { action: 'impersonation.start', label: 'Session started' },
    { action: 'impersonation.stop', label: 'Session ended' },
]

function formatTime(value: string) {
    const date = new Date(value)
    return Number.isFinite(date.getTime())
        ? date.toLocaleString()
        : value
}

function param(params: AuditSearchParams, key: keyof AuditSearchParams) {
    const value = params[key]
    return Array.isArray(value) ? value[0] || '' : value || ''
}

function buildApiQuery(params: AuditSearchParams) {
    const query = new URLSearchParams()
    for (const key of ['q', 'org', 'actor', 'target', 'action', 'severity', 'source', 'service', 'entity', 'request', 'outcome', 'from', 'to', 'limit'] as const) {
        const value = param(params, key).trim()
        if (value) query.set(key, value)
    }
    return query.toString()
}

function contextText(value: Record<string, unknown> | null | undefined) {
    if (!value || typeof value !== 'object') return ''
    const entries = Object.entries(value)
        .filter(([, item]) => item !== null && item !== undefined && item !== '')
        .slice(0, 4)
    return entries.map(([key, item]) => `${key}: ${Array.isArray(item) ? item.join(', ') : String(item)}`).join(' · ')
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
        impersonation: events.filter(event => event.action_type.startsWith('impersonation')).length,
        recovery: events.filter(event => event.action_type.includes('recovery') || event.action_type.includes('invite')).length,
    }
}

function selectedAuditEvent(events: AdminAuditEvent[], params: AuditSearchParams) {
    const request = param(params, 'request').trim()
    const entity = param(params, 'entity').trim()
    const action = param(params, 'action').trim()
    const target = param(params, 'target').trim()

    return events.find(event => (
        (request && event.request_id === request)
        || (entity && event.entity_id === entity)
        || (action && event.action_type === action)
        || (target && (event.target_id === target || event.target_name === target))
    )) || events[0]
}

function auditDetailRows(event: AdminAuditEvent) {
    return [
        ['Actor', event.actor_name || event.actor_id],
        ['Target', event.target_name || event.target_id || event.target_type],
        ['Organization', event.organization_name || event.organization_id],
        ['Request', event.request_id],
        ['Entity', event.entity_id],
        ['Source', `${event.source}/${event.service}`],
    ].filter(([, value]) => value)
}

function auditSnapshotHeadline(eventCount: number, eventStats: ReturnType<typeof stats>) {
    if (!eventCount) return 'No matching support events'
    if (eventStats.critical) return `${eventStats.critical} critical event${eventStats.critical === 1 ? '' : 's'} need review`
    if (eventStats.denied) return `${eventStats.denied} denied event${eventStats.denied === 1 ? '' : 's'} need review`
    return `${eventCount} event${eventCount === 1 ? '' : 's'} matching filters`
}

function resolveSupportMode(value: string): SupportMode {
    const normalized = value.trim().toLowerCase()
    return normalized === 'impersonation' || normalized === 'recovery' || normalized === 'decision' || normalized === 'queue'
        ? normalized
        : 'inspect'
}

export default async function ImpersonationAuditPage({
    searchParams,
}: {
    searchParams: Promise<AuditSearchParams>
}) {
    const Cookies = await cookies()
    const params = await searchParams
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/impersonation%26expired=true')
    }

    const query = buildApiQuery(params)
    const response = await fetch(`${config.url.api}/admin/audit-events${query ? `?${query}` : ''}`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
        },
        cache: 'no-store',
    }).catch(() => null)
    const payload = response?.ok ? await response.json().catch(() => null) : null
    const events = Array.isArray(payload?.events) ? payload.events as AdminAuditEvent[] : []
    const selectedEvent = selectedAuditEvent(events, params)
    const eventStats = stats(events)
    const filterEntries = activeFilterEntries(params)
    const primarySearch = param(params, 'q')
    const advancedFilterCount = filterEntries.filter(([key]) => key !== 'q').length
    const supportMode = resolveSupportMode(param(params, 'support'))
    const responseError = response && !response.ok
        ? `Audit service reported ${response.status}.`
        : !response
            ? 'Audit API is unavailable.'
            : ''

    return (
        <DashboardPage className='gap-3'>
            <DashboardHeader
                eyebrow='Support'
                title='Helpdesk operations'
                description='Inspect scoped support activity, recover access, and review impersonation audit trails from one workbench.'
                actions={(
                    <div className='flex flex-wrap gap-2'>
                        <Link className={quietButtonClass} href='/dashboard'>Dashboard</Link>
                        <Link className='grid h-9 place-items-center rounded-lg bg-ui-primary px-3 text-sm font-semibold text-ui-canvas transition hover:opacity-90' href='/dashboard/system/impersonation?support=impersonation#support-actions'>Start session</Link>
                    </div>
                )}
            />
            <section className='grid gap-3 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]'>
                <div className='grid min-w-0 content-start gap-3'>
                    <DashboardPanel className='p-4'>
                        <form className='grid gap-3' action='/dashboard/system/impersonation'>
                            <div className='grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center'>
                                <label className='sr-only' htmlFor='audit-search'>Search audit events</label>
                                <input id='audit-search' className={fieldClass} name='q' defaultValue={primarySearch} placeholder='Search audit events' />
                                <button className='h-9 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90' type='submit'>Search</button>
                                <Link className={quietButtonClass} href='/dashboard/system/impersonation'>Clear</Link>
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
                        <div className='grid border-b border-ui-border md:grid-cols-[minmax(0,1fr)_minmax(260px,0.48fr)]'>
                            <div className='min-w-0 px-4 py-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h2 className='text-sm font-semibold text-ui-text'>Audit timeline</h2>
                                    <span className='rounded-md bg-ui-raised px-2 py-1 text-xs font-medium text-ui-muted'>{events.length} events</span>
                                </div>
                                <p className='mt-1 text-xs text-ui-muted'>{events.length ? 'Use Focus to inspect a specific event without opening every control.' : 'Search or open filters to find support activity.'}</p>
                            </div>
                            <div className='border-t border-ui-border bg-ui-raised px-4 py-3 md:border-l md:border-t-0'>
                                <div className='text-[10px] font-semibold uppercase tracking-[0.16em] text-ui-muted'>Selected detail</div>
                                {selectedEvent ? (
                                    <div className='mt-2 min-w-0 text-sm text-ui-text'>
                                        <div className='truncate font-semibold text-ui-text'>{selectedEvent.action_type}</div>
                                        <div className='mt-1 truncate text-xs'>request {selectedEvent.request_id || 'checking'} · entity {selectedEvent.entity_id || 'checking'}</div>
                                    </div>
                                ) : (
                                    <p className='mt-2 text-sm text-ui-muted'>Select an audit row to inspect request and entity detail.</p>
                                )}
                            </div>
                        </div>
                        <div className='grid max-h-[72vh] gap-0 divide-y divide-ui-border overflow-auto'>
                            {!events.length ? (
                                <div className='grid gap-3 p-5 text-sm text-ui-muted'>
                                    <p className='font-medium text-ui-text'>Audit stream is clear for the current filters.</p>
                                    <div className='flex flex-wrap gap-2'>
                                        {supportActions.map(({ action, label }) => (
                                            <Link className='rounded-md border border-ui-border px-2 py-1 text-xs font-semibold text-ui-text hover:bg-ui-raised' href={`/dashboard/system/impersonation?action=${encodeURIComponent(action)}&source=admin&service=hanasand-api`} key={action}>{label}</Link>
                                        ))}
                                    </div>
                                </div>
                            ) : events.map((event) => {
                                const focused = selectedEvent?.id === event.id
                                return (
                                    <article key={event.id} className={`grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_11rem] md:items-start ${focused ? 'bg-ui-primary/5 ring-1 ring-inset ring-ui-primary/25' : ''}`} data-helpdesk-focused-event={focused ? 'true' : undefined}>
                                        <div className='min-w-0'>
                                            <div className='flex flex-wrap items-center gap-2 text-sm text-ui-text'>
                                                <strong className='min-w-0 truncate'>{event.action_type}</strong>
                                                {focused ? <span className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-[11px] font-semibold uppercase text-ui-primary'>Focused</span> : null}
                                                <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(event.severity)}`}>{event.severity}</span>
                                                <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass(event.outcome)}`}>{event.outcome}</span>
                                                <span className='rounded-md bg-ui-raised px-2 py-1 text-xs text-ui-muted'>{event.source}/{event.service}</span>
                                            </div>
                                            <div className='mt-2 flex flex-wrap gap-2 text-xs text-ui-muted'>
                                                <span className='rounded-md bg-ui-raised px-2 py-1'>actor {event.actor_name || event.actor_id}</span>
                                                {event.target_id ? <span className='rounded-md bg-ui-raised px-2 py-1'>{event.target_type || 'target'} {event.target_name || event.target_id}</span> : null}
                                                {event.organization_id ? <span className='rounded-md bg-ui-primary/10 px-2 py-1 text-ui-primary'>{event.organization_name || event.organization_id}</span> : null}
                                                {event.entity_id ? <span className='rounded-md bg-ui-raised px-2 py-1 font-mono'>entity {event.entity_id}</span> : null}
                                                {event.request_id ? <span className='rounded-md bg-ui-raised px-2 py-1 font-mono'>request {event.request_id}</span> : null}
                                            </div>
                                            {event.reason ? <p className='mt-2 text-sm text-ui-muted'>{event.reason}</p> : null}
                                            {contextText(event.context) ? <p className='mt-1 text-xs text-ui-muted'>{contextText(event.context)}</p> : null}
                                        </div>
                                        <div className='text-left text-xs text-ui-muted md:text-right'>
                                            <div>{formatTime(event.created_at)}</div>
                                            <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                                            <Link className='mt-2 inline-flex rounded-md border border-ui-border px-2 py-1 font-semibold text-ui-text hover:bg-ui-raised' href={`/dashboard/system/impersonation?request=${encodeURIComponent(event.request_id || '')}&entity=${encodeURIComponent(event.entity_id || '')}&source=${encodeURIComponent(event.source)}&service=${encodeURIComponent(event.service)}`}>
                                                Focus
                                            </Link>
                                        </div>
                                    </article>
                                )
                            })}
                        </div>
                    </DashboardPanel>
                </div>
                <aside className='grid content-start gap-3'>
                    <DashboardPanel className='p-4'>
                        <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-ui-muted'>Audit snapshot</p>
                        <h2 className='mt-1 text-base font-semibold text-ui-text'>{auditSnapshotHeadline(events.length, eventStats)}</h2>
                        <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-ui-muted'>
                            <SnapshotFact label='Events' value={String(events.length)} />
                            <SnapshotFact label='Denied' value={String(eventStats.denied)} tone={eventStats.denied ? 'warn' : 'quiet'} />
                            <SnapshotFact label='Recovery' value={String(eventStats.recovery)} />
                            <SnapshotFact label='Sessions' value={String(eventStats.impersonation)} />
                        </div>
                    </DashboardPanel>
                    {selectedEvent ? (
                        <DashboardPanel className='p-4' data-helpdesk-selected-detail>
                            <div className='flex flex-wrap items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='text-[10px] font-semibold uppercase tracking-[0.16em] text-ui-muted'>Selected event</p>
                                    <h2 className='mt-1 truncate text-sm font-semibold text-ui-text'>{selectedEvent.action_type}</h2>
                                </div>
                                <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass(selectedEvent.outcome)}`}>{selectedEvent.outcome}</span>
                            </div>
                            <dl className='mt-3 grid gap-2 text-xs text-ui-muted'>
                                {auditDetailRows(selectedEvent).map(([label, value]) => (
                                    <div className='grid gap-1 rounded-md border border-ui-border bg-ui-raised px-3 py-2' key={label}>
                                        <dt className='font-semibold uppercase text-ui-muted'>{label}</dt>
                                        <dd className='truncate font-medium text-ui-text'>{value}</dd>
                                    </div>
                                ))}
                            </dl>
                            {selectedEvent.reason ? <p className='mt-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm leading-6 text-ui-muted'>{selectedEvent.reason}</p> : null}
                            {contextText(selectedEvent.context) ? <p className='mt-2 text-xs leading-5 text-ui-muted'>{contextText(selectedEvent.context)}</p> : null}
                        </DashboardPanel>
                    ) : null}
                    <DashboardPanel className='p-0' id='support-actions'>
                        <div className='border-b border-ui-border px-4 py-3'>
                            <h2 className='text-sm font-semibold text-ui-text'>Support actions</h2>
                            <p className='mt-1 text-xs leading-5 text-ui-muted'>Choose one task, complete the required audit fields, then return to the timeline.</p>
                        </div>
                        <details className='group' open={supportMode !== 'inspect'}>
                            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20'>
                                <span>Session support tasks</span>
                                <span className='text-xs font-medium text-ui-muted group-open:hidden'>Open optional tasks</span>
                                <span className='hidden text-xs font-medium text-ui-muted group-open:inline'>Hide optional tasks</span>
                            </summary>
                            <div className='border-t border-ui-border p-4'>
                                <AccessRecoveryForm initialOperation={supportMode} />
                            </div>
                        </details>
                    </DashboardPanel>
                </aside>
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
