'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Info, Pencil } from 'lucide-react'

export default function ServiceAccountDescription({ name, description, onSave }: { name: string, description: string, onSave: (description: string) => Promise<void> }) {
    const id = useId()
    const popup = useRef<HTMLDivElement>(null)
    const trigger = useRef<HTMLButtonElement>(null)
    const dialog = useRef<HTMLDialogElement>(null)
    const input = useRef<HTMLTextAreaElement>(null)
    const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const [draft, setDraft] = useState(description)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const long = description.length > 80 || description.includes('\n')

    useEffect(() => () => clearTimeout(hideTimer.current), [])

    function show() {
        clearTimeout(hideTimer.current)
        const panel = popup.current
        const button = trigger.current
        if (!panel || !button) return
        panel.showPopover()
        const rect = button.getBoundingClientRect()
        panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8))}px`
        panel.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - panel.offsetHeight - 8))}px`
    }

    function hideSoon() {
        clearTimeout(hideTimer.current)
        hideTimer.current = setTimeout(() => popup.current?.hidePopover(), 200)
    }

    return <div className='flex items-center gap-1'>
        {long ? <>
            <button ref={trigger} type='button' aria-label={`Description for ${name}`} aria-describedby={id} onMouseEnter={show} onMouseLeave={hideSoon} onFocus={show} onBlur={hideSoon} onClick={show} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-ui-primary'><Info className='h-4 w-4' aria-hidden='true' /></button>
            <div ref={popup} id={id} popover='auto' role='tooltip' onMouseEnter={() => clearTimeout(hideTimer.current)} onMouseLeave={hideSoon} className='fixed m-0 max-h-[min(24rem,calc(100dvh-1rem))] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto whitespace-pre-wrap wrap-anywhere rounded-xl border border-ui-border bg-ui-panel p-4 text-sm leading-6 text-ui-text shadow-xl'>{description}</div>
        </> : <span className='max-w-56 wrap-anywhere text-ui-muted'>{description || '—'}</span>}
        <button type='button' aria-label={`Edit description for ${name}`} onClick={() => { popup.current?.hidePopover(); setDraft(description); setError(''); dialog.current?.showModal(); input.current?.focus() }} className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-ui-primary'><Pencil className='h-3.5 w-3.5' aria-hidden='true' /></button>
        <dialog ref={dialog} aria-label={`Edit description for ${name}`} onCancel={event => { if (pending) event.preventDefault() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm'>
            <form className='grid gap-4' onSubmit={async event => {
                event.preventDefault()
                if (pending) return
                setPending(true); setError('')
                try { await onSave(draft.trim()); dialog.current?.close() }
                catch (error) { setError(error instanceof Error ? error.message : 'Unable to save description.') }
                finally { setPending(false) }
            }}>
                <h2 className='text-lg font-semibold'>Description for {name}</h2>
                <div className='grid gap-1 text-sm'><label htmlFor={`${id}-input`}>Description</label><textarea id={`${id}-input`} ref={input} value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} rows={5} disabled={pending} placeholder='What does this account do?' className='resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></div>
                {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
                <div className='flex justify-end gap-2'>
                    <button type='button' disabled={pending} onClick={() => dialog.current?.close()} className='rounded-lg border border-ui-border px-4 py-2 text-sm disabled:opacity-50'>Cancel</button>
                    <button disabled={pending} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Saving…' : 'Save description'}</button>
                </div>
            </form>
        </dialog>
    </div>
}
