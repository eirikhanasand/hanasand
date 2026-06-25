'use client'

import ErrorNotice from '@/components/error/errorNotice'
import RecentScans from '@/components/test/recentScans'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { Copy } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

const freeTryLimit = 5
const freeTryStorageKey = 'hanasand:load-testing-free-tries'

export default function TestPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const router = useRouter()
    const [path, setPath] = useState('')
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const [freeTriesUsed, setFreeTriesUsed] = useState(0)
    const isValidLink =
        (path.includes('http://') && path.includes('.') && path.length >= 10)
        || (path.includes('https://') && path.includes('.') && path.length >= 11)
    const fullUrl = `${config.url.link}/${serverId}`
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
        if (freeTriesUsed >= freeTryLimit) {
            return setError('The free load-testing allowance has been used. Choose a plan to keep running checks.')
        }

        const result = await postTest({ url: path })
        if (!result) {
            return setError('Please try again later.')
        }

        if (result.id) {
            setFreeTriesUsed(incrementFreeTriesUsed())
            router.push(`/test/${result.id}`)
        }
    }

    if (created) {
        return (
            <button type='button' onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 py-2 text-left transition hover:border-[#bdc7d5]'>
                <Copy height={15} width={15} className={`shrink-0 ${didCopy === true ? 'stroke-[#147a3b]' : didCopy === false ? 'stroke-[#667085]' : 'stroke-[#b42318]'}`} />
                <span className='min-w-0 break-all text-sm text-[#344054]'>{fullUrl}</span>
            </button>
        )
    }

    return (
        <div className='grid h-full w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-3 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(18rem,0.74fr)_minmax(20rem,0.9fr)] lg:grid-rows-1 xl:grid-cols-[minmax(22rem,0.72fr)_minmax(22rem,0.82fr)_minmax(24rem,0.94fr)]'>
            <section className='grid min-h-0 min-w-0 content-center gap-4 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-sm sm:p-5'>
                <div>
                    <h2 className='text-lg font-semibold text-[#171a21]'>Service check launcher</h2>
                    <p className='mt-1.5 max-w-2xl text-sm leading-6 text-[#596170]'>Start a permitted endpoint check, share the result link, then revisit the report when it finishes.</p>
                    <p className='mt-2 inline-flex w-fit rounded-full bg-[#eef3ff] px-2.5 py-1 text-xs font-semibold text-[#3056d3]'>
                        {Math.max(0, freeTryLimit - freeTriesUsed)} free check{Math.max(0, freeTryLimit - freeTriesUsed) === 1 ? '' : 's'} remaining
                    </p>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-4'>
                    <ErrorNotice compact message={error as string | null} />
                    <input
                        className='z-10 h-11 w-full rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                        placeholder='https://example.com'
                        onChange={(e) => setPath(e.target.value)}
                        value={path}
                        required
                    />
                    <div className='flex flex-wrap gap-3'>
                        <button
                            type='submit'
                            disabled={!isValidLink || freeTriesUsed >= freeTryLimit}
                            className='h-10 rounded-lg bg-[#171a21] px-3.5 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:border disabled:border-[#d8dee9] disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
                        >
                            Start check
                        </button>
                        {freeTriesUsed >= freeTryLimit ? (
                            <button
                                type='button'
                                onClick={() => router.push('/dashboard/subscription')}
                                className='h-10 rounded-lg border border-[#d8dee9] bg-white px-3.5 text-sm font-semibold text-[#344054] transition hover:bg-[#f2f5f9]'
                            >
                                Choose a plan
                            </button>
                        ) : null}
                    </div>
                </form>
            </section>
            <RecentScans title='My Recent Runs' empty='No personal scans yet.' scans={myScans} mine className='h-full' />
            <RecentScans title='Global Recent Scans' empty='No scans recorded yet.' scans={recentScans} className='h-full' />
        </div>
    )
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
