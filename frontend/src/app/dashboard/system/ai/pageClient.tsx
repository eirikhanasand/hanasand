'use client'

import Link from 'next/link'
import { Activity, ArrowLeft, Timer } from 'lucide-react'
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
                            <h1 className='mt-1 text-2xl font-semibold text-ui-text'>AI operations</h1>
                        </div>
                        <div className='flex flex-wrap items-center justify-end gap-2'>
                            <GPT_Header isConnected={gpt.isConnected} participants={gpt.participants} />
                            <Link
                                href='/system'
                                className='flex h-9 items-center gap-2 rounded-md bg-ui-raised px-4 text-sm text-ui-text border border-ui-border transition-colors hover:bg-ui-panel'
                            >
                                <ArrowLeft className='h-4 w-4' />
                                Back to system
                            </Link>
                        </div>
                    </div>
                    <AIContainerHealth containers={aiContainers} error={containerError} />
                    <div id='ai-clients' data-ai-clients>
                        {gpt.clients.length ? (
                            <GPT_Content clients={gpt.clients} onTestClient={gpt.openChat} metrics={<ReliabilityCards economics={economics} error={economicsError} />} />
                        ) : (
                            <div className='space-y-4'>
                                <div className='grid gap-4 md:grid-cols-2'>
                                    <ReliabilityCards economics={economics} error={economicsError} />
                                </div>
                                <GPT_EmptyState />
                            </div>
                        )}
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

function AIContainerHealth({ containers, error }: { containers: DockerContainer[], error: string | null }) {
    const unhealthy = containers.filter((container) => {
        const tone = containerHealth(container).tone
        return tone === 'bad' || tone === 'warn'
    })
    const primary = unhealthy[0] || containers[0] || null

    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-4' data-ai-container-health>
            {error ? <p className='mb-3 text-sm text-ui-danger' role='alert'>{error}</p> : null}
            {primary ? (
                <div className='mb-3 flex justify-end'>
                    <Link href={`/logs?service=${encodeURIComponent(primary.name)}`} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs font-semibold text-ui-text hover:border-ui-primary/40'>
                        View logs
                    </Link>
                </div>
            ) : null}
            <div className='grid gap-2 md:grid-cols-2'>
                {containers.length ? containers.map((container) => {
                    const health = containerHealth(container)
                    return (
                        <div key={container.id} className='min-w-0 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-xs' data-ai-container-row>
                            <div className='flex items-start justify-between gap-2'>
                                <div className='min-w-0'>
                                    <p className='truncate font-semibold text-ui-text'>{container.name}</p>
                                    <p className='mt-1 truncate text-ui-muted'>{container.image || container.name} · {container.status}</p>
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

function ReliabilityCards({ economics, error }: { economics: AIEconomics | null, error: string | null }) {
    if (error || !economics) {
        return <div className='rounded-lg border border-ui-border bg-ui-panel p-4 text-sm text-ui-muted' role={error ? 'alert' : 'status'}>{error || 'Loading activity…'}</div>
    }
    const { reliability } = economics
    const queuedRows = reliability.queueDepth.filter((row) => row.status === 'queued' || row.status === 'running')

    return (
        <>
            <EconomicsStat icon={<Timer className='h-4 w-4' />} label='Time to first response' value={reliability.promptTiming.sampleCount ? formatDuration(reliability.promptTiming.p50FirstUsefulOutputMs) : 'No runs yet'} detail={reliability.promptTiming.sampleCount ? `Typical response time · ${reliability.promptTiming.sampleCount} runs` : 'Shown after the first completed run'} />
            <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-4'>
                <div className='flex items-center justify-between gap-2 text-ui-muted'>
                    <span className='text-xs font-medium uppercase tracking-[0.18em]'>Active and queued work</span>
                    <Activity className='h-4 w-4 shrink-0' />
                </div>
                <div className='mt-3 text-2xl font-semibold text-ui-text'>{queuedRows.reduce((total, row) => total + row.count, 0)} runs</div>
                {queuedRows.length ? (
                    <details className='mt-1 text-xs text-ui-muted'>
                        <summary className='cursor-pointer'>View work</summary>
                        <div className='mt-2 max-h-40 space-y-2 overflow-auto'>
                            {queuedRows.map((row) => (
                                <div key={`${row.lane}-${row.model}-${row.kind}-${row.status}`} className='grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-md border border-ui-border bg-ui-raised px-2 py-1'>
                                    <div className='min-w-0 wrap-break-word'>
                                        <p className='font-medium text-ui-text'>{row.lane} · {row.model}</p>
                                        <p>{row.kind} · {row.status}</p>
                                    </div>
                                    <span className='self-center font-semibold text-ui-text'>{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </details>
                ) : <p className='mt-1 text-xs leading-5 text-ui-muted'>No work is running or waiting.</p>}
            </div>
        </>
    )
}

function EconomicsStat({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between gap-2 text-ui-muted'>
                <span className='text-xs font-medium uppercase tracking-[0.18em]'>{label}</span>
                <span className='text-ui-primary'>{icon}</span>
            </div>
            <div className='mt-3 text-2xl font-semibold text-ui-text'>{value}</div>
            <p className='mt-1 text-xs leading-5 text-ui-muted'>{detail}</p>
        </div>
    )
}

function formatDuration(value: number) {
    if (!value) return '—'
    if (value < 1000) return `${Math.round(value)} ms`
    const seconds = value / 1000
    if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
    const minutes = seconds / 60
    if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`
    return `${(minutes / 60).toFixed(1)} h`
}
