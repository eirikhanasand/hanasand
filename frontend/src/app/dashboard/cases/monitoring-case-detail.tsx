'use client'

import Link from '@/components/organizations/workspaceLink'
import { CaseEvents, CheckFields, type CaseEvent, type CheckDetails } from './case-events'
import Markdown from 'react-markdown'
import { CaseDevelopment } from './case-development'
import { useEffect, useState } from 'react'
import type { CaseRow } from './cases-client'

export type MonitoringCase = CaseRow & {
    diskDiagnostics?: { sampledAt: string, host: string, filesystems: Array<{ path: string, usedPercent: number, complete: boolean, directories: Array<{ path: string, sizeBytes: number }> }> },
    canManage?: boolean,
    relatedChecks?: Array<{ id: string, name: string, message: string, outcome?: string, completedAt?: string }>,
    events?: CaseEvent[], eventTotal?: number, eventPage?: number, eventSnapshot?: string, currentCheck?: CheckDetails,
    lastSeenAt?: string, occurrences: number, automationId: string, resolvedAt?: string, notificationsEnabled: boolean,
    history: Array<{ id: string, actor: string, at: string, action: string, note?: string, fromStatus?: string, toStatus?: string, fromSeverity?: string, toSeverity?: string, notificationsEnabled?: boolean }>,
    comments: Array<{ id: string, author: string, body: string, createdAt: string }>,
    notifications: Array<{ messageId?: string, deliveredAt?: string, error?: string, nextAttemptAt?: string, message?: { content?: string, embeds?: Array<{ title?: string, description?: string, fields?: Array<{ name: string, value: string }> }> } }>,
}

const control = 'rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text disabled:cursor-not-allowed disabled:opacity-50'
const severityColor: Record<string, string> = { low: '#89CFF0', medium: '#22C55E', high: '#FACC15', critical: '#EF4444' }
const headerControl = `${control} inline-flex h-10 min-w-28 items-center justify-center whitespace-nowrap`
const date = (value?: string) => value ? new Date(value).toLocaleString() : '—'

export function MonitoringCaseDetail({ caseId, organizationId }: { caseId: string, organizationId?: string }) {
    const [tab, setTab] = useState('details')
    const [loadingEvents, setLoadingEvents] = useState(false)
    const [item, setItem] = useState<MonitoringCase | null>(null)
    const [error, setError] = useState('')
    const [revision, setRevision] = useState(0)
    const [busy, setBusy] = useState(false)
    const [comment, setComment] = useState('')
    const [notice, setNotice] = useState('')
    const [resolving, setResolving] = useState(false)
    const [aiAssisted, setAiAssisted] = useState(false)
    const params = new URLSearchParams(organizationId ? { organizationId } : {})
    const endpoint = `/api/cases/${encodeURIComponent(caseId)}?${params}`
    useEffect(() => {
        const controller = new AbortController()
        setItem(null)
        setTab('details')
        setComment('')
        setError('')
        fetch(endpoint, { cache: 'no-store', signal: controller.signal }).then(async response => {
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Case unavailable.')
            setItem(payload.case)
        }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
        return () => controller.abort()
    }, [endpoint, revision])
    async function save(change: Record<string, unknown>) {
        if (item?.canManage === false) return
        setBusy(true)
        setError('')
        setNotice('')
        try {
            const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(change) })
            if (!response.ok) {
                const payload = await response.json()
                throw new Error(payload.error || 'Could not save changes.')
            }
            const refreshed = await fetch(endpoint, { cache: 'no-store' })
            if (!refreshed.ok) throw new Error('Changes saved, but the case could not be refreshed. Retry to reload it.')
            setItem((await refreshed.json()).case)
            if ('comment' in change) setComment('')
            setResolving(false)
            setAiAssisted(false)
            setNotice('Changes saved.')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Could not save changes.')
        } finally {
            setBusy(false)
        }
    }
    async function moreEvents() {
        if (!item || loadingEvents) return
        setLoadingEvents(true)
        try {
            const response = await fetch(`${endpoint}&eventsPage=${(item.eventPage || 0) + 1}&eventsAt=${encodeURIComponent(item.eventSnapshot || new Date().toISOString())}`, { cache: 'no-store' })
            if (!response.ok) throw new Error('Could not load more events. Try again.')
            const next = (await response.json()).case as MonitoringCase
            setItem(current => current?.id === item.id ? ({ ...current, events: [...new Map([...(current.events || []), ...(next.events || [])].map(event => [event.id, event])).values()], eventPage: next.eventPage, eventTotal: next.eventTotal }) : current)
        } catch (error) { setError(error instanceof Error ? error.message : 'Could not load events.') }
        finally { setLoadingEvents(false) }
    }
    return <article className='min-w-0 overflow-hidden rounded-xl border border-ui-border bg-ui-panel text-ui-text'>
        <div aria-hidden='true' className='h-1.5' style={{ backgroundColor: severityColor[item?.severity ?? ''] ?? 'transparent' }} />
        <header className='grid gap-3 border-b border-ui-border px-5 py-4 sm:px-6'>
            <div className='flex flex-wrap items-center gap-3'>
                <div className='flex min-w-0 flex-1 items-center gap-4'>
                    <h1 className='min-w-0 wrap-break-word text-xl font-semibold leading-10'>{item?.title || caseId}</h1>
                    <Link className='inline-flex h-10 shrink-0 items-center whitespace-nowrap text-sm text-ui-primary' href={`/cases${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`}>← Cases</Link>
                </div>
                {item && <div className='flex max-w-full flex-wrap items-center gap-2'>
                    <span className={`inline-flex h-10 min-w-28 items-center justify-center rounded-lg border px-3 text-sm font-medium capitalize ${item.status === 'open' ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning' : 'border-ui-success/30 bg-ui-success/10 text-ui-success'}`}>{item.status.replaceAll('_', ' ')}</span>
                    <select aria-label='Severity' className={headerControl} value={item.severity} disabled={busy || item.canManage === false} onChange={event => void save({ severity: event.target.value })}>{['low', 'medium', 'high', 'critical'].map(value => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select>
                    {['closed', 'resolved'].includes(item.status) ? <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => void save({ status: 'open' })}>Reopen case</button> : <>
                        <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => void save({ status: item.status === 'in_progress' ? 'open' : 'in_progress' })}>{item.status === 'in_progress' ? 'Set as open' : 'Start progress'}</button>
                        <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => { setTab('details'); setResolving(true) }}>Resolve case</button>
                    </>}
                    {item.resolution?.id && ['ai', 'automation'].includes(item.resolution.type) && !item.resolution.confirmedAt && ['resolved', 'closed'].includes(item.status) && <button className={headerControl} disabled={busy || item.canManage === false} onClick={() => void save({ confirmResolutionId: item.resolution!.id })}>Confirm resolution</button>}
                </div>}
            </div>
            <p role='status' className='sr-only'>{busy ? 'Saving…' : notice}</p>
            {error && <div role='alert' className='text-sm text-ui-danger'>{error} <button className='underline' disabled={busy} onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
        </header>
        {item?.diskDiagnostics && <section aria-label='Disk usage diagnostics' className='border-b border-ui-border p-5 sm:p-6'>
            <h2 className='font-semibold'>Largest directories</h2>
            <p className='mt-1 text-xs text-ui-muted'>{item.diskDiagnostics.host} · Collected {new Date(item.diskDiagnostics.sampledAt).toLocaleString()}. Directory sizes include their contents; nested rows overlap.</p>
            {item.diskDiagnostics.filesystems.map(filesystem => <div key={filesystem.path} className='mt-4'>
                <h3 className='text-sm font-medium'>{filesystem.path} · {filesystem.usedPercent}% used</h3>
                {!filesystem.complete && <p className='mt-1 text-sm text-ui-warning'>Partial scan. Some directories could not be measured before the time limit or were inaccessible.</p>}
                <div className='mt-2 overflow-x-auto'><table className='w-full text-left text-sm'>
                    <thead className='border-b border-ui-border text-ui-muted'><tr><th className='py-2 pr-4'>Directory</th><th className='py-2 text-right'>Size</th></tr></thead>
                    <tbody>{filesystem.directories.map(directory => <tr key={directory.path} className='border-b border-ui-border/50'>
                        <td className='break-all py-2 pr-4 font-mono'>{directory.path}</td>
                        <td className='whitespace-nowrap py-2 text-right tabular-nums' title={`${directory.sizeBytes.toLocaleString()} bytes`}>{formatDirectorySize(directory.sizeBytes)}</td>
                    </tr>)}</tbody>
                </table></div>
            </div>)}
        </section>}

        {!item && !error && <p className='p-6'>Loading case…</p>}
        {item && <>
            <div role='tablist' aria-label='Case views' className='flex gap-3 border-b border-ui-border px-5 py-3'>
                {['details', 'events'].map(value => <button key={value} id={`case-tab-${value}`} role='tab' aria-selected={tab === value} aria-controls={`case-panel-${value}`} tabIndex={tab === value ? 0 : -1} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'details' : event.key === 'End' ? 'events' : value === 'details' ? 'events' : 'details'; setTab(next); document.getElementById(`case-tab-${next}`)?.focus() } }} className={`${control} ${tab === value ? 'font-semibold text-ui-primary' : ''}`} onClick={() => setTab(value)}>{value === 'details' ? 'Details' : `Events (${item.eventTotal ?? item.occurrences})`}</button>)}
            </div>
            <div id='case-panel-events' role='tabpanel' aria-labelledby='case-tab-events' hidden={tab !== 'events'}><CaseEvents events={item.events || []} total={item.eventTotal || 0} occurrences={item.occurrences} loading={loadingEvents} onMore={() => void moreEvents()} /></div>
            <div id='case-panel-details' role='tabpanel' aria-labelledby='case-tab-details' hidden={tab !== 'details'}>
                {resolving && <form className='grid gap-3 border-b border-ui-border p-5' onSubmit={event => { event.preventDefault(); if (comment.trim()) void save({ status: 'resolved', comment, ...(aiAssisted ? { resolutionMethod: 'ai' } : {}) }) }}>
                    <label htmlFor='resolution-comment' className='font-medium'>Resolution comment (required)</label>
                    <textarea id='resolution-comment' className={`${control} min-h-24`} required maxLength={5000} value={comment} onChange={event => setComment(event.target.value)} placeholder='What was fixed, and how did you verify it?' />
                    <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={aiAssisted} onChange={event => setAiAssisted(event.target.checked)} />Resolved by AI — requires human confirmation</label>
                    <div className='flex gap-2'><button className={control} disabled={busy || item.canManage === false || !comment.trim()}>Resolve with comment</button><button type='button' className={control} disabled={busy || item.canManage === false} onClick={() => setResolving(false)}>Cancel</button></div>
                </form>}
                {item.resolution && <section className='grid gap-2 border-b border-ui-border p-5' aria-label='Resolution review'>
                    <h2 className='font-semibold'>{item.resolution.type === 'ai' ? 'Resolved by AI' : item.resolution.type === 'automation' ? 'Recovered automatically' : item.resolution.type === 'unknown' ? 'Resolver not recorded' : 'Resolved by a person'}</h2>
                    <p className='text-sm'>{item.resolution.actor || 'Identity unavailable'} · {date(item.resolution.at)}</p>
                    {item.resolution.type === 'automation' && item.resolvedAt && (item.relatedChecks?.length || 0) > 1 ? <div className='grid gap-3'>
                        <p className='text-sm text-ui-muted'>Results when the affected checks recovered.</p>
                        <dl className='grid gap-3'>{item.relatedChecks!.map(check => <div key={check.id}>
                            <dt className='text-sm font-medium'>{check.name}</dt>
                            <dd className='mt-1 whitespace-pre-wrap text-sm'>{check.message}</dd>
                        </div>)}</dl>
                    </div> : <p className='whitespace-pre-wrap text-sm'>{item.resolution.note}</p>}
                    {item.resolution.confirmedAt ? <p className='text-sm text-ui-success'>Confirmed by {item.resolution.confirmedBy} · {date(item.resolution.confirmedAt)}</p> : ['ai', 'automation'].includes(item.resolution.type) && <p className='text-sm text-ui-muted'>Awaiting human confirmation.</p>}
                </section>}
                <section aria-labelledby='case-summary' className='min-w-0 grid gap-3 border-b border-ui-border p-5 sm:p-6'>
                    <h2 id='case-summary' className='text-lg font-semibold'>Summary</h2>
                    <p className='whitespace-pre-wrap [overflow-wrap:anywhere] leading-7'>{item.summary}</p>
                    {(item.relatedChecks?.length || 0) > 1 && <p className='text-sm text-ui-muted'>Affected checks: {item.relatedChecks!.map(check => check.name).join(', ')}.</p>}
                </section>
                <section aria-labelledby='case-technical' className='grid gap-4 border-b border-ui-border p-5 sm:p-6'>
                    <div className='flex flex-wrap items-center justify-between gap-3'><h2 id='case-technical' className='text-lg font-semibold'>Technical details</h2><Link className='text-sm text-ui-primary underline' href={`/automation/health?monitor=${encodeURIComponent(item.automationId)}`}>View health check</Link></div>
                    {item.events?.[0]?.details ? <><p className='text-sm text-ui-muted'>Configuration captured for the latest occurrence.</p><CheckFields details={item.events[0].details} /></> : item.currentCheck && <><p className='text-sm text-ui-muted'>Current check configuration. Older runs did not capture their configuration.</p><CheckFields details={item.currentCheck} /></>}
                    {item.events?.[0] && <div className='grid gap-2'><h3 className='font-medium'>Latest recorded result</h3><p className='whitespace-pre-wrap [overflow-wrap:anywhere]'>{item.events[0].message}</p><p className='text-sm text-ui-muted'>Duration: {item.events[0].durationMs == null ? 'Not recorded' : `${item.events[0].durationMs.toLocaleString()} ms`}</p></div>}
                    <dl className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>{[['First seen', date(item.createdAt)], ['Last seen', date(item.lastSeenAt || item.updatedAt)], ['Recovered', item.resolvedAt ? date(item.resolvedAt) : 'Not recovered'], ['Occurrences', item.occurrences.toLocaleString()]].map(([label, value]) => <div key={label} className='min-w-0 rounded-lg bg-ui-canvas p-4'><dt className='text-sm text-ui-muted'>{label}</dt><dd className='mt-2 wrap-break-word text-sm font-medium'>{value}</dd></div>)}</dl>
                    <p className='text-sm text-ui-muted'>Health checks update recovery automatically. A manual case status stays in effect until you change it; closing a case does not mark the health check as recovered.</p>
                </section>
                <details key={`notifications-${caseId}`} className='border-b border-ui-border p-5 sm:p-6'>
                    <summary className='cursor-pointer text-lg font-semibold'>Notification settings ({item.notifications.filter(notification => notification.deliveredAt).length})</summary>
                    <div className='mt-4 grid gap-4'>
                        <label className='flex items-center gap-3 text-sm'><input type='checkbox' className='h-4 w-4' checked={item.notificationsEnabled} disabled={busy || item.canManage === false} onChange={event => void save({ notificationsEnabled: event.target.checked })} />Enable notifications for this case</label>
                        <h3 className='text-sm font-medium'>Delivery history</h3>
                        {item.notifications.length ? item.notifications.map((notification, index) => <article className='grid gap-2 rounded-lg bg-ui-canvas p-3 text-sm' key={notification.messageId || index}>
                            <p>{notification.deliveredAt ? `Delivered ${date(notification.deliveredAt)}` : 'Delivery pending'}</p>
                            {notification.error && <p className='text-ui-danger'>{notification.error}</p>}
                            {notification.message ? <div className='grid gap-3 [overflow-wrap:anywhere]'>
                                {notification.message.content && <NotificationText text={notification.message.content} />}
                                {notification.message.embeds?.map((embed, embedIndex) => <div key={embedIndex} className='grid gap-2 border-l-2 border-ui-border pl-3'>
                                    {embed.title && <p className='font-semibold'>{notificationText(embed.title)}</p>}
                                    {embed.description && <NotificationText text={embed.description} />}
                                    {embed.fields?.length ? <dl className='grid gap-2 sm:grid-cols-2'>{embed.fields.map((field, fieldIndex) => <div key={fieldIndex}><dt className='text-ui-muted'>{field.name}</dt><dd><NotificationText text={field.value} /></dd></div>)}</dl> : null}
                                </div>)}
                            </div> : notification.deliveredAt && <p className='text-ui-muted'>Original message content is unavailable.</p>}
                            {notification.messageId && <p className='wrap-break-word text-xs text-ui-muted'>Message ID: {notification.messageId}</p>}
                        </article>) : <p className='text-sm text-ui-muted'>No notifications sent.</p>}
                    </div>
                </details>
                <CaseDevelopment caseId={caseId} organizationId={item.organizationId || organizationId} />
                <section aria-labelledby='case-history' className='grid gap-4 border-b border-ui-border p-5 sm:p-6'>
                    <h2 id='case-history' className='text-lg font-semibold'>Case history</h2>
                    <p className='text-sm text-ui-muted'>Older cases may have gaps because earlier changes were not recorded.</p>
                    <ol className='grid gap-3'>{item.history?.map(event => <li key={event.id} className='rounded-lg border border-ui-border p-4'>
                        <p className='text-sm font-medium'>{event.action.replaceAll('_', ' ')} · {event.actor} · {date(event.at)}</p>
                        {event.fromStatus !== event.toStatus && <p className='mt-1 text-sm'>{event.fromStatus?.replaceAll('_', ' ')} → {event.toStatus?.replaceAll('_', ' ')}</p>}
                        {event.fromSeverity !== event.toSeverity && <p className='mt-1 text-sm'>Severity: {event.fromSeverity} → {event.toSeverity}</p>}
                        {event.action === 'notifications_changed' && <p className='mt-1 text-sm'>Notifications {event.notificationsEnabled ? 'enabled' : 'disabled'}</p>}
                        {event.note && <p className='mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm'>{event.note}</p>}
                    </li>)}</ol>
                </section>
                <section aria-labelledby='case-comments' className='grid gap-4 p-5 sm:p-6'>
                    <h2 id='case-comments' className='text-lg font-semibold'>Comments</h2>
                    {item.comments?.length ? item.comments.map(entry => <article className='rounded-lg border border-ui-border p-4' key={entry.id}><p className='wrap-break-word text-sm text-ui-muted'>{entry.author} · {date(entry.createdAt)}</p><p className='mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]'>{entry.body}</p></article>) : <p className='text-sm text-ui-muted'>No comments yet.</p>}
                    <form className='grid gap-3' onSubmit={event => { event.preventDefault(); if (comment.trim() && !busy) void save({ comment }) }}>
                        <label htmlFor='case-comment' className='text-sm font-medium'>Add a comment</label>
                        <textarea id='case-comment' className={`${control} min-h-28 w-full`} value={comment} onChange={event => setComment(event.target.value)} maxLength={5000} disabled={busy || item.canManage === false} placeholder='Share an update or investigation notes…' required />
                        <button type='submit' className={`${control} justify-self-start`} disabled={busy || item.canManage === false || !comment.trim()}>Post comment</button>
                    </form>
                </section>
            </div>
        </>}
    </article>
}

function notificationText(text: string) {
    return text.replace(/<t:(\d+)(?::[tTdDfFR])?>/g, (match, seconds) => {
        const timestamp = new Date(Number(seconds) * 1000)
        return Number.isFinite(timestamp.getTime()) ? date(timestamp.toISOString()) : match
    })
}

function NotificationText({ text }: { text: string }) {
    return <div className='whitespace-pre-wrap'><Markdown skipHtml allowedElements={['p', 'strong', 'em', 'a', 'code', 'br', 'ul', 'ol', 'li', 'blockquote']} components={{ a: ({ href, children }) => <a href={href} className='text-ui-primary underline' target='_blank' rel='noopener noreferrer'>{children}</a> }}>{notificationText(text)}</Markdown></div>
}

function formatDirectorySize(bytes: number) {
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
    const index = bytes > 0 ? Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024))) : 0
    return `${(bytes / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${units[index]}`
}
