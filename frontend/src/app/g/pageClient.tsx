'use client'

import ErrorNotice from '@/components/error/errorNotice'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import copy from '@/utils/copy'
import { postLink } from '@/utils/links/post'
import { Check, Copy, LinkIcon, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'

export default function LinkPageClient({ serverId, created }: { serverId?: string, created?: string }) {
    const router = useRouter()
    const [id, setId] = useState('')
    const [path, setPath] = useState('')
    const [busy, setBusy] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: didCopy, setCondition: setDidCopy } = useClearStateAfter({
        initialState: false,
        timeout: 350,
        onClear: () => setDidCopy(false)
    })
    const normalizedShortcut = normalizeShortcut(id)
    const normalizedPath = normalizeDestination(path)
    const shortcutError = id && !normalizedShortcut ? 'Use letters, numbers, dashes or underscores.' : null
    const isValidLink = Boolean(normalizedPath)
    const canSubmit = Boolean(normalizedShortcut && normalizedPath && !busy)
    const fullUrl = `https://hanasand.com/g/${serverId}`

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()
        setError(null)

        if (!normalizedShortcut) {
            setError('Choose a shortcut name first.')
            return
        }

        if (!normalizedPath) {
            setError('Enter a valid destination URL.')
            return
        }

        setBusy(true)
        try {
            const result = await postLink(normalizedShortcut, normalizedPath)
            if (typeof result === 'number') {
                return setError('This shortcut is already taken.')
            }

            if (!result) {
                return setError('Please try again later.')
            }

            if (result.id) {
                router.push(`/g?created=true&id=${encodeURIComponent(result.id)}`)
            }
        } finally {
            setBusy(false)
        }
    }

    if (created) {
        return (
            <button
                type='button'
                onClick={() => copy({ text: fullUrl, setDidCopy })}
                className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${didCopy === true ? 'border-ui-success/25 bg-ui-success/10 text-ui-success' : 'border-ui-border bg-ui-raised text-ui-muted hover:border-ui-primary hover:text-ui-text'}`}
            >
                {didCopy === true ? <Check className='h-4 w-4 shrink-0' /> : <Copy className='h-4 w-4 shrink-0' />}
                <span className='min-w-0 truncate'>{fullUrl}</span>
            </button>
        )
    }

    return (
        <form onSubmit={handleSubmit} className='grid gap-3'>
            <ErrorNotice compact message={error} />
            <label className='grid gap-2'>
                <span className='text-xs font-semibold uppercase text-ui-primary'>Shortcut</span>
                <div className='flex h-11 overflow-hidden rounded-lg border border-ui-border bg-ui-raised focus-within:border-ui-primary focus-within:ring-4 focus-within:ring-ui-primary/15'>
                    <span className='flex items-center border-r border-ui-border bg-ui-panel px-3 text-sm text-ui-muted'>/g/</span>
                    <input
                        className='min-w-0 flex-1 bg-transparent px-3 text-sm text-ui-text outline-none placeholder:text-ui-muted'
                        placeholder='team-notes'
                        onChange={(e) => setId(e.target.value)}
                        value={id}
                    />
                </div>
                {shortcutError ? <span className='text-xs text-ui-warning'>{shortcutError}</span> : null}
            </label>
            <label className='grid gap-2'>
                <span className='flex items-center gap-2 text-xs font-semibold uppercase text-ui-primary'>
                    <LinkIcon className='h-3.5 w-3.5' />
                    Destination
                </span>
                <input
                    className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
                    placeholder='https://example.com'
                    onChange={(e) => setPath(e.target.value)}
                    value={path}
                    required
                />
                {path && !isValidLink ? <span className='text-xs text-ui-warning'>Add a valid URL or domain.</span> : null}
            </label>
            <button
                type='submit'
                disabled={!canSubmit}
                className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
            >
                <Plus className='h-4 w-4' />
                {busy ? 'Creating...' : 'Create shortcut'}
            </button>
        </form>
    )
}

export function normalizeShortcut(value: string) {
    const trimmed = value.trim().replace(/^\/?g\//, '')
    if (!trimmed || !/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
        return ''
    }
    return trimmed
}

export function normalizeDestination(value: string) {
    const trimmed = value.trim()
    if (!trimmed || /\s/.test(trimmed)) {
        return ''
    }

    const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)
        ? trimmed
        : `https://${trimmed}`

    try {
        const parsed = new URL(candidate)
        if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) {
            return ''
        }
        if (['http:', 'https:'].includes(parsed.protocol) && !parsed.hostname.includes('.')) {
            return ''
        }
        return parsed.toString()
    } catch {
        return ''
    }
}
