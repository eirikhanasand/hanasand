'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Organization = { id: string, name: string, slug: string, status: string, member_count: number, created_at: string, last_active_at: string | null }
type SortKey = 'created' | 'lastActive' | 'name' | 'slug' | 'status'

export default function OrganizationList({ organizations }: { organizations: Organization[] }) {
    const [search, setSearch] = useState('')
    const [searchOpen, setSearchOpen] = useState(false)
    const [sort, setSort] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({ key: 'created', direction: 'desc' })
    const searchInput = useRef<HTMLInputElement>(null)
    const searchButton = useRef<HTMLButtonElement>(null)

    function openSearch() {
        setSearchOpen(true)
        requestAnimationFrame(() => searchInput.current?.focus())
    }

    function closeSearch() {
        setSearch('')
        setSearchOpen(false)
        requestAnimationFrame(() => searchButton.current?.focus())
    }

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.repeat || event.altKey || event.shiftKey) return
            event.preventDefault()
            if (searchOpen) {
                searchInput.current?.focus()
                searchInput.current?.select()
            } else openSearch()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [searchOpen])

    const query = search.trim().toLowerCase()
    const rows = organizations.filter(org => `${org.name} ${org.slug} ${org.status}`.toLowerCase().includes(query))
    const sortedRows = [...rows].sort((a, b) => {
        const sign = sort.direction === 'asc' ? 1 : -1
        const comparison = sort.key === 'created'
            ? Date.parse(a.created_at) - Date.parse(b.created_at)
            : sort.key === 'lastActive'
                ? (a.last_active_at ? Date.parse(a.last_active_at) : -Infinity) - (b.last_active_at ? Date.parse(b.last_active_at) : -Infinity)
                : a[sort.key].localeCompare(b[sort.key], undefined, { sensitivity: 'base', numeric: true })
        return sign * comparison || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id)
    })

    function toggleSort(key: SortKey) {
        setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }))
    }

    function sortHeading(label: string, key: SortKey) {
        const active = sort.key === key
        const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
        return <th key={key} scope='col' className='whitespace-nowrap px-3 py-3 font-medium'>
            <button type='button' onClick={() => toggleSort(key)} aria-label={`Sort by ${label}, ${active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'currently inactive'}`} aria-pressed={active} className='inline-flex items-center gap-1.5 hover:text-ui-text focus-visible:outline-2 focus-visible:outline-ui-primary'>
                {label}<Icon size={14} aria-hidden='true' />
            </button>
        </th>
    }

    return <div className='p-4'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
            <p role='status' className='text-sm text-ui-muted'>{rows.length} of {organizations.length} organizations</p>
            {searchOpen ? <div className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 focus-within:ring-2 focus-within:ring-ui-primary'>
                <Search size={16} className='shrink-0 text-ui-muted' aria-hidden='true' />
                <input ref={searchInput} type='search' aria-label='Search organizations' aria-keyshortcuts='Meta+J Control+J' placeholder='Search' value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); closeSearch() } }} className='h-9 w-48 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted' />
                <button type='button' aria-label='Close organization search' title='Close search' onClick={closeSearch} className='grid size-6 place-items-center rounded text-ui-muted hover:bg-ui-panel hover:text-ui-text'><X size={15} aria-hidden='true' /></button>
            </div> : <button ref={searchButton} type='button' aria-label='Search (Cmd J)' aria-keyshortcuts='Meta+J Control+J' title='Search organizations (Cmd J)' onClick={openSearch} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-muted hover:bg-ui-raised hover:text-ui-text'>
                <Search size={16} aria-hidden='true' /><span>Search</span><kbd className='rounded border border-ui-border px-1.5 py-0.5 text-[10px] font-semibold'>⌘ J</kbd>
            </button>}
        </div>
        <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
                <thead className='border-b border-ui-border text-ui-muted'><tr>{[
                    sortHeading('Organization', 'name'), sortHeading('Slug', 'slug'), sortHeading('Status', 'status'),
                    <th key='members' scope='col' className='px-3 py-3 font-medium'>Members</th>, sortHeading('Created', 'created'), sortHeading('Last active (UTC)', 'lastActive'),
                ]}</tr></thead>
                <tbody>{sortedRows.map(org => <tr key={org.id} className='border-b border-ui-border text-ui-text'>
                    <td className='px-3 py-3 font-medium'>{org.name}</td>
                    <td className='px-3 py-3 text-ui-muted'>{org.slug}</td>
                    <td className='px-3 py-3 capitalize'>{org.status}</td>
                    <td className='px-3 py-3'>{org.member_count}</td>
                    <td className='whitespace-nowrap px-3 py-3'>{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC' }).format(new Date(org.created_at))}</td>
                    <td className='whitespace-nowrap px-3 py-3'>{org.last_active_at ? <time dateTime={org.last_active_at}>{new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(org.last_active_at))}</time> : 'No recorded activity'}</td>
                </tr>)}</tbody>
            </table>
            {!sortedRows.length && <p className='py-8 text-center text-ui-muted'>{organizations.length ? 'No organizations match your search.' : 'No organizations found.'}</p>}
        </div>
    </div>
}
