'use client'

import Link from 'next/link'
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Coins, Layers3, LineChart, Server, ShieldCheck, Timer, Zap } from 'lucide-react'
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
        verifiedProgressPerMinutePerNok: number
        productiveMinutes: number
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
        fit?: string
        features?: string[]
    }[]
    reliability: {
        incidentStatus: {
            state: string
            label: string
            message: string
        }
        queueDepth: {
            lane: string
            model: string
            kind: string
            status: string
            count: number
        }[]
        verificationLatency: {
            kind: string
            p50Ms: number
            p95Ms: number
            sampleCount: number
        }[]
        buildDeploy: {
            kind: string
            completed: number
            failed: number
            cancelled: number
            total: number
            successRate: number
        }[]
        failedProofCategories: {
            category: string
            kind: string
            count: number
        }[]
        gpuLanes: {
            clientName: string
            lane: string
            model: string
            status: string
            tier: string
            activeSessions: number
            queuedSessions: number
            maxSessions: number
            availableSessions: number
            contextMaxTokens: number
            memoryUsedMb: number
            memoryTotalMb: number
            gpuLoad: number
            powerWatts: number
            powerLimitWatts: number
            temperatureC: number
        }[]
        costPerSuccessfulVerifiedBuildNok: number
        promptTiming: {
            p50FirstUsefulOutputMs: number
            p95FirstUsefulOutputMs: number
            sampleCount: number
        }
        deployTiming: {
            p50PromptToVerifiedDeployMs: number
            p95PromptToVerifiedDeployMs: number
            sampleCount: number
        }
        capacity: {
            totalQueued: number
            totalActiveSessions: number
            totalAvailableSessions: number
        }
    }
    commercialReadiness: {
        overallState: string
        conclusion: string
        achievedCount: number
        partialCount: number
        internalActionCount: number
        measurableCount: number
        totalCount: number
        items: {
            id: string
            priority: number
            label: string
            status: 'operational' | 'evidence_gap' | 'internal_action'
            evidence: string[]
            action: string
            owner: string
            control: string
            lastAttempt: string
            measurable: boolean
        }[]
    }
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
                            <p className='text-xs uppercase tracking-[0.22em] text-bright/35'>Model operations</p>
                            <h1 className='mt-1 text-2xl font-semibold text-bright/90'>AI worker console</h1>
                            <p className='mt-1 text-sm text-bright/48'>Live sessions, GPU lanes, verification jobs, and spend pressure.</p>
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
                    <div id='ai-clients' data-ai-clients>
                        {gpt.clients.length ? <GPT_Content clients={gpt.clients} onTestClient={gpt.openChat} /> : <GPT_EmptyState />}
                    </div>
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
                <p className='text-sm text-bright/50'>Connecting AI worker telemetry...</p>
            </section>
        )
    }

    const summary = economics.summary
    const cacheRate = summary.cacheableEvents ? Math.round((summary.cacheHits / summary.cacheableEvents) * 100) : 0
    const hasIncident = economics.reliability.incidentStatus.state !== 'operational'
    const hasOperatorActions = economics.commercialReadiness.internalActionCount > 0
    const hasQueue = economics.reliability.capacity.totalQueued > 0
    const primaryHref = hasIncident || hasQueue
        ? '#ai-reliability'
        : hasOperatorActions
            ? '#ai-operations'
            : '#ai-clients'
    const primaryTitle = hasIncident
        ? 'Review worker reliability first'
        : hasQueue
            ? 'Clear queued worker jobs'
            : hasOperatorActions
                ? 'Review operator actions'
                : 'Open live worker clients'
    const primaryDetail = hasIncident
        ? economics.reliability.incidentStatus.message
        : hasQueue
            ? `${economics.reliability.capacity.totalQueued} queued jobs with ${economics.reliability.capacity.totalAvailableSessions} open worker sessions.`
            : hasOperatorActions
                ? `${economics.commercialReadiness.internalActionCount} autonomous lane action${economics.commercialReadiness.internalActionCount === 1 ? '' : 's'} need operator review.`
                : `${economics.reliability.capacity.totalAvailableSessions} worker sessions are available; live clients are ready for inspection.`
    const primaryActionLabel = hasIncident || hasQueue
        ? 'Review reliability'
        : hasOperatorActions
            ? 'Review lanes'
            : 'Open clients'

    return (
        <section className='space-y-4 rounded-xl bg-dark/35 p-4 outline outline-dark'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-bright/35'>Worker output</p>
                    <h2 className='mt-1 text-xl font-semibold text-bright/90'>Verified work, live capacity, and spend</h2>
                    <p className='mt-2 max-w-3xl text-sm leading-6 text-bright/52'>
                        Primary signal: {operationsCopy(economics.keyMetric)}. Failed platform runs stay visible for operators without being counted as user value.
                    </p>
                </div>
                <span className='w-fit rounded-full bg-[#f07d33]/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[#f07d33] outline outline-[#f07d33]/20'>
                    {economics.windowDays} day window
                </span>
            </div>

            <div className='grid gap-3 rounded-lg border border-bright/8 bg-black/18 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center' data-ai-primary-triage>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-bright/42'>
                        <span className='rounded-md border border-bright/8 bg-bright/[0.035] px-2 py-1'>Recommended next</span>
                        <span className='rounded-md border border-bright/8 bg-bright/[0.035] px-2 py-1'>{economics.reliability.capacity.totalAvailableSessions} open sessions</span>
                        <span className='rounded-md border border-bright/8 bg-bright/[0.035] px-2 py-1'>{economics.reliability.capacity.totalQueued} queued</span>
                    </div>
                    <h3 className='mt-3 text-lg font-semibold text-bright/90'>{primaryTitle}</h3>
                    <p className='mt-1 max-w-3xl text-sm leading-6 text-bright/52'>{primaryDetail}</p>
                </div>
                <a
                    href={primaryHref}
                    className='inline-flex min-h-10 w-full items-center justify-center rounded-md bg-[#f07d33] px-4 text-sm font-semibold text-black shadow-sm transition hover:bg-[#ff9857] focus:outline-none focus:ring-2 focus:ring-[#f07d33]/40 sm:w-auto'
                    data-ai-primary-action
                >
                    {primaryActionLabel}
                </a>
            </div>

            <details className='overflow-hidden rounded-lg border border-bright/8 bg-black/18' data-ai-economics-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-bright/84 transition hover:bg-bright/[0.035] sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Spend and output counters</span>
                    <span className='text-xs font-medium text-bright/35'>{formatNok(summary.estimatedCostNok)} NOK, {formatCompact(summary.verifiedUnits)} verified units, {cacheRate}% cached</span>
                </summary>
                <div className='grid gap-3 border-t border-bright/8 p-3 md:grid-cols-2 xl:grid-cols-4' data-ai-economics-metrics>
                    <EconomicsStat icon={<Coins className='h-4 w-4' />} label='Spend' value={`${formatNok(summary.estimatedCostNok)} NOK`} detail={`${formatCompact(summary.billableUnits)} billable work units`} />
                    <EconomicsStat icon={<CheckCircle2 className='h-4 w-4' />} label='Verified output' value={formatMetric(summary.verifiedProgressPerMinutePerNok)} detail={`${formatCompact(summary.verifiedUnits)} verified units over ${formatDuration(summary.productiveMinutes * 60_000)} productive time`} />
                    <EconomicsStat icon={<LineChart className='h-4 w-4' />} label='Token flow' value={formatCompact(summary.tokenUnits)} detail={`${formatCompact(summary.platformErrorUnits)} platform-error units excluded from value`} />
                    <EconomicsStat icon={<Layers3 className='h-4 w-4' />} label='Cached work' value={`${cacheRate}%`} detail={`${summary.cacheHits} cache hits from ${summary.cacheableEvents} cacheable events`} />
                </div>
            </details>

            <ReliabilityPanel reliability={economics.reliability} />
            <OperationsPanel readiness={economics.commercialReadiness} />

            <details className='overflow-hidden rounded-lg border border-bright/8 bg-black/18' data-ai-history-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-bright/84 transition hover:bg-bright/[0.035] sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Trends, lane configuration, and recent runs</span>
                    <span className='text-xs font-medium text-bright/35'>{economics.trend.length} trend buckets, {economics.modes.length} modes, {economics.recentRuns.length} recent runs</span>
                </summary>
                <div className='grid gap-4 border-t border-bright/8 p-3' data-ai-history-panels>
                    <div className='grid gap-4 xl:grid-cols-[1.35fr_0.9fr]'>
                        <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                            <div className='mb-3 flex items-center justify-between'>
                                <h3 className='text-sm font-semibold text-bright/84'>Worker output over time</h3>
                                <span className='text-xs text-bright/35'>tokens · spend · verified outcomes</span>
                            </div>
                            <UsageTrendChart trend={economics.trend} />
                        </div>
                        <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                            <h3 className='text-sm font-semibold text-bright/84'>Lane controls</h3>
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
                            <h3 className='text-sm font-semibold text-bright/84'>Customer lanes</h3>
                            <div className='mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5'>
                                {economics.subscriptionTiers.map((tier) => (
                                    <article key={tier.id} className='rounded-lg border border-bright/8 bg-bright/[0.035] p-3'>
                                        <div className='flex items-center gap-2 text-bright/84'>
                                            <ShieldCheck className='h-4 w-4 text-[#f07d33]' />
                                            <h4 className='text-sm font-semibold'>{tier.label}</h4>
                                        </div>
                                        {tier.fit ? <p className='mt-2 text-xs font-medium text-bright/62'>{tier.fit}</p> : null}
                                        <p className='mt-1 text-xs leading-5 text-bright/48'>{tier.outcomeAllowance} verified outcomes, {tier.queuePriority} queue, {tier.concurrency} concurrent job{tier.concurrency === 1 ? '' : 's'}.</p>
                                        {tier.features?.length ? (
                                            <div className='mt-2 flex flex-wrap gap-1'>
                                                {tier.features.map((feature) => (
                                                    <span key={feature} className='rounded-full border border-bright/8 px-2 py-0.5 text-[10px] text-bright/48'>
                                                        {feature}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        </div>
                        <div className='rounded-lg border border-bright/8 bg-black/18 p-4'>
                            <h3 className='text-sm font-semibold text-bright/84'>Recent worker runs</h3>
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
                                )) : <p className='text-sm text-bright/45'>Worker telemetry updates as verified jobs finish.</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </details>
        </section>
    )
}

function ReliabilityPanel({ reliability }: { reliability: AIEconomics['reliability'] }) {
    const incidentTone = incidentToneClass(reliability.incidentStatus.state)
    const queuedRows = reliability.queueDepth.filter((row) => row.status === 'queued' || row.status === 'running')
    const buildRate = reliability.buildDeploy.find((row) => row.kind === 'build')
    const deployRate = reliability.buildDeploy.find((row) => row.kind === 'deploy')

    return (
        <div className='rounded-lg border border-bright/8 bg-black/18 p-4' id='ai-reliability' data-ai-reliability>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-bright/35'>Reliability and observability</p>
                    <h3 className='mt-1 text-lg font-semibold text-bright/90'>Can users get work done right now?</h3>
                </div>
                <div className={`rounded-lg px-3 py-2 outline ${incidentTone}`}>
                    <div className='flex items-center gap-2 text-sm font-semibold'>
                        {reliability.incidentStatus.state === 'operational' ? <CheckCircle2 className='h-4 w-4' /> : <AlertTriangle className='h-4 w-4' />}
                        {reliability.incidentStatus.label}
                    </div>
                    <p className='mt-1 max-w-xl text-xs leading-5 opacity-80'>{reliability.incidentStatus.message}</p>
                </div>
            </div>

            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <EconomicsStat icon={<Activity className='h-4 w-4' />} label='Queue capacity' value={`${reliability.capacity.totalAvailableSessions} open`} detail={`${reliability.capacity.totalActiveSessions} active, ${reliability.capacity.totalQueued} queued across workers`} />
                <EconomicsStat icon={<Timer className='h-4 w-4' />} label='First output' value={formatDuration(reliability.promptTiming.p50FirstUsefulOutputMs)} detail={`p95 ${formatDuration(reliability.promptTiming.p95FirstUsefulOutputMs)} · ${reliability.promptTiming.sampleCount} runs`} />
                <EconomicsStat icon={<CheckCircle2 className='h-4 w-4' />} label='Verified deploy' value={formatDuration(reliability.deployTiming.p50PromptToVerifiedDeployMs)} detail={`p95 ${formatDuration(reliability.deployTiming.p95PromptToVerifiedDeployMs)} · ${reliability.deployTiming.sampleCount} deploys`} />
                <EconomicsStat icon={<Coins className='h-4 w-4' />} label='Cost / verified build' value={`${formatNok(reliability.costPerSuccessfulVerifiedBuildNok)} NOK`} detail='Cost per successful build or deploy run' />
            </div>

            <div className='mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]'>
                <div className='grid gap-4'>
                    <div className='rounded-lg border border-bright/8 bg-bright/[0.025] p-4'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-sm font-semibold text-bright/84'>Verification latency</h4>
                            <span className='text-xs text-bright/35'>p50 / p95</span>
                        </div>
                        <div className='mt-3 grid gap-2'>
                            {reliability.verificationLatency.length ? reliability.verificationLatency.map((row) => (
                                <div key={row.kind} className='flex items-center justify-between gap-3 rounded-md border border-bright/8 bg-black/18 px-3 py-2 text-sm'>
                                    <span className='capitalize text-bright/76'>{row.kind}</span>
                                    <span className='text-bright/48'>{formatDuration(row.p50Ms)} / {formatDuration(row.p95Ms)} · {row.sampleCount}</span>
                                </div>
                            )) : <p className='text-sm text-bright/45'>Verification jobs are metering; p50/p95 rows update from completed runs.</p>}
                        </div>
                    </div>

                    <div className='rounded-lg border border-bright/8 bg-bright/[0.025] p-4'>
                        <h4 className='text-sm font-semibold text-bright/84'>Build and deploy success</h4>
                        <div className='mt-3 grid gap-3'>
                            <SuccessRate row={buildRate} fallback='build' />
                            <SuccessRate row={deployRate} fallback='deploy' />
                        </div>
                    </div>

                    <div className='rounded-lg border border-bright/8 bg-bright/[0.025] p-4'>
                        <h4 className='text-sm font-semibold text-bright/84'>Failed verification categories</h4>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {reliability.failedProofCategories.length ? reliability.failedProofCategories.map((row) => (
                                <span key={`${row.kind}-${row.category}`} className='rounded-full border border-red-300/15 bg-red-400/8 px-2.5 py-1 text-xs text-red-100/72'>
                                    {formatKind(row.category)} · {row.kind} · {row.count}
                                </span>
                            )) : <span className='rounded-full border border-emerald-300/15 bg-emerald-400/8 px-2.5 py-1 text-xs text-emerald-100/72'>No verification failures in this window</span>}
                        </div>
                    </div>
                </div>

                <div className='grid gap-4'>
                    <div className='rounded-lg border border-bright/8 bg-bright/[0.025] p-4'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-sm font-semibold text-bright/84'>Queue depth by worker/model</h4>
                            <span className='text-xs text-bright/35'>{queuedRows.length} active buckets</span>
                        </div>
                        <div className='mt-3 max-h-52 space-y-2 overflow-auto'>
                            {queuedRows.length ? queuedRows.map((row) => (
                                <div key={`${row.lane}-${row.kind}-${row.status}`} className='grid grid-cols-[1fr_auto] gap-3 rounded-md border border-bright/8 bg-black/18 px-3 py-2 text-xs'>
                                    <div>
                                        <p className='font-medium text-bright/78'>{row.lane} · {row.model}</p>
                                        <p className='mt-1 text-bright/42'>{row.kind} · {row.status}</p>
                                    </div>
                                    <span className='self-center text-sm font-semibold text-bright/82'>{row.count}</span>
                                </div>
                            )) : <p className='text-sm text-bright/45'>Verification queue is clear; active and queued runs stream here.</p>}
                        </div>
                    </div>

                    <div className='rounded-lg border border-bright/8 bg-bright/[0.025] p-4'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-sm font-semibold text-bright/84'>GPU worker health</h4>
                            <span className='text-xs text-bright/35'>{reliability.gpuLanes.length} workers</span>
                        </div>
                        <div className='mt-3 grid gap-2 md:grid-cols-2'>
                            {reliability.gpuLanes.length ? reliability.gpuLanes.map((lane) => (
                                <article key={`${lane.clientName}-${lane.lane}`} className='rounded-lg border border-bright/8 bg-black/18 p-3'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div>
                                            <p className='text-sm font-semibold text-bright/84'>{lane.lane}</p>
                                            <p className='mt-1 text-xs text-bright/42'>{lane.model} · {lane.tier}</p>
                                        </div>
                                        <span className='rounded-full border border-bright/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-bright/48'>{lane.status}</span>
                                    </div>
                                    <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-bright/52'>
                                        <LaneMetric icon={<Server className='h-3.5 w-3.5' />} value={`${lane.availableSessions}/${lane.maxSessions}`} label='available' />
                                        <LaneMetric icon={<Activity className='h-3.5 w-3.5' />} value={`${Math.round(lane.gpuLoad)}%`} label='load' />
                                        <LaneMetric icon={<Zap className='h-3.5 w-3.5' />} value={`${Math.round(lane.powerWatts)} W`} label='power' />
                                        <LaneMetric icon={<Timer className='h-3.5 w-3.5' />} value={formatCompact(lane.contextMaxTokens)} label='context' />
                                    </div>
                                </article>
                            )) : <p className='text-sm text-bright/45'>GPU telemetry updates with load, power, and session capacity for connected model workers.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function OperationsPanel({ readiness }: { readiness: AIEconomics['commercialReadiness'] }) {
    const tone = readiness.overallState === 'commercially_ready'
        ? 'bg-emerald-400/8 text-emerald-100/80 outline-emerald-300/15'
        : readiness.overallState === 'evidence_gaps'
            ? 'bg-sky-400/8 text-sky-100/80 outline-sky-300/15'
            : 'bg-amber-400/8 text-amber-100/80 outline-amber-300/15'

    return (
        <div className='rounded-lg border border-bright/8 bg-black/18 p-4' id='ai-operations' data-ai-operations>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-bright/35'>Worker operations</p>
                    <h3 className='mt-1 text-lg font-semibold text-bright/90'>Autonomous job lanes</h3>
                    <p className='mt-2 max-w-3xl text-sm leading-6 text-bright/52'>{operationsConclusion(readiness.conclusion)}</p>
                </div>
                <div className={`rounded-lg px-3 py-2 text-sm font-semibold outline ${tone}`}>
                    {operationsStateLabel(readiness.overallState)}
                    <p className='mt-1 text-xs font-normal opacity-80'>
                        {readiness.achievedCount} live · {readiness.partialCount} under review · {readiness.internalActionCount} operator actions · {readiness.measurableCount}/{readiness.totalCount} tracked
                    </p>
                </div>
            </div>

            <div className='mt-4 grid gap-3 xl:grid-cols-2'>
                {readiness.items.map((item) => (
                    <article key={item.id} className='rounded-lg border border-bright/8 bg-bright/[0.025] p-4'>
                        <div className='flex items-start justify-between gap-3'>
                            <div>
                                <p className='text-xs font-medium uppercase tracking-[0.16em] text-bright/35'>Lane {item.priority}</p>
                                <h4 className='mt-1 text-sm font-semibold text-bright/86'>{item.label}</h4>
                            </div>
                            <ReadinessBadge status={item.status} measurable={item.measurable} />
                        </div>
                        <div className='mt-3 space-y-1.5'>
                            {item.evidence.slice(0, 3).map((line) => (
                                <p key={line} className='text-xs leading-5 text-bright/48'>{operationsCopy(line)}</p>
                            ))}
                        </div>
                        <div className='mt-3 grid gap-2 rounded-md border border-bright/8 bg-black/18 px-3 py-2 text-xs leading-5'>
                            <div className='grid gap-1 sm:grid-cols-[5.5rem_1fr]'>
                                <span className='font-medium uppercase tracking-[0.12em] text-bright/36'>Owner</span>
                                <span className='text-bright/62'>{item.owner}</span>
                            </div>
                            <div className='grid gap-1 sm:grid-cols-[5.5rem_1fr]'>
                                <span className='font-medium uppercase tracking-[0.12em] text-bright/36'>Runner</span>
                                <span className='text-bright/62'>{operationsCopy(item.control)}</span>
                            </div>
                            <div className='grid gap-1 sm:grid-cols-[5.5rem_1fr]'>
                                <span className='font-medium uppercase tracking-[0.12em] text-bright/36'>Last run</span>
                                <span className='text-bright/48'>{item.lastAttempt}</span>
                            </div>
                            <div className='grid gap-1 sm:grid-cols-[5.5rem_1fr]'>
                                <span className='font-medium uppercase tracking-[0.12em] text-bright/36'>Now</span>
                                <span className='text-bright/48'>{operationsCopy(item.action)}</span>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    )
}

function ReadinessBadge({ status, measurable }: { status: AIEconomics['commercialReadiness']['items'][number]['status'], measurable: boolean }) {
    const label = status === 'operational' ? 'Live' : status === 'evidence_gap' ? 'Warming up' : 'Action queued'
    const tone = status === 'operational'
        ? 'border-emerald-300/15 bg-emerald-400/8 text-emerald-100/76'
        : status === 'evidence_gap'
            ? 'border-sky-300/15 bg-sky-400/8 text-sky-100/76'
            : 'border-amber-300/15 bg-amber-400/8 text-amber-100/76'
    return (
        <div className='flex flex-col items-end gap-1'>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}>{label}</span>
            <span className='text-[10px] uppercase tracking-[0.12em] text-bright/32'>{measurable ? 'tracked' : 'connecting'}</span>
        </div>
    )
}

function operationsConclusion(value: string) {
    return operationsCopy(value)
        .replace(/\bdesign QA\b/gi, 'design checks')
        .replace(/\bmeasured production samples\b/gi, 'live production samples')
        .replace(/\bcommercially strong\b/gi, 'ready for customers')
}

function operationsStateLabel(value: AIEconomics['commercialReadiness']['overallState']) {
    if (value === 'commercially_ready') return 'Customer-ready'
    if (value === 'internal_action_required') return 'Operator action'
    return 'Operator review'
}

function operationsCopy(value: string) {
    return value
        .replace(/\binstrumented\b/gi, 'tracked')
        .replace(/\binstrumenting\b/gi, 'connecting')
        .replace(/\bService gates\b/gi, 'Worker operations')
        .replace(/\bgates\b/gi, 'lanes')
        .replace(/\bgate\b/gi, 'lane')
}

function SuccessRate({ row, fallback }: { row?: AIEconomics['reliability']['buildDeploy'][number], fallback: string }) {
    const rate = row ? Math.round(row.successRate * 100) : 0
    return (
        <div>
            <div className='mb-1 flex items-center justify-between text-xs text-bright/48'>
                <span className='capitalize'>{row?.kind || fallback}</span>
                <span>{row ? `${rate}% · ${row.completed}/${row.total}` : 'no samples'}</span>
            </div>
            <div className='h-2 overflow-hidden rounded-full bg-bright/8'>
                <div className='h-full rounded-full bg-[#f07d33]' style={{ width: `${row ? Math.max(4, rate) : 0}%` }} />
            </div>
        </div>
    )
}

function LaneMetric({ icon, value, label }: { icon: ReactNode, value: string, label: string }) {
    return (
        <div className='rounded-md border border-bright/8 bg-bright/[0.025] p-2'>
            <div className='flex items-center gap-1.5 text-bright/72'>
                <span className='text-[#f07d33]'>{icon}</span>
                <span className='font-medium'>{value}</span>
            </div>
            <p className='mt-1 text-[10px] uppercase tracking-[0.12em] text-bright/32'>{label}</p>
        </div>
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

function formatMetric(value: number) {
    if (!value) return '0'
    if (value < 0.01) return value.toFixed(4)
    if (value < 1) return value.toFixed(2)
    return value.toFixed(1)
}

function formatKind(kind: string) {
    return kind.replace(/_/g, ' ')
}

function formatDate(value: string) {
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDuration(value: number) {
    if (!value) return 'metering'
    if (value < 1000) return `${Math.round(value)} ms`
    const seconds = value / 1000
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
    const minutes = seconds / 60
    if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`
    return `${(minutes / 60).toFixed(1)} h`
}

function incidentToneClass(state: string) {
    if (state === 'operational') return 'bg-emerald-400/8 text-emerald-100/80 outline-emerald-300/15'
    if (state === 'busy') return 'bg-amber-400/8 text-amber-100/80 outline-amber-300/15'
    if (state === 'watching') return 'bg-sky-400/8 text-sky-100/80 outline-sky-300/15'
    return 'bg-red-400/8 text-red-100/80 outline-red-300/15'
}
