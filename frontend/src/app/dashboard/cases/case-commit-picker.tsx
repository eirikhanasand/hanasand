'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

type Commit = { external_id: string, title: string, author: string, updated_at: string }
export type CaseRepository = { id: string, provider: string, repository_url: string, organization_id?: string, can_manage?: boolean, last_received_at?: string, last_warning?: string }
const control = 'rounded-lg border border-ui-border bg-ui-panel px-3 py-2 text-sm disabled:opacity-50'

export function CaseCommitPicker({ caseId, query, repositories, open, revision, onLinked }: {
    caseId: string, query: string, repositories: CaseRepository[], open: boolean, revision: number, onLinked: () => void,
}) {
    const [repositoryId, setRepositoryId] = useState('')
    const [search, setSearch] = useState('')
    const selected = repositories.find(repository => repository.id === repositoryId) || repositories[0]
    const [commits, setCommits] = useState<Commit[]>([])
    const [visible, setVisible] = useState(5)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [linking, setLinking] = useState('')
    const [retry, setRetry] = useState(0)
    const generation = useRef(0)
    const inFlight = useRef(false)
    const waitingForMore = useRef(false)
    const controller = useRef<AbortController | null>(null)
    const list = useRef<HTMLUListElement>(null)
    const repository = selected?.id
    const endpoint = `/api/backend/cases/development/commits?${query}&repositoryId=${encodeURIComponent(repository || '')}&search=${encodeURIComponent(search.trim())}`

    async function load(cursor: string | null, version: number, signal: AbortSignal) {
        if (inFlight.current) return
        inFlight.current = true
        setLoading(true)
        try {
            const response = await fetch(endpoint + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''), { cache: 'no-store', signal })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'Could not load commits.')
            if (generation.current !== version || signal.aborted) return
            setCommits(previous => cursor ? [...previous, ...payload.items] : payload.items)
            setNextCursor(payload.nextCursor)
            if (cursor && waitingForMore.current) { waitingForMore.current = false; setVisible(value => value + 5) }
        } catch (error) {
            if (generation.current === version && !signal.aborted) setError(error instanceof Error ? error.message : 'Could not load commits.')
        } finally {
            if (generation.current === version) { inFlight.current = false; setLoading(false) }
        }
    }
    useEffect(() => {
        const abort = new AbortController()
        controller.current = abort
        const version = ++generation.current
        inFlight.current = false
        waitingForMore.current = false
        setCommits([]); setVisible(5); setNextCursor(null); setError(''); setLinking('')
        if (list.current) list.current.scrollTop = 0
        if (repository) void load(null, version, abort.signal)
        return () => abort.abort()
        // The endpoint captures both the repository and organization; abort stale requests on either change.
    }, [endpoint, caseId, revision, retry])
    useEffect(() => {
        // Keep twenty commits ahead of scrolling; a page contains one hundred.
        if (nextCursor && commits.length - visible < 20 && !loading && !error && controller.current) void load(nextCursor, generation.current, controller.current.signal)
    }, [nextCursor, commits.length, visible, loading, error])
    async function link(commit: Commit) {
        if (!selected || linking) return
        const version = generation.current
        setLinking(commit.external_id); setError('')
        try {
            const response = await fetch(`/api/backend/cases/development/commits?${query}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repositoryId: selected.id, caseId, commit: commit.external_id }),
            })
            const payload = await response.json()
            if (!response.ok) throw new Error(payload.error || 'Could not link commit.')
            if (version === generation.current) onLinked()
        } catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : 'Could not link commit.') }
        finally { if (version === generation.current) setLinking('') }
    }
    return <div hidden={!open} id='case-commit-picker'>
        <div className='grid gap-3 border-t border-ui-border pt-3'>
            <h3 className='text-sm font-medium'>Recent commits</h3>
            {repositories.length > 0 ? <>
                <label className='grid gap-1 text-sm'>Repository<select className={`${control} w-full min-w-0`} value={selected?.id || ''} onChange={event => setRepositoryId(event.target.value)}>
                    {repositories.map(repository => <option key={repository.id} value={repository.id}>{repository.repository_url.replace(/^https:\/\//, '')}{repository.organization_id ? '' : ' (personal)'}</option>)}
                </select></label>
                <label className='grid gap-1 text-sm'>Search commits<input type='search' maxLength={200} className={control} placeholder='Message, author, or commit hash' value={search} onChange={event => setSearch(event.target.value)} /></label>
                {selected?.can_manage === false && <p className='text-sm text-ui-muted'>Repository administrators can link commits.</p>}
                <ul ref={list} aria-label='Recent commits' tabIndex={0} className='max-h-72 overflow-y-auto rounded-lg border border-ui-border divide-y divide-ui-border' onScroll={event => {
                    const element = event.currentTarget
                    if (element.scrollTop > 0 && element.scrollHeight - element.clientHeight - element.scrollTop < 96 && visible < commits.length) {
                        flushSync(() => setVisible(value => Math.min(value + 5, commits.length)))
                    } else if (element.scrollTop > 0 && element.scrollHeight - element.clientHeight - element.scrollTop < 96 && nextCursor) {
                        waitingForMore.current = true
                    }
                }}>
                    {commits.slice(0, visible).map(commit => <li key={commit.external_id}>
                        <button type='button' disabled={Boolean(linking) || selected?.can_manage === false} aria-label={`Link commit ${commit.external_id.slice(0, 8)}: ${commit.title}`} className='grid min-h-20 w-full gap-1 p-3 text-left text-sm hover:bg-ui-raised disabled:opacity-50' onClick={() => void link(commit)}>
                            <span className='font-medium [overflow-wrap:anywhere]'>{commit.title}</span>
                            <span className='text-xs text-ui-muted [overflow-wrap:anywhere]'>{commit.external_id.slice(0, 8)} · {commit.author} · {new Date(commit.updated_at).toLocaleString()}</span>
                        </button>
                    </li>)}
                </ul>
                {loading && !commits.length && <p role='status' className='text-sm text-ui-muted'>Loading commits…</p>}
                {!loading && !error && !commits.length && <p role='status' className='text-sm text-ui-muted'>{search.trim() ? 'No matching commits.' : 'No commits available for this repository.'}</p>}
                {loading && visible >= commits.length && commits.length > 0 && <p role='status' className='text-sm text-ui-muted'>Loading more commits…</p>}
                {error && <p role='alert' className='text-sm text-ui-danger'>{error} <button className='underline' onClick={() => setRetry(value => value + 1)}>Retry</button></p>}
            </> : <p className='text-sm text-ui-muted'>Connect a repository to browse its commits.</p>}
        </div>
    </div>
}
