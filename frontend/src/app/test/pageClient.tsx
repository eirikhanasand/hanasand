'use client'

import Notify from '@/components/notify/notify'
import RecentScans from '@/components/test/recentScans'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { fetchRecentTests } from '@/utils/test/fetchRecentTests'
import { postTest } from '@/utils/test/postTest'
import { saveCodexLoadTestDraft } from '@/utils/test/storage'
import { Bot, Copy, Sparkles } from 'lucide-react'
import { redirect } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'

export default function TestPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const [path, setPath] = useState('')
    const [codexPrompt, setCodexPrompt] = useState('Run a load test for this site and summarize the performance profile.')
    const [codexNotice, setCodexNotice] = useState('')
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

    function prepareCodexLoadTest() {
        if (!isValidLink) {
            return setCodexNotice('Add a valid URL first.')
        }

        saveCodexLoadTestDraft({
            createdAt: new Date().toISOString(),
            source: 'load-test',
            url: path,
            timeout: 1,
            notes: codexPrompt
        })
        setCodexNotice('Prepared for Hanasand AI.')
    }

    if (created) {
        return (
            <div onClick={() => copy({ text: fullUrl, setDidCopy })} className='flex gap-2 cursor-pointer items-center bg-dark px-4 py-1 rounded-xl'>
                <Copy height={15} width={15} className={didCopy === true ? 'stroke-green-600' : didCopy === false ? 'stroke-gray-200' : 'stroke-red-500'} />
                <h1>{serverId}</h1>
            </div>
        )
    }

    return (
        <div className='grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]'>
            <section className='grid gap-4 rounded-2xl border border-white/10 bg-white/4 p-5'>
                <div>
                    <h2 className='text-xl font-semibold text-bright'>Load Test Launcher</h2>
                    <p className='mt-1 text-sm text-bright/55'>Create a fresh scan every time, then revisit or rerun from its result page.</p>
                </div>
                <form onSubmit={handleSubmit} className='grid gap-3'>
                    <Notify message={error} />
                    <input
                        className='outline outline-dark w-full rounded-lg px-3 py-2.5 focus:outline-hidden z-10'
                        placeholder='https://example.com'
                        onChange={(e) => setPath(e.target.value)}
                        value={path}
                        required
                    />
                    <div className='flex flex-wrap gap-2'>
                        <button
                            type='submit'
                            className={`${color} rounded-lg px-4 py-2 text-sm text-gray-300`}
                        >
                            Start Scan
                        </button>
                        <button
                            type='button'
                            onClick={prepareCodexLoadTest}
                            className='flex items-center gap-2 rounded-lg bg-sky-400/12 px-4 py-2 text-sm font-medium text-sky-100 hover:bg-sky-400/20'
                        >
                            <Bot className='h-4 w-4' />
                            Prepare for Codex
                        </button>
                    </div>
                </form>
                <div className='grid gap-3 rounded-xl border border-white/10 bg-white/4 p-4'>
                    <div className='flex items-center gap-2 text-sm font-semibold text-bright'>
                        <Sparkles className='h-4 w-4 text-orange-300' />
                        Codex Load Test Handoff
                    </div>
                    <textarea
                        value={codexPrompt}
                        onChange={(e) => setCodexPrompt(e.target.value)}
                        className='min-h-24 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-bright outline-none'
                    />
                    {codexNotice && <p className='text-xs text-emerald-300'>{codexNotice}</p>}
                </div>
            </section>
            <section className='grid gap-4'>
                <RecentScans title='My Recent Scans' empty='No personal scans yet.' scans={myScans} mine />
                <RecentScans title='Recent Scans' empty='No scans recorded yet.' scans={recentScans} />
            </section>
        </div>
    )
}
