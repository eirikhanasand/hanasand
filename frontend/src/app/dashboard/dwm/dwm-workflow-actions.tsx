'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { Activity, BellRing, Loader2, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react'

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

    async function testWebhook() {
        setBusyAction('webhook-test')
        setResult(null)

        try {
            const test = await postJson('/api/dwm/webhooks/test', {
                tenantId: 'default',
                webhookUrl: webhookUrl.trim() || undefined,
            })
            if (!test.ok) throw new Error(test.message)
            setResult({ ok: true, message: 'Webhook test delivered. Future alerts can use this route.' })
            router.refresh()
        } catch (error) {
            setResult({ ok: false, message: error instanceof Error ? error.message : String(error) })
        } finally {
            setBusyAction(null)
        }
    }

    const termCount = countTerms(terms)
    const webhookConfigured = /^https?:\/\//i.test(webhookUrl.trim())
    const sourceReady = sourceTarget.trim().length > 0

    return (
        <div className='grid gap-4'>
            <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
                <RouteStateCard label='Watch terms' value={String(termCount)} detail={termCount ? 'ready for matching' : 'add terms'} tone={termCount ? 'ok' : 'warn'} />
                <RouteStateCard label='Webhook route' value={webhookConfigured ? 'configured' : 'not set'} detail={webhookConfigured ? 'test before send' : 'optional but needed for delivery'} tone={webhookConfigured ? 'ok' : 'warn'} />
                <RouteStateCard label='Source target' value={sourceReady ? 'queued input' : 'empty'} detail={sourceReady ? sourceTarget.trim() : 'add public channel'} tone={sourceReady ? 'ok' : 'neutral'} />
                <RouteStateCard label='Last action' value={result ? result.ok ? 'ok' : 'blocked' : 'idle'} detail={result?.message || 'no action run'} tone={result ? result.ok ? 'ok' : 'bad' : 'neutral'} />
            </section>

            <div className='grid gap-4 xl:grid-cols-[1.05fr_0.95fr]'>
                <form onSubmit={saveWatchlist} className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
                    <div className='flex items-start justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-[#171a21]'>Customer watchlist</h2>
                            <p className='mt-1 text-sm leading-6 text-[#596170]'>Terms matched against collected evidence before an alert can enter review or delivery.</p>
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
                    <div className='mt-3 flex flex-wrap gap-2'>
                        <button disabled={busyAction !== null} className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:opacity-60'>
                            {busyAction === 'watchlist' ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                            Save and rebuild alerts
                        </button>
                        <WorkflowButton busy={busyAction === 'collection'} disabled={busyAction !== null} icon={<RefreshCw className='h-4 w-4' />} onClick={runCollection}>Run Telegram collection</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'telegram-pack'} disabled={busyAction !== null} icon={<Plus className='h-4 w-4' />} onClick={expandTelegramCoverage}>Expand Telegram</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'darkweb'} disabled={busyAction !== null} icon={<ShieldCheck className='h-4 w-4' />} onClick={approveDarkwebMetadata}>Approve metadata</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'delivery'} disabled={busyAction !== null} icon={<Send className='h-4 w-4' />} onClick={deliverWebhooks}>Send webhooks</WorkflowButton>
                        <WorkflowButton busy={busyAction === 'webhook-test'} disabled={busyAction !== null} icon={<Send className='h-4 w-4' />} onClick={testWebhook}>Test webhook</WorkflowButton>
                    </div>
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
        </div>
    )
}

function RouteStateCard({ label, value, detail, tone }: { label: string, value: string, detail: string, tone: 'ok' | 'warn' | 'bad' | 'neutral' }) {
    const toneClass = tone === 'ok'
        ? 'text-[#147a3b]'
        : tone === 'warn'
            ? 'text-[#b45309]'
            : tone === 'bad'
                ? 'text-[#9a3412]'
                : 'text-[#3056d3]'
    return (
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-4'>
            <div className='flex items-center justify-between gap-3 text-[#667085]'>
                <p className='text-xs font-semibold uppercase'>{label}</p>
                <Activity className='h-4 w-4' />
            </div>
            <p className={`mt-2 truncate text-lg font-semibold ${toneClass}`}>{value}</p>
            <p className='mt-1 line-clamp-2 text-xs leading-5 text-[#667085]'>{detail}</p>
        </div>
    )
}

function WorkflowButton({ busy, disabled, icon, onClick, children }: { busy: boolean, disabled: boolean, icon: React.ReactNode, onClick: () => void, children: string }) {
    return (
        <button type='button' onClick={onClick} disabled={disabled} className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-4 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9] disabled:cursor-not-allowed disabled:opacity-60'>
            {busy ? <Loader2 className='h-4 w-4 animate-spin' /> : icon}
            {children}
        </button>
    )
}

function countTerms(value: string) {
    return value.split(/[\n,]/).map(term => term.trim()).filter(Boolean).length
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
