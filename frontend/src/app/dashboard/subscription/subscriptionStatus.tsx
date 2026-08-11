'use client'

import { useEffect, useState } from 'react'

type BillingStatus = {
    subscription: {
        planId: string
        status: string
        currentPeriodEnd?: string | null
        cancelAtPeriodEnd?: boolean
    } | null
}

export default function SubscriptionStatus() {
    const [status, setStatus] = useState<BillingStatus | null>(null)
    const [opening, setOpening] = useState(false)

    useEffect(() => {
        fetch('/api/billing/status', { cache: 'no-store' })
            .then(response => response.ok ? response.json() as Promise<BillingStatus> : null)
            .then(setStatus)
            .catch(() => undefined)
    }, [])

    if (!status?.subscription) return null

    async function openPortal() {
        setOpening(true)
        try {
            const response = await fetch('/api/billing/portal', { method: 'POST' })
            const payload = await response.json() as { url?: string }
            if (payload.url) window.location.assign(payload.url)
        } finally {
            setOpening(false)
        }
    }

    const subscription = status.subscription
    return (
        <section className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-panel px-4 py-3' aria-label='Current subscription'>
            <div>
                <p className='text-sm font-semibold text-ui-text'>Current plan: {planLabel(subscription.planId)}</p>
                <p className='text-xs text-ui-muted'>Status: {subscription.status}{subscription.cancelAtPeriodEnd ? ' · Cancels at period end' : ''}</p>
            </div>
            <button type='button' onClick={openPortal} disabled={opening} className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:border-ui-primary disabled:opacity-60'>
                {opening ? 'Opening…' : 'Manage billing'}
            </button>
        </section>
    )
}

function planLabel(value: string) {
    return value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}
