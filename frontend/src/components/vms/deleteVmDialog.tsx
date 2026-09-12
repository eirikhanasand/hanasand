'use client'

import { useEffect, useId, useRef, useState } from 'react'

export default function DeleteVmDialog({ name, busy, error, onCancel, onConfirm }: {
    name: string; busy: boolean; error: string; onCancel: () => void; onConfirm: (confirmation: string) => void
}) {
    const dialog = useRef<HTMLDialogElement>(null)
    const titleId = useId()
    const descriptionId = useId()
    const [confirmation, setConfirmation] = useState('')
    useEffect(() => {
        const element = dialog.current
        element?.showModal()
        return () => element?.close()
    }, [])
    return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event => { event.preventDefault(); if (!busy) onCancel() }} className='m-auto w-[calc(100%_-_2rem)] max-w-md rounded-xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-xl backdrop:bg-black/60'>
        <form onSubmit={event => { event.preventDefault(); if (!busy && confirmation === name) onConfirm(confirmation) }}>
            <h2 id={titleId} className='text-lg font-semibold'>Delete {name}?</h2>
            <p id={descriptionId} className='mt-2 text-sm text-ui-muted'>The VM will stop and all access will be blocked. You can restore it for 30 days. After that, the VM and its disk will be permanently deleted.</p>
            <label className='mt-4 grid gap-2 text-sm'><span>Type <strong>{name}</strong> to confirm</span>
                <input autoFocus autoComplete='off' spellCheck={false} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} className='rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-ui-text focus:outline-2 focus:outline-ui-primary' />
            </label>
            {error && <p role='alert' className='mt-3 text-sm text-ui-danger'>{error}</p>}
            <div className='mt-5 flex justify-end gap-2'>
                <button type='button' disabled={busy} onClick={onCancel} className='rounded-lg border border-ui-border px-3 py-2 disabled:opacity-50'>Cancel</button>
                <button type='submit' disabled={busy || confirmation !== name} className='rounded-lg border border-ui-danger/35 bg-ui-danger/10 px-3 py-2 font-semibold text-ui-danger disabled:cursor-not-allowed disabled:opacity-50'>{busy ? 'Stopping VM…' : 'Delete VM'}</button>
            </div>
        </form>
    </dialog>
}
