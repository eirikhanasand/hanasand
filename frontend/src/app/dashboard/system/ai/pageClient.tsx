'use client'

import Link from 'next/link'
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Coins, Layers3, LineChart, Server, Timer, Zap } from 'lucide-react'
import GPT_Content from '@components/gpt/content'
import GPT_EmptyState from '@components/gpt/emptyState'
import GPT_Header from '@components/gpt/header'
import TestClientPopup from '@components/gpt/testClientPopup'
import useGptPageState from '@components/gpt/useGptPageState'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import { aiClientRequest } from '@/utils/ai/client'
import { type ReactNode, useEffect, useState } from 'react'
import { containerHealth, normalizeDockerTelemetry } from '../systemPresentation'

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
    const [aiContainers, setAiContainers] = useState<DockerContainer[]>([])
    const [containerError, setContainerError] = useState<string | null>(null)

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

    useEffect(() => {
        let cancelled = false
        async function loadAiContainers() {
            const id = getCookie('id')
            const token = getCookie('access_token')
            if (!id || !token) {
                if (!cancelled) setContainerError('Log in again to inspect AI containers.')
                return
            }
            try {
                const response = await fetch(`${config.url.api}/docker`, {
                    cache: 'no-store',
                    headers: { id, Authorization: `Bearer ${token}` },
                })
                if (!response.ok) {
                    throw new Error('Docker telemetry is reconnecting.')
                }
                const telemetry = normalizeDockerTelemetry(await response.json())
                const containers = telemetry.containers.filter(isAiContainer)
                if (!cancelled) {
                    setAiContainers(containers)
                    setContainerError(telemetry.unavailable_reason || null)
                }
            } catch (error) {
                if (!cancelled) {
                    setContainerError(error instanceof Error ? error.message : 'Docker telemetry is reconnecting.')
                }
            }
        }
        void loadAiContainers()
        const interval = window.setInterval(loadAiContainers, 30_000)
        return () => {
            cancelled = true
            window.clearInterval(interval)
        }
    }, [])

    return (
        <>
            <div className='h-full w-full overflow-y-auto'>
                <div className='mx-auto flex w-full max-w-330 flex-col gap-4 px-4 pb-4 pt-6 sm:px-6 md:px-8 md:pt-8'>
                    <div className='flex items-end justify-between gap-4'>
                        <div>
                            <p className='text-xs uppercase tracking-[0.22em] text-ui-muted'>System</p>
                            <h1 className='mt-1 text-2xl font-semibold text-ui-text'>AI operations</h1>
                            <p className='mt-1 text-sm text-ui-muted'>Connected workers, verified output, capacity, and spend.</p>
                        </div>
                        <div className='flex flex-wrap items-center justify-end gap-2'>
                            <GPT_Header isConnected={gpt.isConnected} participants={gpt.participants} />
                            <Link
                                href='/dashboard/system'
                                className='flex h-9 items-center gap-2 rounded-md bg-ui-raised px-4 text-sm text-ui-text border border-ui-border transition-colors hover:bg-ui-panel'
                            >
                                <ArrowLeft className='h-4 w-4' />
                                Back to system
                            </Link>
                        </div>
                    </div>
                    <EconomicsPanel economics={economics} error={economicsError} aiContainers={aiContainers} containerError={containerError} />
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

function EconomicsPanel({ economics, error, aiContainers, containerError }: { economics: AIEconomics | null, error: string | null, aiContainers: DockerContainer[], containerError: string | null }) {
    if (error) {
        return (
            <section className='rounded-xl bg-ui-panel p-4 border border-ui-border'>
                <p className='text-sm text-ui-danger'>{error}</p>
            </section>
        )
    }
    if (!economics) {
        return (
            <section className='rounded-xl bg-ui-panel p-4 border border-ui-border'>
                <p className='text-sm text-ui-muted'>Connecting AI worker telemetry...</p>
            </section>
        )
    }

    const summary = economics.summary
    const cacheRate = summary.cacheableEvents ? Math.round((summary.cacheHits / summary.cacheableEvents) * 100) : 0

    return (
        <section className='space-y-4 rounded-xl bg-ui-panel p-4 border border-ui-border'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                    <h2 className='text-xl font-semibold text-ui-text'>Worker output</h2>
                    <p className='mt-1 text-sm text-ui-muted'>Verified work, live capacity, and spend.</p>
                </div>
                <div className='flex flex-wrap items-center justify-end gap-2 text-xs font-semibold'>
                    <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-ui-muted'>{economics.reliability.capacity.totalAvailableSessions} open sessions</span>
                    <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1 text-ui-muted'>{economics.reliability.capacity.totalQueued} queued</span>
                    <span className='rounded-full bg-ui-primary/10 px-3 py-1 font-medium uppercase tracking-[0.16em] text-ui-primary outline outline-ui-primary/20'>
                        {economics.windowDays} day window
                    </span>
                </div>
            </div>

            <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-raised' data-ai-economics-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Spend and output counters</span>
                    <span className='text-xs font-medium text-ui-muted'>{formatNok(summary.estimatedCostNok)} NOK, {formatCompact(summary.verifiedUnits)} verified units, {cacheRate}% cached</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3 md:grid-cols-2 xl:grid-cols-4' data-ai-economics-metrics>
                    <EconomicsStat icon={<Coins className='h-4 w-4' />} label='Spend' value={`${formatNok(summary.estimatedCostNok)} NOK`} detail={`${formatCompact(summary.billableUnits)} billable work units`} />
                    <EconomicsStat icon={<CheckCircle2 className='h-4 w-4' />} label='Verified output' value={formatMetric(summary.verifiedProgressPerMinutePerNok)} detail={`${formatCompact(summary.verifiedUnits)} verified units over ${formatDuration(summary.productiveMinutes * 60_000)} productive time`} />
                    <EconomicsStat icon={<LineChart className='h-4 w-4' />} label='Token flow' value={formatCompact(summary.tokenUnits)} detail={`${formatCompact(summary.platformErrorUnits)} platform-error units excluded from value`} />
                    <EconomicsStat icon={<Layers3 className='h-4 w-4' />} label='Cached work' value={`${cacheRate}%`} detail={`${summary.cacheHits} cache hits from ${summary.cacheableEvents} cacheable events`} />
                </div>
            </details>

            <AIContainerHealth containers={aiContainers} error={containerError} />
            <ReliabilityPanel reliability={economics.reliability} />
        </section>
    )
}

function AIContainerHealth({ containers, error }: { containers: DockerContainer[], error: string | null }) {
    const unhealthy = containers.filter((container) => {
        const tone = containerHealth(container).tone
        return tone === 'bad' || tone === 'warn'
    })
    const primary = unhealthy[0] || containers[0] || null
    const title = error
        ? 'Docker telemetry reconnecting'
        : unhealthy.length
            ? `${unhealthy.length} AI service${unhealthy.length === 1 ? '' : 's'} need review`
            : containers.length
                ? 'AI services are reporting'
                : 'AI service inventory connecting'
    const detail = error
        || (primary
            ? `${primary.name} is ${containerHealth(primary).label.toLowerCase()} (${primary.status}).`
            : 'Model client and parser bridge containers stream here when Docker telemetry attaches.')

    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-4' data-ai-container-health>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-ui-muted'>Service health</p>
                    <h3 className='mt-1 text-lg font-semibold text-ui-text'>{title}</h3>
                    <p className='mt-2 max-w-3xl text-sm leading-6 text-ui-muted'>{detail}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    {primary ? (
                        <Link href={`/dashboard/logs?service=${encodeURIComponent(primary.name)}`} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text hover:border-ui-primary/40'>
                            View logs
                        </Link>
                    ) : null}
                </div>
            </div>
            <div className='mt-3 grid gap-2 md:grid-cols-2'>
                {containers.length ? containers.map((container) => {
                    const health = containerHealth(container)
                    return (
                        <div key={container.id} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs' data-ai-container-row>
                            <div className='flex items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='truncate font-semibold text-ui-text'>{container.name}</p>
                                    <p className='mt-1 truncate text-ui-muted'>{container.image || 'container image metering'} · {container.status}</p>
                                </div>
                                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${healthToneClass(health.tone)}`}>{health.label}</span>
                            </div>
                        </div>
                    )
                }) : <p className='text-sm text-ui-muted'>AI container rows appear as Docker telemetry attaches.</p>}
            </div>
        </div>
    )
}

function isAiContainer(container: DockerContainer) {
    return /(^|_)ai(_|$)|model|parser|gpt/i.test(`${container.name} ${container.image || ''}`)
}

function healthToneClass(tone: ReturnType<typeof containerHealth>['tone']) {
    if (tone === 'ok') return 'border-ui-success/30 bg-ui-success/10 text-ui-success'
    if (tone === 'warn') return 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
    if (tone === 'bad') return 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
    return 'border-ui-border bg-ui-raised text-ui-muted'
}

function ReliabilityPanel({ reliability }: { reliability: AIEconomics['reliability'] }) {
    const incidentTone = incidentToneClass(reliability.incidentStatus.state)
    const queuedRows = reliability.queueDepth.filter((row) => row.status === 'queued' || row.status === 'running')
    const buildRate = reliability.buildDeploy.find((row) => row.kind === 'build')
    const deployRate = reliability.buildDeploy.find((row) => row.kind === 'deploy')

    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-4' id='ai-reliability' data-ai-reliability>
            <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-ui-muted'>Reliability and observability</p>
                    <h3 className='mt-1 text-lg font-semibold text-ui-text'>Can users get work done right now?</h3>
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
                    <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-sm font-semibold text-ui-text'>Verification latency</h4>
                            <span className='text-xs text-ui-muted'>p50 / p95</span>
                        </div>
                        <div className='mt-3 grid gap-2'>
                            {reliability.verificationLatency.length ? reliability.verificationLatency.map((row) => (
                                <div key={row.kind} className='flex items-center justify-between gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm'>
                                    <span className='capitalize text-ui-text'>{row.kind}</span>
                                    <span className='text-ui-muted'>{formatDuration(row.p50Ms)} / {formatDuration(row.p95Ms)} · {row.sampleCount}</span>
                                </div>
                            )) : <p className='text-sm text-ui-muted'>Verification jobs are metering; p50/p95 rows update from completed runs.</p>}
                        </div>
                    </div>

                    <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
                        <h4 className='text-sm font-semibold text-ui-text'>Build and deploy success</h4>
                        <div className='mt-3 grid gap-3'>
                            <SuccessRate row={buildRate} fallback='build' />
                            <SuccessRate row={deployRate} fallback='deploy' />
                        </div>
                    </div>

                    <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
                        <h4 className='text-sm font-semibold text-ui-text'>Failed verification categories</h4>
                        <div className='mt-3 flex flex-wrap gap-2'>
                            {reliability.failedProofCategories.length ? reliability.failedProofCategories.map((row) => (
                                <span key={`${row.kind}-${row.category}`} className='rounded-full border border-ui-danger/30 bg-ui-danger/10 px-2.5 py-1 text-xs text-ui-danger'>
                                    {formatKind(row.category)} · {row.kind} · {row.count}
                                </span>
                            )) : <span className='rounded-full border border-ui-success/30 bg-ui-success/10 px-2.5 py-1 text-xs text-ui-success'>No verification failures in this window</span>}
                        </div>
                    </div>
                </div>

                <div className='grid gap-4'>
                    <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-sm font-semibold text-ui-text'>Queue depth by worker/model</h4>
                            <span className='text-xs text-ui-muted'>{queuedRows.length} active buckets</span>
                        </div>
                        <div className='mt-3 max-h-52 space-y-2 overflow-auto'>
                            {queuedRows.length ? queuedRows.map((row) => (
                                <div key={`${row.lane}-${row.kind}-${row.status}`} className='grid grid-cols-[1fr_auto] gap-3 rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-xs'>
                                    <div>
                                        <p className='font-medium text-ui-text'>{row.lane} · {row.model}</p>
                                        <p className='mt-1 text-ui-muted'>{row.kind} · {row.status}</p>
                                    </div>
                                    <span className='self-center text-sm font-semibold text-ui-text'>{row.count}</span>
                                </div>
                            )) : <p className='text-sm text-ui-muted'>Verification queue is clear; active and queued runs stream here.</p>}
                        </div>
                    </div>

                    <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
                        <div className='flex items-center justify-between gap-3'>
                            <h4 className='text-sm font-semibold text-ui-text'>GPU worker health</h4>
                            <span className='text-xs text-ui-muted'>{reliability.gpuLanes.length} workers</span>
                        </div>
                        <div className='mt-3 grid gap-2 md:grid-cols-2'>
                            {reliability.gpuLanes.length ? reliability.gpuLanes.map((lane) => (
                                <article key={`${lane.clientName}-${lane.lane}`} className='rounded-lg border border-ui-border bg-ui-raised p-3'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <div>
                                            <p className='text-sm font-semibold text-ui-text'>{lane.lane}</p>
                                            <p className='mt-1 text-xs text-ui-muted'>{lane.model} · {lane.tier}</p>
                                        </div>
                                        <span className='rounded-full border border-ui-border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ui-muted'>{lane.status}</span>
                                    </div>
                                    <div className='mt-3 grid grid-cols-2 gap-2 text-xs text-ui-muted'>
                                        <LaneMetric icon={<Server className='h-3.5 w-3.5' />} value={`${lane.availableSessions}/${lane.maxSessions}`} label='available' />
                                        <LaneMetric icon={<Activity className='h-3.5 w-3.5' />} value={`${Math.round(lane.gpuLoad)}%`} label='load' />
                                        <LaneMetric icon={<Zap className='h-3.5 w-3.5' />} value={`${Math.round(lane.powerWatts)} W`} label='power' />
                                        <LaneMetric icon={<Timer className='h-3.5 w-3.5' />} value={formatCompact(lane.contextMaxTokens)} label='context' />
                                    </div>
                                </article>
                            )) : <p className='text-sm text-ui-muted'>GPU telemetry updates with load, power, and session capacity for connected model workers.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SuccessRate({ row, fallback }: { row?: AIEconomics['reliability']['buildDeploy'][number], fallback: string }) {
    const rate = row ? Math.round(row.successRate * 100) : 0
    return (
        <div>
            <div className='mb-1 flex items-center justify-between text-xs text-ui-muted'>
                <span className='capitalize'>{row?.kind || fallback}</span>
                <span>{row ? `${rate}% · ${row.completed}/${row.total}` : 'no samples'}</span>
            </div>
            <div className='h-2 overflow-hidden rounded-full bg-ui-border'>
                <div className='h-full rounded-full bg-ui-primary' style={{ width: `${row ? Math.max(4, rate) : 0}%` }} />
            </div>
        </div>
    )
}

function LaneMetric({ icon, value, label }: { icon: ReactNode, value: string, label: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised p-2'>
            <div className='flex items-center gap-1.5 text-ui-text'>
                <span className='text-ui-primary'>{icon}</span>
                <span className='font-medium'>{value}</span>
            </div>
            <p className='mt-1 text-[10px] uppercase tracking-[0.12em] text-ui-muted'>{label}</p>
        </div>
    )
}

function EconomicsStat({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-4'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.16em]'>{label}</span>
                <span className='text-ui-primary'>{icon}</span>
            </div>
            <div className='mt-3 text-2xl font-semibold text-ui-text'>{value}</div>
            <p className='mt-1 text-xs leading-5 text-ui-muted'>{detail}</p>
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
    if (state === 'operational') return 'bg-ui-success/10 text-ui-success outline-ui-success/25'
    if (state === 'busy') return 'bg-ui-warning/10 text-ui-warning outline-ui-warning/25'
    if (state === 'watching') return 'bg-ui-primary/10 text-ui-primary outline-ui-primary/25'
    return 'bg-ui-danger/10 text-ui-danger outline-ui-danger/25'
}
