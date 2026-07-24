'use client'

import { PlayCircle, RefreshCcw } from 'lucide-react'
import { useState } from 'react'

type ManualRunButtonProps = {
    sourceId?: string
    label?: string
    queries?: string[]
}

type ControlResponseBody = {
    scheduled?: boolean
    qa?: { qualityScore?: number }
    payload?: unknown
    error?: { message?: string }
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

        const controlResult: { ok: boolean; body: ControlResponseBody } = await fetch('/api/ti/scraper/control', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                action: sourceId === 'all_sources' ? 'scheduler_run_now' : 'run_query',
                sourceId,
                query: uniqueQueries[0] || sourceId,
                targets: uniqueQueries,
                reason: 'operator source run from source inventory',
            }),
        }).then(async response => ({
            ok: response.ok,
            body: await response.json().catch(() => ({})) as ControlResponseBody,
        })).catch(error => ({
            ok: false,
            body: { error: { message: error instanceof Error ? error.message : String(error) } } as ControlResponseBody,
        }))

        const qa = controlResult.body.qa?.qualityScore ? ` QA ${controlResult.body.qa.qualityScore}%.` : ''
        setMessage(controlResult.ok ? `Queued in Hanasand AI scheduler.${qa}` : controlResult.body.error?.message || 'Run request recorded; scheduler response unavailable.')

        setState('queued')
    }

    return (
        <div className='flex flex-wrap items-center gap-2'>
            <button
                type='button'
                onClick={queueRun}
                disabled={state === 'running'}
                className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70'
            >
                {state === 'running' || state === 'queued' ? <RefreshCcw className='h-4 w-4' /> : <PlayCircle className='h-4 w-4' />}
                {state === 'running' ? 'Starting run' : state === 'queued' ? 'Run queued' : label}
            </button>
            {queuedAt ? (
                <span className='text-xs text-ui-muted'>
                    {message || `Queued at ${new Date(queuedAt).toLocaleTimeString()}.`}
                </span>
            ) : null}
        </div>
    )
}
