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

const fieldClass = 'h-9 min-w-0 rounded-md border border-[#d8e0ec] bg-white px-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#7b8494] focus:border-[#3056d3] focus:ring-2 focus:ring-[#3056d3]/15'
const selectClass = `${fieldClass} appearance-none`
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
    if (severity === 'critical') return 'border-[#b42318]/25 bg-[#fff1f0] text-[#b42318]'
    if (severity === 'warning') return 'border-[#b54708]/25 bg-[#fff7ed] text-[#b54708]'
    if (severity === 'notice') return 'border-[#3056d3]/20 bg-[#eef4ff] text-[#3056d3]'
    return 'border-[#667085]/20 bg-[#f2f4f7] text-[#475467]'
}

function outcomeClass(outcome: AdminAuditEvent['outcome']) {
    if (outcome === 'success') return 'border-[#067647]/20 bg-[#ecfdf3] text-[#067647]'
    if (outcome === 'denied') return 'border-[#b42318]/20 bg-[#fff1f0] text-[#b42318]'
    return 'border-[#b54708]/20 bg-[#fff7ed] text-[#b54708]'
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
                        <Link className='grid h-9 place-items-center rounded-md border border-[#ccd6e4] px-3 text-sm font-semibold text-[#344054] transition hover:bg-[#eef4ff]' href='/dashboard'>Dashboard</Link>
                        <Link className='grid h-9 place-items-center rounded-md bg-[#3056d3] px-3 text-sm font-semibold text-white transition hover:bg-[#2848b5]' href='/dashboard/system/impersonation?action=impersonation.start&source=admin&service=hanasand-api'>Impersonation audit</Link>
                    </div>
                )}
            />
            <section className='grid gap-3 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.35fr)]'>
                <div className='grid content-start gap-3'>
                    <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2'>
                        {[
                            ['Events', String(events.length)],
                            ['Denied', String(eventStats.denied)],
                            ['Recovery', String(eventStats.recovery)],
                            ['Impersonation', String(eventStats.impersonation)],
                        ].map(([label, value]) => (
                            <DashboardPanel className='p-3' key={label}>
                                <div className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]'>{label}</div>
                                <div className='mt-1 text-2xl font-semibold text-[#171a21]'>{value}</div>
                            </DashboardPanel>
                        ))}
                    </div>
                    <DashboardPanel className='p-0'>
                        <div className='border-b border-[#e7edf5] px-4 py-3'>
                            <h2 className='text-sm font-semibold text-[#171a21]'>Support actions</h2>
                            <p className='mt-1 text-xs leading-5 text-[#667085]'>Reason, scope, duration, and audit links are required for recovery and impersonation work.</p>
                        </div>
                        <div className='p-4'>
                            <AccessRecoveryForm />
                        </div>
                    </DashboardPanel>
                </div>
                <div className='grid min-w-0 content-start gap-3'>
                    <DashboardPanel className='p-4'>
                        <form className='grid gap-3' action='/dashboard/system/impersonation'>
                            <div className='grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]'>
                                <input className={fieldClass} name='q' defaultValue={param(params, 'q')} placeholder='Search all fields' />
                                <input className={fieldClass} name='org' defaultValue={param(params, 'org')} placeholder='Organization' />
                                <input className={fieldClass} name='actor' defaultValue={param(params, 'actor')} placeholder='Actor' />
                                <input className={fieldClass} name='target' defaultValue={param(params, 'target')} placeholder='Target' />
                                <input className={fieldClass} name='action' defaultValue={param(params, 'action')} placeholder='Action type' />
                            </div>
                            <div className='grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_9rem_9rem]'>
                                <input className={fieldClass} name='source' defaultValue={param(params, 'source')} placeholder='Source' />
                                <input className={fieldClass} name='service' defaultValue={param(params, 'service')} placeholder='Service' />
                                <input className={fieldClass} name='entity' defaultValue={param(params, 'entity')} placeholder='Entity id' />
                                <input className={fieldClass} name='request' defaultValue={param(params, 'request')} placeholder='Request id' />
                                <input className={fieldClass} name='from' defaultValue={param(params, 'from')} type='datetime-local' />
                                <input className={fieldClass} name='to' defaultValue={param(params, 'to')} type='datetime-local' />
                            </div>
                            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto] sm:items-center'>
                                <select className={selectClass} name='severity' defaultValue={param(params, 'severity').toLowerCase()}>
                                    {severities.map(severity => <option key={severity} value={severity}>{severity || 'Severity'}</option>)}
                                </select>
                                <select className={selectClass} name='outcome' defaultValue={param(params, 'outcome').toLowerCase()}>
                                    {outcomes.map(outcome => <option key={outcome} value={outcome}>{outcome || 'Outcome'}</option>)}
                                </select>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <select className={selectClass} name='limit' defaultValue={param(params, 'limit') || '200'}>
                                        {limits.map(limit => <option key={limit} value={limit}>{limit}</option>)}
                                    </select>
                                </div>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <button className='h-9 rounded-md bg-[#3056d3] px-4 text-sm font-semibold text-white transition hover:bg-[#2848b5]' type='submit'>Apply</button>
                                    <Link className='grid h-9 place-items-center rounded-md border border-[#ccd6e4] px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f6fc]' href='/dashboard/system/impersonation'>Clear</Link>
                                </div>
                            </div>
                            {filterEntries.length ? (
                                <div className='flex flex-wrap gap-2 border-t border-[#e7edf5] pt-3'>
                                    {filterEntries.map(([key, value]) => (
                                        <span className='rounded-md border border-[#d8e0ec] bg-[#f8fafc] px-2 py-1 text-xs text-[#475467]' key={key}>{key}: {value}</span>
                                    ))}
                                </div>
                            ) : null}
                        </form>
                    </DashboardPanel>
                    {responseError ? (
                        <DashboardPanel className='border-[#fedf89] bg-[#fffbeb] p-4 text-sm text-[#93370d]'>
                            {responseError} Check API availability or narrow the query.
                        </DashboardPanel>
                    ) : null}
                    <DashboardPanel className='overflow-hidden'>
                        <div className='grid border-b border-[#e7edf5] md:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)]'>
                            <div className='min-w-0 px-4 py-3'>
                                <h2 className='text-sm font-semibold text-[#171a21]'>Audit timeline</h2>
                                <p className='mt-1 text-xs text-[#667085]'>{events.length ? 'Newest matching event is selected for detail.' : 'Use filters or support actions to load matching events.'}</p>
                            </div>
                            <div className='border-t border-[#e7edf5] px-4 py-3 md:border-l md:border-t-0'>
                                <div className='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#667085]'>Selected detail</div>
                                {selectedEvent ? (
                                    <div className='mt-2 min-w-0 text-sm text-[#344054]'>
                                        <div className='truncate font-semibold text-[#171a21]'>{selectedEvent.action_type}</div>
                                        <div className='mt-1 truncate text-xs'>request {selectedEvent.request_id || 'none'} · entity {selectedEvent.entity_id || 'none'}</div>
                                    </div>
                                ) : (
                                    <p className='mt-2 text-sm text-[#667085]'>No event selected.</p>
                                )}
                            </div>
                        </div>
                        <div className='grid max-h-[72vh] gap-0 divide-y divide-[#e7edf5] overflow-auto'>
                            {!events.length ? (
                                <div className='grid gap-3 p-5 text-sm text-[#667085]'>
                                    <p className='font-medium text-[#344054]'>No admin activity matched the current filters.</p>
                                    <div className='flex flex-wrap gap-2'>
                                        {supportActions.map(action => (
                                            <Link className='rounded-md border border-[#d8e0ec] px-2 py-1 text-xs font-semibold text-[#344054] hover:bg-[#f2f6fc]' href={`/dashboard/system/impersonation?action=${encodeURIComponent(action)}&source=admin&service=hanasand-api`} key={action}>{action}</Link>
                                        ))}
                                    </div>
                                </div>
                            ) : events.map((event) => (
                                <article key={event.id} className='grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_11rem] md:items-start'>
                                    <div className='min-w-0'>
                                        <div className='flex flex-wrap items-center gap-2 text-sm text-[#171a21]'>
                                            <strong className='min-w-0 truncate'>{event.action_type}</strong>
                                            <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${severityClass(event.severity)}`}>{event.severity}</span>
                                            <span className={`rounded-md border px-2 py-1 text-[11px] font-semibold uppercase ${outcomeClass(event.outcome)}`}>{event.outcome}</span>
                                            <span className='rounded-md bg-[#f2f4f7] px-2 py-1 text-xs text-[#475467]'>{event.source}/{event.service}</span>
                                        </div>
                                        <div className='mt-2 flex flex-wrap gap-2 text-xs text-[#667085]'>
                                            <span className='rounded-md bg-[#f8fafc] px-2 py-1'>actor {event.actor_name || event.actor_id}</span>
                                            {event.target_id ? <span className='rounded-md bg-[#f8fafc] px-2 py-1'>{event.target_type || 'target'} {event.target_name || event.target_id}</span> : null}
                                            {event.organization_id ? <span className='rounded-md bg-[#eef4ff] px-2 py-1 text-[#3056d3]'>{event.organization_name || event.organization_id}</span> : null}
                                            {event.entity_id ? <span className='rounded-md bg-[#f8fafc] px-2 py-1 font-mono'>entity {event.entity_id}</span> : null}
                                            {event.request_id ? <span className='rounded-md bg-[#f8fafc] px-2 py-1 font-mono'>request {event.request_id}</span> : null}
                                        </div>
                                        {event.reason ? <p className='mt-2 text-sm text-[#475467]'>{event.reason}</p> : null}
                                        {contextText(event.context) ? <p className='mt-1 text-xs text-[#667085]'>{contextText(event.context)}</p> : null}
                                    </div>
                                    <div className='text-left text-xs text-[#667085] md:text-right'>
                                        <div>{formatTime(event.created_at)}</div>
                                        <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                                        <Link className='mt-2 inline-flex rounded-md border border-[#d8e0ec] px-2 py-1 font-semibold text-[#344054] hover:bg-[#f2f6fc]' href={`/dashboard/system/impersonation?request=${encodeURIComponent(event.request_id || '')}&entity=${encodeURIComponent(event.entity_id || '')}&source=${encodeURIComponent(event.source)}&service=${encodeURIComponent(event.service)}`}>
                                            Focus
                                        </Link>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </DashboardPanel>
                </div>
            </section>
        </DashboardPage>
    )
}
