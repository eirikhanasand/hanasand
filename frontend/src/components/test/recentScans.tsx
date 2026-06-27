'use client'

import prettyDate from '@/utils/date/prettyDate'
import { ActivityIcon, ArrowRight, Eye, Fingerprint, Inbox, Timer, TrendingDown, TrendingUp, UserRound } from 'lucide-react'
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
        <section className={`grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm ${className}`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold text-[#171a21]'>{title}</h2>
                    <p className='text-xs text-[#667085]'>{mine ? 'Your most recent service checks' : 'Latest permitted checks across the service'}</p>
                </div>
            </div>
            {!scans.length && (
                <div className='grid h-full min-h-48 place-items-center rounded-lg border border-dashed border-[#cfd7e4] bg-[#f8fafc] p-4 text-center text-sm text-[#667085]'>
                    <div>
                        <div className='mx-auto grid h-10 w-10 place-items-center rounded-lg border border-[#dfe5ee] bg-white text-[#3056d3]'>
                            <Inbox className='h-5 w-5' />
                        </div>
                        <p className='mt-3 font-medium text-[#344054]'>{empty}</p>
                        <p className='mt-1 text-xs leading-5 text-[#667085]'>
                            {mine ? 'Runs you start from this browser will appear here.' : 'New public run summaries will appear here automatically.'}
                        </p>
                    </div>
                </div>
            )}
            {scans.length > 0 && (
                <div className={`grid min-h-0 gap-2 overflow-y-auto pr-1 ${listClassName}`}>
                    {scans.map((scan) => (
                        <Link
                            key={scan.id}
                            href={`/test/${scan.id}`}
                            className='group grid min-w-0 gap-3 rounded-lg border border-[#e0e5ed] bg-[#f8fafc] px-3 py-3 transition hover:border-[#bdc7d5] hover:bg-white hover:shadow-sm'
                        >
                            <div className='flex min-w-0 items-start justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm font-medium text-[#171a21]'>{scan.url}</div>
                                    <div className='mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-[#667085]'>
                                        <span className='inline-flex min-w-0 max-w-full items-center gap-1 rounded-md border border-[#e0e5ed] bg-white px-2 py-1'><Fingerprint className='h-3.5 w-3.5 shrink-0' /> <span className='min-w-0 break-all'>{scan.id}</span></span>
                                        <StatusPill status={scan.status} />
                                        <span className='inline-flex items-center gap-1 rounded-md border border-[#e0e5ed] bg-white px-2 py-1'><Eye className='h-3.5 w-3.5 shrink-0' /> {scan.visits}</span>
                                        {mine && <span className='flex items-center gap-1'><UserRound className='h-3.5 w-3.5 shrink-0' /> mine</span>}
                                    </div>
                                    <ScanStats scan={scan} />
                                </div>
                                <ArrowRight className='mt-1 h-4 w-4 shrink-0 text-[#98a2b3] transition group-hover:translate-x-0.5 group-hover:text-[#3056d3]' />
                            </div>
                            <div className='border-t border-[#e0e5ed] pt-2 text-xs text-[#667085]'>{prettyDate(scan.created_at)}</div>
                        </Link>
                    ))}
                </div>
            )}
        </section>
    )
}

function StatusPill({ status }: { status: string }) {
    const normalized = status.toLowerCase()
    const tone = normalized === 'done'
        ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#11612f]'
        : normalized === 'error' || normalized === 'failed'
            ? 'border-[#fecdca] bg-[#fff1f0] text-[#912018]'
            : 'border-[#f8df9b] bg-[#fff8e1] text-[#8a5a00]'

    return (
        <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium ${tone}`}>
            <ActivityIcon className='h-3.5 w-3.5 shrink-0' />
            {status}
        </span>
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
        <div className='mt-2 flex min-w-0 flex-wrap gap-2 text-[11px] text-[#596170]'>
            {hasRequests && typeof p95 === 'number' && p95 > 0 && (
                <span className='inline-flex items-center gap-1 rounded-md border border-[#e0e5ed] bg-white px-2 py-1'>
                    <Timer className='h-3 w-3' />
                    p95 {Math.round(p95)}ms
                </span>
            )}
            {hasRequests && typeof failureRate === 'number' && (
                <span className='rounded-md border border-[#e0e5ed] bg-white px-2 py-1'>
                    fail {failureRate.toFixed(1)}%
                </span>
            )}
            {hasRequests && typeof delta === 'number' && Math.abs(delta) > 0 && (
                <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 ${delta >= 0 ? 'border-[#bde8ca] bg-[#e9f8ef] text-[#11612f]' : 'border-[#ffd1d1] bg-[#fff1f1] text-[#b42318]'}`}>
                    {delta >= 0 ? <TrendingUp className='h-3 w-3' /> : <TrendingDown className='h-3 w-3' />}
                    {delta >= 0 ? 'faster' : 'slower'} {Math.abs(Math.round(delta))}ms
                </span>
            )}
        </div>
    )
}
