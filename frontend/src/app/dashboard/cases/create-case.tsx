'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'

const control = 'w-full rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm text-ui-text disabled:opacity-50'
export function CreateCase({ organizationId }: { organizationId?: string }) {
    const router = useRouter()
    const dialog = useRef<HTMLDialogElement>(null)
    const requestId = useRef('')
    const [title, setTitle] = useState('')
    const [summary, setSummary] = useState('')
    const [priority, setPriority] = useState('medium')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    function open() {
        requestId.current = crypto.randomUUID()
        setTitle(''); setSummary(''); setPriority('medium'); setError('')
        dialog.current?.showModal()
    }
    async function create(event: React.FormEvent) {
        event.preventDefault()
        if (busy) return
        setBusy(true); setError('')
        try {
            const params = new URLSearchParams(organizationId ? { organizationId } : {})
            const response = await fetch(`/api/cases?${params}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceType: 'manual', title: title.trim(), summary: summary.trim(), priority, idempotencyKey: requestId.current }) })
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'Could not create the case. Please retry.')
            if (typeof payload.case?.id !== 'string' || !payload.case.id) throw new Error('The server did not return a case. Please retry.')
            dialog.current?.close()
            router.push(`/cases/${encodeURIComponent(payload.case.id)}${params.size ? `?${params}` : ''}`)
        } catch (error) { setError(error instanceof Error ? error.message : 'Could not create the case. Please retry.') }
        finally { setBusy(false) }
    }
    return <>
        <button type='button' onClick={open} className='inline-flex items-center gap-2 rounded-lg bg-ui-primary px-3 py-2 text-sm font-medium text-white'><Plus aria-hidden='true' className='h-4 w-4' />Create case</button>
        <dialog ref={dialog} aria-labelledby='create-case-title' onCancel={event => { if (busy) event.preventDefault() }} className='m-auto w-[90vw] max-w-lg rounded-lg border border-ui-border bg-ui-panel p-5 text-ui-text backdrop:bg-black/50'>
            <form onSubmit={create} className='grid gap-4'>
                <h2 id='create-case-title' className='text-lg font-semibold'>Create case</h2>
                <p className='text-sm text-ui-muted'>{organizationId ? 'Create a case in the selected organization.' : 'Create a case in your personal workspace.'}</p>
                <label className='grid gap-1 text-sm'>Title<input autoFocus required maxLength={200} className={control} value={title} disabled={busy} onChange={event => setTitle(event.target.value)} /></label>
                <label className='grid gap-1 text-sm'>Description<textarea maxLength={5000} rows={4} className={control} value={summary} disabled={busy} onChange={event => setSummary(event.target.value)} /></label>
                <label className='grid gap-1 text-sm'>Severity<select aria-label='Severity' className={control} value={priority} disabled={busy} onChange={event => setPriority(event.target.value)}><option value='low'>Low</option><option value='medium'>Medium</option><option value='high'>High</option><option value='critical'>Critical</option></select></label>
                {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
                <div className='flex justify-end gap-2'><button type='button' className='rounded-lg border border-ui-border px-3 py-2 text-sm' disabled={busy} onClick={() => dialog.current?.close()}>Cancel</button><button type='submit' disabled={busy || !title.trim()} className='rounded-lg bg-ui-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-50'>{busy ? 'Creating…' : 'Create case'}</button></div>
            </form>
        </dialog>
    </>
}
