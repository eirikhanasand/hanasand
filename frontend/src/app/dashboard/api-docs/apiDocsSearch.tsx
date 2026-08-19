'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export default function ApiDocsSearch() {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) inputRef.current?.focus()
        const normalized = query.trim().toLowerCase()
        document.querySelectorAll<HTMLElement>('[data-api-search]').forEach(item => {
            item.hidden = Boolean(normalized) && !item.dataset.apiSearch!.toLowerCase().includes(normalized)
        })
    }, [open, query])

    return <div className='flex items-center gap-2'>
        {open ? <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder='Search schemas and endpoints' aria-label='Search schemas and endpoints' className='h-9 w-56 rounded-md border border-ui-border bg-ui-raised px-3 text-xs text-ui-text outline-none focus:border-ui-primary' /> : null}
        <button type='button' onClick={() => { setOpen(value => !value); if (open) setQuery('') }} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary' aria-label={open ? 'Close API docs search' : 'Search API docs'}>
            {open ? <X className='h-3.5 w-3.5' /> : <Search className='h-3.5 w-3.5' />}
            {open ? 'Close' : 'Search'}
        </button>
    </div>
}
