'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CheckCircle2, Loader2, Send, XCircle } from 'lucide-react'
import type { DwmAlert } from '@/utils/dwm/product'

type InboxAlert = DwmAlert & {
    deliveryState?: string
    workflowNote?: string
}

export function DwmAlertInbox({ alerts }: { alerts: InboxAlert[] }) {
    const router = useRouter()
    const [busyAlert, setBusyAlert] = useState<string | null>(null)
    const [message, setMessage] = useState<string | null>(null)

    async function updateAlert(alertId: string, reviewState: string, deliveryState: string, note: string) {
        setBusyAlert(alertId)
        setMessage(null)
        try {
            const response = await fetch(`/api/dwm/alerts/${encodeURIComponent(alertId)}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ reviewState, deliveryState, note, actor: 'dashboard' }),
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

    if (!alerts.length) {
        return (
            <div className='rounded-lg border border-dashed border-[#cfd8e6] bg-[#fbfcfe] p-5 text-sm leading-6 text-[#596170]'>
                No customer alerts yet. Monitoring is active; recent captures do not mention the saved watchlist terms.
            </div>
        )
    }

    return (
        <div className='grid gap-2'>
            {alerts.map((alert) => (
                <div key={alert.id} className='grid gap-3 rounded-lg border border-[#e0e5ed] bg-[#fbfcfe] p-3 md:grid-cols-[1fr_auto] md:items-center'>
                    <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h3 className='font-semibold text-[#171a21]'>{alert.company}</h3>
                            {alert.actor && <span className='rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'>{alert.actor}</span>}
                            <span className={severityClass(alert.severity)}>{alert.severity}</span>
                            <span className='rounded-full bg-[#f4f7ff] px-2 py-0.5 text-xs font-semibold text-[#475467]'>{alert.confidence}% confidence</span>
                            <span className='rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#596170]'>{(alert.deliveryState || 'pending_review').replaceAll('_', ' ')}</span>
                        </div>
                        <p className='mt-1 text-sm text-[#596170]'>Matched <span className='font-mono'>{alert.matchedTerm.value}</span> from {alert.sourceFamily.replaceAll('_', ' ')} · {alert.artifactType.replaceAll('_', ' ')}</p>
                        <p className='mt-2 line-clamp-2 text-sm leading-6 text-[#3d4656]'>{alert.claimSummary}</p>
                        {alert.workflowNote && <p className='mt-2 text-sm font-semibold text-[#3056d3]'>{alert.workflowNote}</p>}
                    </div>
                    <div className='flex flex-wrap gap-2 md:justify-end'>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'reviewing', 'pending_review', 'Analyst review started.')} icon='review'>Review</ActionButton>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'route_to_customer', 'ready_to_send', 'Ready for customer delivery.')} icon='send'>Ready</ActionButton>
                        <ActionButton busy={busyAlert === alert.id} onClick={() => updateAlert(alert.id, 'false_positive', 'muted', 'Marked false positive.')} icon='false'>False</ActionButton>
                    </div>
                </div>
            ))}
            {message && <p className='text-sm text-[#596170]'>{message}</p>}
        </div>
    )
}

function ActionButton({ busy, onClick, icon, children }: { busy: boolean, onClick: () => void, icon: 'review' | 'send' | 'false', children: string }) {
    const Icon = busy ? Loader2 : icon === 'send' ? Send : icon === 'false' ? XCircle : CheckCircle2
    return (
        <button onClick={onClick} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-xs font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
            <Icon className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
            {children}
        </button>
    )
}

function severityClass(severity: string) {
    if (severity === 'critical') return 'rounded-full bg-[#fff0eb] px-2 py-0.5 text-xs font-semibold text-[#c2410c]'
    if (severity === 'high') return 'rounded-full bg-[#fff7ed] px-2 py-0.5 text-xs font-semibold text-[#b45309]'
    return 'rounded-full bg-[#eef3ff] px-2 py-0.5 text-xs font-semibold text-[#3056d3]'
}
