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
    replayCount?: number
    lastReplayedAt?: string
    workflowContext?: {
        organizationId?: string
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

export function DwmAlertInbox({ alerts, tenantId = 'default', organizationId }: { alerts: InboxAlert[], tenantId?: string, organizationId?: string }) {
    const router = useRouter()
    const [busyAlert, setBusyAlert] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

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
            setMessage('Alert updated.')
            router.refresh()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error))
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
            setMessage('Evidence replay recorded.')
            router.refresh()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error))
        } finally {
            setBusyAlert(null)
        }
    }

    async function sendAlert(alertId: string) {
        setBusyAlert(alertId)
        setMessage(null)
        try {
            const alert = alerts.find(item => item.id === alertId)
            const response = await fetch('/api/dwm/webhooks/deliver', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(scopeBody({ alertId, limit: 1 }, tenantId, alert ? alertOrganizationId(alert, organizationId) : organizationId)),
            })
            const payload = await response.json().catch(() => ({})) as { error?: { message?: string }, attemptedCount?: number }
            if (!response.ok) throw new Error(payload.error?.message || response.statusText)
            setMessage(payload.attemptedCount ? 'Webhook delivery attempted.' : 'No delivery has been sent for this alert.')
            router.refresh()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : String(error))
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
            {alerts.map((alert) => (
                <div key={alert.id} className='grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-3'>
                    <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='font-semibold text-ui-text'>{alert.company}</h3>
                            {alert.actor && <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-2 py-0.5 text-xs font-semibold text-ui-primary'>{alert.actor}</span>}
                            <span className={severityClass(alert.severity)}>{alert.severity}</span>
                            <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-text'>{alert.confidence}% confidence</span>
                            <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-muted'>{(alert.deliveryState || 'pending_review').replaceAll('_', ' ')}</span>
                            <span className='rounded-full border border-ui-border bg-ui-raised px-2 py-0.5 text-xs font-semibold text-ui-muted'>{alert.workflowEvents?.length || 0} events</span>
                        </div>
                        <p className='mt-1 text-sm text-ui-muted'>Matched <span className='font-mono'>{alert.matchedTerm.value}</span> from {alert.sourceFamily.replaceAll('_', ' ')} · {alert.artifactType.replaceAll('_', ' ')}</p>
                        <p className='mt-2 line-clamp-2 text-sm leading-6 text-ui-text'>{safeAlertSummary(alert)}</p>
                        {alert.workflowNote && <p className='mt-2 text-sm font-semibold text-ui-primary'>{alert.workflowNote}</p>}
                    </div>

                    <div className='grid gap-2 md:grid-cols-2'>
                        {alert.evidence.slice(0, 3).map(item => (
                            <div key={item.id} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <span className='text-xs font-semibold text-ui-text'>{item.sourceName}</span>
                                    <span className='rounded-full border border-ui-primary/35 bg-ui-primary/10 px-2 py-0.5 text-[11px] font-semibold text-ui-primary'>{item.redactionState.replaceAll('_', ' ')}</span>
                                </div>
                                <p className='mt-2 line-clamp-2 text-xs leading-5 text-ui-muted'>{safeEvidenceExcerpt(item.excerpt)}</p>
                                <p className='mt-2 break-all font-mono text-[11px] text-ui-muted'>{item.contentHash}</p>
                            </div>
                        ))}
                    </div>

                    {alert.workflowEvents?.length ? (
                        <div className='rounded-lg border border-ui-border bg-ui-raised p-3 text-xs text-ui-muted'>
                            Latest: {latestEventLabel(alert.workflowEvents)}
                        </div>
                    ) : null}

                    <div className='flex flex-wrap gap-2'>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'reviewing', 'pending_review', 'Analyst review started.')} icon='review'>Review</ActionButton>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'route_to_customer', 'ready_to_send', 'Ready for customer delivery.')} icon='send'>Ready</ActionButton>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => replayAlert(alert.id)} icon='replay'>Replay</ActionButton>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => sendAlert(alert.id)} icon='send'>Send</ActionButton>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'false_positive', 'muted', 'Marked false positive.')} icon='false'>False</ActionButton>
                    </div>
                </div>
            ))}
            {message && <p className='text-sm text-ui-muted'>{message}</p>}
        </div>
    )
}

function alertOrganizationId(alert: InboxAlert, fallback?: string) {
    return alert.organizationId || alert.workflowContext?.organizationId || fallback
}

function scopeBody<T extends Record<string, unknown>>(body: T, tenantId: string, organizationId?: string) {
    return organizationId ? { ...body, tenantId, organizationId } : { ...body, tenantId }
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
