'use client'

import config from '@/config'

export type CommercialContactRequest = {
    name: string
    email: string
    company?: string
    subject: string
    message: string
    intent?: string
    plan?: string
    deliveryPreference?: string
    replyWindow?: string
    securityReview?: boolean
    source?: string
}

export async function submitContactRequest(payload: CommercialContactRequest) {
    const response = await fetch(`${config.url.api}/commercial/contact-requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({})) as { error?: string, ticketId?: string, nextStep?: string }
    if (!response.ok || body.error) throw new Error(body.error || 'Contact intake is temporarily unavailable.')
    return body
}

