'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'
import type { AuditPage, AuditSearchParams } from './data'
import type { ReactNode } from 'react'
import Link from 'next/link'
import config from '@/config'
import { AlertTriangle, ClipboardList, Clock3 } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export default function AuditTimeline({ initialAudit, filters }: { initialAudit: AuditPage, filters: AuditSearchParams }) {
    const [audit, setAudit] = useState(initialAudit)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)
    const pending = useRef(false)
    const controller = useRef<AbortController | null>(null)
    const scrollRoot = useRef<HTMLDivElement>(null)
    const sentinel = useRef<HTMLDivElement>(null)
    const sortedEvents = audit.events
    const loadMore = useCallback(async () => {
        if (pending.current || !audit.available || !audit.nextCursor) return
        pending.current = true
        setLoading(true)
        setError(false)
        const abort = new AbortController()
        controller.current = abort
        try {
            const token = getCookie('access_token')
            const id = getCookie('id')
            if (!token || !id) throw new Error('Authentication required')
            const query = new URLSearchParams({ limit: '50', cursor: audit.nextCursor })
            for (const key of ['service', 'actor', 'action', 'target', 'outcome', 'from', 'to']) {
                const value = param(filters, key)
                if (value) query.set(key, value)
            }
            const response = await fetch(`${config.url.api}/system/events?${query}`, {
                headers: { Authorization: `Bearer ${token}`, id }, signal: abort.signal,
            })
            if (!response.ok) throw new Error('Unable to load events')
            const payload = await response.json()
            if (!Array.isArray(payload.events) || !payload.pagination) throw new Error('Invalid events')
            setAudit(current => {
                const ids = new Set(current.events.map(event => event.id))
                return {
                    available: true,
                    total: payload.pagination.total ?? current.total,
                    nextCursor: payload.pagination.nextCursor || null,
                    events: [...current.events, ...payload.events.map((event: Record<string, unknown>) => ({
                        id: Number(event.id), happenedAt: String(event.created_at || ''),
                        actor: String(event.actor_name || event.actor_id || 'system'),
                        service: String(event.service || event.source || '—'), action: String(event.event_type || ''),
                        target: String(event.target_name || event.object_id || event.object_type || '—'),
                        result: String(event.outcome || ''), detail: String(event.reason || event.service || ''),
                    })).filter((event: { id: number }) => !ids.has(event.id))],
                }
            })
        } catch {
            if (!abort.signal.aborted) setError(true)
        } finally {
            pending.current = false
            if (!abort.signal.aborted) setLoading(false)
        }
    }, [audit.available, audit.nextCursor, filters])
    useEffect(() => () => controller.current?.abort(), [])
    useEffect(() => {
        if (!sentinel.current || error || loading || !audit.nextCursor) return
        const observer = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting)) void loadMore()
        }, { root: scrollRoot.current, rootMargin: '150px' })
        observer.observe(sentinel.current)
        return () => observer.disconnect()
    }, [loadMore, error, loading, audit.nextCursor])
    const failedEvents = sortedEvents.filter(event => !['ok', 'ready', 'success', 'completed', 'published'].includes(event.result.toLowerCase()))
    const lastEvent = sortedEvents[0]
    const failedIds = new Set(failedEvents.map(event => event.id))

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Management'
                title='Audit log'
                description='Audit events across all services, including account access, infrastructure, and threat intelligence.'
            />

            <div className='grid gap-2 sm:grid-cols-3'>
                <Metric title='Events' value={`${sortedEvents.length}/${audit.total ?? '—'}`} icon={<ClipboardList className='h-4 w-4' />} />
                <Metric title='Failures' value={`${failedEvents.length}`} tone={failedEvents.length ? 'bad' : 'ok'} icon={<AlertTriangle className='h-4 w-4' />} />
                <Metric title='Last action' value={lastEvent ? shortTime(lastEvent.happenedAt) : '—'} icon={<Clock3 className='h-4 w-4' />} />
            </div>

            <DashboardPanel className='p-3'>
                <form className='grid gap-2 sm:grid-cols-2 lg:grid-cols-8' action='/management/audit'>
                    <input aria-label='Service' className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='service' defaultValue={param(filters, 'service')} placeholder='All services' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='actor' defaultValue={param(filters, 'actor')} placeholder='Actor' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='action' defaultValue={param(filters, 'action')} placeholder='Action' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='target' defaultValue={param(filters, 'target')} placeholder='Target' />
                    <select className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='outcome' defaultValue={param(filters, 'outcome')}>
                        <option value=''>Any result</option><option value='success'>Success</option><option value='denied'>Denied</option><option value='failed'>Failed</option>
                    </select>
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='from' defaultValue={param(filters, 'from')} placeholder='From (ISO time)' />
                    <input className='h-9 rounded-md border border-ui-border bg-ui-raised px-3 text-sm text-ui-text' name='to' defaultValue={param(filters, 'to')} placeholder='To (ISO time)' />
                    <div className='flex gap-2'><button className='h-9 flex-1 rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas' type='submit'>Filter</button><Link className='grid h-9 place-items-center rounded-md border border-ui-border px-3 text-sm font-semibold text-ui-text' href='/management/audit'>Clear</Link></div>
                </form>
            </DashboardPanel>

            <DashboardPanel className='min-h-0 overflow-hidden border-ui-border bg-ui-panel p-0'>
                <div className='border-b border-ui-border bg-ui-raised px-3 py-2'>
                    <h2 className='text-sm font-semibold text-ui-text'>Timeline</h2>
                    <p className='mt-0.5 text-[11px] text-ui-muted'>{sortedEvents.length}/{audit.total ?? '—'} events · newest first</p>
                </div>
                <div ref={scrollRoot} data-testid='audit-scroll' className='max-h-[calc(100vh-18rem)] min-h-72 overflow-auto'>
                    <table className='min-w-full border-separate border-spacing-0 text-xs'>
                        <thead className='sticky top-0 z-10 bg-ui-panel/95 text-left text-[10px] font-semibold text-ui-muted backdrop-blur'>
                            <tr>
                                <th className='border-b border-ui-border px-3 py-2'>Time</th>
                                <th className='border-b border-ui-border px-3 py-2'>Service</th>
                                <th className='border-b border-ui-border px-3 py-2'>Actor</th>
                                <th className='border-b border-ui-border px-3 py-2'>Action</th>
                                <th className='border-b border-ui-border px-3 py-2'>Target</th>
                                <th className='border-b border-ui-border px-3 py-2'>Result</th>
                                <th className='border-b border-ui-border px-3 py-2'>Description</th>
                            </tr>
                        </thead>
                        <tbody className='bg-ui-panel'>
                            {sortedEvents.map(event => (
                                <tr key={event.id} id={`event-${event.id}`} className='align-top transition hover:bg-ui-raised'>
                                    <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 text-ui-muted'>{compactTime(event.happenedAt)}</td>
                                    <td className='border-b border-ui-border px-3 py-1.5 text-ui-text'>{event.service}</td>
                                    <td className='max-w-28 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>{event.actor}</td>
                                    <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5 font-mono font-semibold text-ui-primary'>{event.action}</td>
                                    <td className='max-w-44 border-b border-ui-border px-3 py-1.5 font-mono text-ui-text'>
                                        {event.target}
                                    </td>
                                    <td className='whitespace-nowrap border-b border-ui-border px-3 py-1.5'><StatusPill label={event.result} tone={failedIds.has(event.id) ? 'bad' : 'ok'} /></td>
                                    <td className='max-w-[34rem] border-b border-ui-border px-3 py-1.5 text-ui-muted'>
                                        <span className='line-clamp-2'>{event.detail}</span>
                                    </td>
                                </tr>
                            ))}
                            {!sortedEvents.length ? (
                                <tr>
                                    <td colSpan={7} className='px-4 py-8 text-center text-sm text-ui-muted'>{audit.available ? 'No audit events match these filters.' : 'Audit storage is unavailable. The result is not being treated as an empty log.'}</td>
                                </tr>
                            ) : null}
                        </tbody>
                    </table>
                    <div ref={sentinel} className='p-3 text-center text-xs text-ui-muted' aria-live='polite'>
                        {loading ? 'Loading more events…' : error ? <button type='button' onClick={() => void loadMore()} className='text-ui-primary underline'>Could not load more events. Retry</button> : audit.nextCursor ? <button type='button' onClick={() => void loadMore()} className='text-ui-primary'>Load 50 more</button> : audit.available && sortedEvents.length ? 'All events displayed' : null}
                    </div>
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function param(params: AuditSearchParams, key: string) {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value || '').trim()
}

function Metric({ title, value, icon, tone = 'neutral' }: { title: string, value: string, icon: ReactNode, tone?: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
            <div className={`flex items-center justify-between ${toneClass(tone).text}`}>
                <p className='text-[10px] font-semibold text-ui-muted'>{title}</p>
                {icon}
            </div>
            <p className='mt-2 truncate text-lg font-semibold text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function StatusPill({ label, tone }: { label: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const classes = toneClass(tone)
    return <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${classes.bg} ${classes.text}`}>{label}</span>
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
