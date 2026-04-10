'use client'

import prettyDate from '@/utils/date/prettyDate'
import { ActivityIcon, ArrowRight, Eye, Fingerprint, UserRound } from 'lucide-react'
import Link from 'next/link'

type RecentScansProps = {
    title: string
    empty: string
    scans: Test[]
    mine?: boolean
}

export default function RecentScans({ title, empty, scans, mine = false }: RecentScansProps) {
    return (
        <section className='grid gap-3 rounded-xl border border-white/10 bg-white/4 p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-sm font-semibold text-bright'>{title}</h2>
                    <p className='text-xs text-bright/45'>{mine ? 'Your most recent load tests' : 'Latest load tests across the service'}</p>
                </div>
            </div>
            {!scans.length && (
                <div className='grid min-h-28 place-items-center rounded-lg border border-dashed border-white/10 text-sm text-bright/45'>
                    {empty}
                </div>
            )}
            {scans.length > 0 && (
                <div className='grid gap-2'>
                    {scans.map((scan) => (
                        <Link
                            key={scan.id}
                            href={`/test/${scan.id}`}
                            className='grid gap-2 rounded-lg border border-white/8 bg-white/3 px-3 py-3 transition hover:bg-white/7'
                        >
                            <div className='flex items-center justify-between gap-3'>
                                <div className='min-w-0'>
                                    <div className='truncate text-sm font-medium text-bright/90'>{scan.url}</div>
                                    <div className='mt-1 flex flex-wrap items-center gap-3 text-xs text-bright/45'>
                                        <span className='flex items-center gap-1'><Fingerprint className='h-3.5 w-3.5' /> {scan.id}</span>
                                        <span className='flex items-center gap-1'><ActivityIcon className='h-3.5 w-3.5' /> {scan.status}</span>
                                        <span className='flex items-center gap-1'><Eye className='h-3.5 w-3.5' /> {scan.visits}</span>
                                        {mine && <span className='flex items-center gap-1'><UserRound className='h-3.5 w-3.5' /> mine</span>}
                                    </div>
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
