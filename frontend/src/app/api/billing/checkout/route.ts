import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { commercialAccessPlans } from '@/utils/commercialAccess'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import tokenIsValid from '@/utils/proxy/tokenIsValid'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
    const selected = new URL(request.url).searchParams.get('plan')
    const plan = commercialAccessPlans.find(item => item.id === selected)
    if (!plan) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 })

    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://hanasand.com').replace(/\/$/, '')

    const cookieStore = await cookies()
    const token = cookieStore.get('access_token')?.value
    const id = cookieStore.get('id')?.value
    if (!token || !id) return NextResponse.redirect(new URL('/login?next=/subscription', siteUrl))

    const session = await tokenIsValid(token, id)
    if (!session.valid) return NextResponse.redirect(new URL('/login?next=/subscription', siteUrl))

    const billingResponse = await fetch(`${authApiUrl().replace(/\/$/, '')}/billing/subscription`, {
        headers: { Authorization: `Bearer ${token}`, id },
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
    })
    if (!billingResponse.ok) return NextResponse.json({ error: 'Subscription status is temporarily unavailable. Please try again.' }, { status: 503 })
    const billing = await billingResponse.json() as { entitlements?: Array<{ planId?: string }> }
    if (billing.entitlements?.some(entitlement => entitlement.planId === plan.id)) {
        return NextResponse.json({ error: `You already have an active ${plan.name} subscription.` }, { status: 409 })
    }

    const secret = process.env.STRIPE_SECRET_KEY
    if (!secret) return NextResponse.json({ error: 'Checkout is temporarily unavailable. Stripe is not configured.' }, { status: 503 })

    const body = new URLSearchParams({
        mode: 'subscription',
        'line_items[0][price_data][currency]': 'nok',
        'line_items[0][price_data][unit_amount]': String(plan.priceNok * 100),
        'line_items[0][price_data][recurring][interval]': 'month',
        'line_items[0][price_data][product_data][name]': plan.name,
        'line_items[0][price_data][product_data][description]': `${plan.quota}. ${plan.summary}`,
        'line_items[0][quantity]': '1',
        success_url: `${siteUrl}/subscription?checkout=success`,
        cancel_url: `${siteUrl}/subscription?checkout=cancelled`,
        'metadata[user_id]': id,
        'metadata[plan_id]': plan.id,
        'subscription_data[metadata][user_id]': id,
        'subscription_data[metadata][plan_id]': plan.id,
    })
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        cache: 'no-store',
    })
    const payload = await response.json() as { url?: string; error?: { message?: string } }
    if (!response.ok || !payload.url) return NextResponse.json({ error: payload.error?.message || 'Stripe checkout could not be created.' }, { status: 502 })
    return NextResponse.redirect(payload.url)
}
