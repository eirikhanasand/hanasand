'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { BellRing, Loader2, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react'

type WorkflowResult = {
    ok: boolean
    message: string
}

export function DwmWorkflowActions({ initialTerms }: { initialTerms: string[] }) {
    const router = useRouter()
    const [terms, setTerms] = useState(initialTerms.join('\n'))
    const [webhookUrl, setWebhookUrl] = useState('')
    const [sourceTarget, setSourceTarget] = useState('')
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [result, setResult] = useState<WorkflowResult | null>(null)

    async function saveWatchlist(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('watchlist')
        setResult(null)

        try {
            const create = await postJson('/api/dwm/watchlists', {
                tenantId: 'default',
                name: 'Default company exposure watchlist',
                terms,
                webhookUrl: webhookUrl.trim() || undefined,
            })
            if (!create.ok) throw new Error(create.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', { tenantId: 'default' })
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({
                ok: rebuild.ok,
                message: rebuild.ok ? `Watchlist saved. Rebuilt ${savedAlertCount} alerts.` : rebuild.message,
            })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function submitSource(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusyAction('source')
        setResult(null)

        try {
            const source = await postJson('/api/dwm/source-requests', {
                tenantId: 'default',
                target: sourceTarget,
                type: 'telegram_channel',
                priority: 'high',
                scope: terms,
                activate: true,
            })
            if (!source.ok) throw new Error(source.message)
            const duplicateOf = typeof source.duplicateOf === 'string' ? source.duplicateOf : ''
            setResult({ ok: true, message: duplicateOf ? `Already registered as ${duplicateOf}.` : 'Telegram source submitted for bounded public polling.' })
            setSourceTarget('')
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function runCollection() {
        setBusyAction('collection')
        setResult(null)

        try {
            const run = await postJson('/api/dwm/canary/run', {
                operatorApproval: true,
                approvedBy: 'dashboard',
                maxSources: 12,
                maxTasks: 24,
            })
            if (!run.ok) throw new Error(run.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', { tenantId: 'default' })
            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({ ok: true, message: `Collected ${captureCount} Telegram captures. Rebuilt ${savedAlertCount} alerts.` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function expandTelegramCoverage() {
        setBusyAction('telegram-pack')
        setResult(null)

        try {
            const applied = await postJson('/api/dwm/source-requests', {
                tenantId: 'default',
                seedPackIds: ['telegram-ransomware-claim-watch', 'telegram-stealer-broker-watch', 'telegram-regional-language-watch'],
                activate: true,
                limit: 60,
                scope: terms,
            })
            if (!applied.ok) throw new Error(applied.message)

            const run = await postJson('/api/dwm/canary/run', {
                operatorApproval: true,
                approvedBy: 'dashboard',
                maxSources: 48,
                maxTasks: 96,
            })
            if (!run.ok) throw new Error(run.message)

            const rebuild = await postJson('/api/dwm/alerts/rebuild', { tenantId: 'default' })
            const summary = applied.summary && typeof applied.summary === 'object' ? applied.summary as Record<string, unknown> : {}
            const createdCount = typeof summary.telegramPublicCreated === 'number' ? summary.telegramPublicCreated : 0
            const duplicateCount = typeof summary.duplicateCount === 'number' ? summary.duplicateCount : 0
            const captureCount = readNumber(run.canaryRun, 'insertedCaptureCount')
            const savedAlertCount = typeof rebuild.savedAlertCount === 'number' ? rebuild.savedAlertCount : 0
            setResult({ ok: true, message: `Added ${createdCount} Telegram canary source(s), skipped ${duplicateCount} duplicate(s), collected ${captureCount} capture(s), rebuilt ${savedAlertCount} alert(s).` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function approveDarkwebMetadata() {
        setBusyAction('darkweb')
        setResult(null)

        try {
            const approved = await postJson('/api/dwm/darkweb/approve-metadata', {
                tenantId: 'default',
                seedPackIds: ['darkweb-actor-metadata-core', 'darkweb-market-metadata-watch'],
                activate: true,
                approveMetadataOnly: true,
                approvedBy: 'dashboard',
                limit: 68,
                scope: terms,
            })
            if (!approved.ok) throw new Error(approved.message)
            const summary = approved.summary && typeof approved.summary === 'object' ? approved.summary as Record<string, unknown> : {}
            const count = typeof summary.darkwebMetadataCreated === 'number' ? summary.darkwebMetadataCreated : 0
            setResult({ ok: true, message: `Approved ${count} dark-web metadata source(s). No payload downloads enabled.` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    async function deliverWebhooks() {
        setBusyAction('delivery')
        setResult(null)

        try {
            const delivery = await postJson('/api/dwm/webhooks/deliver', {
                tenantId: 'default',
                limit: 25,
            })
            if (!delivery.ok) throw new Error(delivery.message)
            const attemptedCount = typeof delivery.attemptedCount === 'number' ? delivery.attemptedCount : 0
            setResult({ ok: true, message: `Webhook delivery attempted for ${attemptedCount} alert(s).` })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className='grid gap-4 xl:grid-cols-[1.05fr_0.95fr]'>
            <form onSubmit={saveWatchlist} className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
                <div className='flex items-start justify-between gap-3'>
                    <div>
                        <h2 className='text-base font-semibold text-[#171a21]'>Customer watchlist</h2>
                        <p className='mt-1 text-sm leading-6 text-[#596170]'>Company names, domains, vendors, brands, VIPs, and products to match against collected evidence.</p>
                    </div>
                    <BellRing className='h-5 w-5 text-[#3056d3]' />
                </div>
                <textarea
                    value={terms}
                    onChange={event => setTerms(event.target.value)}
                    placeholder={'acme.com\nAcme Payments\nNorthwind Supplier'}
                    className='mt-4 min-h-36 w-full resize-y rounded-lg border border-[#d8dee9] bg-[#fbfcfe] px-3 py-2 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                />
                <input
                    value={webhookUrl}
                    onChange={event => setWebhookUrl(event.target.value)}
                    placeholder='Webhook URL, optional'
                    className='mt-3 h-10 w-full rounded-lg border border-[#d8dee9] bg-[#fbfcfe] px-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                />
                <button disabled={busyAction !== null} className='mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:opacity-60'>
                    {busyAction === 'watchlist' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                    Save and rebuild alerts
                </button>
                <button type='button' onClick={runCollection} disabled={busyAction !== null} className='ml-2 mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
                    {busyAction === 'collection' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                    Run Telegram collection
                </button>
                <button type='button' onClick={expandTelegramCoverage} disabled={busyAction !== null} className='ml-2 mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
                    {busyAction === 'telegram-pack' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                    Expand Telegram coverage
                </button>
                <button type='button' onClick={approveDarkwebMetadata} disabled={busyAction !== null} className='ml-2 mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
                    {busyAction === 'darkweb' ? <Loader2 className='h-4 w-4 animate-spin' /> : <ShieldCheck className='h-4 w-4' />}
                    Expand dark-web metadata
                </button>
                <button type='button' onClick={deliverWebhooks} disabled={busyAction !== null} className='ml-2 mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
                    {busyAction === 'delivery' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                    Send webhooks
                </button>
            </form>

            <form onSubmit={submitSource} className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
                <div className='flex items-start justify-between gap-3'>
                    <div>
                        <h2 className='text-base font-semibold text-[#171a21]'>Telegram source request</h2>
                        <p className='mt-1 text-sm leading-6 text-[#596170]'>Add a public @handle or t.me URL. Private invites are blocked.</p>
                    </div>
                    <Plus className='h-5 w-5 text-[#3056d3]' />
                </div>
                <input
                    value={sourceTarget}
                    onChange={event => setSourceTarget(event.target.value)}
                    placeholder='@breach_drop_house or https://t.me/channel'
                    className='mt-4 h-10 w-full rounded-lg border border-[#d8dee9] bg-[#fbfcfe] px-3 text-sm text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-2 focus:ring-[#dbe5ff]'
                />
                <button disabled={busyAction !== null || !sourceTarget.trim()} className='mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#3056d3] px-4 text-sm font-semibold text-white transition hover:bg-[#2446b6] disabled:cursor-not-allowed disabled:opacity-60'>
                    {busyAction === 'source' ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
                    Submit source
                </button>
                {result && (
                    <p className={`mt-4 rounded-lg border px-3 py-2 text-sm ${result.ok ? 'border-[#d6e9de] bg-[#f4fbf7] text-[#147a3b]' : 'border-[#fde2d6] bg-[#fff7f3] text-[#9a3412]'}`}>
                        {result.message}
                    </p>
                )}
            </form>
        </div>
    )
}

async function postJson(path: string, body: Record<string, unknown>): Promise<Record<string, unknown> & { ok: boolean, message: string }> {
    const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    })
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const error = payload.error as { message?: string } | undefined
    return {
        ...payload,
        ok: response.ok,
        message: error?.message || response.statusText,
    }
}

function readNumber(value: unknown, key: string) {
    if (!value || typeof value !== 'object') return 0
    const candidate = (value as Record<string, unknown>)[key]
    return typeof candidate === 'number' ? candidate : 0
}
