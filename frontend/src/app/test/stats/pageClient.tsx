'use client'

import ErrorNotice from '@/components/error/errorNotice'
import RecentScans from '@/components/test/recentScans'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { fetchTest } from '@/utils/test/fetchTest'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import prettyDate from '@/utils/date/prettyDate'
import { ArrowLeft, ArrowRight, ChartColumn, Eye, Globe, Rocket, Watch } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, ReactNode, useEffect, useState } from 'react'

export default function TestStatsPageClient() {
    const [query, setQuery] = useState('')
    const [test, setTest] = useState<Test | null>(null)
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const canSearch = query.trim().length > 0

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

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()

        if (!canSearch) {
            return
        }

        const result = await fetchTest(query)
        if (!result) {
            return setError('Please try again later.')
        }

        setTest(result)
    }

    return (
        <div className='grid h-full w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] items-stretch gap-3 overflow-hidden p-4 md:p-5 lg:grid-cols-[minmax(21rem,0.72fr)_minmax(0,1.28fr)] lg:grid-rows-1 xl:grid-cols-[minmax(23rem,0.64fr)_minmax(0,1.36fr)]'>
            <section className='grid min-h-0 min-w-0 content-start gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-4'>
                <div className='flex items-start justify-between gap-3 border-b border-white/8 pb-3'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <ChartColumn className='h-4 w-4 stroke-orange-500' />
                            <h1 className='text-base font-semibold text-bright/92'>Service check results</h1>
                        </div>
                        <p className='mt-1.5 text-sm leading-5 text-bright/50'>Find a check by scan id, then open the full report.</p>
                    </div>
                    <Link href='/test' className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-xs font-medium text-bright/62 transition hover:bg-white/[0.07] hover:text-bright/82'>
                        <ArrowLeft className='h-4 w-4' />
                        New check
                    </Link>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-3'>
                    <ErrorNotice compact message={error as string | null} />
                    <input
                        className='z-10 h-10 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-normal text-bright outline-none transition placeholder:text-bright/30 focus:border-[#f07d33]/55 focus:bg-white/[0.065]'
                        placeholder='Scan id'
                        onChange={(e) => setQuery(e.target.value)}
                        value={query}
                        required
                    />
                    <button
                        type='submit'
                        disabled={!canSearch}
                        className='h-10 w-full rounded-lg bg-bright/88 px-3 text-sm font-medium text-background/90 transition hover:bg-bright disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-bright/34'
                    >
                        Search
                    </button>
                </form>
                {test && (
                    <div className='grid min-w-0 gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-bright/74'>
                        <ResultRow icon={<Rocket className='h-4 w-4' />} label='Scan' value={test.id} />
                        <ResultRow icon={<Globe className='h-4 w-4' />} label='URL' value={test.url} breakAll />
                        <ResultRow icon={<Watch className='h-4 w-4' />} label='Created' value={prettyDate(test.created_at)} />
                        <ResultRow icon={<Eye className='h-4 w-4' />} label='Visits' value={String(test.visits)} />
                        <Link href={`/test/${test.id}`} className='mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.055] px-3 text-sm font-medium text-bright/78 transition hover:bg-white/[0.075]'>
                            Open Scan
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                )}
            </section>
            <section className='grid min-h-0 min-w-0 grid-cols-1 gap-3 lg:grid-cols-2'>
                <RecentScans title='My Recent Scans' empty='No personal scans yet.' scans={myScans} mine className='hidden lg:grid' />
                <RecentScans title='Recent Scans' empty='No recent scans yet.' scans={recentScans} />
            </section>
        </div>
    )
}

function ResultRow({ icon, label, value, breakAll = false }: { icon: ReactNode, label: string, value: string, breakAll?: boolean }) {
    return (
        <div className='grid min-w-0 grid-cols-[1rem_minmax(4rem,0.28fr)_minmax(0,1fr)] items-center gap-2 text-xs'>
            <span className='text-bright/46'>{icon}</span>
            <span className='text-bright/40'>{label}</span>
            <span className={`min-w-0 text-bright/72 ${breakAll ? 'break-all' : 'truncate'}`}>{value}</span>
        </div>
    )
}
