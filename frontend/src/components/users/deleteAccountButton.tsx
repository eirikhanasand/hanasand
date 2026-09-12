'use client'

import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { getCookie } from '@/utils/cookies/cookies'

export default function DeleteAccountButton({ name, onDelete }: { name: string, onDelete: () => Promise<void> }) {
    const dialog = useRef<HTMLDialogElement>(null)
    const [skip, setSkip] = useState(false)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const storageKey = () => `account-delete-confirmation:${getCookie('id') || ''}`

    async function remove() {
        if (pending) return
        setPending(true)
        setError('')
        try {
            await onDelete()
            if (skip) { try { sessionStorage.setItem(storageKey(), 'skip') } catch { /* Storage may be disabled; keep asking for confirmation. */ } }
            dialog.current?.close()
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to delete account.')
            if (!dialog.current?.open) dialog.current?.showModal()
        } finally { setPending(false) }
    }

    return <>
        <button type='button' aria-label={`Delete ${name}`} disabled={pending}
            className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-danger hover:bg-ui-danger/10 disabled:opacity-50'
            onClick={(event) => {
                event.stopPropagation()
                let direct = false
                try { direct = sessionStorage.getItem(storageKey()) === 'skip' } catch { /* Storage may be disabled; keep asking for confirmation. */ }
                if (direct) void remove()
                else { setSkip(false); setError(''); dialog.current?.showModal() }
            }}><Trash2 className='h-4 w-4' /></button>
        <dialog ref={dialog} aria-label={`Delete ${name}?`}
            onClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (pending) event.preventDefault() } }}
            onCancel={event => { if (pending) event.preventDefault() }}
            className='m-auto w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-black/50'>
            <h2 className='font-semibold'>Delete {name}?</h2>
            <p className='mt-2 text-sm text-ui-muted'>This account will lose access.</p>
            <label className='my-4 flex items-center gap-2 text-sm'><input type='checkbox' checked={skip} disabled={pending} onChange={event => setSkip(event.target.checked)} />Don’t ask again for this session</label>
            {error && <p role='alert' className='mb-3 text-sm text-ui-danger'>{error}</p>}
            <div className='flex justify-end gap-2'>
                <button type='button' autoFocus disabled={pending} onClick={() => dialog.current?.close()} className='rounded-lg border border-ui-border px-3 py-2'>Cancel</button>
                <button type='button' disabled={pending} onClick={() => void remove()} className='rounded-lg bg-ui-danger px-3 py-2 text-white'>{pending ? 'Deleting…' : 'Delete'}</button>
            </div>
        </dialog>
    </>
}
