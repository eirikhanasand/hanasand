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

const fieldClass = 'h-10 rounded-lg border border-white/10 bg-black/24 px-3 text-sm text-bright outline-none focus:border-[#f07d33]/55'
const severities = ['', 'info', 'notice', 'warning', 'critical']
const outcomes = ['', 'success', 'denied', 'failed']
const limits = ['50', '100', '200', '500']

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

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Security'
                title='Admin audit timeline'
                description='Structured support, organization, invite, and impersonation activity.'
            />
            <DashboardPanel className='p-4'>
                <AccessRecoveryForm />
            </DashboardPanel>
            <DashboardPanel className='p-4'>
                <form className='grid gap-3' action='/dashboard/system/impersonation'>
                    <div className='grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]'>
                        <input className={fieldClass} name='q' defaultValue={param(params, 'q')} placeholder='Search all fields' />
                        <input className={fieldClass} name='org' defaultValue={param(params, 'org')} placeholder='Organization' />
                        <input className={fieldClass} name='actor' defaultValue={param(params, 'actor')} placeholder='Actor' />
                        <input className={fieldClass} name='target' defaultValue={param(params, 'target')} placeholder='Target' />
                        <input className={fieldClass} name='action' defaultValue={param(params, 'action')} placeholder='Action type' />
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem_8rem_auto] lg:items-center'>
                        <input className={fieldClass} name='source' defaultValue={param(params, 'source')} placeholder='Source' />
                        <input className={fieldClass} name='service' defaultValue={param(params, 'service')} placeholder='Service' />
                        <input className={fieldClass} name='entity' defaultValue={param(params, 'entity')} placeholder='Entity id' />
                        <input className={fieldClass} name='request' defaultValue={param(params, 'request')} placeholder='Request id' />
                        <input className={fieldClass} name='from' defaultValue={param(params, 'from')} type='datetime-local' />
                        <input className={fieldClass} name='to' defaultValue={param(params, 'to')} type='datetime-local' />
                        <select className={fieldClass} name='severity' defaultValue={param(params, 'severity').toLowerCase()}>
                            {severities.map(severity => <option key={severity} value={severity}>{severity || 'Severity'}</option>)}
                        </select>
                        <select className={fieldClass} name='outcome' defaultValue={param(params, 'outcome').toLowerCase()}>
                            {outcomes.map(outcome => <option key={outcome} value={outcome}>{outcome || 'Outcome'}</option>)}
                        </select>
                        <div className='flex flex-wrap items-center gap-2'>
                            <select className={fieldClass} name='limit' defaultValue={param(params, 'limit') || '200'}>
                                {limits.map(limit => <option key={limit} value={limit}>{limit}</option>)}
                            </select>
                            <button className='h-10 rounded-lg bg-[#f07d33] px-4 text-sm font-semibold text-black transition hover:bg-[#ff944d]' type='submit'>Apply</button>
                            <Link className='grid h-10 place-items-center rounded-lg border border-white/10 px-4 text-sm font-semibold text-bright/70 transition hover:bg-white/8' href='/dashboard/system/impersonation'>Clear</Link>
                        </div>
                    </div>
                </form>
            </DashboardPanel>
            <DashboardPanel className='overflow-hidden'>
                <div className='border-b border-white/8 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-bright/34'>
                    {events.length} events
                </div>
                <div className='grid gap-0 divide-y divide-white/8'>
                    {!events.length ? (
                        <p className='p-4 text-sm text-bright/45'>No admin activity matched the current filters.</p>
                    ) : events.map((event) => (
                        <article key={event.id} className='grid gap-2 p-4 md:grid-cols-[1fr_auto] md:items-center'>
                            <div className='min-w-0'>
                                <div className='flex flex-wrap items-center gap-2 text-sm text-bright/88'>
                                    <strong>{event.action_type}</strong>
                                    <span className='rounded-md bg-white/6 px-2 py-1 text-xs uppercase text-bright/55'>{event.severity}</span>
                                    <span className='rounded-md bg-white/6 px-2 py-1 text-xs uppercase text-bright/55'>{event.outcome}</span>
                                    <span className='rounded-md bg-white/6 px-2 py-1 text-xs text-bright/55'>{event.source}/{event.service}</span>
                                </div>
                                <div className='mt-2 flex flex-wrap gap-2 text-xs text-bright/42'>
                                    <span className='rounded-md bg-white/6 px-2 py-1'>actor {event.actor_name || event.actor_id}</span>
                                    {event.target_id ? <span className='rounded-md bg-white/6 px-2 py-1'>{event.target_type || 'target'} {event.target_name || event.target_id}</span> : null}
                                    {event.organization_id ? <span className='rounded-md bg-[#f07d33]/10 px-2 py-1 text-[#f07d33]'>{event.organization_name || event.organization_id}</span> : null}
                                    {event.entity_id ? <span className='rounded-md bg-white/6 px-2 py-1 font-mono'>entity {event.entity_id}</span> : null}
                                    {event.request_id ? <span className='rounded-md bg-white/6 px-2 py-1 font-mono'>request {event.request_id}</span> : null}
                                </div>
                                {event.reason ? <p className='mt-2 text-sm text-bright/66'>{event.reason}</p> : null}
                                {contextText(event.context) ? <p className='mt-1 text-xs text-bright/38'>{contextText(event.context)}</p> : null}
                            </div>
                            <div className='text-left text-xs text-bright/42 md:text-right'>
                                <div>{formatTime(event.created_at)}</div>
                                <div className='mt-1 max-w-xl truncate'>{event.ip}</div>
                            </div>
                        </article>
                    ))}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}
