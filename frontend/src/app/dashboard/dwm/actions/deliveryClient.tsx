'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { LoaderCircle, Plus, Search, Send, X } from 'lucide-react'

type Destination = {
    id: string
    name: string
    kind: 'discord' | 'webhook'
    endpointHint: string
    status: string
    lastTestedAt?: string | null
    lastTestStatus?: string | null
    lastTestHttpStatus?: number | null
}
type Draft = { id?: string, name: string, kind: 'discord' | 'webhook', url: string }
type Result = { ok: boolean, message: string }
type Payload = {
    destinations?: Destination[]
    destinationAdminProof?: { access?: { canManage?: boolean } }
    delivery?: { status: string, responseStatus?: number, error?: string }
    error?: string | { message?: string }
}
const button = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'
const field = 'min-h-10 w-full rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'

export default function DeliveryClient({ scopeId }: { scopeId: string }) {
    const endpoint = `/api/organizations/${encodeURIComponent(scopeId)}/webhooks`
    const [destinations, setDestinations] = useState<Destination[]>([])
    const [canManage, setCanManage] = useState(false)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState('')
    const [version, setVersion] = useState(0)
    const [query, setQuery] = useState('')
    const [kind, setKind] = useState('')
    const [status, setStatus] = useState('')
    const [draft, setDraft] = useState<Draft | null>(null)
    const [formError, setFormError] = useState('')
    const [busy, setBusy] = useState('')
    const [results, setResults] = useState<Record<string, Result>>({})
    const dialog = useRef<HTMLDialogElement>(null)

    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setLoadError('')
        void request(endpoint, { signal: controller.signal }).then(payload => {
            if (!Array.isArray(payload.destinations)) throw new Error('Destinations could not be loaded.')
            setDestinations(payload.destinations.filter(row => row.status !== 'archived'))
            setCanManage(payload.destinationAdminProof?.access?.canManage === true)
        }).catch(error => {
            if (!controller.signal.aborted) setLoadError(error.message)
        }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [endpoint, version])

    useEffect(() => {
        if (draft) dialog.current?.showModal()
        else dialog.current?.close()
    }, [draft])

    function openForm(destination?: Destination) {
        setFormError('')
        setDraft(destination ? { id: destination.id, name: destination.name, kind: destination.kind, url: '' } : { name: '', kind: 'discord', url: '' })
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!draft || busy || !canManage) return
        const url = draft.url.trim()
        if ((!draft.id || url) && !validUrl(url, draft.kind)) {
            setFormError(draft.kind === 'discord' ? 'Enter a valid HTTPS Discord webhook URL.' : 'Enter a valid HTTPS webhook URL.')
            return
        }
        setBusy('save'); setFormError('')
        try {
            await request(draft.id ? `${endpoint}/${encodeURIComponent(draft.id)}` : endpoint, {
                method: draft.id ? 'PATCH' : 'POST',
                body: JSON.stringify({ name: draft.name.trim(), kind: draft.kind, ...(url ? { endpointUrl: url } : {}), ...(!draft.id ? { status: 'active' } : {}) }),
            })
            setDraft(null)
            setVersion(value => value + 1)
        } catch (error) { setFormError(error instanceof Error ? error.message : 'Destination could not be saved.') }
        finally { setBusy('') }
    }

    async function test(destination: Destination) {
        if (busy || !canManage) return
        setBusy(destination.id)
        setResults(current => { const next = { ...current }; delete next[destination.id]; return next })
        try {
            const payload = await request(`${endpoint}/test`, { method: 'POST', body: JSON.stringify({ destinationId: destination.id, dryRun: false, live: true }) })
            if (payload.delivery?.status !== 'delivered') throw new Error(payload.delivery?.error || 'The example message was not delivered.')
            setResults(current => ({ ...current, [destination.id]: { ok: true, message: 'Example message sent.' } }))
        } catch (error) {
            setResults(current => ({ ...current, [destination.id]: { ok: false, message: error instanceof Error ? error.message : 'Test failed.' } }))
        } finally { setBusy(''); setVersion(value => value + 1) }
    }

    async function remove(destination: Destination) {
        if (busy || !canManage || !window.confirm(`Remove ${destination.name}?`)) return
        setBusy(destination.id)
        try {
            await request(`${endpoint}/${encodeURIComponent(destination.id)}`, { method: 'DELETE' })
            setVersion(value => value + 1)
        } catch (error) {
            setResults(current => ({ ...current, [destination.id]: { ok: false, message: error instanceof Error ? error.message : 'Destination could not be removed.' } }))
        } finally { setBusy('') }
    }

    const visible = destinations.filter(row => (!kind || row.kind === kind) && (!status || row.status === status) && `${row.name} ${row.endpointHint}`.toLowerCase().includes(query.trim().toLowerCase()))
    return <section className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel text-ui-text'>
        <div className='flex items-center justify-between gap-3 border-b border-ui-border px-4 py-3'>
            <h1 className='text-lg font-semibold'>Delivery</h1>
            <button type='button' className={button} disabled={loading || !canManage || Boolean(busy)} onClick={() => openForm()}><Plus className='h-4 w-4' aria-hidden='true' />Add destination</button>
        </div>
        <div className='flex flex-wrap gap-3 border-b border-ui-border p-4'>
            <label className='relative min-w-48 flex-1'><Search aria-hidden='true' className='pointer-events-none absolute left-3 top-3 h-4 w-4 text-ui-muted' /><input aria-label='Search destinations' placeholder='Search destinations' className={`${field} pl-9`} value={query} onChange={event => setQuery(event.target.value)} /></label>
            <select aria-label='Filter by type' className={`${field} sm:w-40`} value={kind} onChange={event => setKind(event.target.value)}><option value=''>All types</option><option value='discord'>Discord</option><option value='webhook'>Webhook</option></select>
            <select aria-label='Filter by status' className={`${field} sm:w-40`} value={status} onChange={event => setStatus(event.target.value)}><option value=''>All statuses</option><option value='active'>Active</option><option value='paused'>Paused</option></select>
        </div>
        {loadError ? <div role='alert' className='flex flex-wrap items-center gap-3 p-4 text-sm text-ui-danger'>{loadError}<button className={button} onClick={() => setVersion(value => value + 1)}>Retry</button></div> : <>
            <div className='overflow-x-auto' aria-busy={loading}>
                <table className='w-full min-w-[44rem] text-left text-sm'>
                    <thead className='bg-ui-raised text-xs text-ui-muted'><tr>{['Name', 'Type', 'Destination', 'Status', 'Last test', 'Actions'].map(label => <th key={label} scope='col' className='px-4 py-3 font-semibold'>{label}</th>)}</tr></thead>
                    <tbody className='divide-y divide-ui-border'>
                        {visible.map(destination => <tr key={destination.id}>
                            <th scope='row' className='px-4 py-3 font-semibold'>{destination.name}</th>
                            <td className='px-4 py-3'>{destination.kind === 'discord' ? 'Discord' : 'Webhook'}</td>
                            <td className='max-w-64 truncate px-4 py-3 text-ui-muted' title={destination.endpointHint}>{destination.endpointHint}</td>
                            <td className='px-4 py-3 capitalize'>{destination.status}</td>
                            <td className='px-4 py-3'><span>{testLabel(destination.lastTestStatus)}</span>{destination.lastTestedAt && <time dateTime={destination.lastTestedAt} className='mt-1 block whitespace-nowrap text-xs text-ui-muted'>{new Date(destination.lastTestedAt).toLocaleString()}</time>}</td>
                            <td className='px-4 py-3'>
                                <div className='flex gap-2'>
                                    <button type='button' className={button} disabled={!canManage || Boolean(busy) || destination.status !== 'active'} aria-label={`Test ${destination.name}`} title='Send an example message' onClick={() => void test(destination)}>{busy === destination.id ? <LoaderCircle aria-hidden='true' className='h-4 w-4 animate-spin' /> : <Send aria-hidden='true' className='h-4 w-4' />}Test</button>
                                    {canManage && <><button type='button' className={button} disabled={Boolean(busy)} aria-label={`Edit ${destination.name}`} onClick={() => openForm(destination)}>Edit</button><button type='button' className={button} disabled={Boolean(busy)} aria-label={`Remove ${destination.name}`} onClick={() => void remove(destination)}>Remove</button></>}
                                </div>
                                {results[destination.id] && <p role={results[destination.id].ok ? 'status' : 'alert'} className={`mt-2 max-w-sm text-xs ${results[destination.id].ok ? 'text-ui-success' : 'text-ui-danger'}`}>{results[destination.id].message}</p>}
                            </td>
                        </tr>)}
                        {!visible.length && <tr><td colSpan={6} className='px-4 py-10 text-center text-ui-muted'>{loading ? 'Loading destinations…' : destinations.length ? 'No destinations match these filters.' : 'No delivery destinations yet.'}</td></tr>}
                    </tbody>
                </table>
            </div>
            {!loading && !canManage && <p className='border-t border-ui-border px-4 py-3 text-sm text-ui-muted'>Only workspace owners and admins can add or test destinations.</p>}
        </>}
        <dialog ref={dialog} aria-labelledby='destination-form-title' className='m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-ui-border bg-ui-panel p-0 text-ui-text shadow-xl backdrop:bg-black/60' onCancel={event => { if (busy === 'save') event.preventDefault(); else setDraft(null) }} onClose={() => setDraft(null)}>
            {draft && <form onSubmit={save} className='grid gap-4 p-5'>
                <div className='flex items-center justify-between gap-3'><h2 id='destination-form-title' className='text-lg font-semibold'>{draft.id ? 'Edit destination' : 'Add destination'}</h2><button type='button' aria-label='Close' className={button} disabled={busy === 'save'} onClick={() => setDraft(null)}><X aria-hidden='true' className='h-4 w-4' /></button></div>
                <label className='grid gap-1 text-sm font-medium'>Name<input autoFocus required maxLength={120} className={field} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
                <label className='grid gap-1 text-sm font-medium'>Type<select className={field} value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as Draft['kind'] })}><option value='discord'>Discord</option><option value='webhook'>Webhook</option></select></label>
                <label className='grid gap-1 text-sm font-medium'>Webhook URL<input required={!draft.id} type='url' pattern='https://.*' autoComplete='off' maxLength={2048} className={field} placeholder={draft.id ? 'Leave blank to keep the current URL' : 'https://discord.com/api/webhooks/…'} value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} /></label>
                {formError && <p role='alert' className='text-sm text-ui-danger'>{formError}</p>}
                <div className='flex justify-end gap-2'><button type='button' className={button} disabled={busy === 'save'} onClick={() => setDraft(null)}>Cancel</button><button type='submit' className={button} disabled={busy === 'save' || !draft.name.trim()}>{busy === 'save' && <LoaderCircle aria-hidden='true' className='h-4 w-4 animate-spin' />}Save destination</button></div>
            </form>}
        </dialog>
    </section>
}

async function request(url: string, options: RequestInit = {}): Promise<Payload> {
    const response = await fetch(url, { ...options, cache: 'no-store', headers: { 'content-type': 'application/json' } })
    const payload = await response.json() as Payload
    if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'The request failed. Try again.')
    return payload
}

function validUrl(value: string, kind: Draft['kind']) {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && !url.username && !url.password && (kind !== 'discord' || /(^|\.)discord(?:app)?\.com$/i.test(url.hostname) && /^\/api\/webhooks\/[^/]+\/[^/]+/.test(url.pathname))
    } catch { return false }
}

function testLabel(status?: string | null) {
    return status === 'delivered' ? 'Delivered' : status === 'dry_run' ? 'Dry run only' : status === 'failed' ? 'Failed' : status === 'skipped' ? 'Not sent' : 'Not tested'
}
