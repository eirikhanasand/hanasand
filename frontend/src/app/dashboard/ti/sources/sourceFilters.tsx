'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const selects = [
    { name: 'family', label: 'Family', options: ['rss', 'web', 'telegram_public', 'darkweb_metadata'] },
    { name: 'lifecycle', label: 'Status', options: ['active', 'candidate', 'review', 'paused'] },
    { name: 'access', label: 'Access', options: ['public_http', 'public_rss', 'public_telegram', 'tor_metadata'] },
    { name: 'health', label: 'Health', options: ['healthy', 'stale', 'failed', 'not observed'] },
    { name: 'output', label: 'Useful output', options: ['yes', 'no'] },
    { name: 'matches', label: 'Matches', options: ['yes', 'no'] },
]
const names = ['q', ...selects.map(select => select.name)]
function values(params: URLSearchParams) { return Object.fromEntries(names.map(name => [name, params.get(name) || ''])) }

export default function SourceFilters() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const current = searchParams.toString()
    const [draft, setDraft] = useState(() => values(new URLSearchParams(current)))
    const latest = useRef(draft)
    const pending = useRef<string | null>(null)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        // An earlier navigation can finish while the user is still changing filters.
        if (pending.current !== null && pending.current !== current) return
        pending.current = null
        latest.current = values(new URLSearchParams(current))
        setDraft(latest.current)
    }, [current])

    useEffect(() => {
        function restore() {
            clearTimeout(timer.current)
            pending.current = null
            latest.current = values(new URLSearchParams(window.location.search))
            setDraft(latest.current)
        }
        window.addEventListener('popstate', restore)
        return () => { clearTimeout(timer.current); window.removeEventListener('popstate', restore) }
    }, [])

    function apply(next: Record<string, string>, delay = 0) {
        clearTimeout(timer.current)
        latest.current = next
        setDraft(next)
        const params = new URLSearchParams(current)
        params.set('scope', 'global')
        params.set('page', '1')
        for (const name of names) {
            if (next[name]) params.set(name, next[name])
            else params.delete(name)
        }
        const query = params.toString()
        pending.current = query === current ? null : query
        const navigate = () => router.replace(`/ti/sources?${query}`, { scroll: false })
        if (delay) timer.current = setTimeout(navigate, delay)
        else navigate()
    }

    return <form className='flex flex-wrap items-center gap-2 border-b border-ui-border p-3' onSubmit={event => { event.preventDefault(); apply(latest.current) }}>
        <input name='q' value={draft.q} aria-label='Search sources' placeholder='Search sources' onChange={event => apply({ ...latest.current, q: event.target.value }, 300)} className='h-8 min-w-48 rounded-md border border-ui-border bg-ui-canvas px-2.5 text-xs text-ui-text outline-none' />
        {selects.map(({ name, label, options }) => <select key={name} name={name} value={draft[name]} aria-label={label} onChange={event => apply({ ...latest.current, [name]: event.target.value })} className='h-8 rounded-md border border-ui-border bg-ui-canvas px-2 text-xs text-ui-text outline-none'>
            <option value=''>{label}</option>
            {options.map(option => <option key={option} value={option}>{option === 'candidate' ? 'Inactive' : option.replaceAll('_', ' ')}</option>)}
        </select>)}
        {names.some(name => draft[name]) ? <button type='button' onClick={() => apply(values(new URLSearchParams()))} className='text-xs font-semibold text-ui-primary underline'>Clear</button> : null}
    </form>
}
