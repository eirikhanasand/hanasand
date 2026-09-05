import type { ReactNode } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import config from '@/config'
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3 } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export const dynamic = 'force-dynamic'

type AuditSearchParams = Record<string, string | string[] | undefined>

type AuditEvent = {
    id: number
    happenedAt: string
    actor: string
    action: string
    target: string
    result: string
    detail: string
}

type AuditPage = {
    events: AuditEvent[]
    available: boolean
    nextCursor: string | null
}

export default async function TiAuditPage({ searchParams }: { searchParams?: Promise<AuditSearchParams> }) {
    const params = await searchParams
    const filters = params || {}
    const audit = await getAuditPage(filters)
    const sortedEvents = audit.events
    const failedEvents = sortedEvents.filter(event => !['ok', 'ready', 'success', 'completed', 'published'].includes(event.result.toLowerCase()))
    const lastEvent = sortedEvents[0]
    const failedIds = new Set(failedEvents.map(event => event.id))

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Threat intelligence'
                title='Audit log'
                description='Management actions, queue decisions, worker events, and profile-cache changes.'
            />

            <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-5'>
                <Metric title='Events' value={`${sortedEvents.length}`} icon={<ClipboardList className='h-4 w-4' />} />
                <Metric title='Failures' value={`${failedEvents.length}`} tone={failedEvents.length ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Audit storage' value={audit.available ? 'Available' : 'Unavailable'} tone={audit.available ? 'ok' : 'bad'} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Page' value={`${sortedEvents.length}`} icon={<CheckCircle2 className='h-4 w-4' />} />
                <Metric title='Last action' value={lastEvent ? shortTime(lastEvent.happenedAt) : 'Checking'} icon={<Clock3 className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='p-3'>
                <form className='grid gap-2 sm:grid-cols-2 lg:grid-cols-7' action='/ti/audit'>
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='actor' defaultValue={param(filters, 'actor')} placeholder='Actor' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='action' defaultValue={param(filters, 'action')} placeholder='Action' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='target' defaultValue={param(filters, 'target')} placeholder='Target' />
                    <select className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='outcome' defaultValue={param(filters, 'outcome')}>
                        <option value=''>Any result</option><option value='success'>Success</option><option value='denied'>Denied</option><option value='failed'>Failed</option>
                    </select>
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='from' defaultValue={param(filters, 'from')} placeholder='From (ISO time)' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='to' defaultValue={param(filters, 'to')} placeholder='To (ISO time)' />
                    <div className='flex gap-2'><button className='h-9 flex-1 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas' type='submit'>Filter</button><Link className='grid h-9 place-items-center rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text' href='/ti/audit'>Clear</Link></div>
                </form>
            </DashboardPanel>

            <div className='grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]'>
                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <div>
                                <h2 className='text-sm font-semibold text-ui-text'>Timeline</h2>
                                <p className='mt-0.5 text-[11px] text-ui-muted'>{sortedEvents.length} events sorted newest first</p>
                            </div>
                            <div className='flex flex-wrap gap-1.5 text-[11px] font-semibold'>
                                <StatusPill label={audit.available ? 'audit storage available' : 'audit storage unavailable'} tone={audit.available ? 'ok' : 'bad'} />
                            </div>
                        </div>
                    </div>
                    <div className='max-h-[calc(100vh-18rem)] min-h-72 overflow-auto'>
                        <table className='min-w-full border-separate border-spacing-0 text-xs'>
                            <thead className='sticky top-0 z-10 bg-ui-panel/95 text-left text-[10px] font-semibold uppercase text-ui-muted backdrop-blur'>
                                <tr>
                                    <th className='border-b border-ui-border px-3 py-2'>Time</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Actor</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Action</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Target</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Result</th>
                                    <th className='border-b border-ui-border px-3 py-2'>Detail</th>
                                </tr>
                            </thead>
                            <tbody className='bg-ui-panel'>
                                {sortedEvents.map(event => (
                                    <tr key={event.id} className='align-top transition hover:bg-ui-raised'>
                                        <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 text-ui-muted'>{compactTime(event.happenedAt)}</td>
                                        <td className='max-w-28 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>{event.actor}</td>
                                        <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 font-mono font-semibold text-ui-primary'>{event.action}</td>
                                        <td className='max-w-44 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>
                                            <Link className='hover:text-ui-primary hover:underline' href={auditEventHref(event)}>{event.target}</Link>
                                        </td>
                                        <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5'><StatusPill label={event.result} tone={failedIds.has(event.id) ? 'bad' : 'ok'} /></td>
                                        <td className='max-w-[34rem] border-b border-ui-border px-3 py-1.5 text-ui-muted'>
                                            <span className='line-clamp-2'>{event.detail}</span>
                                        </td>
                                    </tr>
                                ))}
                                {!sortedEvents.length ? (
                                    <tr>
                                        <td colSpan={6} className='px-4 py-8 text-center text-sm text-ui-muted'>{audit.available ? 'No audit events match these filters.' : 'Audit storage is unavailable. The result is not being treated as an empty log.'}</td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                    <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
                        <h2 className='text-sm font-semibold text-ui-text'>Events to review</h2>
                        <p className='mt-0.5 text-[11px] text-ui-muted'>{failedEvents.length} event{failedEvents.length === 1 ? '' : 's'}</p>
                    </div>
                    <div className='max-h-[calc(100vh-19rem)] min-h-72 overflow-auto p-2'>
                        <div className='grid gap-1.5'>
                            {failedEvents.slice(0, 24).map(event => (
                                <Link key={event.id} href={auditEventHref(event)} className='grid gap-1 rounded-md border border-ui-border bg-ui-raised px-2.5 py-2 text-left transition hover:border-ui-primary hover:bg-ui-panel'>
                                    <div className='flex min-w-0 items-center justify-between gap-2'>
                                        <span className='truncate font-mono text-[11px] font-semibold text-ui-primary'>{event.action}</span>
                                        <StatusPill label={event.result} tone='bad' />
                                    </div>
                                    <p className='truncate font-mono text-[11px] text-ui-text'>{event.target}</p>
                                    <div className='flex min-w-0 items-center justify-between gap-2 text-[10px] text-ui-muted'>
                                        <span className='truncate'>{event.actor}</span>
                                        <span className='shrink-0'>{shortAge(event.happenedAt)}</span>
                                    </div>
                                </Link>
                            ))}
                            {!failedEvents.length ? <p className='rounded-md border border-dashed border-ui-border p-3 text-xs text-ui-muted'>Audit stream is live; no failed events in the current window.</p> : null}
                        </div>
                    </div>
                </DashboardPanel>
            </div>
            {audit.nextCursor ? <div className='flex justify-end'><Link className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text hover:bg-ui-raised' href={withCursor(filters, audit.nextCursor)}>Next page</Link></div> : null}
        </DashboardPage>
    )
}

async function getAuditPage(params: AuditSearchParams): Promise<AuditPage> {
    const query = new URLSearchParams({ limit: '50' })
    for (const key of ['actor', 'action', 'target', 'outcome', 'from', 'to', 'cursor']) {
        const value = param(params, key)
        if (value) query.set(key, value)
    }
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) return { events: [], available: false, nextCursor: null }
    const response = await fetch(`${config.url.api}/admin/audit-events?${query.toString()}`, {
        headers: { Authorization: `Bearer ${decodeURIComponent(token)}`, id },
        cache: 'no-store',
    }).catch(() => null)
    if (!response?.ok) return { events: [], available: false, nextCursor: null }
    const payload = await response.json().catch(() => null) as { events?: Array<Record<string, unknown>>, pagination?: { nextCursor?: string | null } } | null
    const events = Array.isArray(payload?.events) ? payload.events.map(event => ({
        id: Number(event.id),
        happenedAt: String(event.created_at || ''),
        actor: String(event.actor_name || event.actor_id || 'system'),
        action: String(event.action_type || ''),
        target: String(event.target_name || event.target_id || event.target_type || '—'),
        result: String(event.outcome || ''),
        detail: String(event.reason || event.service || ''),
    })) : []
    return { events, available: true, nextCursor: payload?.pagination?.nextCursor || null }
}

function param(params: AuditSearchParams, key: string) {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value || '').trim()
}

function withCursor(params: AuditSearchParams, cursor: string) {
    const query = new URLSearchParams()
    for (const key of ['actor', 'action', 'target', 'outcome', 'from', 'to']) {
        const value = param(params, key)
        if (value) query.set(key, value)
    }
    query.set('cursor', cursor)
    return `/ti/audit?${query.toString()}`
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-[10px] font-semibold uppercase text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className='mt-2 truncate text-lg font-semibold capitalize text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
}

function auditEventHref(event: { action: string, target: string }) {
    const action = event.action.toLowerCase()
    if (action.includes('source') || event.target.startsWith('source:')) return '/ti/sources'
    if (action.includes('domain') || event.target.includes('.')) return '/ti/domains'
    if (action.includes('actor') || action.includes('profile') || action.includes('enrich')) return '/ti/enrichment'
    if (action.includes('alert') || action.includes('watchlist') || action.includes('webhook')) return '/dwm/actions'
    return '/dwm'
}

function toneClass(tone: 'neutral' | 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return { bg: 'bg-ui-success/15', text: 'text-ui-success' }
    if (tone === 'watch') return { bg: 'bg-ui-warning/15', text: 'text-ui-warning' }
    if (tone === 'bad') return { bg: 'bg-ui-danger/15', text: 'text-ui-danger' }
    return { bg: 'bg-ui-primary/15', text: 'text-ui-primary' }
}

function compactTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

function shortTime(value: string) {
    return new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Oslo',
    }).format(new Date(value))
}

function shortAge(value: string) {
    const delta = Date.now() - new Date(value).getTime()
    if (!Number.isFinite(delta)) return 'checking'
    const minutes = Math.max(0, Math.round(delta / 60_000))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `${hours}h`
    return `${Math.round(hours / 24)}d`
}
