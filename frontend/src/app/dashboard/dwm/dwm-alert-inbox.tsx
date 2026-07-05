'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, Loader2, RotateCcw, Send, XCircle } from 'lucide-react'
import type { DwmAlert } from '@/utils/dwm/product'
import { safeAlertSummary, safeEvidenceExcerpt } from '@/utils/dwm/display'

type InboxAlert = DwmAlert & {
    deliveryState?: string
    workflowNote?: string
    organizationId?: string
    caseId?: string
    caseIdCandidate?: string
    casePath?: string
    replayCount?: number
    lastReplayedAt?: string
    workflowContext?: {
        organizationId?: string
        caseId?: string
        caseIdCandidate?: string
        casePath?: string
    }
    workflowEvents?: Array<{
        id: string
        at: string
        actor?: string
        note?: string
        toReviewState?: string
        toDeliveryState?: string
    }>
}

type InboxMessage = {
    text: string
    actionHref?: string
    actionLabel?: string
}

export function DwmAlertInbox({ alerts, tenantId = 'default', organizationId }: { alerts: InboxAlert[], tenantId?: string, organizationId?: string }) {
    const router = useRouter()
    const [busyAlert, setBusyAlert] = useState<string | null>(null)
    const [message, setMessage] = useState<InboxMessage | null>(null)

    async function updateAlert(alertId: string, reviewState: string, deliveryState: string, note: string) {
        setBusyAlert(alertId)
        setMessage(null)
        try {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ reviewState, deliveryState, note, actor: 'dashboard' }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage({ text: 'Alert updated.' })
            router.refresh()
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAlert(null)
        }
    }

    async function replayAlert(alertId: string) {
        setBusyAlert(alertId)
        setMessage(null)
        try {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}/replay`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ actor: 'dashboard' }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await response.json().catch(() => ({})) as { error?: { message?: string } }
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage({ text: 'Evidence replay recorded.' })
            router.refresh()
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAlert(null)
        }
    }

    async function sendAlert(alertId: string) {
        setBusyAlert(alertId)
        setMessage(null)
        try {
            const alert = alerts.find(item => item.id === alertId)
            const caseId = alert ? alertCaseId(alert) : undefined
            const casePath = alert ? alert.casePath || alert.workflowContext?.casePath : undefined
            const response = await fetch('/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ alertId, caseId, casePath, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await response.json().catch(() => ({})) as { error?: { message?: string }, attemptedCount?: number }
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage(payload.attemptedCount
                ? { text: 'Webhook delivery attempted.' }
                : {
                    text: 'No delivery was attempted. Configure or test a destination before sending.',
                    actionHref: alert ? deliverySetupHref(alert, organizationId) : '/organizations?focus=destinations#destinations',
                    actionLabel: 'Configure delivery',
                })
            router.refresh()
        } catch (error) {
            const alert = alerts.find(item => item.id === alertId)
            setMessage({
                text: error instanceof Error ? error.message : String(error),
                actionHref: alert ? deliverySetupHref(alert, organizationId) : undefined,
                actionLabel: alert ? 'Review delivery setup' : undefined,
            })
        } finally {
            setBusyAlert(null)
        }
    }

    if (!alerts.length) {
        return (
            <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-5 text-sm leading-6 text-ui-muted'>
                Monitoring is active. Customer alerts appear here when source captures match the saved watchlist terms.
            </div>
        )
    }

    return (
        <div className='grid gap-2'>
            {alerts.map((alert) => {
                const evidencePreview = alert.evidence.slice(0, 3)
                const eventCount = alert.workflowEvents?.length || 0
                const deliveryHref = deliverySetupHref(alert, organizationId)
                return (
                    <article key={alert.id} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3' data-dwm-alert-row>
                        <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-2'>
                                <h3 className='font-semibold text-ui-text'>{alert.company}</h3>
                                {alert.actor && <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'>{alert.actor}</span>}
                                <span className={severityClass(alert.severity)}>{alert.severity}</span>
                                <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-text'>{alert.confidence}% confidence</span>
                                <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-muted'>{(alert.deliveryState || 'pending_review').replaceAll('_', ' ')}</span>
                                <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-muted'>{alert.workflowEvents?.length || 0} events</span>
                            </div>
                            <p className='mt-1 text-sm text-ui-muted'>Matched <span className='font-semibold text-ui-text'>{alert.matchedTerm.value}</span> from {alert.sourceFamily.replaceAll('_', ' ')} · {alert.artifactType.replaceAll('_', ' ')}</p>
                            <p className='mt-2 line-clamp-2 text-sm leading-6 text-ui-text'>{safeAlertSummary(alert)}</p>
                            {alert.workflowNote && <p className='mt-2 text-sm font-semibold text-ui-primary'>{alert.workflowNote}</p>}
                        </div>

                        <div className='flex flex-wrap gap-2' data-dwm-alert-primary-actions>
                            {alertCaseId(alert) ? <a href={caseDetailHref(alert, tenantId, organizationId)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-primary/35 bg-ui-primary/10 px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-primary/15 focus:outline-none focus:ring-2 focus:ring-ui-primary/30'>Open case</a> : null}
                            <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'reviewing', 'pending_review', 'Analyst review started.')} icon='review'>Review</ActionButton>
                            <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'route_to_customer', 'ready_to_send', 'Ready for customer delivery.')} icon='send'>Ready</ActionButton>
                            <ActionButton busy={busyAlert === alert.id} onClick={() => sendAlert(alert.id)} icon='send'>Send</ActionButton>
                            <a href={deliveryHref} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel focus:outline-none focus:ring-2 focus:ring-ui-primary/30' data-dwm-alert-delivery-setup='true'>Delivery setup</a>
                        </div>

                        <details className='rounded-lg border border-ui-border bg-ui-raised' data-dwm-alert-evidence-disclosure>
                            <summary className='flex cursor-pointer list-none flex-col gap-1 px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                                <span>Evidence and history</span>
                                <span className='font-medium text-ui-muted'>{alert.evidence.length} evidence rows, {eventCount} case events</span>
                            </summary>
                            <div className='grid gap-2 border-t border-ui-border p-3 md:grid-cols-2'>
                                {evidencePreview.map(item => (
                                    <div key={item.id} className='rounded-lg border border-ui-border bg-ui-panel p-3'>
                                        <div className='flex flex-wrap items-center gap-2'>
                                            <span className='text-xs font-semibold text-ui-text'>{item.sourceName}</span>
                                            <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{item.redactionState.replaceAll('_', ' ')}</span>
                                        </div>
                                        <p className='mt-2 line-clamp-2 text-xs leading-5 text-ui-muted'>{safeEvidenceExcerpt(item.excerpt)}</p>
                                        <p className='mt-2 text-[11px] font-semibold text-ui-muted'>{evidenceHashState(item.contentHash)}</p>
                                    </div>
                                ))}
                                {!evidencePreview.length && (
                                    <p className='rounded-lg border border-dashed border-ui-border bg-ui-panel p-3 text-xs text-ui-muted'>Evidence rows are syncing for this alert.</p>
                                )}
                                {alert.workflowEvents?.length ? (
                                    <div className='rounded-lg border border-ui-border bg-ui-panel p-3 text-xs text-ui-muted md:col-span-2'>
                                        Latest: {latestEventLabel(alert.workflowEvents)}
                                    </div>
                                ) : null}
                            </div>
                        </details>

                        <details className='rounded-lg border border-ui-border bg-ui-raised' data-dwm-alert-secondary-actions>
                            <summary className='flex cursor-pointer list-none flex-col gap-1 px-3 py-2 text-xs font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                                <span>Secondary actions</span>
                                <span className='font-medium text-ui-muted'>Replay evidence or mute as false positive</span>
                            </summary>
                            <div className='flex flex-wrap gap-2 border-t border-ui-border p-3'>
                                <ActionButton busy={busyAlert === alert.id} onClick={() => replayAlert(alert.id)} icon='replay'>Replay</ActionButton>
                                <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'false_positive', 'muted', 'Marked false positive.')} icon='false'>False</ActionButton>
                            </div>
                        </details>
                    </article>
                )
            })}
            {message && (
                <div className='flex flex-wrap items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm text-ui-muted' data-dwm-alert-result='true'>
                    <span className='wrap-break-word'>{message.text}</span>
                    {message.actionHref && message.actionLabel ? (
                        <a href={message.actionHref} className='inline-flex min-h-8 items-center rounded-lg border border-current px-3 text-xs font-semibold text-ui-text transition hover:opacity-80' data-dwm-alert-result-action='true'>
                            {message.actionLabel}
                        </a>
                    ) : null}
                </div>
            )}
        </div>
    )
}

function alertOrganizationId(alert: InboxAlert, fallback?: string) {
    return alert.organizationId || alert.workflowContext?.organizationId || fallback
}

function alertCaseId(alert: InboxAlert) {
    return alert.caseId || alert.workflowContext?.caseId || alert.caseIdCandidate || alert.workflowContext?.caseIdCandidate || caseIdFromPath(alert.casePath || alert.workflowContext?.casePath)
}

function caseDetailHref(alert: InboxAlert, tenantId: string, fallbackOrganizationId?: string) {
    const params = new URLSearchParams()
    const organizationId = alertOrganizationId(alert, fallbackOrganizationId)
    if (organizationId) params.set('organizationId', organizationId)
    if (tenantId) params.set('tenantId', tenantId)
    params.set('alertId', alert.id)
    params.set('route', 'alert_queue')
    const query = params.toString()
    return `/dashboard/dwm/cases/${encodeURIComponent(alertCaseId(alert) || '')}${query ? `?${query}` : ''}`
}

function deliverySetupHref(alert: InboxAlert, fallbackOrganizationId?: string) {
    const params = new URLSearchParams()
    const organizationId = alertOrganizationId(alert, fallbackOrganizationId)
    if (organizationId) params.set('organizationId', organizationId)
    params.set('alertId', alert.id)
    params.set('focus', 'destinations')
    const query = params.toString()
    return `/organizations${query ? `?${query}` : ''}#destinations`
}

function caseIdFromPath(path?: string) {
    const match = path?.match(/\/cases\/([^/?#]+)/)
    if (!match?.[1]) return undefined
    try {
        return decodeURIComponent(match[1])
    } catch {
        return match[1]
    }
}

function scopeBody<T extends Record<string, unknown>>(body: T, tenantId: string, organizationId?: string) {
    const cleanBody = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)) as T
    return organizationId ? { ...cleanBody, tenantId, organizationId } : { ...cleanBody, tenantId }
}

function ActionButton({ busy, onClick, icon, children }: { busy: boolean, onClick: () => void, icon: 'review' | 'send' | 'false' | 'replay', children: string }) {
    const Icon = busy ? Loader2 : icon === 'send' ? Send : icon === 'false' ? XCircle : icon === 'replay' ? RotateCcw : CheckCircle2
    return (
        <button onClick={onClick} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel disabled:cursor-not-allowed disabled:opacity-60'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {children}
        </button>
    )
}

function evidenceHashState(value?: string | null) {
    return value ? 'hash available' : 'hash pending'
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full border border-ui-danger/35 bg-ui-danger/10 px-2 py-0.5 text-xs font-semibold text-ui-danger'
    if (severity === 'high') return 'rounded-full border border-ui-warning/35 bg-ui-warning/10 px-2 py-0.5 text-xs font-semibold text-ui-warning'
    return 'rounded-full border border-ui-primary/35 bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'
}

function latestEventLabel(events: NonNullable<InboxAlert['workflowEvents']>) {
    const latest = [...events].sort((a, b) => String(b.at).localeCompare(String(a.at)))[0]
    if (!latest) return 'No review event recorded for this alert.'
    const state = latest.toDeliveryState || latest.toReviewState || 'updated'
    return `${state.replaceAll('_', ' ')} by ${latest.actor || 'dashboard'} · ${latest.note || latest.at}`
}
