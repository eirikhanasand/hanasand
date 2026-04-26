'use client'

import Notify from '@/components/notify/notify'
import RecentScans from '@/components/test/recentScans'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { Copy } from 'lucide-react'
import { redirect } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

export default function TestPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const [path, setPath] = useState('')
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
    const isValidLink =
        (path.includes('http://') && path.includes('.') && path.length >= 10)
        || (path.includes('https://') && path.includes('.') && path.length >= 11)
    const color = isValidLink ? 'bg-orange-500/80 cursor-pointer glow-orange-small' : path.length > 0 ? 'bg-red-500 cursor-not-allowed glow-red' : 'outline outline-dark cursor-not-allowed'
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

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        if (!isValidLink) {
            return
        }

        e.preventDefault()
        const result = await postTest({ url: path })
        if (!result) {
            return setError('Please try again later.')
        }

        if (result.id) {
            redirect(`/test/${result.id}`)
        }
    }

    if (created) {
        return (
            <div onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex max-w-full cursor-pointer items-center gap-2 rounded-xl bg-dark px-4 py-1'>
                <Copy height={15} width={15} className={`shrink-0 ${didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-gray-200' : 'stroke-red-500'}`} />
                <h1 className='min-w-0 break-all'>{serverId}</h1>
            </div>
        )
    }

    return (
        <div className='grid w-full min-w-0 max-w-6xl items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]'>
            <section className='grid min-w-0 gap-5 rounded-2xl border border-white/10 bg-white/4 p-5 sm:p-6'>
                <div>
                    <h2 className='text-xl font-semibold text-bright'>Load Test Launcher</h2>
                    <p className='mt-2 max-w-2xl text-sm leading-6 text-bright/55'>Create a fresh scan every time, then revisit or rerun from its result page.</p>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-4'>
                    <Notify message={error} />
                    <input
                        className='outline outline-dark z-10 w-full rounded-xl px-4 py-3 focus:outline-hidden'
                        placeholder='https://example.com'
                        onChange={(e) => setPath(e.target.value)}
                        value={path}
                        required
                    />
                    <div className='flex flex-wrap gap-3'>
                        <button
                            type='submit'
                            className={`${color} rounded-xl px-4 py-2.5 text-sm font-medium text-gray-300`}
                        >
                            Start Scan
                        </button>
                    </div>
                </form>
            </section>
            <section className='grid min-w-0 gap-4'>
                <RecentScans title='My Recent Scans' empty='No personal scans yet.' scans={myScans} mine />
                <RecentScans title='Recent Scans' empty='No scans recorded yet.' scans={recentScans} />
            </section>
        </div>
    )
}
