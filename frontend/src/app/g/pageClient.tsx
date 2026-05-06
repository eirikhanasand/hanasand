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
                className={`flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${didCopy === true ? 'border-emerald-300/25 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-white/[0.045] text-bright/72 hover:bg-white/7 hover:text-bright'}`}
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
                <span className='text-xs font-medium uppercase tracking-[0.18em] text-bright/34'>Shortcut</span>
                <div className='flex h-11 overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] focus-within:border-[#f07d33]/55 focus-within:bg-white/[0.065]'>
                    <span className='flex items-center border-r border-white/8 px-3 text-sm text-bright/32'>/g/</span>
                    <input
                        className='min-w-0 flex-1 bg-transparent px-3 text-sm text-bright outline-none placeholder:text-bright/28'
                        placeholder='team-notes'
                        onChange={(e) => setId(e.target.value)}
                        value={id}
                    />
                </div>
                {shortcutError ? <span className='text-xs text-[#f0a17a]'>{shortcutError}</span> : null}
            </label>
            <label className='grid gap-2'>
                <span className='flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-bright/34'>
                    <LinkIcon className='h-3.5 w-3.5' />
                    Destination
                </span>
                <input
                    className='h-11 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-bright outline-none transition placeholder:text-bright/28 focus:border-[#f07d33]/55 focus:bg-white/[0.065]'
                    placeholder='https://example.com'
                    onChange={(e) => setPath(e.target.value)}
                    value={path}
                    required
                />
                {path && !isValidLink ? <span className='text-xs text-[#f0a17a]'>Add a valid URL or domain.</span> : null}
            </label>
            <button
                type='submit'
                disabled={!canSubmit}
                className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-semibold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/5 disabled:text-bright/35'
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
