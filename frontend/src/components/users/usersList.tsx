'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import DashboardUser from './dashboardUser'

export default function UsersList({ users, roles }: { users: UserWithRole[], roles: Role[] }) {
    const [showReserved, setShowReserved] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [search, setSearch] = useState('')
    const searchButton = useRef<HTMLButtonElement>(null)

    function closeSearch() {
        setSearch('')
        setSearchOpen(false)
        requestAnimationFrame(() => searchButton.current?.focus())
    }

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.repeat || event.altKey || event.shiftKey) return
            event.preventDefault()
            if (searchOpen) closeSearch()
            else setSearchOpen(true)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [searchOpen])

    const reservedSet = useMemo(() => new Set(reservedUsernames), [])
    const reservedCount = users.filter((user) => reservedSet.has(user.id.toLowerCase())).length
    const visibleUsers = (showReserved
        ? users
        : users.filter((user) => !reservedSet.has(user.id.toLowerCase())))
        .filter((user) => {
            const query = search.trim().toLowerCase()
            return !query || user.name.toLowerCase().includes(query) || user.id.toLowerCase().includes(query)
        })

    return (
        <>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h1 className='text-base font-semibold text-ui-text'>Users</h1>
                    <p className='mt-1 text-sm text-ui-muted'>{visibleUsers.length} shown</p>
                </div>
                <div className='flex items-center gap-2'>
                    {searchOpen ? (
                        <div className='flex items-center gap-1 rounded-lg border border-ui-border bg-ui-raised px-2'>
                            <Search className='h-4 w-4 text-ui-muted' />
                            <input
                                autoFocus
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        closeSearch()
                                    }
                                }}
                                aria-label='Filter users'
                                className='h-8 w-36 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted'
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder='Name or username'
                                value={search}
                            />
                            <button
                                type='button'
                                aria-label='Close user search'
                                title='Close search'
                                onClick={closeSearch}
                                className='grid h-6 w-6 place-items-center rounded text-ui-muted hover:bg-ui-panel hover:text-ui-text'
                            >
                                <X className='h-4 w-4' />
                            </button>
                        </div>
                    ) : <button
                        ref={searchButton}
                        type='button'
                        aria-label='Search users (Cmd J)'
                        aria-keyshortcuts='Meta+J Control+J'
                        title='Search users by name or username (Cmd J)'
                        onClick={() => setSearchOpen(true)}
                        className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted hover:bg-ui-panel hover:text-ui-text'
                    >
                        <Search className='h-4 w-4' />
                        <span>Search</span>
                        <kbd className='rounded-md border border-ui-border bg-ui-panel px-1.5 py-0.5 text-[10px] font-semibold text-ui-muted'>Cmd J</kbd>
                    </button>}
                    {reservedCount > 0 && (
                        <button
                            type='button'
                            onClick={() => setShowReserved((value) => !value)}
                            className='h-9 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-panel'
                        >
                            {showReserved ? 'Hide reserved' : 'Show reserved'}
                        </button>
                    )}
                </div>
            </div>
            <div className='grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px] gap-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ui-muted'>
                <span>Name</span>
                <span>Username</span>
                <span aria-hidden='true' />
            </div>
            {visibleUsers.map((user) => <DashboardUser roles={roles} key={user.id} user={user} />)}
        </>
    )
}
