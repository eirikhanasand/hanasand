'use client'

import { FormEvent, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Edit3, Loader2, Pause, Play, Send, Webhook } from 'lucide-react'

export type DashboardWebhookOrganization = {
    id: string
    tenantId: string
    name: string
    status: string
}

export type DashboardWebhookDestination = {
    id: string
    organizationId: string
    tenantId?: string
    name: string
    kind: 'discord' | 'generic' | string
    status: 'active' | 'paused' | string
    updatedAt: string
    createdAt?: string
    endpointHash?: string
    endpointHint?: string
    lastTestedAt?: string
    lastTestStatus?: string
}

export type DashboardWebhookDelivery = {
    id: string
    alertId: string
    watchlistId?: string
    organizationId?: string
    webhookDestinationId?: string
    endpointHash?: string
    attemptedAt: string
    payloadHash?: string
    status: string
    deliveryKind?: string
    httpStatus?: number
    error?: string
}

function sanitizeDeliveryCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(/hanasand-live-proof-\d+/gi, 'Hanasand live org')
        .replace(/hanasand-live-proof/gi, 'Hanasand live org')
        .replace(/receipt/gi, 'delivery')
        .replace(/proof/gi, 'status')
        .replace(/readiness/gi, 'status')
}

export type DashboardWebhookAlertOption = {
    id: string
    title: string
    severity: string
    confidence: number
    watchlistTerm: string
    sourceFamily: string
    evidenceCount: number
    evidenceTimestamp: string
    routeLabel: string
    routeUrl: string
    caseId?: string
    casePath?: string
    summary: string
    dedupeKey: string
}

type Props = {
    organization?: DashboardWebhookOrganization
    initialDestinations: DashboardWebhookDestination[]
    initialDeliveries: DashboardWebhookDelivery[]
    alertOptions: DashboardWebhookAlertOption[]
}

type RequestResult = {
    ok?: boolean
    testedAt?: string
    destination?: DashboardWebhookDestination
    delivery?: DashboardWebhookDelivery
    deliveries?: DashboardWebhookDelivery[]
    error?: { code?: string, message?: string }
}

const emptyDestination = { name: '', url: '', kind: 'discord' }

export default function WebhookDeliveryConsole({ organization, initialDestinations, initialDeliveries, alertOptions }: Props) {
    const [destinations, setDestinations] = useState(initialDestinations)
    const [deliveries, setDeliveries] = useState(initialDeliveries)
    const [selectedDestinationId, setSelectedDestinationId] = useState(initialDestinations.find(item => item.status === 'active')?.id || initialDestinations[0]?.id || '')
    const [selectedAlertId, setSelectedAlertId] = useState(alertOptions[0]?.id || '')
    const [draft, setDraft] = useState(emptyDestination)
    const [editingId, setEditingId] = useState('')
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [lastResult, setLastResult] = useState<RequestResult | null>(null)

    const selectedDestination = destinations.find(item => item.id === selectedDestinationId) || destinations[0]
    const selectedAlert = alertOptions.find(item => item.id === selectedAlertId) || alertOptions[0]
    const activeCount = destinations.filter(item => item.status === 'active').length
    const scopedDeliveries = deliveries
        .filter(item => !organization || !item.organizationId || item.organizationId === organization.id)
        .filter(item => !selectedDestination?.id || !item.webhookDestinationId || item.webhookDestinationId === selectedDestination.id)
        .slice(0, 8)
    const preview = useMemo(() => buildPreview(organization, selectedDestination, selectedAlert), [organization, selectedDestination, selectedAlert])
    const canUseActions = Boolean(organization)

    async function submitDestination(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!organization) return
        setBusy('save-destination')
        setError('')
        setMessage('')
        try {
            const endpoint = editingId
                ? `/api/organizations/${encodeURIComponent(organization.id)}/webhooks/${encodeURIComponent(editingId)}`
                : `/api/organizations/${encodeURIComponent(organization.id)}/webhooks`
            const body = editingId && !draft.url.trim()
                ? { name: draft.name, kind: draft.kind }
                : { name: draft.name, kind: draft.kind, url: draft.url }
            const payload = await requestJson<RequestResult>(endpoint, {
                method: editingId ? 'PATCH' : 'POST',
                body: JSON.stringify(body),
            })
            const destination = payload.destination
            if (destination) {
                setDestinations(current => upsertDestination(current, destination))
                setSelectedDestinationId(destination.id)
                setDraft(emptyDestination)
                setEditingId('')
                setMessage(editingId ? 'Destination updated.' : 'Destination created.')
            }
            setLastResult(payload)
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setBusy('')
        }
    }

    async function testDestination(destinationId: string) {
        if (!organization) return
        setBusy(`test-${destinationId}`)
        setError('')
        setMessage('')
        try {
            const payload = await requestJson<RequestResult>(`/api/organizations/${encodeURIComponent(organization.id)}/webhooks/test`, {
                method: 'POST',
                body: JSON.stringify({ webhookDestinationId: destinationId, dryRun: true, alertContext: preview?.hanasand }),
            })
            const delivery = payload.delivery
            if (delivery) {
                setDeliveries(current => upsertDelivery(current, delivery))
            }
            setLastResult(payload)
            setMessage(delivery ? `Dry-run test recorded as ${delivery.status}.` : 'Dry-run test completed.')
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setBusy('')
        }
    }

    async function setDestinationStatus(destination: DashboardWebhookDestination, status: 'active' | 'paused') {
        if (!organization) return
        setBusy(`${status}-${destination.id}`)
        setError('')
        setMessage('')
        try {
            const payload = await requestJson<RequestResult>(`/api/organizations/${encodeURIComponent(organization.id)}/webhooks/${encodeURIComponent(destination.id)}`, {
                method: status === 'paused' ? 'DELETE' : 'PATCH',
                body: JSON.stringify({ status }),
            })
            const nextDestination = payload.destination
            if (nextDestination) {
                setDestinations(current => upsertDestination(current, nextDestination))
                setMessage(status === 'paused' ? 'Destination paused.' : 'Destination enabled.')
            }
            setLastResult(payload)
        } catch (err) {
            setError(errorMessage(err))
        } finally {
            setBusy('')
        }
    }

    function startEdit(destination: DashboardWebhookDestination) {
        setEditingId(destination.id)
        setDraft({ name: destination.name, kind: destination.kind === 'generic' ? 'generic' : 'discord', url: '' })
        setSelectedDestinationId(destination.id)
        setMessage('Leave endpoint blank to keep the stored secret.')
        setError('')
    }

    return (
        <section className='rounded-lg border border-[#dfe5ee] bg-white shadow-sm'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-[#edf1f6] px-4 py-3'>
                <div className='min-w-0'>
                    <h2 className='flex items-center gap-2 text-sm font-semibold text-[#171a21]'>
                        <Webhook className='h-4 w-4 text-[#3056d3]' />
                        Discord and webhook delivery
                    </h2>
                    <p className='mt-1 text-xs text-[#667085]'>
                        {organization ? `${sanitizeDeliveryCopy(organization.name)}: ${activeCount}/${destinations.length} active destinations.` : 'Select or create an organization before configuring destinations.'}
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-xs font-semibold'>
                    <span className={statusPill(activeCount ? 'active' : 'paused')}>{activeCount ? 'Delivery configured' : 'Destination required'}</span>
                    <span className='rounded-lg border border-[#d8dee9] bg-[#fbfcfe] px-2.5 py-1 text-[#596170]'>{scopedDeliveries.length} recent rows</span>
                </div>
            </div>

            <div className='grid gap-4 p-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <div className='grid gap-4'>
                    <form onSubmit={submitDestination} className='rounded-lg border border-[#e5eaf2] bg-[#fbfcfe] p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>{editingId ? 'Edit destination' : 'Add destination'}</h3>
                            {editingId ? (
                                <button type='button' className='text-xs font-semibold text-[#3056d3]' onClick={() => { setEditingId(''); setDraft(emptyDestination); setMessage('') }}>
                                    Cancel
                                </button>
                            ) : null}
                        </div>
                        <div className='mt-3 grid gap-2 sm:grid-cols-[1fr_120px]'>
                            <label className='grid gap-1 text-xs font-semibold text-[#475467]'>
                                Label
                                <input className={inputClass} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder='SOC Discord' disabled={!canUseActions || Boolean(busy)} />
                            </label>
                            <label className='grid gap-1 text-xs font-semibold text-[#475467]'>
                                Type
                                <select className={inputClass} value={draft.kind} onChange={event => setDraft(current => ({ ...current, kind: event.target.value }))} disabled={!canUseActions || Boolean(busy)}>
                                    <option value='discord'>Discord</option>
                                    <option value='generic'>Webhook</option>
                                </select>
                            </label>
                        </div>
                        <label className='mt-2 grid gap-1 text-xs font-semibold text-[#475467]'>
                            Endpoint URL
                            <input className={inputClass} value={draft.url} onChange={event => setDraft(current => ({ ...current, url: event.target.value }))} placeholder={editingId ? 'Leave blank to keep existing endpoint' : 'https://discord.com/api/webhooks/...'} disabled={!canUseActions || Boolean(busy)} />
                        </label>
                        <button type='submit' className='mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-3 text-xs font-semibold text-white transition hover:bg-[#2b2f39] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] disabled:cursor-not-allowed disabled:opacity-60' disabled={!canUseActions || busy === 'save-destination' || !draft.name.trim() || (!editingId && !draft.url.trim())}>
                            {busy === 'save-destination' ? <Loader2 className='h-4 w-4 animate-spin' /> : <CheckCircle2 className='h-4 w-4' />}
                            {editingId ? 'Save destination' : 'Create destination'}
                        </button>
                    </form>

                    <div className='rounded-lg border border-[#e5eaf2]'>
                        <div className='border-b border-[#edf1f6] px-3 py-2'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Destinations</h3>
                        </div>
                        <div className='max-h-80 overflow-auto'>
                            {!destinations.length ? (
                                <div className='p-4 text-sm text-[#667085]'>No destination is configured. Add a Discord or generic webhook endpoint to enable dry-run tests.</div>
                            ) : destinations.map(destination => (
                                <div key={destination.id} className={`grid gap-3 border-b border-[#edf1f6] p-3 last:border-b-0 ${selectedDestination?.id === destination.id ? 'bg-[#f6f9ff]' : 'bg-white'}`}>
                                    <div className='flex flex-wrap items-start justify-between gap-2'>
                                        <button type='button' className='min-w-0 text-left' onClick={() => setSelectedDestinationId(destination.id)}>
                                            <p className='truncate text-sm font-semibold text-[#171a21]'>{destination.name}</p>
                                            <p className='mt-1 truncate font-mono text-[11px] text-[#667085]'>{destination.endpointHint || destination.endpointHash || destination.id}</p>
                                        </button>
                                        <span className={statusPill(destination.status)}>{destination.status}</span>
                                    </div>
                                    <div className='flex flex-wrap items-center gap-2 text-xs text-[#667085]'>
                                        <span>{destination.kind === 'discord' ? 'Discord' : 'Webhook'}</span>
                                        <span>Updated {formatTimestamp(destination.updatedAt)}</span>
                                        {destination.lastTestStatus ? <span>Last test {destination.lastTestStatus}</span> : <span>Not tested</span>}
                                    </div>
                                    <div className='flex flex-wrap gap-2'>
                                        <ActionButton busy={busy === `test-${destination.id}`} disabled={!canUseActions || destination.status !== 'active'} onClick={() => testDestination(destination.id)} icon={<Send className='h-3.5 w-3.5' />}>Test</ActionButton>
                                        <ActionButton disabled={!canUseActions || Boolean(busy)} onClick={() => startEdit(destination)} icon={<Edit3 className='h-3.5 w-3.5' />}>Edit</ActionButton>
                                        {destination.status === 'active'
                                            ? <ActionButton busy={busy === `paused-${destination.id}`} disabled={!canUseActions} onClick={() => setDestinationStatus(destination, 'paused')} icon={<Pause className='h-3.5 w-3.5' />}>Pause</ActionButton>
                                            : <ActionButton busy={busy === `active-${destination.id}`} disabled={!canUseActions} onClick={() => setDestinationStatus(destination, 'active')} icon={<Play className='h-3.5 w-3.5' />}>Enable</ActionButton>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='grid gap-4'>
                    <div className='rounded-lg border border-[#e5eaf2] bg-[#fbfcfe] p-3'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Dry-run payload</h3>
                            <select className={`${inputClass} max-w-full sm:w-[280px]`} value={selectedAlertId} onChange={event => setSelectedAlertId(event.target.value)}>
                                {alertOptions.map(alert => <option key={alert.id} value={alert.id}>{alert.severity.toUpperCase()} - {alert.title}</option>)}
                                {!alertOptions.length ? <option>No alert loaded</option> : null}
                            </select>
                        </div>
                        {preview ? (
                            <div className='mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]'>
                                <div className='grid gap-2 text-sm text-[#344054]'>
                                    <PreviewLine label='Alert' value={selectedAlert?.title || 'No alert'} />
                                    <PreviewLine label='Watchlist' value={selectedAlert?.watchlistTerm || 'Not returned'} />
                                    <PreviewLine label='Source' value={selectedAlert?.sourceFamily || 'Not returned'} />
                                    <PreviewLine label='Route' value={selectedAlert?.routeLabel || 'Not returned'} />
                                    <PreviewLine label='Destination' value={selectedDestination?.endpointHint || selectedDestination?.endpointHash || 'No destination selected'} />
                                </div>
                                <pre className='max-h-[260px] overflow-auto rounded-lg border border-[#d8dee9] bg-white p-3 text-[11px] leading-5 text-[#344054]'>{JSON.stringify(preview, null, 2)}</pre>
                            </div>
                        ) : (
                            <div className='mt-3 rounded-lg border border-[#fed7aa] bg-[#fff7ed] p-3 text-sm text-[#9a3412]'>Load an alert and destination to preview the Discord body.</div>
                        )}
                    </div>

                    <div className='rounded-lg border border-[#e5eaf2] bg-white'>
                        <div className='flex flex-wrap items-center justify-between gap-2 border-b border-[#edf1f6] px-3 py-2'>
                            <h3 className='text-sm font-semibold text-[#171a21]'>Delivery history</h3>
                            {lastResult?.delivery ? <span className={statusPill(lastResult.delivery.status)}>Latest {lastResult.delivery.status}</span> : null}
                        </div>
                        <div className='overflow-x-auto'>
                            <table className='min-w-full divide-y divide-[#edf1f6] text-left text-xs'>
                                <thead className='bg-[#fbfcfe] text-[#667085]'>
                                    <tr>
                                        <th className='px-3 py-2 font-semibold'>Attempt</th>
                                        <th className='px-3 py-2 font-semibold'>Alert</th>
                                        <th className='px-3 py-2 font-semibold'>Status</th>
                                        <th className='px-3 py-2 font-semibold'>Retry/error</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-[#edf1f6]'>
                                    {!scopedDeliveries.length ? (
                                        <tr><td colSpan={4} className='px-3 py-4 text-sm text-[#667085]'>No delivery rows for this destination yet. Run a dry-run test to record the first attempt.</td></tr>
                                    ) : scopedDeliveries.map(delivery => (
                                        <tr key={delivery.id}>
                                            <td className='px-3 py-2'>
                                                <p className='font-mono text-[11px] text-[#344054]'>{delivery.id}</p>
                                                <p className='mt-1 text-[#667085]'>{formatTimestamp(delivery.attemptedAt)}</p>
                                            </td>
                                            <td className='px-3 py-2 text-[#344054]'>{delivery.alertId}</td>
                                            <td className='px-3 py-2'><span className={statusPill(delivery.status)}>{delivery.status}</span></td>
                                            <td className='px-3 py-2 text-[#667085]'>{delivery.error || (delivery.httpStatus ? `HTTP ${delivery.httpStatus}` : delivery.payloadHash || 'No error returned')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {(message || error) ? (
                        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${error ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]' : 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]'}`}>
                            {error ? <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' /> : <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0' />}
                            <span>{error || message}</span>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    )
}

function ActionButton({ children, icon, busy, disabled, onClick }: { children: ReactNode, icon: ReactNode, busy?: boolean, disabled?: boolean, onClick: () => void }) {
    return (
        <button type='button' className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#d8dee9] bg-white px-2.5 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] disabled:cursor-not-allowed disabled:opacity-50' disabled={disabled || busy} onClick={onClick}>
            {busy ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : icon}
            {children}
        </button>
    )
}

function PreviewLine({ label, value }: { label: string, value: string }) {
    return (
        <p className='flex min-w-0 justify-between gap-3 rounded-md bg-white px-2 py-1.5'>
            <span className='shrink-0 font-semibold text-[#667085]'>{label}</span>
            <span className='truncate text-right text-[#171a21]'>{value}</span>
        </p>
    )
}

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers)
    headers.set('content-type', 'application/json')
    const response = await fetch(url, {
        ...init,
        headers,
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
        const message = payload?.error?.message || `Request failed with HTTP ${response.status}.`
        const error = new Error(message)
        throw error
    }
    return payload as T
}

function buildPreview(organization: DashboardWebhookOrganization | undefined, destination: DashboardWebhookDestination | undefined, alert: DashboardWebhookAlertOption | undefined) {
    if (!organization || !destination || !alert) return null
    return {
        content: `Hanasand alert for ${alert.title}`,
        embeds: [{
            title: `${alert.severity.toUpperCase()}: ${alert.title}`,
            description: alert.summary,
            timestamp: alert.evidenceTimestamp,
            fields: [
                { name: 'Organization', value: sanitizeDeliveryCopy(organization.name) || organization.name, inline: true },
                { name: 'Matched term', value: alert.watchlistTerm, inline: true },
                { name: 'Source family', value: alert.sourceFamily, inline: true },
                { name: 'Evidence', value: `${alert.evidenceCount} item${alert.evidenceCount === 1 ? '' : 's'}`, inline: true },
                { name: 'Confidence', value: `${alert.confidence}%`, inline: true },
                { name: 'Route', value: alert.routeLabel, inline: true },
                { name: 'Open case', value: alert.casePath || alert.routeUrl, inline: false },
            ],
        }],
        allowed_mentions: { parse: [] },
        hanasand: {
            organizationId: organization.id,
            tenantId: organization.tenantId,
            webhookDestinationId: destination.id,
            destinationTarget: destination.endpointHint || destination.endpointHash || 'redacted_destination',
            alertId: alert.id,
            caseId: alert.caseId,
            casePath: alert.casePath,
            watchlistTerm: alert.watchlistTerm,
            sourceFamily: alert.sourceFamily,
            evidenceTimestamp: alert.evidenceTimestamp,
            routeUrl: alert.routeUrl,
            dedupeKey: alert.dedupeKey,
            dryRun: true,
            replay: false,
        },
    }
}

function upsertDestination(current: DashboardWebhookDestination[], destination: DashboardWebhookDestination) {
    const next = current.filter(item => item.id !== destination.id)
    return [destination, ...next].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
}

function upsertDelivery(current: DashboardWebhookDelivery[], delivery: DashboardWebhookDelivery) {
    const next = current.filter(item => item.id !== delivery.id)
    return [delivery, ...next].sort((a, b) => String(b.attemptedAt || '').localeCompare(String(a.attemptedAt || '')))
}

function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
}

function formatTimestamp(value?: string) {
    if (!value) return 'not recorded'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusPill(status: string) {
    const normalized = status.toLowerCase()
    if (['active', 'delivered', 'dry_run', 'sent'].includes(normalized)) return 'inline-flex items-center rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-2 py-0.5 text-[11px] font-semibold text-[#166534]'
    if (['failed', 'error'].includes(normalized)) return 'inline-flex items-center rounded-full border border-[#fecaca] bg-[#fef2f2] px-2 py-0.5 text-[11px] font-semibold text-[#991b1b]'
    return 'inline-flex items-center rounded-full border border-[#fed7aa] bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#9a3412]'
}

const inputClass = 'h-9 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm text-[#171a21] outline-none transition placeholder:text-[#98a2b3] focus:border-[#8fb4ff] focus:ring-2 focus:ring-[#dbe5ff] disabled:cursor-not-allowed disabled:bg-[#f2f5f9]'
