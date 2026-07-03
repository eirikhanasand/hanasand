import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

type ContactPayload = {
    name?: unknown
    email?: unknown
    company?: unknown
    subject?: unknown
    message?: unknown
    intent?: unknown
    plan?: unknown
}

const CONTACT_FORWARD_URL = process.env.CONTACT_FORWARD_URL || process.env.CONTACT_WEBHOOK_URL || ''
const CONTACT_TIMEOUT_MS = Number(process.env.CONTACT_TIMEOUT_MS || 8_000)

export async function POST(request: NextRequest) {
    const payload = await request.json().catch(() => null) as ContactPayload | null
    const name = text(payload?.name)
    const email = text(payload?.email)
    const company = text(payload?.company)
    const subject = text(payload?.subject)
    const message = text(payload?.message)
    const intent = text(payload?.intent)
    const plan = text(payload?.plan)

    if (!name || !email || !subject || !message) {
        return NextResponse.json({ error: 'Name, email, subject, and message are required.' }, { status: 400 })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Use a valid email address.' }, { status: 400 })
    }

    if (message.length < 20) {
        return NextResponse.json({ error: 'Message must be at least 20 characters.' }, { status: 400 })
    }

    const ticketId = `HS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`
    const receivedAt = new Date().toISOString()
    const record = {
        schemaVersion: 'hanasand.contact_request.v1',
        ticketId,
        receivedAt,
        name,
        email,
        company: company || null,
        subject,
        message,
        intent: intent || null,
        plan: plan || null,
        source: request.headers.get('referer') || '/contact',
    }

    let delivery: 'forwarded' | 'server-log' = 'server-log'
    if (CONTACT_FORWARD_URL) {
        const response = await fetch(CONTACT_FORWARD_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record),
            signal: AbortSignal.timeout(CONTACT_TIMEOUT_MS),
        }).catch(() => null)

        if (!response?.ok) {
            return NextResponse.json({ error: 'Contact intake is temporarily unavailable. Email eirik@hanasand.com and include this request text.' }, { status: 503 })
        }
        delivery = 'forwarded'
    } else {
        console.info('Hanasand contact request received', {
            ticketId,
            email,
            company: company || undefined,
            subject,
            intent: intent || undefined,
            plan: plan || undefined,
        })
    }

    return NextResponse.json({
        accepted: true,
        ticketId,
        delivery,
        receivedAt,
        nextStep: 'We received the request. Expect a reply by email with coverage fit, setup steps, or support follow-up.',
    }, {
        status: 202,
        headers: { 'cache-control': 'no-store' },
    })
}

function text(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
