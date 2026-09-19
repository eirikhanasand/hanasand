'use client'

import { useCallback, useEffect, useState } from 'react'
import { HardDrive, RefreshCcw, Trash2 } from 'lucide-react'
import { getCookie } from '@/utils/cookies/cookies'

type Storage = {
    cacheBytes: number; reclaimableCacheBytes: number; cacheBudgetBytes: number
    unusedImages: { id: string; names: string[]; sizeBytes: number; eligible: boolean; retainedReason: string | null }[]
    checkedAt: string; lastSuccessAt?: string; lastFreedBytes?: number; running: boolean; queued: boolean; stale: boolean; error?: string
    schedule: string; timezone: string
}
const bytes = (value: number) => `${(value / 1e9).toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`
const date = (value: string) => new Date(value).toLocaleString()

export default function DockerStoragePanel() {
    const [state, setState] = useState<Storage | null>(null)
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            const response = await fetch('/api/backend/system/storage', { cache: 'no-store', signal,
                headers: { Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '' } })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'Unable to load storage.')
            setState(body); setError('')
        } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load storage.') }
    }, [])
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        const timer = setInterval(() => { void load(controller.signal) }, 10000)
        return () => { controller.abort(); clearInterval(timer) }
    }, [load])
    const clear = async () => {
        setSubmitting(true); setError('')
        try {
            const response = await fetch('/api/backend/system/storage/clear', { method: 'POST',
                headers: { Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '' } })
            const body = await response.json()
            if (!response.ok) throw new Error(body.error || 'Unable to start cleanup.')
            setState(current => current ? { ...current, queued: true } : current)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to start cleanup.') }
        finally { setSubmitting(false) }
    }
    const busy = submitting || state?.running || state?.queued
    return <section aria-label='Docker storage' className='min-w-0 space-y-3 rounded-xl border border-ui-border bg-ui-panel p-4 text-ui-text shadow-sm sm:p-5'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <h2 className='flex items-center gap-2 text-lg font-semibold'><HardDrive className='h-5 w-5 text-ui-primary' aria-hidden />Docker storage <span className='text-xs font-normal text-ui-muted'>Inspur</span></h2>
            <button type='button' onClick={() => void clear()} disabled={Boolean(busy) || !state || state.stale || Boolean(error)} className='inline-flex items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-sm font-semibold hover:border-ui-primary disabled:opacity-50'>
                {busy ? <RefreshCcw className='h-4 w-4 animate-spin' aria-hidden /> : <Trash2 className='h-4 w-4' aria-hidden />}{state?.running ? 'Clearing…' : busy ? 'Queued…' : 'Clear unused storage'}
            </button>
        </div>
        {error && <p role='alert' className='text-sm text-ui-danger'>{error} <button className='underline' onClick={() => void load()}>Retry</button></p>}
        {!state ? !error && <p className='text-sm text-ui-muted'>Loading storage…</p> : <>
            <div className='grid gap-3 sm:grid-cols-3'>
                <div className='rounded-lg border border-ui-border bg-ui-raised/50 p-3'><p className='text-xs text-ui-muted'>Build cache</p><p className='mt-1 text-xl font-semibold tabular-nums'>{bytes(state.cacheBytes)}</p><p className='text-xs text-ui-muted'>{bytes(state.reclaimableCacheBytes)} reclaimable</p></div>
                <div className='rounded-lg border border-ui-border bg-ui-raised/50 p-3'><p className='text-xs text-ui-muted'>Nightly cleanup</p><p className='mt-1 font-semibold'>{state.schedule} · {state.timezone}</p><p className='text-xs text-ui-muted'>Keeps up to {bytes(state.cacheBudgetBytes)} of unused build cache</p></div>
                <div className='rounded-lg border border-ui-border bg-ui-raised/50 p-3'><p className='text-xs text-ui-muted'>Last successful cleanup</p><p className='mt-1 text-sm font-semibold'>{state.lastSuccessAt ? <time dateTime={state.lastSuccessAt}>{date(state.lastSuccessAt)}</time> : 'Not cleared yet'}</p>{state.lastSuccessAt && <p className='text-xs text-ui-muted'>Disk space increased by {bytes(state.lastFreedBytes || 0)}</p>}</div>
            </div>
            {state.error && <p role='alert' className='text-sm text-ui-danger'>Cleanup needs attention: {state.error}</p>}
            {state.stale && <p role='status' className='text-sm text-ui-warning'>Storage figures are out of date.</p>}
            <details className='rounded-lg border border-ui-border'>
                <summary className='cursor-pointer px-3 py-2 text-sm font-semibold'>Unused images ({state.unusedImages.length})</summary>
                <div className='max-h-72 overflow-auto border-t border-ui-border'><table className='w-full text-left text-sm'><thead><tr className='text-xs text-ui-muted'><th className='p-3'>Image</th><th className='p-3'>Size</th><th className='p-3'>Cleanup</th></tr></thead><tbody>{state.unusedImages.map(image => <tr key={image.id} className='border-t border-ui-border'><td className='max-w-xs break-all p-3 font-mono text-xs'>{image.names.join(', ')}</td><td className='whitespace-nowrap p-3 tabular-nums'>{bytes(image.sizeBytes)}</td><td className='p-3 text-xs text-ui-muted'>{image.retainedReason || 'Will be removed'}</td></tr>)}</tbody></table>{state.unusedImages.length === 0 && <p className='p-3 text-sm text-ui-muted'>No unused images.</p>}</div>
            </details>
            <p className='text-xs text-ui-muted'>Recent images and two releases per image are kept for rollback. Image sizes include shared layers.</p>
            <p className='text-right text-[11px] text-ui-muted'>Checked <time dateTime={state.checkedAt}>{date(state.checkedAt)}</time></p>
        </>}
    </section>
}
