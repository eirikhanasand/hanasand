'use client'

import { History, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type HistoryRun = { id: string; resultId: string; target: string; startedAt: string; status: string }

export default function BrowserHistory({ clientId, inline = false }: { clientId: string; inline?: boolean }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [runs, setRuns] = useState<HistoryRun[]>([])
    const [nextOffset, setNextOffset] = useState<number | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const request = useRef<AbortController | null>(null)
    useEffect(() => () => request.current?.abort(), [])

    async function load(offset = 0) {
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLoading(true)
        setError('')
        try {
            const response = await fetch(`/api/backend/browser/runs?history=all&offset=${offset}&clientId=${encodeURIComponent(clientId)}`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
            if (!response.ok) throw new Error('Could not load history.')
            const data = await response.json() as { runs: HistoryRun[]; nextOffset?: number | null }
            setRuns(current => offset === 0 ? data.runs : [...current, ...data.runs.filter(run => !current.some(item => item.id === run.id))])
            setNextOffset(data.nextOffset ?? null)
        } catch (error) {
            if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load history.')
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }

    return <>
        <button type='button' onClick={() => { dialog.current?.showModal(); void load() }} disabled={!clientId} className={`${inline ? '' : 'fixed bottom-24 right-4 z-40 shadow-lg'} inline-flex items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-4 py-2 text-sm font-semibold text-ui-text hover:border-ui-primary`} aria-haspopup='dialog'>
            <History className='h-4 w-4' />History
        </button>
        <dialog ref={dialog} aria-labelledby='browser-history-title' onClose={() => request.current?.abort()} className='m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg border border-ui-border bg-ui-panel p-4 text-ui-text shadow-xl backdrop:bg-black/50'>
            <div className='mb-4 flex items-center justify-between gap-4'>
                <h2 id='browser-history-title' className='text-lg font-semibold'>History</h2>
                <button type='button' onClick={() => dialog.current?.close()} aria-label='Close history' className='rounded-md p-2 hover:bg-ui-raised'><X className='h-5 w-5' /></button>
            </div>
            <div className='grid gap-2'>
                {runs.map(run => <a key={run.id} href={`/browser/${run.resultId}?run=${encodeURIComponent(run.id)}`} className='grid gap-1 rounded-md border border-ui-border p-3 text-sm hover:border-ui-primary focus-visible:outline-2 focus-visible:outline-ui-primary'>
                    <span className='break-all font-mono'>{run.target}</span>
                    <span className='text-xs text-ui-muted'>{new Date(run.startedAt).toLocaleString()} · {run.status === 'ended' ? 'Complete' : run.status}</span>
                </a>)}
                {!loading && !error && !runs.length ? <p className='text-sm text-ui-muted'>No previous runs.</p> : null}
                {loading ? <p role='status' className='text-sm text-ui-muted'>Loading…</p> : null}
                {error ? <div role='alert' className='text-sm text-ui-danger'>{error} <button type='button' onClick={() => void load(runs.length ? nextOffset ?? 0 : 0)} className='underline'>Try again</button></div> : null}
                {nextOffset !== null && !loading && !error ? <button type='button' onClick={() => void load(nextOffset)} className='rounded-md border border-ui-border px-3 py-2 text-sm hover:border-ui-primary'>Load more</button> : null}
            </div>
        </dialog>
    </>
}
