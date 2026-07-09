'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

type AppConfirmDialogProps = {
    open: boolean
    title: string
    body: string
    confirmLabel?: string
    tone?: 'warning' | 'danger'
    icon?: ReactNode
    onCancel: () => void
    onConfirm: () => void
}

type AppPromptDialogProps = {
    open: boolean
    title: string
    label: string
    initialValue: string
    confirmLabel?: string
    onCancel: () => void
    onConfirm: (value: string) => void
}

export function AppConfirmDialog({
    open,
    title,
    body,
    confirmLabel = 'Confirm',
    tone = 'warning',
    icon,
    onCancel,
    onConfirm,
}: AppConfirmDialogProps) {
    if (!open) return null
    const toneClass = tone === 'danger'
        ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger hover:bg-ui-danger/15'
        : 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning hover:bg-ui-warning/15'

    return (
        <AppDialog title={title} onCancel={onCancel}>
            <div className='flex items-start gap-3'>
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${toneClass}`}>
                    {icon || <AlertTriangle className='h-4 w-4' />}
                </span>
                <div className='min-w-0'>
                    <h2 id='app-dialog-title' className='text-base font-semibold text-ui-text'>{title}</h2>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{body}</p>
                </div>
            </div>
            <div className='mt-4 flex justify-end gap-2'>
                <button type='button' onClick={onCancel} className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised'>
                    Cancel
                </button>
                <button type='button' onClick={onConfirm} className={`inline-flex h-9 items-center rounded-md border px-3 text-sm font-semibold ${toneClass}`}>
                    {confirmLabel}
                </button>
            </div>
        </AppDialog>
    )
}

export function AppPromptDialog({
    open,
    title,
    label,
    initialValue,
    confirmLabel = 'Save',
    onCancel,
    onConfirm,
}: AppPromptDialogProps) {
    const [value, setValue] = useState(initialValue)

    useEffect(() => {
        if (open) setValue(initialValue)
    }, [initialValue, open])

    if (!open) return null

    function submit(event: React.FormEvent) {
        event.preventDefault()
        const nextValue = value.trim()
        if (nextValue) onConfirm(nextValue)
    }

    return (
        <AppDialog title={title} onCancel={onCancel}>
            <form onSubmit={submit}>
                <h2 id='app-dialog-title' className='text-base font-semibold text-ui-text'>{title}</h2>
                <label className='mt-3 block text-sm font-semibold text-ui-muted'>
                    {label}
                    <input
                        autoFocus
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        className='mt-1.5 w-full rounded-md border border-ui-border bg-ui-raised px-3 py-2 text-sm text-ui-text outline-none focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                    />
                </label>
                <div className='mt-4 flex justify-end gap-2'>
                    <button type='button' onClick={onCancel} className='inline-flex h-9 items-center rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised'>
                        Cancel
                    </button>
                    <button type='submit' className='inline-flex h-9 items-center rounded-md bg-ui-primary px-3 text-sm font-semibold text-ui-canvas hover:opacity-90'>
                        {confirmLabel}
                    </button>
                </div>
            </form>
        </AppDialog>
    )
}

function AppDialog({ children, onCancel }: { children: ReactNode, title: string, onCancel: () => void }) {
    return (
        <div className='fixed inset-0 z-50 grid place-items-center bg-ui-canvas/75 p-4 backdrop-blur-sm' role='dialog' aria-modal='true' aria-labelledby='app-dialog-title' onClick={onCancel}>
            <div className='w-full max-w-md rounded-lg border border-ui-border bg-ui-panel p-4 shadow-xl' onClick={(event) => event.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}
