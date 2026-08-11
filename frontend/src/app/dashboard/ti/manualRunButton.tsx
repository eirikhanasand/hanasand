'use client'

import { PlayCircle, RefreshCcw } from 'lucide-react'
import { useState } from 'react'

type ManualRunButtonProps = {
    sourceId?: string
    label?: string
    queries?: string[]
    compact?: boolean
}

type ControlResponseBody = {
    scheduled?: boolean
    qa?: { qualityScore?: number }
    payload?: unknown
    error?: { message?: string }
}

export default function ManualRunButton({ sourceId = 'all_sources', label = 'Start run', queries = [], compact = false }: ManualRunButtonProps) {
    const [state, setState] = useState<'idle' | 'running' | 'queued'>('idle')
    const [queuedAt, setQueuedAt] = useState('')
    const [message, setMessage] = useState('')

    async function queueRun() {
        const now = new Date().toISOString()
        const uniqueQueries = [...new Set(queries.map(query => query.trim()).filter(Boolean))]

        setState('running')
        setQueuedAt(now)
        setMessage(uniqueQueries.length ? `Starting ${uniqueQueries.length} source check${uniqueQueries.length === 1 ? '' : 's'}...` : 'Starting scheduled source collection...')

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
        setMessage(controlResult.ok ? `Queued in Hanasand AI scheduler.${qa}` : controlResult.body.error?.message || 'Run failed; scheduler response unavailable.')
        setState(controlResult.ok ? 'queued' : 'idle')
    }

    return (
        <div className={`flex items-center gap-2 ${compact ? 'shrink-0' : 'flex-wrap'}`}>
            <button
                type='button'
                onClick={queueRun}
                disabled={state === 'running'}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ui-primary font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-wait disabled:opacity-70 ${compact ? 'h-8 px-2 text-xs' : 'h-10 px-4 text-sm'}`}
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
