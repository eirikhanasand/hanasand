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

export default function TestPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const router = useRouter()
    const [path, setPath] = useState('')
    const [recentScans, setRecentScans] = useState<Test[]>([])
    const [myScans, setMyScans] = useState<Test[]>([])
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

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()
        if (!isValidLink) {
            return
        }

        const result = await postTest({ url: path })
        if (!result) {
            return setError('Please try again later.')
        }

        if (result.id) {
            router.push(`/test/${result.id}`)
        }
    }

    if (created) {
        return (
            <button type='button' onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex max-w-full cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.045] px-3 py-2 text-left transition hover:bg-white/[0.07]'>
                <Copy height={15} width={15} className={`shrink-0 ${didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-gray-200' : 'stroke-red-500'}`} />
                <span className='min-w-0 break-all text-sm text-bright/78'>{fullUrl}</span>
            </button>
        )
    }

    return (
        <div className='grid h-full w-full min-w-0 grid-rows-[auto_minmax(0,1fr)_minmax(0,1fr)] items-stretch gap-3 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(18rem,0.74fr)_minmax(20rem,0.9fr)] lg:grid-rows-1 xl:grid-cols-[minmax(22rem,0.72fr)_minmax(22rem,0.82fr)_minmax(24rem,0.94fr)]'>
            <section className='grid min-h-0 min-w-0 content-center gap-4 rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:p-5'>
                <div>
                    <h2 className='text-lg font-medium text-bright/92'>Load test launcher</h2>
                    <p className='mt-1.5 max-w-2xl text-sm leading-6 text-bright/52'>Start a scan, share the generated test link, then revisit the result when the run finishes.</p>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-4'>
                    <ErrorNotice compact message={error as string | null} />
                    <input
                        className='z-10 h-11 w-full rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm font-normal text-bright outline-none transition placeholder:text-bright/30 focus:border-[#f07d33]/55 focus:bg-white/[0.065]'
                        placeholder='https://example.com'
                        onChange={(e) => setPath(e.target.value)}
                        value={path}
                        required
                    />
                    <div className='flex flex-wrap gap-3'>
                        <button
                            type='submit'
                            disabled={!isValidLink}
                            className='h-10 rounded-lg bg-bright/88 px-3.5 text-sm font-medium text-background/90 transition hover:bg-bright disabled:cursor-not-allowed disabled:bg-white/[0.055] disabled:text-bright/34'
                        >
                            Start scan
                        </button>
                    </div>
                </form>
            </section>
            <RecentScans title='My Recent Runs' empty='No personal scans yet.' scans={myScans} mine className='h-full' />
            <RecentScans title='Global Recent Scans' empty='No scans recorded yet.' scans={recentScans} className='h-full' />
        </div>
    )
}
