'use client'

import { useId, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'

export default function EditServiceAccountButton({ name, description, onSave }: { name: string, description: string, onSave: (details: { name: string, description: string }) => Promise<void> }) {
    const descriptionId = useId()
    const dialog = useRef<HTMLDialogElement>(null)
    const input = useRef<HTMLInputElement>(null)
    const [draftName, setDraftName] = useState(name)
    const [draftDescription, setDraftDescription] = useState(description)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')

    return <>
        <button type='button' aria-label={`Edit ${name}`} onClick={() => { setDraftName(name); setDraftDescription(description); setError(''); dialog.current?.showModal(); input.current?.focus() }} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-ui-primary'><Pencil className='h-4 w-4' aria-hidden='true' /></button>
        <dialog ref={dialog} aria-label={`Edit ${name}`} onCancel={event => { if (pending) event.preventDefault() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm'>
            <form className='grid gap-4' onSubmit={async event => {
                event.preventDefault()
                if (pending || !draftName.trim()) return
                setPending(true); setError('')
                try { await onSave({ name: draftName.trim(), description: draftDescription.trim() }); dialog.current?.close() }
                catch (error) { setError(error instanceof Error ? error.message : 'Unable to save service account.') }
                finally { setPending(false) }
            }}>
                <h2 className='text-lg font-semibold'>Edit service account</h2>
                <label className='grid gap-1 text-sm'>Name<input ref={input} value={draftName} onChange={event => setDraftName(event.target.value)} required maxLength={100} disabled={pending} className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></label>
                <div className='grid gap-1 text-sm'><label htmlFor={descriptionId}>Description</label><textarea id={descriptionId} value={draftDescription} onChange={event => setDraftDescription(event.target.value)} maxLength={2000} rows={5} disabled={pending} placeholder='What does this account do?' className='resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></div>
                {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
                <div className='flex justify-end gap-2'>
                    <button type='button' disabled={pending} onClick={() => dialog.current?.close()} className='rounded-lg border border-ui-border px-4 py-2 text-sm disabled:opacity-50'>Cancel</button>
                    <button disabled={pending || !draftName.trim()} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Saving…' : 'Save changes'}</button>
                </div>
            </form>
        </dialog>
    </>
}
