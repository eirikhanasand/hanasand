'use client'

import { PlayCircle, RefreshCcw } from 'lucide-react'
import { useState } from 'react'

type ManualRunButtonProps = {
    sourceId?: string
    label?: string
}

export default function ManualRunButton({ sourceId = 'all_sources', label = 'Start run' }: ManualRunButtonProps) {
    const [state, setState] = useState<'idle' | 'queued'>('idle')
    const [queuedAt, setQueuedAt] = useState('')

    function queueRun() {
        const now = new Date().toISOString()
        setState('queued')
        setQueuedAt(now)

        try {
            window.localStorage.setItem(`hanasand:ti-admin:manual-run:${sourceId}`, now)
        } catch {
            // Local persistence is best-effort until the scraper exposes the mutation endpoint.
        }
    }

    return (
        <div className='flex flex-wrap items-center gap-2'>
            <button
                type='button'
                onClick={queueRun}
                className='inline-flex h-10 items-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39]'
            >
                {state === 'queued' ? <RefreshCcw className='h-4 w-4' /> : <PlayCircle className='h-4 w-4' />}
                {state === 'queued' ? 'Run queued' : label}
            </button>
            {queuedAt ? (
                <span className='text-xs text-[#667085]'>
                    Queued locally at {new Date(queuedAt).toLocaleTimeString()}.
                </span>
            ) : null}
        </div>
    )
}
