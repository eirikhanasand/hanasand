'use client'

import RecentScans from '@/components/test/recentScans'
import { DashboardPanel } from '@/components/dashboard/ui'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Gauge, Globe2, Search, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

const scenarioPresets = [
    {
        id: 'baseline',
        label: 'Baseline',
        detail: 'One-user release check',
        stages: [{ duration: '30s', target: 1 }],
        timeout: 30000,
    },
    {
        id: 'ramp',
        label: 'Ramp',
        detail: 'Capacity smoke test',
        stages: [{ duration: '30s', target: 5 }, { duration: '1m', target: 20 }, { duration: '30s', target: 0 }],
        timeout: 45000,
    },
    {
        id: 'spike',
        label: 'Spike',
        detail: 'Burst and recovery check',
        stages: [{ duration: '15s', target: 5 }, { duration: '20s', target: 40 }, { duration: '25s', target: 0 }],
        timeout: 60000,
    },
]

export default function LoadTestingOperations() {
    const router = useRouter()
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const [loadedAt, setLoadedAt] = useState<Date | null>(null)
    const [targetUrl, setTargetUrl] = useState('')
    const [scenarioId, setScenarioId] = useState(scenarioPresets[0].id)
    const [historyView, setHistoryView] = useState<'mine' | 'global'>('mine')
    const [permissionConfirmed, setPermissionConfirmed] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const [error, setError] = useState('')
    const selectedScenario = scenarioPresets.find((scenario) => scenario.id === scenarioId) ?? scenarioPresets[0]
    const validTarget = isValidServiceUrl(targetUrl)
    const canStart = validTarget && permissionConfirmed

    useEffect(() => {
        let active = true

        async function loadScans() {
            const [recent, mine] = await Promise.all([
                fetchRecentTests('recent', 8),
                fetchRecentTests('mine', 8),
            ])

            if (!active) return
            setRecentScans(recent)
            setMyScans(mine)
            setLoadedAt(new Date())
        }

        loadScans()
        const timer = window.setInterval(loadScans, 30_000)
        return () => {
            active = false
            window.clearInterval(timer)
        }
    }, [])

    const allScans = useMemo(() => dedupeScans([...myScans, ...recentScans]), [myScans, recentScans])
    const activeScans = allScans.filter(scan => !['done', 'failed', 'error'].includes(scan.status.toLowerCase()))
    const failedScans = allScans.filter(scan => ['failed', 'error'].includes(scan.status.toLowerCase()))
    const latest = allScans[0]
    const p95 = latestP95(latest)
    const visibleHistory = historyView === 'mine' ? myScans : recentScans

    async function startCheck(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canStart || isStarting) return
        setIsStarting(true)
        setError('')
        const result = await postTest({ url: targetUrl, timeout: selectedScenario.timeout, stages: selectedScenario.stages })
        setIsStarting(false)
        if (!result.ok) {
            setError(result.error)
            return
        }
        router.push(`/test/${result.test.id}`)
    }

    return (
        <div className='grid gap-4'>
            <DashboardPanel className='overflow-hidden rounded-lg border-ui-border bg-ui-panel p-0 shadow-sm'>
                <div className='grid gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]'>
                    <div className='grid gap-4 p-4 sm:p-5 lg:p-6'>
                        <div className='max-w-3xl'>
                            <p className='inline-flex items-center gap-2 rounded-full border border-ui-primary/30 bg-ui-primary/10 px-3 py-1 text-xs font-semibold text-ui-primary'>
                                <ShieldCheck className='h-3.5 w-3.5' />
                                Permission-gated
                            </p>
                            <h2 className='mt-3 text-2xl font-semibold tracking-normal text-ui-text md:text-3xl'>Check an endpoint you control</h2>
                            <p className='mt-2 text-sm leading-6 text-ui-muted'>Run a permitted HTTP check, then open the result for latency, failures, logs, and response evidence.</p>
                        </div>
                        <form onSubmit={startCheck} className='grid gap-3'>
                            <div className='flex min-w-0 flex-col gap-2 xl:flex-row'>
                                <label className='relative min-w-0 flex-1'>
                                    <span className='sr-only'>Endpoint URL</span>
                                    <Globe2 className='absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ui-subtle' />
                                    <input
                                        className='h-12 w-full rounded-lg border border-ui-border bg-ui-panel pl-12 pr-4 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                                        value={targetUrl}
                                        onChange={(event) => setTargetUrl(event.target.value)}
                                        placeholder='https://api.example.com/health'
                                    />
                                </label>
                                <button
                                    type='submit'
                                    disabled={!canStart || isStarting}
                                    className='inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-ui-primary px-5 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
                                >
                                    <Search className='h-4 w-4' />
                                    {isStarting ? 'Starting' : 'Start check'}
                                </button>
                            </div>
                            <label className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${permissionConfirmed ? 'border-ui-success/35 bg-ui-success/10 text-ui-text' : 'border-ui-border bg-ui-raised text-ui-muted'}`} data-load-test-permission-gate>
                                <input
                                    type='checkbox'
                                    checked={permissionConfirmed}
                                    onChange={(event) => setPermissionConfirmed(event.target.checked)}
                                    className='mt-1 h-4 w-4 rounded border-ui-border text-ui-primary focus:ring-ui-primary/30'
                                />
                                <span className='grid gap-1'>
                                    <span className='font-semibold text-ui-text'>I own this endpoint or have written permission to test it.</span>
                                    <span className='text-xs leading-5 text-ui-muted'>{validTarget ? 'Ready for a baseline-safe check.' : 'Enter a valid HTTP/S endpoint before starting.'}</span>
                                </span>
                            </label>
                            <div className='flex flex-wrap items-center gap-2 text-xs text-ui-subtle'>
                                <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5 font-medium text-ui-text'>{selectedScenario.label}: {selectedScenario.detail}</span>
                                <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5'>{Math.round(selectedScenario.timeout / 1000)}s timeout</span>
                                <span className='rounded-md border border-ui-border bg-ui-raised px-2.5 py-1.5'>p95/p99 evidence</span>
                            </div>
                            <details className='rounded-lg border border-ui-border bg-ui-raised' data-load-test-scenario-disclosure>
                                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text transition hover:bg-ui-panel [&::-webkit-details-marker]:hidden'>
                                    <span>Scenario settings</span>
                                    <span className='text-xs font-medium text-ui-subtle'>Baseline by default</span>
                                </summary>
                                <div className='grid gap-2 border-t border-ui-border p-3 md:grid-cols-3'>
                                    {scenarioPresets.map((scenario) => (
                                        <button
                                            key={scenario.id}
                                            type='button'
                                            onClick={() => setScenarioId(scenario.id)}
                                            className={`grid min-h-[4.5rem] gap-1 rounded-lg border p-3 text-left transition ${scenario.id === scenarioId ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:border-ui-primary'}`}
                                        >
                                            <span className='flex items-center justify-between gap-2 text-sm font-semibold'>
                                                {scenario.label}
                                                {scenario.id === scenarioId ? <CheckCircle2 className='h-4 w-4 text-ui-success' /> : null}
                                            </span>
                                            <span className='text-xs leading-5 text-ui-subtle'>{scenario.detail}</span>
                                        </button>
                                    ))}
                                </div>
                            </details>
                            {error ? <p className='text-sm text-ui-danger'>{error}</p> : null}
                        </form>
                    </div>
                    <aside className='grid content-start gap-3 border-t border-ui-border bg-ui-raised p-4 lg:border-l lg:border-t-0'>
                        <h3 className='text-sm font-semibold text-ui-text'>Operations snapshot</h3>
                        <SnapshotRow icon={<Activity className='h-4 w-4' />} label='Now' value={activeScans.length ? `${activeScans.length} running` : 'No active checks'} tone={activeScans.length ? 'watch' : 'ok'} />
                        <SnapshotRow icon={<CheckCircle2 className='h-4 w-4' />} label='History' value={allScans.length ? `${allScans.length} recent` : 'No runs yet'} tone='neutral' />
                        <SnapshotRow icon={<Gauge className='h-4 w-4' />} label='Latest p95' value={p95 ? `${p95}ms` : 'Waiting for a run'} tone={p95 && p95 > 1000 ? 'watch' : 'ok'} />
                        <SnapshotRow icon={<AlertTriangle className='h-4 w-4' />} label='Failures' value={failedScans.length ? String(failedScans.length) : 'Clear'} tone={failedScans.length ? 'bad' : 'ok'} />
                        <SnapshotRow icon={<Gauge className='h-4 w-4' />} label='Latency' value='p95/p99 evidence' tone='neutral' />
                        <SnapshotRow icon={<ArrowRight className='h-4 w-4' />} label='Artifacts' value='logs + share link' tone='neutral' />
                        <details className='rounded-lg border border-ui-border bg-ui-panel' data-load-test-policy-disclosure>
                            <summary className='cursor-pointer list-none px-3 py-2 text-sm font-semibold text-ui-text [&::-webkit-details-marker]:hidden'>Policy and evidence</summary>
                            <div className='grid gap-2 border-t border-ui-border p-3'>
                                <PolicyRow label='Allowed target' value='HTTP/S endpoints you own or are permitted to test' />
                                <PolicyRow label='Evidence' value='status, p95 latency, failure rate, logs, errors' />
                                <PolicyRow label='Refresh' value={loadedAt ? loadedAt.toLocaleTimeString() : 'loading history'} />
                            </div>
                        </details>
                    </aside>
                </div>
            </DashboardPanel>

            <DashboardPanel className='overflow-hidden rounded-lg border-ui-border bg-ui-panel p-0 shadow-sm'>
                <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border bg-ui-raised px-4 py-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Result history</h2>
                        <p className='mt-1 text-sm text-ui-subtle'>Open a run to inspect the full evidence report.</p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <div className='inline-flex rounded-lg border border-ui-border bg-ui-panel p-1' role='group' aria-label='Choose result history'>
                            {(['mine', 'global'] as const).map((view) => (
                                <button
                                    key={view}
                                    type='button'
                                    onClick={() => setHistoryView(view)}
                                    className={`h-8 rounded-md px-3 text-xs font-semibold transition ${historyView === view ? 'bg-ui-primary text-ui-canvas' : 'text-ui-muted hover:bg-ui-raised'}`}
                                >
                                    {view === 'mine' ? 'My checks' : 'Global'}
                                </button>
                            ))}
                        </div>
                        <Link href='/test/stats' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'>
                            Results
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                </div>
                <div className='p-3'>
                    <RecentScans
                        title={historyView === 'mine' ? 'My endpoint checks' : 'Global endpoint checks'}
                        readyMessage={historyView === 'mine' ? 'Personal checks are ready.' : 'Global check state is updating.'}
                        scans={visibleHistory}
                        mine={historyView === 'mine'}
                        surface='premium'
                        className='min-h-[22rem] shadow-none'
                        listClassName='max-h-[24rem]'
                    />
                </div>
            </DashboardPanel>
        </div>
    )
}

function PolicyRow({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <p className='text-xs font-semibold uppercase text-ui-subtle'>{label}</p>
            <p className='mt-1 text-sm leading-5 text-ui-text'>{value}</p>
        </div>
    )
}

function isValidServiceUrl(value: string) {
    try {
        const url = new URL(value.trim())
        return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname.includes('.'))
    } catch {
        return false
    }
}

function SnapshotRow({ icon, label, value, tone }: { icon: ReactNode, label: string, value: string, tone: 'neutral' | 'ok' | 'watch' | 'bad' }) {
    const toneClass = tone === 'bad'
        ? 'text-ui-danger'
        : tone === 'watch'
            ? 'text-ui-warning'
            : tone === 'ok'
                ? 'text-ui-success'
                : 'text-ui-primary'

    return (
        <div className='flex items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-panel px-3 py-2'>
            <div className='min-w-0'>
                <p className='text-xs font-semibold uppercase text-ui-subtle'>{label}</p>
                <p className='truncate text-sm font-semibold text-ui-text'>{value}</p>
            </div>
            <span className={toneClass}>{icon}</span>
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

function latestP95(scan?: Test) {
    const value = scan?.latest_run_summary?.duration?.p95 ?? scan?.summary?.duration?.p95
    return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : null
}
