'use client'

import { FormEvent, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Edit3, Loader2, Pause, Play, Send, Webhook } from 'lucide-react'

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
    destinationId?: string
    requestId?: string
    auditEventId?: string
    endpointHash?: string
    endpointHint?: string
    attemptedAt: string
    payloadHash?: string
    status: string
    deliveryKind?: string
    httpStatus?: number
    error?: string
    errorClass?: string
    attemptCount?: number | null
    nextRetryAt?: string | null
    idempotencyKey?: string
    casePath?: string
    dryRun?: boolean
}

function sanitizeDeliveryCopy(value: string | undefined) {
    if (!value) return value
    return value
        .replace(/hanasand-live-status-\d+/gi, 'Hanasand live org')
        .replace(/hanasand-live-status/gi, 'Hanasand live org')
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

const blankDestination = { name: '', url: '', kind: 'discord' }

export default function WebhookDeliveryConsole({ organization, initialDestinations, initialDeliveries, alertOptions }: Props) {
    const [destinations, setDestinations] = useState(initialDestinations)
    const [deliveries, setDeliveries] = useState(initialDeliveries)
    const [selectedDestinationId, setSelectedDestinationId] = useState(initialDestinations.find(item => item.status === 'active')?.id || initialDestinations[0]?.id || '')
    const [selectedAlertId, setSelectedAlertId] = useState(alertOptions[0]?.id || '')
    const [draft, setDraft] = useState(blankDestination)
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
    const deliveryHeadline = activeCount
        ? `${activeCount} active destination${activeCount === 1 ? '' : 's'}`
        : 'Destination required'

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
                setDraft(blankDestination)
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
        <section className='rounded-lg border border-[#26344d] bg-[#101827] shadow-sm'>
            <div className='flex flex-wrap items-start justify-between gap-3 border-b border-[#1f2c42] px-4 py-3'>
                <div className='min-w-0'>
                    <p className='text-[10px] font-semibold uppercase text-[#9db8ff]'>Delivery routes</p>
                    <h2 className='mt-1 flex items-center gap-2 text-sm font-semibold text-[#edf4ff]'>
                        <Webhook className='h-4 w-4 text-[#9db8ff]' />
                        {deliveryHeadline}
                    </h2>
                    <p className='mt-1 text-xs text-[#8fa0ba]'>
                        {organization ? `${sanitizeDeliveryCopy(organization.name)} · ${scopedDeliveries.length} recent delivery rows` : 'Select or create an organization before configuring destinations.'}
                    </p>
                </div>
                <div className='flex flex-wrap items-center gap-2 text-xs font-semibold'>
                    <span className={statusPill(activeCount ? 'active' : 'paused')}>{activeCount ? 'Delivery configured' : 'Destination required'}</span>
                    <span className='rounded-lg border border-[#27364f] bg-[#0b121e] px-2.5 py-1 text-[#aab7cc]'>{scopedDeliveries.length} recent rows</span>
                </div>
            </div>

            <div className='grid gap-4 p-4 xl:grid-cols-[0.9fr_1.1fr]'>
                <div className='grid gap-4'>
                    <details className='rounded-lg border border-[#26344d] bg-[#0b121e]' open={Boolean(editingId)}>
                        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#edf4ff] outline-none transition hover:bg-[#15284b] focus-visible:ring-2 focus-visible:ring-[#1f3f7a]'>
                            <span>{editingId ? 'Edit selected destination' : 'Add or edit destination'}</span>
                            <span className='inline-flex items-center gap-2 text-xs font-medium text-[#8fa0ba]'>
                                {destinations.length ? `${destinations.length} saved` : 'Setup'}
                                <ChevronDown className='h-4 w-4' />
                            </span>
                        </summary>
                        <form onSubmit={submitDestination} className='border-t border-[#26344d] p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-2'>
                                <h3 className='text-sm font-semibold text-[#edf4ff]'>{editingId ? 'Edit destination' : 'Add destination'}</h3>
                                {editingId ? (
                                    <button type='button' className='text-xs font-semibold text-[#9db8ff]' onClick={() => { setEditingId(''); setDraft(blankDestination); setMessage('') }}>
                                        Cancel
                                    </button>
                                ) : null}
                            </div>
                            <div className='mt-3 grid gap-2 sm:grid-cols-[1fr_120px]'>
                                <label className='grid gap-1 text-xs font-semibold text-[#aab7cc]'>
                                    Label
                                    <input className={inputClass} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} placeholder='SOC Discord' disabled={!canUseActions || Boolean(busy)} />
                                </label>
                                <label className='grid gap-1 text-xs font-semibold text-[#aab7cc]'>
                                    Type
                                    <select className={inputClass} value={draft.kind} onChange={event => setDraft(current => ({ ...current, kind: event.target.value }))} disabled={!canUseActions || Boolean(busy)}>
                                        <option value='discord'>Discord</option>
                                        <option value='generic'>Webhook</option>
                                    </select>
                                </label>
                            </div>
                            <label className='mt-2 grid gap-1 text-xs font-semibold text-[#aab7cc]'>
                                Endpoint URL
                                <input className={inputClass} value={draft.url} onChange={event => setDraft(current => ({ ...current, url: event.target.value }))} placeholder={editingId ? 'Leave blank to keep existing endpoint' : 'https://discord.com/api/webhooks/...'} disabled={!canUseActions || Boolean(busy)} />
                            </label>
                            <button type='submit' className='mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#315fe8] px-3 text-xs font-semibold text-white transition hover:bg-[#426ef0] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-60' disabled={!canUseActions || busy === 'save-destination' || !draft.name.trim() || (!editingId && !draft.url.trim())}>
                                {busy === 'save-destination' ? <Loader2 className='h-4 w-4 animate-spin' /> : <CheckCircle2 className='h-4 w-4' />}
                                {editingId ? 'Save destination' : 'Create destination'}
                            </button>
                        </form>
                    </details>

                    <div className='rounded-lg border border-[#26344d]'>
                        <div className='border-b border-[#1f2c42] px-3 py-2'>
                            <h3 className='text-sm font-semibold text-[#edf4ff]'>Destinations</h3>
                        </div>
                        <div className='max-h-80 overflow-auto'>
                            {!destinations.length ? (
                                <div className='p-4 text-sm text-[#8fa0ba]'>Delivery routes attach here. Add Discord or a generic webhook endpoint to start dry-run tests.</div>
                            ) : destinations.map(destination => (
                                <div key={destination.id} className={`grid gap-3 border-b border-[#1f2c42] p-3 last:border-b-0 ${selectedDestination?.id === destination.id ? 'bg-[#111b2b]' : 'bg-[#101827]'}`}>
                                    <div className='flex flex-wrap items-start justify-between gap-2'>
                                        <button type='button' className='min-w-0 text-left' onClick={() => setSelectedDestinationId(destination.id)}>
                                            <p className='truncate text-sm font-semibold text-[#edf4ff]'>{destination.name}</p>
                                            <p className='mt-1 truncate font-mono text-[11px] text-[#8fa0ba]'>{destination.endpointHint || destination.endpointHash || destination.id}</p>
                                        </button>
                                        <span className={statusPill(destination.status)}>{destination.status}</span>
                                    </div>
                                    <div className='flex flex-wrap items-center gap-2 text-xs text-[#8fa0ba]'>
                                        <span>{destination.kind === 'discord' ? 'Discord' : 'Webhook'}</span>
                                        <span>Updated {formatTimestamp(destination.updatedAt)}</span>
                                        {destination.lastTestStatus ? <span>Last test {destination.lastTestStatus}</span> : <span>Test ready</span>}
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
                    <details className='rounded-lg border border-[#26344d] bg-[#0b121e]'>
                        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#edf4ff] outline-none transition hover:bg-[#15284b] focus-visible:ring-2 focus-visible:ring-[#1f3f7a]'>
                            <span>Dry-run payload</span>
                            <span className='inline-flex items-center gap-2 text-xs font-medium text-[#8fa0ba]'>
                                {selectedAlert ? selectedAlert.severity.toUpperCase() : 'Select alert'}
                                <ChevronDown className='h-4 w-4' />
                            </span>
                        </summary>
                        <div className='border-t border-[#26344d] p-3'>
                            <div className='flex flex-wrap items-center justify-between gap-3'>
                                <h3 className='text-sm font-semibold text-[#edf4ff]'>Dry-run payload</h3>
                                <select className={`${inputClass} max-w-full sm:w-[280px]`} value={selectedAlertId} onChange={event => setSelectedAlertId(event.target.value)}>
                                    {alertOptions.map(alert => <option key={alert.id} value={alert.id}>{alert.severity.toUpperCase()} - {alert.title}</option>)}
                                    {!alertOptions.length ? <option>Select an alert</option> : null}
                                </select>
                            </div>
                            {preview ? (
                                <div className='mt-3 grid gap-3 lg:grid-cols-[0.9fr_1.1fr]'>
                                    <div className='grid gap-2 text-sm text-[#dbe7ff]'>
                                        <PreviewLine label='Alert' value={selectedAlert?.title || 'alert syncing'} />
                                        <PreviewLine label='Watchlist' value={selectedAlert?.watchlistTerm || 'syncing'} />
                                        <PreviewLine label='Source' value={selectedAlert?.sourceFamily || 'syncing'} />
                                        <PreviewLine label='Route' value={selectedAlert?.routeLabel || 'syncing'} />
                                        <PreviewLine label='Destination' value={selectedDestination?.endpointHint || selectedDestination?.endpointHash || 'destination syncing'} />
                                    </div>
                                    <pre className='max-h-[260px] overflow-auto rounded-lg border border-[#27364f] bg-[#101827] p-3 text-[11px] leading-5 text-[#dbe7ff]'>{JSON.stringify(preview, null, 2)}</pre>
                                </div>
                            ) : (
                                <div className='mt-3 rounded-lg border border-[#7a5618] bg-[#2a1c0e] p-3 text-sm text-[#ffd58a]'>Select an alert and destination to render the Discord body.</div>
                            )}
                        </div>
                    </details>

                    <details className='rounded-lg border border-[#26344d] bg-[#101827]'>
                        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-[#edf4ff] outline-none transition hover:bg-[#15284b] focus-visible:ring-2 focus-visible:ring-[#1f3f7a]'>
                            <span>Delivery history</span>
                            <span className='inline-flex items-center gap-2 text-xs font-medium text-[#8fa0ba]'>
                                {lastResult?.delivery ? `Latest ${lastResult.delivery.status}` : `${scopedDeliveries.length} rows`}
                                <ChevronDown className='h-4 w-4' />
                            </span>
                        </summary>
                        <div className='overflow-x-auto border-t border-[#1f2c42]'>
                            <table className='min-w-full divide-y divide-[#1f2c42] text-left text-xs'>
                                <thead className='bg-[#0b121e] text-[#8fa0ba]'>
                                    <tr>
                                        <th className='px-3 py-2 font-semibold'>Attempt</th>
                                        <th className='px-3 py-2 font-semibold'>Alert</th>
                                        <th className='px-3 py-2 font-semibold'>Status</th>
                                        <th className='px-3 py-2 font-semibold'>Retry/error</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-[#1f2c42]'>
                                    {!scopedDeliveries.length ? (
                                        <tr><td colSpan={4} className='px-3 py-4 text-sm text-[#8fa0ba]'>Dry-run tests, retries, and customer sends stream here with redacted destination metadata.</td></tr>
                                    ) : scopedDeliveries.map(delivery => (
                                        <tr key={delivery.id}>
                                            <td className='px-3 py-2'>
                                                <p className='font-mono text-[11px] text-[#dbe7ff]'>{delivery.id}</p>
                                                <p className='mt-1 text-[#8fa0ba]'>{formatTimestamp(delivery.attemptedAt)}</p>
                                                <p className='mt-1 truncate font-mono text-[11px] text-[#8fa0ba]'>{delivery.requestId || delivery.auditEventId || 'no audit id'}</p>
                                            </td>
                                            <td className='px-3 py-2'>
                                                <p className='truncate text-[#dbe7ff]'>{delivery.alertId}</p>
                                                <p className='mt-1 truncate text-[#8fa0ba]'>{delivery.casePath || delivery.watchlistId || delivery.idempotencyKey || 'alert route pending'}</p>
                                            </td>
                                            <td className='px-3 py-2'>
                                                <span className={statusPill(delivery.status)}>{delivery.status}</span>
                                                <p className='mt-1 text-[#8fa0ba]'>{delivery.dryRun ? 'dry run' : delivery.deliveryKind || 'delivery'}</p>
                                                <p className='mt-1 truncate font-mono text-[11px] text-[#8fa0ba]'>{delivery.endpointHint || delivery.endpointHash || delivery.webhookDestinationId || delivery.destinationId || 'redacted target'}</p>
                                            </td>
                                            <td className='px-3 py-2 text-[#8fa0ba]'>
                                                <p>{deliveryStatusDetail(delivery)}</p>
                                                <p className='mt-1'>{retryDetail(delivery)}</p>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>

                    {(message || error) ? (
                        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${error ? 'border-[#7a3520] bg-[#2c160f] text-[#ffb598]' : 'border-[#1f6f48] bg-[#0c261c] text-[#9cf0bc]'}`}>
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
        <button type='button' className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#27364f] bg-[#101827] px-2.5 text-xs font-semibold text-[#dbe7ff] transition hover:bg-[#162033] focus:outline-none focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:opacity-50' disabled={disabled || busy} onClick={onClick}>
            {busy ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : icon}
            {children}
        </button>
    )
}

function PreviewLine({ label, value }: { label: string, value: string }) {
    return (
        <p className='flex min-w-0 justify-between gap-3 rounded-md bg-[#101827] px-2 py-1.5'>
            <span className='shrink-0 font-semibold text-[#8fa0ba]'>{label}</span>
            <span className='truncate text-right text-[#edf4ff]'>{value}</span>
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

function deliveryStatusDetail(delivery: DashboardWebhookDelivery) {
    if (delivery.error) return delivery.error
    if (delivery.errorClass) return delivery.errorClass
    if (delivery.httpStatus) return `HTTP ${delivery.httpStatus}`
    if (delivery.payloadHash) return delivery.payloadHash
    return 'clear'
}

function retryDetail(delivery: DashboardWebhookDelivery) {
    const attempt = delivery.attemptCount === null || delivery.attemptCount === undefined ? null : `attempt ${delivery.attemptCount}`
    const nextRetry = delivery.nextRetryAt ? `retry ${formatTimestamp(delivery.nextRetryAt)}` : null
    return [attempt, nextRetry].filter(Boolean).join(' · ') || 'no retry scheduled'
}

function formatTimestamp(value?: string) {
    if (!value) return 'not recorded'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function statusPill(status: string) {
    const normalized = status.toLowerCase()
    if (['active', 'delivered', 'dry_run', 'sent'].includes(normalized)) return 'inline-flex items-center rounded-full border border-[#1f6f48] bg-[#0c261c] px-2 py-0.5 text-[11px] font-semibold text-[#9cf0bc]'
    if (['failed', 'error'].includes(normalized)) return 'inline-flex items-center rounded-full border border-[#7a3520] bg-[#2c160f] px-2 py-0.5 text-[11px] font-semibold text-[#ffb598]'
    return 'inline-flex items-center rounded-full border border-[#7a5618] bg-[#2a1c0e] px-2 py-0.5 text-[11px] font-semibold text-[#ffd58a]'
}

const inputClass = 'h-9 rounded-lg border border-[#27364f] bg-[#101827] px-3 text-sm text-[#edf4ff] outline-none transition placeholder:text-[#6e7d92] focus:border-[#7aa5ff] focus:ring-2 focus:ring-[#1f3f7a] disabled:cursor-not-allowed disabled:bg-[#162033]'
