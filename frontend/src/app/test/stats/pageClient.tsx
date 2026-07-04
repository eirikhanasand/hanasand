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
            <section className='grid min-h-0 min-w-0 content-start gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                <div className='flex items-start justify-between gap-3 border-b border-ui-border pb-3'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <ChartColumn className='h-4 w-4 text-ui-primary' />
                            <h1 className='text-base font-semibold text-ui-text'>Service check results</h1>
                        </div>
                        <p className='mt-1.5 text-sm leading-5 text-ui-muted'>Find a check by scan id, then open the full report.</p>
                    </div>
                    <Link href='/test' className='inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:border-ui-border'>
                        <ArrowLeft className='h-4 w-4' />
                        New check
                    </Link>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-3'>
                    <ErrorNotice compact message={error as string | null} />
                    <input
                        className='z-10 h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                        placeholder='Scan id'
                        onChange={(e) => setQuery(e.target.value)}
                        value={query}
                        required
                    />
                    <button
                        type='submit'
                        disabled={!canSearch}
                        className='h-10 w-full rounded-lg bg-ui-text px-3 text-sm font-semibold text-ui-canvas transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
                    >
                        Search
                    </button>
                </form>
                {test && (
                    <div className='grid min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
                        <ResultRow icon={<Rocket className='h-4 w-4' />} label='Scan' value={test.id} />
                        <ResultRow icon={<Globe className='h-4 w-4' />} label='URL' value={test.url} breakAll />
                        <ResultRow icon={<Watch className='h-4 w-4' />} label='Created' value={prettyDate(test.created_at)} />
                        <ResultRow icon={<Eye className='h-4 w-4' />} label='Visits' value={String(test.visits)} />
                        <Link href={`/test/${test.id}`} className='mt-1 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-border'>
                            Open Scan
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    </div>
                )}
            </section>
            <section className='grid min-h-0 min-w-0 grid-cols-1 gap-3 lg:grid-cols-2'>
                <RecentScans title='My Recent Scans' readyMessage='Personal check lane is ready.' scans={myScans} mine className='hidden lg:grid' />
                <RecentScans title='Recent Scans' readyMessage='Global check lane is listening.' scans={recentScans} />
            </section>
        </div>
    )
}

function ResultRow({ icon, label, value, breakAll = false }: { icon: ReactNode, label: string, value: string, breakAll?: boolean }) {
    return (
        <div className='grid min-w-0 grid-cols-[1rem_minmax(4rem,0.28fr)_minmax(0,1fr)] items-center gap-2 text-xs'>
            <span className='text-ui-muted'>{icon}</span>
            <span className='text-ui-muted'>{label}</span>
            <span className={`min-w-0 text-ui-text ${breakAll ? 'break-all' : 'truncate'}`}>{value}</span>
        </div>
    )
}
