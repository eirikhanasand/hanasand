'use client'

import { useEffect, useState } from 'react'
import { GitCommitHorizontal, GitPullRequest, RefreshCw } from 'lucide-react'
import config from '@/config'

type Entry = { repository_id: string, kind: string, external_id: string, title: string, url: string, author: string, state: string, branch: string, updated_at: string, repository_url: string, provider: string }
type Repository = { id: string, provider: string, repository_url: string, last_received_at?: string, last_warning?: string }
const control = 'min-w-0 rounded-lg border border-ui-border bg-ui-canvas px-3 py-2 text-sm disabled:opacity-50'

export function CaseDevelopment({ caseId, organizationId }: { caseId: string, organizationId?: string }) {
    const [entries, setEntries] = useState<Entry[]>([])
    const [repositories, setRepositories] = useState<Repository[]>([])
    const [hasMore, setHasMore] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [provider, setProvider] = useState('forgejo')
    const [url, setUrl] = useState('')
    const [setup, setSetup] = useState<{ secret: string, webhookPath: string } | null>(null)
    const [revision, setRevision] = useState(0)
    const query = new URLSearchParams(organizationId ? { organizationId } : {}).toString()
    const base = '/api/backend/cases'
    async function request(path: string, init?: RequestInit) {
        const response = await fetch(path, { cache: 'no-store', ...init })
        const payload = await response.json()
        if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Could not load repository integration.')
        return payload
    }
    useEffect(() => { setSetup(null) }, [caseId, query])
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        setEntries([]); setRepositories([]); setHasMore(false)
        setError('')
        Promise.all([
            request(`${base}/development?${query}&caseId=${encodeURIComponent(caseId)}`, { signal: controller.signal }),
            request(`${base}/repositories?${query}`, { signal: controller.signal }),
        ]).then(([development, connections]) => { if (controller.signal.aborted) return; setEntries(development.items); setHasMore(development.hasMore); setRepositories(connections.items) })
            .catch(error => { if (!controller.signal.aborted) setError(error.message) })
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [caseId, query, revision])
    async function connect(event: React.FormEvent) {
        event.preventDefault()
        setLoading(true); setError(''); setSetup(null)
        try {
            setSetup(await request(`${base}/repositories?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, repositoryUrl: url }) }))
            setUrl(''); setRevision(value => value + 1)
        } catch (error) { setError(error instanceof Error ? error.message : 'Could not connect repository.') }
        finally { setLoading(false) }
    }
    async function disconnect(repository: Repository) {
        if (!window.confirm('Disconnect this repository and remove its case links? The repository itself will not change.')) return
        setLoading(true); setError('')
        try { await request(`${base}/repositories/${repository.id}?${query}`, { method: 'DELETE' }); setRevision(value => value + 1); setSetup(null) }
        catch (error) { setError(error instanceof Error ? error.message : 'Could not disconnect repository.') }
        finally { setLoading(false) }
    }
    async function loadMore() {
        setLoading(true); setError('')
        try {
            const payload = await request(`${base}/development?${query}&caseId=${encodeURIComponent(caseId)}&offset=${entries.length}`)
            setEntries(previous => [...previous, ...payload.items]); setHasMore(payload.hasMore)
        } catch (error) { setError(error instanceof Error ? error.message : 'Could not load more changes.') }
        finally { setLoading(false) }
    }
    const reference = /^HA-[1-9]\d*$|^case_[a-f0-9]{1,16}$/.test(caseId) ? caseId : `[case:${caseId}]`
    return <section aria-label='Development' className='grid min-w-0 gap-3 rounded-lg border border-ui-border bg-ui-canvas p-4 text-ui-text'>
        <div className='flex items-center justify-between gap-3'><h2 className='text-lg font-semibold'>Development</h2><button type='button' className={control} aria-label='Refresh development links' title='Refresh development links' disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw className='h-4 w-4' /></button></div>
        <p className='text-sm text-ui-muted'>Mention <code className='break-all select-all'>{reference}</code> in a commit message or pull/merge request title or description to link it here. Linking a change does not resolve the case.</p>
        {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
        {loading && !entries.length && <p role='status' className='text-sm text-ui-muted'>Loading development links…</p>}
        {!loading && !error && !entries.length && <p className='text-sm text-ui-muted'>No related changes received yet.</p>}
        <ul className='grid gap-2'>{entries.map(entry => <li key={`${entry.repository_id}:${entry.kind}:${entry.external_id}`} className='flex min-w-0 gap-3 rounded-lg border border-ui-border p-3'>
            {entry.kind === 'commit' ? <GitCommitHorizontal className='mt-1 h-4 w-4 shrink-0' /> : <GitPullRequest className='mt-1 h-4 w-4 shrink-0' />}
            <div className='min-w-0'><a href={entry.url} target='_blank' rel='noopener noreferrer' className='wrap-break-word font-medium text-ui-primary'>{entry.kind === 'commit' ? entry.external_id.slice(0, 8) : `#${entry.external_id}`} · {entry.title}</a>
                <p className='wrap-break-word text-xs text-ui-muted'>{entry.provider} · {entry.repository_url.replace(/^https:\/\//, '')} · {entry.state} · {entry.author} · {new Date(entry.updated_at).toLocaleString()}</p>
                {entry.branch && <p className='break-all text-xs text-ui-muted'>{entry.branch.replace(/^refs\/heads\//, '')}</p>}</div>
        </li>)}</ul>
        {hasMore && <button type='button' className={control} disabled={loading} onClick={loadMore}>Load more changes</button>}
        <details className='border-t border-ui-border pt-3'><summary className='cursor-pointer text-sm font-medium'>Repository connections ({repositories.length})</summary>
            <div className='mt-3 grid gap-3'>
                <p className='text-sm text-ui-muted'>{organizationId ? 'Connections share repository details with active members of this organization. Organization administrators manage them.' : 'These connections and repository details are private to your account.'} Webhooks link new events; existing history is not imported automatically.</p>
                {repositories.map(repository => <div key={repository.id} className='grid gap-1 rounded-lg border border-ui-border p-3 text-sm'><p className='break-all'>{repository.repository_url}</p><p className='text-ui-muted'>{repository.last_received_at ? `Last event: ${new Date(repository.last_received_at).toLocaleString()}` : 'Waiting for the first webhook event.'}</p>{repository.last_warning && <p role='status' className='text-ui-danger'>{repository.last_warning}</p>}<button type='button' className={`${control} justify-self-start`} disabled={loading} onClick={() => disconnect(repository)}>Disconnect</button></div>)}
                <form onSubmit={connect} className='grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)_auto] sm:items-end'>
                    <label className='grid gap-1 text-sm'>Provider<select aria-label='Provider' className={control} value={provider} onChange={event => setProvider(event.target.value)}><option value='forgejo'>Forgejo</option><option value='github'>GitHub</option><option value='gitlab'>GitLab</option></select></label>
                    <label className='grid min-w-0 flex-1 gap-1 text-sm'>Repository URL<input className={control} type='url' required placeholder='https://git.example.com/team/repository' value={url} onChange={event => setUrl(event.target.value)} /></label>
                    <button className={control} disabled={loading} type='submit'>Connect repository</button>
                </form>
                {setup && <div className='grid gap-2 rounded-lg border border-ui-border p-3 text-sm'><p>Add a webhook in this repository’s settings. Select JSON, push events and pull request events (merge request events in GitLab). Keep TLS verification enabled.</p><label className='grid gap-1'>Webhook URL<input readOnly className={control} value={`${config.url.api.replace(/\/api\/?$/, '')}${setup.webhookPath}`} /></label><label className='grid gap-1'>Webhook secret — shown once<input readOnly className={control} value={setup.secret} /></label><p>For GitLab, enter this in “Secret token”. For GitHub and Forgejo, use “Secret”. Save it before leaving this page.</p><button type='button' className={`${control} justify-self-start`} onClick={() => setSetup(null)}>Hide secret</button></div>}
            </div>
        </details>
    </section>
}
