'use client'

import { PlayCircle, RefreshCcw } from 'lucide-react'
import { useState } from 'react'
import searchThreatIntel from '@/utils/ti/search'

type ManualRunButtonProps = {
    sourceId?: string
    label?: string
    queries?: string[]
}

export default function ManualRunButton({ sourceId = 'all_sources', label = 'Start run', queries = [] }: ManualRunButtonProps) {
    const [state, setState] = useState<'idle' | 'running' | 'queued'>('idle')
    const [queuedAt, setQueuedAt] = useState('')
    const [message, setMessage] = useState('')

    async function queueRun() {
        const now = new Date().toISOString()
        const uniqueQueries = [...new Set(queries.map(query => query.trim()).filter(Boolean))]

        setState('running')
        setQueuedAt(now)
        setMessage(uniqueQueries.length ? `Starting ${uniqueQueries.length} source check${uniqueQueries.length === 1 ? '' : 's'}...` : 'Run request recorded.')

        try {
            window.localStorage.setItem(`hanasand:ti-admin:manual-run:${sourceId}`, now)
        } catch {
            // Local persistence is best-effort; the API trigger below is the source of truth.
        }

        if (uniqueQueries.length) {
            const results = await Promise.allSettled(uniqueQueries.map(query => searchThreatIntel(query)))
            const started = results.filter(result => result.status === 'fulfilled' && result.value).length
            setMessage(started ? `Triggered ${started} source check${started === 1 ? '' : 's'}.` : 'Run request recorded; no immediate API response.')
        }

        setState('queued')
    }

    return (
        <div className='flex flex-wrap items-center gap-2'>
            <button
                type='button'
                onClick={queueRun}
                disabled={state === 'running'}
                className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'
            >
                {state === 'running' || state === 'queued' ? <RefreshCcw className='h-4 w-4' /> : <PlayCircle className='h-4 w-4' />}
                {state === 'running' ? 'Starting run' : state === 'queued' ? 'Run queued' : label}
            </button>
            {queuedAt ? (
                <span className='text-xs text-[#667085]'>
                    {message || `Queued at ${new Date(queuedAt).toLocaleTimeString()}.`}
                </span>
            ) : null}
        </div>
    )
}
