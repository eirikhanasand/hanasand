'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { requestJson, type Rule } from './detection-rules'
import RulePreview from './rule-preview'

type Job = { id: string, rule_version: string, status: string, scanned: string, matched: string, protected: string,
    removed_events: string, removed_sources: string, error: string | null, created_at: string, updated_at: string }
type Existing = { count: number, bytes: number }
const active = (job?: Job) => job && ['queued', 'running'].includes(job.status)
const number = (value: string) => Number(value).toLocaleString()
const removed = (value: string, noun: string) => `${number(value)} ${noun}${Number(value) === 1 ? '' : 's'} removed`

export default function ReprocessRule({ rule, organizationId, disabled, defaultRange = '24', onComplete }: { rule: Rule, organizationId: string, disabled: boolean, defaultRange?: string, onComplete?: () => void }) {
    const [jobs, setJobs] = useState<Job[]>([]), [existing, setExisting] = useState<Existing | null>(null), [loaded, setLoaded] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
    const [open, setOpen] = useState(false), [range, setRange] = useState(defaultRange), [confirmed, setConfirmed] = useState(false)
    const [previewReady, setPreviewReady] = useState(false), [refresh, setRefresh] = useState(0)
    const completedJob = useRef('')
    const ready = useCallback((value: boolean) => setPreviewReady(value), [])
    const endpoint = `/api/backend/rules/${encodeURIComponent(rule.id.replace(/\.v\d+$/, ''))}/reprocess?organizationId=${encodeURIComponent(organizationId)}`
    const job = jobs[0]
    const running = Boolean(active(job))
    useEffect(() => {
        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout>
        const load = async () => {
            try {
                const result = await requestJson<{ jobs: Job[], existing: Existing | null }>(endpoint, { signal: controller.signal })
                if (controller.signal.aborted) return
                setJobs(result.jobs)
                setExisting(result.existing)
                setLoaded(true)
                const completed = result.jobs.find(item => item.status === 'completed')
                if (completed && completedJob.current !== completed.id) {
                    completedJob.current = completed.id
                    onComplete?.()
                }
                if (result.jobs.some(active)) timer = setTimeout(load, 10_000)
            } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load progress.') }
        }
        void load()
        return () => { controller.abort(); clearTimeout(timer) }
    }, [endpoint, onComplete, refresh])
    useEffect(() => { setOpen(false); setConfirmed(false); setPreviewReady(false) }, [rule.version])
    async function start() {
        if (!confirmed || !previewReady || disabled || busy) return
        setBusy(true); setError('')
        try {
            const result = await requestJson<{ job: Job }>(endpoint, { method: 'POST', body: JSON.stringify({ confirm: true, version: rule.version,
                from: range === 'all' ? null : new Date(Date.now() - Number(range) * 3600_000).toISOString() }) })
            setJobs(previous => [result.job, ...previous.filter(item => item.id !== result.job.id)])
            setOpen(false); setConfirmed(false); setRefresh(value => value + 1)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not start reprocessing.') }
        finally { setBusy(false) }
    }
    async function cancel() {
        if (!job || busy) return
        setBusy(true); setError('')
        try {
            const result = await requestJson<{ job: Job }>(endpoint, { method: 'POST', body: JSON.stringify({ action: 'cancel', jobId: job.id }) })
            setJobs(previous => previous.map(item => item.id === result.job.id ? result.job : item)); setRefresh(value => value + 1)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not stop reprocessing.') }
        finally { setBusy(false) }
    }
    if (!loaded || !existing?.count) return null
    const formatBytes = (value: number) => {
        if (value < 1024) return `${value} B`
        const units = ['KB', 'MB', 'GB', 'TB']
        let amount = value / 1024, unit = 0
        while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
        return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)}${units[unit]}`
    }
    return <section aria-label='Reprocess existing logs' className='grid gap-4 rounded-xl border border-ui-border bg-ui-panel p-5 sm:p-6'>
        <div className='flex flex-wrap items-center justify-between gap-3'><div><h2 className='text-sm font-semibold'>Existing logs</h2><p className='mt-1 text-sm text-ui-muted'>{existing.count.toLocaleString()} Matching logs in the database.</p><p className='text-xs text-ui-muted'>{formatBytes(existing.bytes)}</p></div>
            <button type='button' disabled={disabled || running || busy || rule.enabled === false || rule.definition?.action !== 'drop'}
                onClick={() => { setOpen(!open); setConfirmed(false); setPreviewReady(false) }} className='rounded-lg border border-ui-border px-3 py-2 text-sm disabled:opacity-50'>Reprocess</button></div>
        {disabled && <p className='text-xs text-ui-muted'>Save your changes before reprocessing.</p>}
        {error && <p role='alert' className='text-sm text-ui-text'>{error}<button type='button' onClick={() => { setError(''); setRefresh(value => value + 1) }} className='ml-2 underline'>Refresh</button></p>}
        {open && <div className='grid gap-4'>
            <label className='flex flex-wrap items-center gap-3 text-sm'>Time range<select aria-label='Reprocess time range' value={range} onChange={event => { setRange(event.target.value); setPreviewReady(false); setConfirmed(false) }} className='rounded-lg border border-ui-border bg-ui-canvas px-3 py-2'><option value='1'>Last hour</option><option value='24'>Last 24 hours</option><option value='168'>Last 7 days</option><option value='all'>All stored logs</option></select></label>
            <RulePreview key={`${rule.version}:${range}`} organizationId={organizationId} conditions={rule.definition?.conditions || []} action='drop' range={range} onReady={ready} />
            <label className='flex items-start gap-2 text-sm'><input type='checkbox' checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className='mt-1' /><span>Apply saved version {rule.version} to existing logs. Matching Low records and their stored originals will be permanently deleted. Store rules and security findings are preserved.</span></label>
            <button type='button' disabled={!confirmed || !previewReady || busy || disabled} onClick={() => void start()} className='w-fit ui-button ui-button-primary px-4 py-2 text-sm disabled:opacity-50'>{busy ? 'Starting…' : 'Apply to existing logs'}</button>
        </div>}
        {job && <div role='status' className='grid gap-2 text-sm'>
            <div className='flex flex-wrap items-center justify-between gap-3'><p className='capitalize'>{job.status} · version {job.rule_version}</p>{running && <button type='button' disabled={busy} onClick={() => void cancel()} className='rounded-md border border-ui-border px-3 py-1'>Stop reprocessing</button>}</div>
            <p>{number(job.scanned)} checked · {removed(job.removed_events, 'event')} · {removed(job.removed_sources, 'original')} · {number(job.protected)} protected matches kept</p>
            {job.error && <p>{job.error}</p>}
            <p className='text-xs text-ui-muted'>Last updated {new Date(job.updated_at).toLocaleString()}</p>
        </div>}
        {jobs.length > 1 && <details className='text-sm'><summary className='cursor-pointer'>Previous runs</summary><ul className='mt-3 grid gap-2'>{jobs.slice(1).map(item => <li key={item.id}>{new Date(item.created_at).toLocaleString()} · v{item.rule_version} · {item.status} · {number(item.removed_events)} events removed</li>)}</ul></details>}
    </section>
}
