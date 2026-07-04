'use client'

import ErrorNotice from '@/components/error/errorNotice'
import RecentScans from '@/components/test/recentScans'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, Copy, Flame, Gauge, Globe2, Search, Timer } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { FormEvent, useEffect, useState } from 'react'

const freeTryLimit = 5
const freeTryStorageKey = 'hanasand:load-testing-free-tries-v2'
const scenarioPresets = [
    {
        id: 'baseline',
        label: 'Baseline',
        detail: 'Single-user HTTP check for release confidence.',
        stages: [{ duration: '30s', target: 1 }],
        timeout: 30000,
    },
    {
        id: 'ramp',
        label: 'Ramp',
        detail: 'Gradual traffic increase for capacity smoke tests.',
        stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }],
        timeout: 45000,
    },
    {
        id: 'spike',
        label: 'Spike',
        detail: 'Short burst to expose timeout and error behavior.',
        stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }],
        timeout: 60000,
    },
]

export default function TestPageClient({ serverId, created, missingTestId }: { serverId?: string, created?: string, missingTestId?: string }) {
    const router = useRouter()
    const [path, setPath] = useState('')
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const [freeTriesUsed, setFreeTriesUsed] = useState(0)
    const [loadTestQuota, setLoadTestQuota] = useState<LoadTestQuota | null>(null)
    const [scenarioId, setScenarioId] = useState(scenarioPresets[0].id)
    const selectedScenario = scenarioPresets.find((scenario) => scenario.id === scenarioId) ?? scenarioPresets[0]
    const isValidLink =
        (path.includes('http://') && path.includes('.') && path.length >= 10)
        || (path.includes('https://') && path.includes('.') && path.length >= 11)
    const fullUrl = `${config.url.link}/${serverId}`
    const remainingChecks = loadTestQuota?.remaining ?? Math.max(0, freeTryLimit - freeTriesUsed)
    const quotaLabel = loadTestQuota && loadTestQuota.plan !== 'free'
        ? `${remainingChecks} ${loadTestQuota.plan} check${remainingChecks === 1 ? '' : 's'} remaining this month`
        : `${remainingChecks} free check${remainingChecks === 1 ? '' : 's'} remaining`
    const recentChecks = dedupeScans([...myScans, ...recentScans]).slice(0, 3)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false)
    })

    useEffect(() => {
        let active = true

        async function loadScans() {
            const [recent, mine] = await Promise.all([
                fetchRecentTests('recent'),
                fetchRecentTests('mine')
            ])

            if (!active) {
                return
            }

            setRecentScans(recent)
            setMyScans(mine)
        }

        loadScans()
        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        setFreeTriesUsed(readFreeTriesUsed())
    }, [])

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()
        if (!isValidLink) {
            return
        }
        const result = await postTest({ url: path, timeout: selectedScenario.timeout, stages: selectedScenario.stages })
        if (!result.ok) {
            if (result.quota) {
                setLoadTestQuota(result.quota)
                if (result.quota.plan === 'free') {
                    setFreeTriesUsed(Math.min(freeTryLimit, result.quota.used))
                }
            }
            return setError(result.error)
        }

        if (result.test.id) {
            if (result.test.quota) {
                setLoadTestQuota(result.test.quota)
                if (result.test.quota.plan === 'free') {
                    setFreeTriesUsed(Math.min(freeTryLimit, result.test.quota.used))
                }
            } else {
                setFreeTriesUsed(incrementFreeTriesUsed())
            }
            router.push(`/test/${result.test.id}`)
        }
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
                    <button
                        type='button'
                        onClick={() => router.push('/test')}
                        className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'
                    >
                        <ArrowLeft className='h-4 w-4' />
                        New check
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className='grid h-full min-h-0 w-full min-w-0 grid-rows-[minmax(21rem,auto)_minmax(0,1fr)] gap-4'>
            <section className='grid place-items-center'>
                <div className='grid w-full max-w-3xl gap-5 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:p-6'>
                    <div className='flex items-start justify-between gap-4'>
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-sm font-semibold uppercase text-ui-primary'>
                                <Flame className='h-5 w-5 text-ui-primary' />
                                Endpoint check
                            </div>
                            <h1 className='text-3xl font-semibold tracking-normal text-ui-text md:text-4xl'>Check a service before users do</h1>
                            <p className='max-w-2xl text-sm leading-6 text-ui-muted'>Run an owned HTTP endpoint through a measured scenario with latency, failure-rate, logs, and a shareable evidence report.</p>
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
                                    value={path}
                                    required
                                />
                            </span>
                        </label>

                        <div className='grid gap-2'>
                            <span className='text-xs font-semibold uppercase text-ui-primary'>Traffic shape</span>
                            <div className='grid grid-cols-3 gap-2'>
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

                        <button
                            type='submit'
                            disabled={!isValidLink}
                            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
                        >
                            <Search className='h-4 w-4' />
                            Start check
                        </button>
                    </form>

                    <div className='flex items-center justify-between gap-3 border-t border-ui-border pt-4'>
                        <p className='text-xs leading-5 text-ui-muted'>Only run checks against endpoints you own or have permission to test.</p>
                        <button
                            type='button'
                            onClick={() => router.push('/test/stats')}
                            className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'
                        >
                            Results
                            <ArrowRight className='h-4 w-4' />
                        </button>
                    </div>
                </div>
            </section>

            <section className='grid min-h-0 gap-4 lg:grid-cols-2'>
                <RecentScans title='My service checks' readyMessage='No personal checks yet.' scans={myScans.length ? myScans : recentChecks} mine surface='default' className='min-h-0' listClassName='max-h-80' />
                <RecentScans title='Service-wide checks' readyMessage='Service-wide check history is updating.' scans={recentScans} surface='default' className='min-h-0' listClassName='max-h-80' />
            </section>
        </div>
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

function dedupeScans(scans: Test[]) {
    const seen = new Set<string>()
    return scans
        .filter((scan) => {
            if (seen.has(scan.id)) return false
            seen.add(scan.id)
            return true
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
