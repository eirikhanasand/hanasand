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
}

const fieldClass = 'h-9 min-w-0 rounded-md border border-[#27364f] bg-[#101827] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#7b8494] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a]'
const selectClass = `${fieldClass} appearance-none`
const quietButtonClass = 'grid h-9 place-items-center rounded-md border border-[#31466b] bg-[#111827] px-3 text-sm font-semibold text-[#dbe7ff] transition hover:bg-[#172033]'
const severities = ['', 'info', 'notice', 'warning', 'critical']
const outcomes = ['', 'success', 'denied', 'failed']
const limits = ['50', '100', '200', '500']
const supportActions = [
    'support.organization.access_recovery',
    'support.organization.invite',
    'support.organization.member_role_recovery',
    'impersonation.start',
    'impersonation.stop',
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
    if (severity === 'critical') return 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'
    if (severity === 'warning') return 'border-[#7a5618] bg-[#2a1c0e] text-[#ffd58a]'
    if (severity === 'notice') return 'border-[#31466b] bg-[#122449] text-[#9db8ff]'
    return 'border-[#31466b] bg-[#101827] text-[#aab7cc]'
}

function outcomeClass(outcome: AdminAuditEvent['outcome']) {
    if (outcome === 'success') return 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]'
    if (outcome === 'denied') return 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]'
    return 'border-[#7a5618] bg-[#2a1c0e] text-[#ffd58a]'
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
    const selectedEvent = events[0]
    const eventStats = stats(events)
    const filterEntries = activeFilterEntries(params)
    const primarySearch = param(params, 'q')
    const advancedFilterCount = filterEntries.filter(([key]) => key !== 'q').length
    const responseError = response && !response.ok
        ? `Audit API returned ${response.status}.`
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
                        <a className='grid h-9 place-items-center rounded-md bg-[#315bd8] px-3 text-sm font-semibold text-white transition hover:bg-[#244bbf]' href='#support-actions'>Start session</a>
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
                                <button className='h-9 rounded-md bg-[#315bd8] px-4 text-sm font-semibold text-white transition hover:bg-[#244bbf]' type='submit'>Search</button>
                                <Link className={quietButtonClass} href='/dashboard/system/impersonation'>Clear</Link>
                            </div>
                            <details className='group rounded-md border border-[#26344d] bg-[#0b121e]'>
                                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#dbe7ff] outline-none transition hover:bg-[#162033] focus-visible:ring-2 focus-visible:ring-[#1f3f7a]'>
                                    <span>Filters{advancedFilterCount ? ` (${advancedFilterCount})` : ''}</span>
                                    <span className='text-xs font-medium text-[#8fa0ba] group-open:hidden'>Show advanced</span>
                                    <span className='hidden text-xs font-medium text-[#8fa0ba] group-open:inline'>Hide advanced</span>
                                </summary>
                                <div className='grid gap-3 border-t border-[#26344d] p-3'>
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
                                        <button className='h-9 rounded-md border border-[#31466b] px-4 text-sm font-semibold text-[#dbe7ff] transition hover:bg-[#162033]' type='submit'>Apply filters</button>
                                    </div>
                                </div>
                            </details>
                            {filterEntries.length ? (
                                <div className='flex flex-wrap gap-2 border-t border-[#26344d] pt-3' aria-label='Active audit filters'>
                                    {filterEntries.map(([key, value]) => (
                                        <span className='rounded-md border border-[#27364f] bg-[#0b121e] px-2 py-1 text-xs text-[#aab7cc]' key={key}>{key}: {value}</span>
                                    ))}
                                </div>
                            ) : null}
                        </form>
                    </DashboardPanel>
                    {responseError ? (
                        <DashboardPanel className='border-[#7a5618] bg-[#2a1c0e] p-4 text-sm text-[#ffd58a]'>
                            {responseError} Check API availability or narrow the query.
                        </DashboardPanel>
                    ) : null}
                    <DashboardPanel className='overflow-hidden'>
                        <div className='grid border-b border-[#26344d] md:grid-cols-[minmax(0,1fr)_minmax(260px,0.48fr)]'>
                            <div className='min-w-0 px-4 py-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <h2 className='text-sm font-semibold text-[#edf4ff]'>Audit timeline</h2>
                                    <span className='rounded-md bg-[#101827] px-2 py-1 text-xs font-medium text-[#8fa0ba]'>{events.length} events</span>
                                </div>
                                <p className='mt-1 text-xs text-[#8fa0ba]'>{events.length ? 'Newest matching event is selected for detail.' : 'Search or open filters to find support activity.'}</p>
                            </div>
                            <div className='border-t border-[#26344d] bg-[#0b121e] px-4 py-3 md:border-l md:border-t-0'>
                                <div className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8fa0ba]'>Selected detail</div>
                                {selectedEvent ? (
                                    <div className='mt-2 min-w-0 text-sm text-[#dbe7ff]'>
                                        <div className='truncate font-semibold text-[#edf4ff]'>{selectedEvent.action_type}</div>
                                        <div className='mt-1 truncate text-xs'>request {selectedEvent.request_id || 'checking'} · entity {selectedEvent.entity_id || 'checking'}</div>
                                    </div>
                                ) : (
                                    <p className='mt-2 text-sm text-[#8fa0ba]'>Select an audit row to inspect request and entity detail.</p>
                                )}
                            </div>
                        </div>
                        <div className='grid max-h-[72vh] gap-0 divide-y divide-[#26344d] overflow-auto'>
                            {!events.length ? (
                                <div className='grid gap-3 p-5 text-sm text-[#8fa0ba]'>
                                    <p className='font-medium text-[#dbe7ff]'>Audit stream is clear for the current filters.</p>
                                    <div className='flex flex-wrap gap-2'>
                                        {supportActions.map(action => (
                                            <Link className='rounded-md border border-[#27364f] px-2 py-1 text-xs font-semibold text-[#dbe7ff] hover:bg-[#162033]' href={`/dashboard/system/impersonation?action=${encodeURIComponent(action)}&source=admin&service=hanasand-api`} key={action}>{action}</Link>
                                        ))}
                                    </div>
                                </div>
                            ) : events.map((event) => (
                                <article key={event.id} className='grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_11rem] md:items-start'>
                                    <div className='min-w-0'>
                                        <div className='flex flex-wrap items-center gap-2 text-sm text-[#edf4ff]'>
                                            <strong className='min-w-0 truncate'>{event.action_type}</strong>
                                            <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(event.severity)}`}>{event.severity}</span>
                                            <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass(event.outcome)}`}>{event.outcome}</span>
                                            <span className='rounded-md bg-[#101827] px-2 py-1 text-xs text-[#aab7cc]'>{event.source}/{event.service}</span>
                                        </div>
                                        <div className='mt-2 flex flex-wrap gap-2 text-xs text-[#8fa0ba]'>
                                            <span className='rounded-md bg-[#0b121e] px-2 py-1'>actor {event.actor_name || event.actor_id}</span>
                                            {event.target_id ? <span className='rounded-md bg-[#0b121e] px-2 py-1'>{event.target_type || 'target'} {event.target_name || event.target_id}</span> : null}
                                            {event.organization_id ? <span className='rounded-md bg-[#122449] px-2 py-1 text-[#9db8ff]'>{event.organization_name || event.organization_id}</span> : null}
                                            {event.entity_id ? <span className='rounded-md bg-[#0b121e] px-2 py-1 font-mono'>entity {event.entity_id}</span> : null}
                                            {event.request_id ? <span className='rounded-md bg-[#0b121e] px-2 py-1 font-mono'>request {event.request_id}</span> : null}
                                        </div>
                                        {event.reason ? <p className='mt-2 text-sm text-[#aab7cc]'>{event.reason}</p> : null}
                                        {contextText(event.context) ? <p className='mt-1 text-xs text-[#8fa0ba]'>{contextText(event.context)}</p> : null}
                                    </div>
                                    <div className='text-left text-xs text-[#8fa0ba] md:text-right'>
                                        <div>{formatTime(event.created_at)}</div>
                                        <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                                        <Link className='mt-2 inline-flex rounded-md border border-[#27364f] px-2 py-1 font-semibold text-[#dbe7ff] hover:bg-[#162033]' href={`/dashboard/system/impersonation?request=${encodeURIComponent(event.request_id || '')}&entity=${encodeURIComponent(event.entity_id || '')}&source=${encodeURIComponent(event.source)}&service=${encodeURIComponent(event.service)}`}>
                                            Focus
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </DashboardPanel>
                </div>
                <aside className='grid content-start gap-3'>
                    <div className='grid grid-cols-2 gap-2'>
                        {[
                            ['Events', String(events.length)],
                            ['Denied', String(eventStats.denied)],
                            ['Recovery', String(eventStats.recovery)],
                            ['Impersonation', String(eventStats.impersonation)],
                        ].map(([label, value]) => (
                            <DashboardPanel className='p-3' key={label}>
                                <div className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8fa0ba]'>{label}</div>
                                <div className='mt-1 text-2xl font-semibold text-[#edf4ff]'>{value}</div>
                            </DashboardPanel>
                        ))}
                    </div>
                    <DashboardPanel className='p-0' id='support-actions'>
                        <div className='border-b border-[#26344d] px-4 py-3'>
                            <h2 className='text-sm font-semibold text-[#edf4ff]'>Support actions</h2>
                            <p className='mt-1 text-xs leading-5 text-[#8fa0ba]'>Choose one task, complete the required audit fields, then return to the timeline.</p>
                        </div>
                        <details className='group'>
                            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[#dbe7ff] outline-none transition hover:bg-[#162033] focus-visible:ring-2 focus-visible:ring-[#1f3f7a]'>
                                <span>Start or manage support action</span>
                                <span className='text-xs font-medium text-[#8fa0ba] group-open:hidden'>Show controls</span>
                                <span className='hidden text-xs font-medium text-[#8fa0ba] group-open:inline'>Hide controls</span>
                            </summary>
                            <div className='border-t border-[#26344d] p-4'>
                                <AccessRecoveryForm />
                            </div>
                        </details>
                    </DashboardPanel>
                </aside>
            </section>
        </DashboardPage>
    )
}
