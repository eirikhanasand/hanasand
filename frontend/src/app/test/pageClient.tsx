'use client'

import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, Copy, Flame, Gauge, Globe2, Inbox, Search, Timer, UserRound } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react'

const freeTryLimit = 5
const freeTryStorageKey = 'hanasand:load-testing-free-tries-v2'
const scenarioPresets = [
    { id: 'baseline', label: 'Baseline', detail: 'Single-user HTTP check.', stages: [{ duration: '30s', target: 1 }], timeout: 30000 },
    { id: 'ramp', label: 'Ramp', detail: 'Gradual traffic increase.', stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }], timeout: 45000 },
    { id: 'spike', label: 'Spike', detail: 'Short timeout burst.', stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }], timeout: 60000 },
]

export default function TestPageClient({ serverId, created, missingTestId }: { serverId?: string, created?: string, missingTestId?: string }) {
    const router = useRouter()
    const [path, setPath] = useState('')
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [freeTriesUsed, setFreeTriesUsed] = useState(0)
    const [loadTestQuota, setLoadTestQuota] = useState<LoadTestQuota | null>(null)
    const [scenarioId, setScenarioId] = useState(scenarioPresets[0].id)
    const selectedScenario = scenarioPresets.find((scenario) => scenario.id === scenarioId) ?? scenarioPresets[0]
    const fullUrl = `${config.url.link}/${serverId}`
    const remainingChecks = loadTestQuota?.remaining ?? Math.max(0, freeTryLimit - freeTriesUsed)
    const quotaLabel = loadTestQuota && loadTestQuota.plan !== 'free'
        ? `${remainingChecks} ${loadTestQuota.plan} check${remainingChecks === 1 ? '' : 's'} remaining this month`
        : `${remainingChecks} free check${remainingChecks === 1 ? '' : 's'} remaining`
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false)
    })

    useEffect(() => {
        let active = true
        fetchRecentTests('recent').then((recent) => {
            if (active) setRecentScans(recent)
        })
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        setFreeTriesUsed(readFreeTriesUsed())
    }, [])

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()
        await startCheck()
    }

    async function handleEndpointKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key !== 'Enter') return
        e.preventDefault()
        await startCheck()
    }

    async function startCheck() {
        setError(null)

        const url = normalizeEndpoint(path)
        if (!isValidEndpoint(url)) {
            setError('Enter a full HTTP or HTTPS endpoint you control.')
            return
        }

        const result = await postTest({ url, timeout: selectedScenario.timeout, stages: selectedScenario.stages })
        if (!result.ok) {
            if (result.quota) {
                setLoadTestQuota(result.quota)
                if (result.quota.plan === 'free') setFreeTriesUsed(Math.min(freeTryLimit, result.quota.used))
            }
            setError(result.error)
            return
        }

        if (result.test.quota) {
            setLoadTestQuota(result.test.quota)
            if (result.test.quota.plan === 'free') setFreeTriesUsed(Math.min(freeTryLimit, result.test.quota.used))
        } else {
            setFreeTriesUsed(incrementFreeTriesUsed())
        }
        if (result.test.id) router.push(`/test/${result.test.id}`)
    }

    if (created) {
        return (
            <div className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:p-6'>
                <div className='grid gap-5'>
                    <div className='flex items-start justify-between gap-4'>
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-ui-text'>
                                <CheckCircle2 className='h-5 w-5 text-ui-success' />
                                Service check created
                            </div>
                            <p className='text-sm leading-6 text-ui-muted'>Copy the result link or start another check.</p>
                        </div>
                    </div>
                    <button type='button' onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-left transition hover:border-ui-primary'>
                        <Copy height={15} width={15} className={`shrink-0 ${didCopy === true ? 'stroke-ui-success' : didCopy === false ? 'stroke-ui-muted' : 'stroke-ui-danger'}`} />
                        <span className='min-w-0 break-all text-sm text-ui-text'>{fullUrl}</span>
                    </button>
                    <button type='button' onClick={() => router.push('/test')} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                        <ArrowLeft className='h-4 w-4' />
                        New check
                    </button>
                </div>
            </div>
        )
    }

    return (
        <>
            <div className='grid gap-4'>
                <p className='text-sm font-semibold uppercase text-ui-primary'>Endpoint check</p>
                <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Check a service before users do.</h1>
                <p className='max-w-xl text-base leading-7 text-ui-muted'>
                    Run an owned HTTP endpoint through a measured scenario with latency, failure-rate, logs, and a shareable result link.
                </p>
            </div>

            <section className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:p-6'>
                <div className='grid gap-4'>
                    <div className='flex items-start justify-between gap-4'>
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-ui-text'>
                                <Flame className='h-5 w-5 text-ui-primary' />
                                Start endpoint check
                            </div>
                            <p className='text-sm leading-6 text-ui-muted'>Paste an HTTP endpoint and choose the traffic shape.</p>
                        </div>
                        <span className='rounded-lg border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-primary'>{quotaLabel}</span>
                    </div>

                    {missingTestId ? <ErrorNotice compact variant='info' message={`The check '${missingTestId}' does not exist yet. Create a new run to get a result link.`} /> : null}

                    <form onSubmit={handleSubmit} className='grid gap-3'>
                        <ErrorNotice compact message={error as string | null} />
                        <label className='grid gap-2'>
                            <span className='text-xs font-semibold uppercase text-ui-primary'>Endpoint</span>
                            <span className='relative'>
                                <Globe2 className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                                <input
                                    className='h-11 w-full rounded-lg border border-ui-border bg-ui-raised pl-10 pr-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                                    placeholder='https://api.example.com/health'
                                    onChange={(e) => setPath(e.target.value)}
                                    onKeyDown={(e) => void handleEndpointKeyDown(e)}
                                    value={path}
                                    required
                                />
                            </span>
                        </label>

                        <div className='grid gap-2'>
                            <span className='text-xs font-semibold uppercase text-ui-primary'>Traffic shape</span>
                            <div className='grid gap-2 sm:grid-cols-3'>
                                {scenarioPresets.map((scenario) => (
                                    <button
                                        key={scenario.id}
                                        type='button'
                                        onClick={() => setScenarioId(scenario.id)}
                                        className={`rounded-lg border px-3 py-2 text-left transition ${scenario.id === scenarioId ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-raised text-ui-text hover:border-ui-primary'}`}
                                    >
                                        <span className='flex items-center justify-between gap-2 text-sm font-semibold'>
                                            {scenario.label}
                                            {scenario.id === scenarioId ? <CheckCircle2 className='h-4 w-4' /> : null}
                                        </span>
                                        <span className='mt-1 block truncate text-xs text-ui-muted'>{scenario.detail}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs leading-5 text-ui-muted sm:grid-cols-3'>
                            <CompactFact icon={<Timer className='h-3.5 w-3.5' />} label={`${Math.round(selectedScenario.timeout / 1000)}s timeout`} />
                            <CompactFact icon={<Gauge className='h-3.5 w-3.5' />} label='p95 and failures' />
                            <CompactFact icon={<BarChart3 className='h-3.5 w-3.5' />} label='logs and result link' />
                        </div>

                        <button type='submit' className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:bg-ui-primary/90'>
                            <Search className='h-4 w-4' />
                            Start check
                        </button>
                    </form>

                    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-ui-border pt-3'>
                        <h2 className='text-sm font-semibold text-ui-text'>Recent checks</h2>
                        <div className='flex flex-wrap gap-2'>
                            <button type='button' onClick={() => router.push('/test/stats?scope=mine')} className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                                <UserRound className='h-4 w-4' />
                                My checks
                            </button>
                            <button type='button' onClick={() => router.push('/test/stats')} className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>
                                Results
                                <ArrowRight className='h-4 w-4' />
                            </button>
                        </div>
                    </div>
                    <RecentChecks scans={recentScans} />
                </div>
            </section>
        </>
    )
}

function CompactFact({ icon, label }: { icon: ReactNode, label: string }) {
    return (
        <div className='flex items-center gap-2'>
            <span className='text-ui-primary'>{icon}</span>
            <span>{label}</span>
        </div>
    )
}

function RecentChecks({ scans }: { scans: Test[] }) {
    if (!scans.length) {
        return (
            <div className='grid min-h-24 place-items-center rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-center text-sm text-ui-muted'>
                <div>
                    <div className='mx-auto grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-primary'>
                        <Inbox className='h-4 w-4' />
                    </div>
                    <p className='mt-2 font-semibold text-ui-text'>Recent check history is updating.</p>
                    <p className='mt-1 text-xs'>New public run summaries stream here automatically.</p>
                </div>
            </div>
        )
    }

    return (
        <div className='grid max-h-48 gap-2 overflow-y-auto pr-1'>
            {scans.slice(0, 4).map(scan => (
                <button
                    key={scan.id}
                    type='button'
                    onClick={() => window.location.assign(`/test/${scan.id}`)}
                    className='grid min-w-0 grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-left text-sm transition hover:border-ui-primary'
                >
                    <span className='min-w-0'>
                        <span className='block truncate font-semibold text-ui-text'>{scan.url}</span>
                        <span className='mt-0.5 block text-xs text-ui-muted'>{scan.status}</span>
                    </span>
                    <ArrowRight className='h-4 w-4 text-ui-muted' />
                </button>
            ))}
        </div>
    )
}

function normalizeEndpoint(value: string) {
    return value.trim()
}

function isValidEndpoint(value: string) {
    try {
        const url = new URL(value)
        return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
    } catch {
        return false
    }
}

function readFreeTriesUsed() {
    try {
        return Math.max(0, Math.min(freeTryLimit, Number(window.localStorage.getItem(freeTryStorageKey) || '0') || 0))
    } catch {
        return 0
    }
}

function incrementFreeTriesUsed() {
    const next = Math.min(freeTryLimit, readFreeTriesUsed() + 1)
    try {
        window.localStorage.setItem(freeTryStorageKey, String(next))
    } catch {
        // The server check still runs; storage only gates the browser trial experience.
    }
    return next
}
