'use client'

import { type SavedSearch, TI_SAVED_SEARCHES_KEY, TI_SAVED_SEARCH_LIMIT, usePublicTiPageEffects } from '../pageClientShared'
import { getCookie } from '@/utils/cookies/cookies'
import { rememberSearch } from '@/components/ti/searchSuggestions'
import { SyntheticEvent, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import EmptyState from './empty-state'
import Results from './results'
import SearchLoading from './search-loading'
import searchThreatIntel, { TiSearchResponse } from '@/utils/ti/search'
import SearchWorkspaceControls from './search-workspace-controls'

export default function TiPageClient({ initialQuery, initialResult }: { initialQuery: string; initialResult: TiSearchResponse | null }) {
    const router = useRouter()
    const [query, setQuery] = useState(initialResult?.query ?? initialQuery)
    const [result, setResult] = useState<TiSearchResponse | null>(initialResult)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
    const [savedSearchesFromAccount, setSavedSearchesFromAccount] = useState(false)
    const [savedSearchError, setSavedSearchError] = useState('')
    const activeQueryRef = useRef((initialResult?.query ?? initialQuery).trim().toLowerCase())
    const requestSeqRef = useRef(0)
    usePublicTiPageEffects({ initialQuery, initialResult, query, result, setBusy, setError, setQuery, setResult, activeQueryRef, requestSeqRef })

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            setSavedSearchesFromAccount(true)
            fetch('/api/backend/ti/saved-searches', { headers: { Authorization: `Bearer ${token}`, id }, cache: 'no-store' })
                .then(response => response.ok ? response.json() : null)
                .then(payload => {
                    if (Array.isArray(payload?.savedSearches)) setSavedSearches(payload.savedSearches.slice(0, TI_SAVED_SEARCH_LIMIT))
                    else setSavedSearchError('Account-saved searches are temporarily unavailable.')
                })
                .catch(() => setSavedSearchError('Account-saved searches are temporarily unavailable.'))
            return
        }
        try {
            const stored = JSON.parse(window.localStorage.getItem(TI_SAVED_SEARCHES_KEY) || '[]')
            if (Array.isArray(stored)) {
                setSavedSearches(stored.filter((item): item is SavedSearch => Boolean(item && typeof item.query === 'string' && typeof item.savedAt === 'string')).slice(0, TI_SAVED_SEARCH_LIMIT))
            }
        } catch {
            setSavedSearches([])
        }
    }, [])

    async function executeSearch(clean: string) {
        if (!clean) return
        rememberSearch(clean)

        const requestSeq = requestSeqRef.current + 1
        requestSeqRef.current = requestSeq
        setBusy(true)
        setError('')
        setQuery(clean)
        const cleanKey = clean.toLowerCase()
        activeQueryRef.current = cleanKey
        router.push(`/ti/${encodeURIComponent(clean)}`)
        try {
            const next = await searchThreatIntel(clean, { preferCached: true })
            if (requestSeqRef.current !== requestSeq || activeQueryRef.current !== cleanKey) return
            if (!next) {
                setError('Threat intelligence search is temporarily unavailable.')
                return
            }
            setResult(next)
        } finally {
            if (requestSeqRef.current === requestSeq) setBusy(false)
        }
    }

    async function submit(event: SyntheticEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        await executeSearch(String(form.get('q') ?? query).trim())
    }

    async function saveCurrentSearch() {
        const clean = query.trim()
        if (!clean) return
        setSavedSearchError('')
        const previous = savedSearches
        const next = [{ query: clean, savedAt: new Date().toISOString() }, ...savedSearches.filter(item => item.query.toLowerCase() !== clean.toLowerCase())].slice(0, TI_SAVED_SEARCH_LIMIT)
        setSavedSearches(next)
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            try {
                const response = await fetch('/api/backend/ti/saved-searches', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, id }, body: JSON.stringify({ query: clean }) })
                if (!response.ok) throw new Error('save_failed')
            } catch {
                setSavedSearches(previous)
                setSavedSearchError('Could not save this search to your account. Try again.')
            }
        } else {
            window.localStorage.setItem(TI_SAVED_SEARCHES_KEY, JSON.stringify(next))
        }
    }

    async function removeSavedSearch(queryToRemove: string) {
        setSavedSearchError('')
        const previous = savedSearches
        const next = savedSearches.filter(item => item.query !== queryToRemove)
        setSavedSearches(next)
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            const params = new URLSearchParams({ query: queryToRemove })
            try {
                const response = await fetch(`/api/backend/ti/saved-searches?${params}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, id } })
                if (!response.ok) throw new Error('remove_failed')
            } catch {
                setSavedSearches(previous)
                setSavedSearchError('Could not remove this search from your account. Try again.')
            }
        } else {
            window.localStorage.setItem(TI_SAVED_SEARCHES_KEY, JSON.stringify(next))
        }
    }

    function handleQueryChange(value: string) {
        setQuery(value)
        const cleanKey = value.trim().toLowerCase()
        activeQueryRef.current = cleanKey
        if (!cleanKey) {
            setResult(null)
            return
        }
        if (result && result.query.trim().toLowerCase() !== cleanKey) {
            setResult(null)
        }
    }

    const visible = result
    const hasUsableResult = Boolean(visible && visible.status !== 'unavailable' && (
        visible.actorIdentity?.catalogMatched ||
        visible.summary.trim() ||
        visible.sources.length ||
        visible.recentActivity.length
    ))

    return (
        <div className={visible ? 'mx-auto grid w-full max-w-7xl gap-6' : 'mx-auto grid min-h-[calc(100vh-9rem)] w-full max-w-[45rem] place-content-center gap-5 py-10'}>
            <SearchWorkspaceControls
                query={query}
                busy={busy}
                visible={Boolean(visible)}
                error={error}
                hasUsableResult={hasUsableResult}
                savedSearches={savedSearches}
                savedSearchesFromAccount={savedSearchesFromAccount}
                savedSearchError={savedSearchError}
                onSubmit={submit}
                onQueryChange={handleQueryChange}
                onSearch={value => void executeSearch(value)}
                onSave={saveCurrentSearch}
                onRemoveSavedSearch={removeSavedSearch}
            />

            {busy ? <SearchLoading query={query} /> : visible ? <Results result={visible} error={error} /> : <EmptyState />}
        </div>
    )
}
