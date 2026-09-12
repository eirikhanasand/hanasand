'use client'

import { useEffect, useId, useState } from 'react'
import { getCookie } from '@/utils/cookies/cookies'

const HISTORY_LIMIT = 30
const examples = ['APT29', 'LockBit', 'microsoft.com', 'CVE-2024-3094']
const historyKey = () => `hanasand:ti:search-history:${getCookie('id') || 'guest'}`
const normalize = (value: string) => value.toLocaleLowerCase().replace(/[\s_-]+/g, '')

export function readSearchHistory(): string[] {
    try {
        const stored: unknown = JSON.parse(localStorage.getItem(historyKey()) || '[]')
        return Array.isArray(stored) ? stored.filter((value): value is string => typeof value === 'string' && value.trim().length >= 2 && value.length <= 200).slice(0, HISTORY_LIMIT) : []
    } catch { return [] }
}

export function rememberSearch(query: string) {
    const clean = query.trim()
    if (clean.length < 2 || clean.length > 200) return
    try {
        const next = [clean, ...readSearchHistory().filter(value => normalize(value) !== normalize(clean))].slice(0, HISTORY_LIMIT)
        localStorage.setItem(historyKey(), JSON.stringify(next))
        window.dispatchEvent(new Event('ti-search-history'))
    } catch { /* Search remains available when browser storage is disabled. */ }
}

export function searchSuggestions(query: string, history: string[], saved: string[]) {
    const key = normalize(query)
    if (!key) return history.slice(0, 3)
    const terms = [...history, ...saved, ...examples]
    return terms.filter((term, index) => normalize(term).includes(key) && terms.findIndex(other => normalize(other) === normalize(term)) === index).slice(0, 6)
}

export default function SearchSuggestions({ query, onChange, onSearch, saved, compact }: {
    query: string, onChange: (query: string) => void, onSearch: (query: string) => void, saved: string[], compact: boolean
}) {
    const id = useId()
    const [history, setHistory] = useState<string[]>([])
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState(-1)
    useEffect(() => {
        const refresh = () => setHistory(readSearchHistory())
        refresh()
        window.addEventListener('ti-search-history', refresh)
        window.addEventListener('storage', refresh)
        return () => { window.removeEventListener('ti-search-history', refresh); window.removeEventListener('storage', refresh) }
    }, [])
    const suggestions = searchSuggestions(query, history, saved)
    const expanded = open && suggestions.length > 0
    function choose(term: string) { setOpen(false); setActive(-1); onSearch(term) }
    return <div className='relative min-w-0 flex-1' onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
        <label className='grid gap-2' htmlFor={id}>
            <span className={`text-xs font-semibold uppercase text-ui-primary ${compact ? 'sr-only' : ''}`}>Threat intelligence search</span>
        </label>
        <input id={id} name='q' role='combobox' aria-autocomplete='list' aria-expanded={expanded} aria-controls={`${id}-suggestions`} aria-activedescendant={expanded && active >= 0 && active < suggestions.length ? `${id}-option-${active}` : undefined}
            value={query} autoComplete='off' placeholder='APT29, LockBit, microsoft.com, CVE-2024-3094...'
            onFocus={() => { setOpen(true); setActive(-1) }}
            onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1) }}
            onKeyDown={event => {
                if (event.nativeEvent.isComposing) return
                if (event.key === 'Escape') { setOpen(false); setActive(-1) }
                else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && suggestions.length) {
                    event.preventDefault(); setOpen(true)
                    setActive(previous => (previous + (event.key === 'ArrowDown' ? 1 : previous < 0 ? 0 : -1) + suggestions.length) % suggestions.length)
                } else if (event.key === 'Enter') {
                    if (expanded && active >= 0 && active < suggestions.length) { event.preventDefault(); choose(suggestions[active]) }
                    else setOpen(false)
                }
            }}
            className={`${compact ? 'h-10 px-3 text-sm' : 'mt-2 h-12 px-4 text-base'} w-full rounded-lg border border-ui-border bg-ui-panel font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20`} />
        {expanded ? <div className='absolute top-full z-20 mt-2 w-full overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-lg'>
            <div className='flex items-center justify-between gap-3 px-3 py-2 text-xs text-ui-muted'>
                <span>{query.trim() ? 'Suggestions' : 'Recent searches'}</span>
                {history.length > 0 ? <button type='button' className='underline hover:text-ui-text' onClick={() => { try { localStorage.removeItem(historyKey()) } catch { /* Storage may be disabled. */ } setHistory([]) }} aria-label='Clear search history'>Clear history</button> : null}
            </div>
            <ul id={`${id}-suggestions`} role='listbox' aria-label={query.trim() ? 'Search suggestions' : 'Recent searches'}>
                {suggestions.map((term, index) => <li id={`${id}-option-${index}`} key={term} role='option' aria-selected={index === active} onMouseDown={event => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(term)} className={`cursor-pointer px-3 py-2 text-sm text-ui-text hover:bg-ui-raised ${index === active ? 'bg-ui-raised' : ''}`}>
                    <span className='wrap-break-word'>{term}</span>{history.includes(term) ? <span className='ml-2 text-xs text-ui-muted'>Recent</span> : null}
                </li>)}
            </ul>
        </div> : null}
    </div>
}
