'use client'

import prettyDate from '@/utils/date/prettyDate'
import { ActivityIcon, ArrowRight, Eye, Fingerprint, Timer, TrendingDown, TrendingUp, UserRound } from 'lucide-react'
import Link from 'next/link'

type RecentScansProps = {
    title: string
    empty: string
    scans: Test[]
    mine?: boolean
    className?: string
    listClassName?: string
}

export default function RecentScans({ title, empty, scans, mine = false, className = '', listClassName = '' }: RecentScansProps) {
    return (
        <section className={`grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-xl border border-white/10 bg-white/4 p-4 ${className}`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold text-bright'>{title}</h2>
                    <p className='text-xs text-bright/45'>{mine ? 'Your most recent load tests' : 'Latest load tests across the service'}</p>
                </div>
            </div>
            {!scans.length && (
                <div className='grid h-full min-h-0 place-items-center rounded-lg border border-dashed border-white/10 text-sm text-bright/45'>
                    {empty}
                </div>
            )}
            {scans.length > 0 && (
                <div className={`grid min-h-0 gap-2 overflow-y-auto pr-1 ${listClassName}`}>
                    {scans.map((scan) => (
                        <Link
                            key={scan.id}
                            href={`/test/${scan.id}`}
                            className='grid min-w-0 gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-3 transition hover:bg-white/7'
                        >
                            <div className='flex min-w-0 items-center justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm font-medium text-bright/90'>{scan.url}</div>
                                    <div className='mt-1 flex min-w-0 flex-wrap items-center gap-3 text-xs text-bright/45'>
                                        <span className='flex min-w-0 items-center gap-1'><Fingerprint className='h-3.5 w-3.5 shrink-0' /> <span className='min-w-0 break-all'>{scan.id}</span></span>
                                        <span className='flex items-center gap-1'><ActivityIcon className='h-3.5 w-3.5 shrink-0' /> {scan.status}</span>
                                        <span className='flex items-center gap-1'><Eye className='h-3.5 w-3.5 shrink-0' /> {scan.visits}</span>
                                        {mine && <span className='flex items-center gap-1'><UserRound className='h-3.5 w-3.5 shrink-0' /> mine</span>}
                                    </div>
                                    <ScanStats scan={scan} />
                                </div>
                                <ArrowRight className='h-4 w-4 shrink-0 text-bright/35' />
                            </div>
                            <div className='text-xs text-bright/40'>{prettyDate(scan.created_at)}</div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    )
}

function ScanStats({ scan }: { scan: Test }) {
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
        <div className='mt-2 flex min-w-0 flex-wrap gap-2 text-[11px] text-bright/55'>
            {hasRequests && typeof p95 === 'number' && p95 > 0 && (
                <span className='inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1'>
                    <Timer className='h-3 w-3' />
                    p95 {Math.round(p95)}ms
                </span>
            )}
            {hasRequests && typeof failureRate === 'number' && (
                <span className='rounded-md bg-white/5 px-2 py-1'>
                    fail {failureRate.toFixed(1)}%
                </span>
            )}
            {hasRequests && typeof delta === 'number' && Math.abs(delta) > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${delta >= 0 ? 'bg-green-400/10 text-green-300' : 'bg-red-400/10 text-red-300'}`}>
                    {delta >= 0 ? <TrendingUp className='h-3 w-3' /> : <TrendingDown className='h-3 w-3' />}
                    {delta >= 0 ? 'faster' : 'slower'} {Math.abs(Math.round(delta))}ms
                </span>
            )}
        </div>
    )
}
