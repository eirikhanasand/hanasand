import { NextRequest, NextResponse } from 'next/server'
import config from '@/config'

export const dynamic = 'force-dynamic'

const FALLBACK_MESSAGE = 'I can help with account access, pricing, webhooks, API questions, and finding the right Hanasand page. For anything sensitive, use the contact form so we can reply directly.'

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({})) as { message?: string, page?: string }
    const message = cleanText(body.message, 800)
    const page = cleanText(body.page, 160)
    if (!message) return NextResponse.json({ error: 'Missing message.' }, { status: 400 })

    try {
        const response = await fetch(`${config.url.api}/tools/ai`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            cache: 'no-store',
            body: JSON.stringify({
                prompt: message,
                context: [
                    'You are the small Hanasand public support assistant.',
                    'Answer in 1-4 short sentences.',
                    'Help with support, contact, billing, webhooks, API access, account access, legal pages, and finding the right public Hanasand page.',
                    'Do not give legal, medical, financial, or security incident advice beyond directing the user to contact support.',
                    'Do not claim to inspect private accounts or live customer data.',
                    'Useful routes: /support, /contact, /faq, /pricing, /developers, /trust, /status, /dwm, /browser, /ti.',
                    page ? `Current page: ${page}.` : '',
                ].filter(Boolean).join(' '),
                maxTokens: 220,
                billingMode: 'draft',
            }),
            signal: AbortSignal.timeout(18_000),
        })
        const payload = await response.json().catch(() => ({})) as { message?: string, error?: string }
        if (!response.ok) throw new Error(payload.error || response.statusText)
        return NextResponse.json({ message: cleanText(payload.message, 1200) || FALLBACK_MESSAGE })
    } catch {
        return NextResponse.json({ message: FALLBACK_MESSAGE, fallback: true })
    }
}

function cleanText(value: unknown, limit: number) {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : ''
}
