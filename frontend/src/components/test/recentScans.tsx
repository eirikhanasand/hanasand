'use client'

import prettyDate from '@/utils/date/prettyDate'
import { ActivityIcon, ArrowRight, Eye, Fingerprint, Inbox, Timer, TrendingDown, TrendingUp, UserRound } from 'lucide-react'
import Link from 'next/link'

type RecentScansProps = {
    title: string
    readyMessage: string
    scans: Test[]
    mine?: boolean
    className?: string
    listClassName?: string
    surface?: 'default' | 'premium'
}

export default function RecentScans({ title, readyMessage, scans, mine = false, className = '', listClassName = '', surface = 'default' }: RecentScansProps) {
    const premium = surface === 'premium'
    const sectionClass = premium
        ? 'border-ui-border bg-ui-panel shadow-[0_18px_45px_rgba(16,24,40,0.08)]'
        : 'border-ui-border bg-ui-panel shadow-sm'
    const titleClass = premium ? 'text-ui-text' : 'text-ui-text'
    const mutedClass = premium ? 'text-ui-muted' : 'text-ui-muted'
    const emptyClass = premium
        ? 'border-ui-border bg-ui-raised text-ui-muted'
        : 'border-ui-border bg-ui-raised text-ui-muted'
    const emptyIconClass = premium
        ? 'border-ui-border bg-ui-panel text-ui-primary'
        : 'border-ui-border bg-ui-panel text-ui-primary'
    const itemClass = premium
        ? 'border-ui-border bg-ui-panel hover:border-ui-border hover:bg-ui-raised hover:shadow-[0_12px_28px_rgba(16,24,40,0.08)]'
        : 'border-ui-border bg-ui-raised hover:border-ui-primary hover:bg-ui-panel hover:shadow-sm'
    const badgeClass = premium ? 'border-ui-border bg-ui-raised' : 'border-ui-border bg-ui-panel'
    return (
        <section className={`grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-xl border p-4 ${sectionClass} ${className}`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className={`text-sm font-semibold ${titleClass}`}>{title}</h2>
                    <p className={`text-xs ${mutedClass}`}>{mine ? 'Your most recent service checks' : 'Latest permitted checks across the service'}</p>
                </div>
            </div>
            {!scans.length && (
                <div className={`grid h-full min-h-48 place-items-center rounded-lg border border-dashed p-4 text-center text-sm ${emptyClass}`}>
                    <div>
                        <div className={`mx-auto grid h-10 w-10 place-items-center rounded-lg border ${emptyIconClass}`}>
                            <Inbox className='h-5 w-5' />
                        </div>
                        <p className={`mt-3 font-medium ${titleClass}`}>{readyMessage}</p>
                        <p className={`mt-1 text-xs leading-5 ${mutedClass}`}>
                            {mine ? 'Runs you start from this browser stream here.' : 'New public run summaries stream here automatically.'}
                        </p>
                    </div>
                </div>
            )}
            {scans.length > 0 && (
                <div className={`grid min-h-0 content-start gap-2 overflow-y-auto pr-1 ${listClassName}`}>
                    {scans.map((scan) => (
                        <Link
                            key={scan.id}
                            href={`/test/${scan.id}`}
                            className={`group grid min-w-0 content-start gap-3 rounded-lg border px-3 py-3 transition ${itemClass}`}
                        >
                            <div className='flex min-w-0 items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className={`truncate text-sm font-medium ${titleClass}`}>{scan.url}</div>
                                    <div className={`mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs ${mutedClass}`}>
                                        <span className={`inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border px-2 py-1 ${badgeClass}`}><Fingerprint className='h-3.5 w-3.5 shrink-0' /> <span className='min-w-0 break-all'>{scan.id}</span></span>
                                        <StatusPill status={scan.status} surface={surface} />
                                        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${badgeClass}`}><Eye className='h-3.5 w-3.5 shrink-0' /> {scan.visits}</span>
                                        {mine && <span className='flex items-center gap-1'><UserRound className='h-3.5 w-3.5 shrink-0' /> mine</span>}
                                    </div>
                                    <ScanStats scan={scan} surface={surface} />
                                </div>
                                <ArrowRight className={`mt-1 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 ${premium ? 'text-ui-muted group-hover:text-ui-primary' : 'text-ui-muted group-hover:text-ui-primary'}`} />
                            </div>
                            <div className={`border-t pt-2 text-xs ${premium ? 'border-ui-border text-ui-muted' : 'border-ui-border text-ui-muted'}`}>{prettyDate(scan.created_at)}</div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    )
}

function StatusPill({ status, surface }: { status: string, surface: RecentScansProps['surface'] }) {
    const normalized = status.toLowerCase()
    const premium = surface === 'premium'
    const tone = premium
        ? normalized === 'done'
            ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
            : normalized === 'error' || normalized === 'failed'
                ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
                : 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
        : normalized === 'done'
            ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
            : normalized === 'error' || normalized === 'failed'
                ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
                : 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'

    return (
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium ${tone}`}>
            <ActivityIcon className='h-3.5 w-3.5 shrink-0' />
            {status}
        </span>
    )
}

function ScanStats({ scan, surface }: { scan: Test, surface: RecentScansProps['surface'] }) {
    const summary = (scan.latest_run_summary || scan.summary || {}) as {
        requests?: number
        duration?: { p95?: number }
        failureRate?: number
    }
    const hasRequests = typeof summary.requests === 'number' && summary.requests > 0
    const p95 = summary.duration?.p95
    const failureRate = typeof summary.failureRate === 'number' ? summary.failureRate * 100 : null
    const delta = scan.p95_delta_ms

    if (!hasRequests && typeof delta !== 'number') {
        return null
    }

    return (
        <div className={`mt-2 flex min-w-0 flex-wrap gap-2 text-[11px] ${surface === 'premium' ? 'text-ui-muted' : 'text-ui-muted'}`}>
            {hasRequests && typeof p95 === 'number' && p95 > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${surface === 'premium' ? 'border-ui-border bg-ui-raised' : 'border-ui-border bg-ui-panel'}`}>
                    <Timer className='h-3 w-3' />
                    p95 {Math.round(p95)}ms
                </span>
            )}
            {hasRequests && typeof failureRate === 'number' && (
                <span className={`rounded-md border px-2 py-1 ${surface === 'premium' ? 'border-ui-border bg-ui-raised' : 'border-ui-border bg-ui-panel'}`}>
                    fail {failureRate.toFixed(1)}%
                </span>
            )}
            {hasRequests && typeof delta === 'number' && Math.abs(delta) > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${surface === 'premium'
                    ? delta >= 0
                        ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
                        : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
                    : delta >= 0
                        ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
                        : 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
                }`}>
                    {delta >= 0 ? <TrendingUp className='h-3 w-3' /> : <TrendingDown className='h-3 w-3' />}
                    {delta >= 0 ? 'faster' : 'slower'} {Math.abs(Math.round(delta))}ms
                </span>
            )}
        </div>
    )
}
