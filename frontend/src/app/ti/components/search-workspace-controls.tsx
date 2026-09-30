'use client'

import { type SavedSearch } from '../pageClientShared'
import { Bookmark, Search, Trash2 } from 'lucide-react'
import { SyntheticEvent } from 'react'
import SearchSuggestions from '@/components/ti/searchSuggestions'

export default function SearchWorkspaceControls({
    query,
    busy,
    visible,
    error,
    hasUsableResult,
    savedSearches,
    savedSearchesFromAccount,
    savedSearchError,
    onSubmit,
    onQueryChange,
    onSearch,
    onSave,
    onRemoveSavedSearch,
}: {
    query: string
    busy: boolean
    visible: boolean
    error: string
    hasUsableResult: boolean
    savedSearches: SavedSearch[]
    savedSearchesFromAccount: boolean
    savedSearchError: string
    onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void
    onQueryChange: (value: string) => void
    onSearch: (value: string) => void
    onSave: () => void
    onRemoveSavedSearch: (query: string) => void
}) {
    return (
        <>
            <form onSubmit={onSubmit} className={visible ? 'grid gap-3 rounded-lg border border-ui-border bg-ui-panel p-2 shadow-sm md:p-3' : 'grid gap-3'}>
                {!visible ? (
                    <div className='text-center'>
                        <h1 className='text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>Search threat intelligence</h1>
                        <p className='mt-3 text-sm font-medium text-ui-primary dark:text-ui-primary'>Find current intelligence about any threat actor, company, domain, CVE, or malware family.</p>
                    </div>
                ) : null}
                <div className={`flex flex-col gap-3 ${visible ? 'md:flex-row md:items-end' : 'rounded-xl border border-ui-border bg-ui-panel p-3 shadow-[0_18px_50px_var(--ui-shadow)] dark:border-ui-border dark:bg-ui-panel'}`}>
                    <SearchSuggestions query={query} onChange={onQueryChange} onSearch={onSearch} saved={savedSearches.map(item => item.query)} compact={visible} />
                    <button
                        type='submit'
                        aria-busy={busy}
                        aria-label={busy ? 'Searching threat intelligence' : 'Search threat intelligence'}
                        className={`${visible ? 'h-10 min-w-24 rounded-lg' : 'h-11 min-w-28 rounded-lg'} inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:bg-ui-panel disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-panel`}
                    >
                        <Search className='h-4 w-4' />
                        <span>{busy ? 'Searching' : 'Search'}</span>
                    </button>
                    {query.trim() ? <button
                        type='button'
                        onClick={onSave}
                        aria-label={`Save search ${query.trim()}`}
                        className={`${visible ? 'h-10' : 'h-11'} inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised`}
                    >
                        <Bookmark className='h-4 w-4' />
                        <span className='hidden sm:inline'>Save</span>
                    </button> : null}
                </div>
                {error && !hasUsableResult ? <p className='text-sm text-ui-text'>{error}</p> : null}
            </form>

            {savedSearches.length || savedSearchError ? <section aria-label='Saved searches' className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-3 shadow-sm'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-sm font-semibold text-ui-text'>Saved searches</h2>
                        <p className='mt-1 text-xs text-ui-muted'>{savedSearchesFromAccount ? 'Stored with your account. Select one to reopen the current result.' : 'Stored only in this browser until you sign in.'}</p>
                    </div>
                    <Bookmark className='h-4 w-4 text-ui-primary' />
                </div>
                <div className='flex flex-wrap gap-2'>
                    {savedSearches.map(item => <div key={`${item.query}:${item.savedAt}`} className='inline-flex max-w-full items-center gap-1 rounded-md border border-ui-border bg-ui-canvas pl-3 text-sm dark:border-ui-border dark:bg-ui-canvas'>
                        <button type='button' onClick={() => onSearch(item.query)} className='max-w-56 truncate py-2 font-medium text-ui-text hover:text-ui-primary' title={`Open ${item.query}`}>{item.query}</button>
                        <button type='button' onClick={() => onRemoveSavedSearch(item.query)} aria-label={`Remove saved search ${item.query}`} className='rounded p-2 text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'><Trash2 className='h-3.5 w-3.5' /></button>
                    </div>)}
                </div>
                {savedSearchError ? <p role='alert' className='text-xs leading-5 text-ui-text'>{savedSearchError}</p> : null}
            </section> : null}
        </>
    )
}
