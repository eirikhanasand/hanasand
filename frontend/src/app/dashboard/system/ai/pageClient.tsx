'use client'

import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Clock3, Coins, Layers3, LineChart, ShieldCheck } from 'lucide-react'
import GPT_Content from '@components/gpt/content'
import GPT_EmptyState from '@components/gpt/emptyState'
import GPT_Header from '@components/gpt/header'
import TestClientPopup from '@components/gpt/testClientPopup'
import useGptPageState from '@components/gpt/useGptPageState'
import { aiClientRequest } from '@/utils/ai/client'
import { type ReactNode, useEffect, useState } from 'react'

type AIEconomics = {
    windowDays: number
    keyMetric: string
    summary: {
        eventCount: number
        tokenUnits: number
        billableUnits: number
        estimatedCostNok: number
        verifiedUnits: number
        verifiedProgressPerNok: number
        platformErrorUnits: number
        browserProofs: number
        buildMinutes: number
        deployMinutes: number
        cacheHits: number
        cacheableEvents: number
        failedPlatformDiscountNok: number
    }
    modes: {
        id: string
        label: string
        priority: number
        concurrency: number
        verification: string
        discountFailedPlatformRuns: boolean
    }[]
    subscriptionTiers: {
        id: string
        label: string
        outcomeAllowance: number
        queuePriority: string
        concurrency: number
    }[]
    trend: {
        bucket: string
        eventCount: number
        tokenUnits: number
        billableUnits: number
        estimatedCostNok: number
        verifiedUnits: number
        platformErrorUnits: number
    }[]
    recentRuns: {
        id: string
        kind: string
        units: number
        billableUnits: number
        estimatedCostNok: number
        billingMode: string
        outcome: string
        metadata: Record<string, unknown>
        createdAt: string
    }[]
}

export default function GPT_Page() {
    const gpt = useGptPageState()
    const [economics, setEconomics] = useState<AIEconomics | null>(null)
    const [economicsError, setEconomicsError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function loadEconomics() {
            try {
                const response = await aiClientRequest('/ai/economics?days=30')
                if (!response.ok) {
                    throw new Error('Unable to load AI economics.')
                }
                const data = await response.json()
                if (!cancelled) {
                    setEconomics(data as AIEconomics)
                    setEconomicsError(null)
                }
            } catch (error) {
                if (!cancelled) {
                    setEconomicsError(error instanceof Error ? error.message : 'Unable to load AI economics.')
                }
            }
        }
        void loadEconomics()
        const interval = window.setInterval(loadEconomics, 30_000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [])

    return (
        <>
            <div className='h-full w-full overflow-y-auto'>
                <div className='mx-auto flex w-full max-w-330 flex-col gap-4 px-4 pb-4 pt-6 sm:px-6 md:px-8 md:pt-8'>
                    <div className='flex items-center justify-between gap-4'>
                        <div>
                            <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>System</p>
                            <h1 className='mt-1 text-2xl font-semibold text-bright/90'>AI</h1>
                        </div>
                        <Link
                            href='/dashboard/system'
                            className='flex items-center gap-2 rounded-md bg-bright/3 px-4 py-2 text-sm text-bright/80 outline outline-dark transition-colors hover:bg-bright/5'
                        >
                            <ArrowLeft className='h-4 w-4' />
                            Back to system
                        </Link>
                    </div>
                    <GPT_Header isConnected={gpt.isConnected} participants={gpt.participants} />
                    <EconomicsPanel economics={economics} error={economicsError} />
                    {gpt.clients.length ? <GPT_Content clients={gpt.clients} onTestClient={gpt.openChat} /> : <GPT_EmptyState />}
                </div>
            </div>
            {gpt.chatSession && gpt.activeClient ? (
                <TestClientPopup
                    client={gpt.activeClient}
                    conversationId={gpt.chatSession.conversationId}
                    isSending={gpt.chatSession.isSending}
                    messages={gpt.chatSession.messages}
                    metrics={gpt.chatSession.metrics}
                    onClose={gpt.closeChat}
                    onSend={gpt.sendPrompt}
                />
            ) : null}
        </>
    )
}

function EconomicsPanel({ economics, error }: { economics: AIEconomics | null, error: string | null }) {
    if (error) {
        return (
            <section className='rounded-xl bg-dark/35 p-4 outline outline-dark'>
                <p className='text-sm text-red-200/80'>{error}</p>
            </section>
        )
    }
    if (!economics) {
        return (
            <section className='rounded-xl bg-dark/35 p-4 outline outline-dark'>
                <p className='text-sm text-bright/50'>Loading pricing and usage economics...</p>
            </section>
        )
    }

    const summary = economics.summary
    const cacheRate = summary.cacheableEvents ? Math.round((summary.cacheHits / summary.cacheableEvents) * 100) : 0

    return (
        <section className='space-y-4 rounded-xl bg-dark/35 p-4 outline outline-dark'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-bright/35'>Pricing and unit economics</p>
                    <h2 className='mt-1 text-xl font-semibold text-bright/90'>Verified outcomes, not raw messages</h2>
                    <p className='mt-2 max-w-3xl text-sm leading-6 text-bright/52'>
                        Key metric: {economics.keyMetric}. Failed platform infrastructure runs stay visible operationally, but are not treated like successful user value.
                    </p>
                </div>
                <span className='w-fit rounded-full bg-[#f07d33]/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[#f07d33] outline outline-[#f07d33]/20'>
                    {economics.windowDays} day window
                </span>
            </div>

            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <EconomicsStat icon={<Coins className='h-4 w-4' />} label='Estimated cost' value={`${formatNok(summary.estimatedCostNok)} NOK`} detail={`${formatCompact(summary.billableUnits)} billable units`} />
                <EconomicsStat icon={<CheckCircle2 className='h-4 w-4' />} label='Verified progress' value={formatCompact(summary.verifiedUnits)} detail={`${summary.verifiedProgressPerNok.toFixed(1)} verified units / NOK`} />
                <EconomicsStat icon={<LineChart className='h-4 w-4' />} label='Token usage' value={formatCompact(summary.tokenUnits)} detail={`${formatCompact(summary.platformErrorUnits)} platform-error units discounted`} />
                <EconomicsStat icon={<Layers3 className='h-4 w-4' />} label='Cached work' value={`${cacheRate}%`} detail={`${summary.cacheHits} cache hits from ${summary.cacheableEvents} cacheable events`} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.35fr_0.9fr]'>
                <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                    <div className='mb-3 flex items-center justify-between'>
                        <h3 className='text-sm font-semibold text-bright/84'>Usage over time</h3>
                        <span className='text-xs text-bright/35'>tokens · cost · verified outcomes</span>
                    </div>
                    <UsageTrendChart trend={economics.trend} />
                </div>
                <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                    <h3 className='text-sm font-semibold text-bright/84'>Cost controls</h3>
                    <div className='mt-3 grid gap-2'>
                        {economics.modes.map((mode) => (
                            <div key={mode.id} className='rounded-lg border border-bright/8 bg-bright/[0.035] p-3'>
                                <div className='flex items-center justify-between gap-3'>
                                    <span className='text-sm font-medium text-bright/82'>{mode.label}</span>
                                    <span className='text-xs text-bright/42'>{mode.concurrency} concurrent</span>
                                </div>
                                <p className='mt-1 text-xs leading-5 text-bright/48'>{mode.verification}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className='grid gap-4 xl:grid-cols-2'>
                <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                    <h3 className='text-sm font-semibold text-bright/84'>Outcome-based tiers</h3>
                    <div className='mt-3 grid gap-2 sm:grid-cols-3'>
                        {economics.subscriptionTiers.map((tier) => (
                            <article key={tier.id} className='rounded-lg border border-bright/8 bg-bright/[0.035] p-3'>
                                <div className='flex items-center gap-2 text-bright/84'>
                                    <ShieldCheck className='h-4 w-4 text-[#f07d33]' />
                                    <h4 className='text-sm font-semibold'>{tier.label}</h4>
                                </div>
                                <p className='mt-2 text-xs leading-5 text-bright/48'>{tier.outcomeAllowance} verified outcomes, {tier.queuePriority} queue, {tier.concurrency} concurrent lane{tier.concurrency === 1 ? '' : 's'}.</p>
                            </article>
                        ))}
                    </div>
                </div>
                <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                    <h3 className='text-sm font-semibold text-bright/84'>Recent run economics</h3>
                    <div className='mt-3 max-h-64 space-y-2 overflow-auto'>
                        {economics.recentRuns.length ? economics.recentRuns.map((run) => (
                            <div key={run.id} className='grid gap-2 rounded-lg border border-bright/8 bg-bright/[0.035] p-3 text-xs text-bright/52 sm:grid-cols-[1fr_auto]'>
                                <div>
                                    <p className='font-medium text-bright/78'>{formatKind(run.kind)} · {run.outcome}</p>
                                    <p className='mt-1'>{formatDate(run.createdAt)} · {formatCompact(run.units)} tokens · {formatCompact(run.billableUnits)} billable</p>
                                </div>
                                <div className='flex items-center gap-2 text-bright/70 sm:justify-end'>
                                    <Clock3 className='h-3.5 w-3.5 text-[#f07d33]' />
                                    {formatNok(run.estimatedCostNok)} NOK
                                </div>
                            </div>
                        )) : <p className='text-sm text-bright/45'>No recorded AI economics yet.</p>}
                    </div>
                </div>
            </div>
        </section>
    )
}

function EconomicsStat({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
            <div className='flex items-center justify-between text-bright/35'>
                <span className='text-xs font-medium uppercase tracking-[0.16em]'>{label}</span>
                <span className='text-[#f07d33]'>{icon}</span>
            </div>
            <div className='mt-3 text-2xl font-semibold text-bright/90'>{value}</div>
            <p className='mt-1 text-xs leading-5 text-bright/45'>{detail}</p>
        </div>
    )
}

function UsageTrendChart({ trend }: { trend: AIEconomics['trend'] }) {
    const rows = trend.length ? trend : [{ bucket: new Date().toISOString(), eventCount: 0, tokenUnits: 0, billableUnits: 0, estimatedCostNok: 0, verifiedUnits: 0, platformErrorUnits: 0 }]
    const maxTokens = Math.max(1, ...rows.map(row => row.tokenUnits))
    const maxCost = Math.max(1, ...rows.map(row => row.estimatedCostNok))
    const maxVerified = Math.max(1, ...rows.map(row => row.verifiedUnits))
    return (
        <div className='space-y-3'>
            <Sparkline rows={rows} max={maxTokens} field='tokenUnits' color='#f07d33' label='Token units' />
            <Sparkline rows={rows} max={maxCost} field='estimatedCostNok' color='#86efac' label='Cost NOK' />
            <Sparkline rows={rows} max={maxVerified} field='verifiedUnits' color='#93c5fd' label='Verified outcomes' />
        </div>
    )
}

function Sparkline({ rows, field, max, color, label }: { rows: AIEconomics['trend'], field: keyof AIEconomics['trend'][number], max: number, color: string, label: string }) {
    const width = 420
    const height = 74
    const numericRows = rows.map((row, index) => ({
        index,
        value: Number(row[field]) || 0,
        bucket: row.bucket,
    }))
    const points = numericRows.map((row) => {
        const x = numericRows.length === 1 ? 0 : (row.index / (numericRows.length - 1)) * width
        const y = height - (row.value / max) * (height - 8) - 4
        return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return (
        <div>
            <div className='mb-1 flex items-center justify-between text-xs text-bright/42'>
                <span>{label}</span>
                <span>{formatCompact(numericRows[numericRows.length - 1]?.value || 0)}</span>
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className='h-16 w-full overflow-visible rounded-md bg-bright/[0.025]' role='img' aria-label={`${label} over time`}>
                <polyline fill='none' stroke={color} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' points={points} />
                {numericRows.map((row) => {
                    const x = numericRows.length === 1 ? 0 : (row.index / (numericRows.length - 1)) * width
                    const y = height - (row.value / max) * (height - 8) - 4
                    return <circle key={`${row.bucket}-${field}`} cx={x} cy={y} r='2.5' fill={color} />
                })}
            </svg>
        </div>
    )
}

function formatNok(value: number) {
    return value.toLocaleString('nb-NO', { maximumFractionDigits: 2 })
}

function formatCompact(value: number) {
    return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatKind(kind: string) {
    return kind.replace(/_/g, ' ')
}

function formatDate(value: string) {
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
