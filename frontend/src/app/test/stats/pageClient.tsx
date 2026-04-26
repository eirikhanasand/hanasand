'use client'

import Notify from '@/components/notify/notify'
import RecentScans from '@/components/test/recentScans'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { fetchTest } from '@/utils/test/fetchTest'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import prettyDate from '@/utils/date/prettyDate'
import { ArrowLeft, ChartColumn, Eye, Globe, Rocket, Watch } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

export default function TestStatsPageClient() {
    const [query, setQuery] = useState('')
    const [test, setTest] = useState<Test | null>(null)
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const color = query.length > 0
        ? 'bg-orange-500/80 cursor-pointer glow-orange-small outline outline-dark'
        : 'outline outline-dark cursor-not-allowed'

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

        if (query.length <= 0) {
            return
        }

        const result = await fetchTest(query)
        if (!result) {
            return setError('Please try again later.')
        }

        setTest(result)
    }

    return (
        <div className='grid w-full min-w-0 items-start gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
            <section className='grid min-w-0 gap-4 rounded-xl border border-white/10 bg-white/4 p-4'>
                <div className='flex gap-2'>
                    <ChartColumn className='stroke-orange-500' />
                    <h1 className='text-xl'>Test Results</h1>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-2'>
                    <Notify message={error} />
                    <input
                        className='outline outline-dark w-full rounded-md px-2 py-2 z-10'
                        placeholder='Scan id'
                        onChange={(e) => setQuery(e.target.value)}
                        value={query}
                        required
                    />
                    <button
                        type='submit'
                        className={`${color} w-full rounded-lg px-2 py-2 text-gray-300`}
                    >
                        Search
                    </button>
                </form>
                {test && (
                    <div className='grid min-w-0 gap-3 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-bright/80'>
                        <div className='flex min-w-0 gap-2'><Rocket className='h-4 w-4 shrink-0' /><h1 className='min-w-0 wrap-break-word'>{test.id}</h1></div>
                        <div className='flex min-w-0 gap-2'><Globe className='h-4 w-4 shrink-0' /><h1 className='min-w-0 break-all'>{test.url}</h1></div>
                        <div className='flex min-w-0 gap-2'><Watch className='h-4 w-4 shrink-0' /><h1 className='min-w-0 wrap-break-word'>{prettyDate(test.created_at)}</h1></div>
                        <div className='flex min-w-0 gap-2'><Eye className='h-4 w-4 shrink-0' /><h1 className='min-w-0 wrap-break-word'>{test.visits}</h1></div>
                        <Link href={`/test/${test.id}`} className='mt-2 rounded-lg border border-white/10 bg-white/6 px-3 py-2 text-center text-sm hover:bg-white/10'>
                            Open Scan
                        </Link>
                    </div>
                )}
                <div className='mt-auto flex justify-end'>
                    <Link href='/test' className='group rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                        <ArrowLeft className='group-hover:stroke-[#e25822]' />
                    </Link>
                </div>
            </section>
            <section className='grid min-w-0 gap-4'>
                <RecentScans title='My Recent Scans' empty='No personal scans yet.' scans={myScans} mine />
                <RecentScans title='Recent Scans' empty='No recent scans yet.' scans={recentScans} />
            </section>
        </div>
    )
}
