'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, Plus, Search, X } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import DeleteAccountButton from './deleteAccountButton'
import AccountDate from './accountDate'
import ServiceAccountDescription from './serviceAccountDescription'
import EditServiceAccountButton from './editServiceAccountButton'

type Endpoint = { method: string, route: string, label: string }
type Account = { id: string, name: string, description?: string, active: boolean, created_at: string | null, keys: { lastUsedAt: string | null, scopes: Endpoint[] }[] }

async function request(path = '', options: RequestInit = {}) {
    const response = await fetch(`${config.url.api}/service-accounts${path}`, { ...options, cache: 'no-store', headers: {
        'Content-Type': 'application/json', Authorization: `Bearer ${getCookie('access_token') || ''}`, id: getCookie('id') || '',
    } })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'Unable to update service accounts.')
    return body
}

export default function ServiceAccounts() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [endpoints, setEndpoints] = useState<Endpoint[]>([])
    const [selected, setSelected] = useState<string[]>([])
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [secret, setSecret] = useState('')
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState('')
    const [error, setError] = useState('')
    const [ready, setReady] = useState(false)
    const [pending, setPending] = useState(false)
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState('asc')
    const [createError, setCreateError] = useState('')
    const searchInput = useRef<HTMLInputElement>(null)
    const nameInput = useRef<HTMLInputElement>(null)
    const dialog = useRef<HTMLDialogElement>(null)
    const load = useCallback(async () => {
        const data = await request()
        setAccounts(data.accounts)
        setEndpoints(data.endpoints)
        setReady(true)
    }, [])
    useEffect(() => { void load().catch(error => setError(error.message)) }, [load])
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.repeat || event.altKey || event.shiftKey || document.querySelector('dialog[open]')) return
            event.preventDefault()
            searchInput.current?.focus()
            searchInput.current?.select()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])

    const activeAccounts = accounts.filter(account => account.active)
    const query = search.trim().toLowerCase()
    const visibleAccounts = activeAccounts.filter(account => [account.name, account.id, account.description || '', ...account.keys.flatMap(key => key.scopes.map(scope => `${scope.method} ${scope.route} ${scope.label || ''}`))].some(value => value.toLowerCase().includes(query)))
        .sort((a, b) => (sort === 'asc' ? 1 : -1) * (a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id)))

    return <div className='grid gap-5'>
        {error && <p role='alert' className='text-ui-danger'>{error}</p>}
        {!ready && !error && <p>Loading service accounts…</p>}
        {ready && <>
            <div className='flex flex-wrap items-center gap-3'>
                <div className='flex min-w-0 flex-1 basis-64 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 focus-within:ring-2 focus-within:ring-ui-primary'>
                    <Search className='h-4 w-4 shrink-0 text-ui-muted' aria-hidden='true' />
                    <input ref={searchInput} type='search' aria-label='Search service accounts' aria-keyshortcuts='Meta+J Control+J' value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setSearch('') }} placeholder='Search accounts…' className='h-10 min-w-0 w-full bg-transparent text-sm outline-none' />
                    <kbd className='shrink-0 rounded border border-ui-border px-1.5 py-0.5 text-[10px] text-ui-muted'>⌘/Ctrl J</kbd>
                </div>
                <select aria-label='Sort service accounts' value={sort} onChange={event => setSort(event.target.value)} className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm focus-visible:outline-ui-primary'>
                    <option value='asc'>Name: A–Z</option>
                    <option value='desc'>Name: Z–A</option>
                </select>
                <button type='button' onClick={() => { setCreateError(''); dialog.current?.showModal(); nameInput.current?.focus() }} className='ml-auto inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary'><Plus className='h-4 w-4' aria-hidden='true' />Add service account</button>
            </div>
            <p role='status' className='text-sm text-ui-muted'>{visibleAccounts.length} of {activeAccounts.length} service accounts</p>
            <dialog ref={dialog} aria-labelledby='create-service-account-title' aria-describedby='create-service-account-description' onCancel={event => { if (pending) event.preventDefault() }} className='m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-ui-border bg-ui-panel p-5 text-ui-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm sm:p-6'>
                <div className='mb-5 flex items-start justify-between gap-4'>
                    <div><h2 id='create-service-account-title' className='text-lg font-semibold'>Add service account</h2><p id='create-service-account-description' className='mt-1 text-sm text-ui-muted'>Give the account a name and choose the endpoints it can access.</p></div>
                    <button type='button' aria-label='Close create service account' disabled={pending} onClick={() => dialog.current?.close()} className='rounded-lg p-2 text-ui-muted hover:bg-ui-raised disabled:opacity-50'><X className='h-5 w-5' aria-hidden='true' /></button>
                </div>
                <form className='grid gap-4' onSubmit={async event => {
                    event.preventDefault()
                    if (pending || !name.trim() || !selected.length) return
                    setPending(true); setCreateError('')
                    try {
                        const result = await request('', { method: 'POST', body: JSON.stringify({ name: name.trim(), description: description.trim(), scopes: endpoints.filter(endpoint => selected.includes(`${endpoint.method} ${endpoint.route}`)).map(({ method, route }) => ({ method, route })) }) })
                        setSecret(result.secret); setName(''); setDescription(''); setSelected([]); setCopied(false); setCopyError(''); setError('')
                        dialog.current?.close()
                        await load().catch(error => setError(error.message))
                    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Unable to create service account.') }
                    finally { setPending(false) }
                }}>
                    <label className='grid gap-1 text-sm'>Name<input ref={nameInput} disabled={pending} required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder='Production health monitor' className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></label>
                    <label className='grid gap-1 text-sm'>Description (optional)<textarea disabled={pending} maxLength={2000} rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder='What does this account do?' className='resize-y rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></label>
                    <fieldset disabled={pending} className='grid gap-1 rounded-lg border border-ui-border p-3'><legend className='px-1 text-sm font-semibold'>Allowed endpoints</legend>
                        {endpoints.map(endpoint => { const id = `${endpoint.method} ${endpoint.route}`; return <label key={id} className='flex items-start gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-ui-primary/5'><input className='mt-0.5 accent-ui-primary' type='checkbox' checked={selected.includes(id)} onChange={event => setSelected(current => event.target.checked ? [...current, id] : current.filter(value => value !== id))} /><span className='grid min-w-0 gap-0.5 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2'>{endpoint.label} <code className='break-all text-xs text-ui-muted'>{endpoint.method} {endpoint.route}</code></span></label> })}
                    </fieldset>
                    {createError && <p role='alert' className='text-sm text-ui-danger'>{createError}</p>}
                    <div className='flex flex-wrap justify-end gap-2 border-t border-ui-border pt-4'>
                        <button type='button' disabled={pending} onClick={() => dialog.current?.close()} className='rounded-lg border border-ui-border px-4 py-2 text-sm hover:bg-ui-raised disabled:opacity-50'>Cancel</button>
                        <button disabled={pending || !selected.length || !name.trim()} className='rounded-lg bg-ui-primary px-4 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Creating…' : 'Create service account'}</button>
                    </div>
                </form>
            </dialog>
            {secret && <section aria-labelledby='service-account-key-title' className='grid gap-4 rounded-xl border border-ui-primary/25 bg-ui-primary/10 p-4 shadow-sm sm:p-5'>
                <div className='flex items-start gap-3'>
                    <span className='grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ui-primary/15 text-ui-primary'><KeyRound className='h-5 w-5' aria-hidden='true' /></span>
                    <div className='grid gap-1'>
                        <h3 id='service-account-key-title' className='font-semibold text-ui-primary'>Save this key now</h3>
                        <p className='text-sm leading-6 text-ui-text'>This key is shown only once. Store it somewhere safe.</p>
                    </div>
                </div>
                <code className='block min-w-0 break-all select-all rounded-lg border border-ui-primary/20 bg-ui-panel/80 px-4 py-3 font-mono text-sm leading-6 text-ui-text'>{secret}</code>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <p className='text-sm text-ui-muted'>Send it in the <code className='font-medium text-ui-text'>X-API-Key</code> request header.</p>
                    <div className='flex flex-wrap items-center gap-2'>
                        <button type='button' className='inline-flex items-center gap-2 rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary' onClick={async () => {
                            try { await navigator.clipboard.writeText(secret); setCopied(true); setCopyError('') }
                            catch { setCopyError('Could not copy automatically. Select the key above and copy it.'); setCopied(false) }
                        }}>{copied ? <Check className='h-4 w-4' aria-hidden='true' /> : <Copy className='h-4 w-4' aria-hidden='true' />}<span aria-live='polite'>{copied ? 'Copied' : 'Copy key'}</span></button>
                        <button type='button' className='rounded-lg border border-ui-primary/25 px-3 py-2 text-sm font-medium text-ui-text transition hover:bg-ui-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary' onClick={() => { setSecret(''); setCopied(false); setCopyError('') }}>Dismiss key</button>
                    </div>
                </div>
                {copyError && <p role='alert' className='text-sm text-ui-text'>{copyError}</p>}
            </section>}
            <div className='overflow-x-auto'><table className='w-full text-left text-sm'><thead><tr><th className='p-2'>Name</th><th className='p-2'>Description</th><th className='p-2'>Endpoints</th><th className='p-2'>Created</th><th className='p-2'>Last used</th><th className='p-2'><span className='sr-only'>Actions</span></th></tr></thead><tbody>
                {visibleAccounts.map(account => <tr key={account.id} className='border-t border-ui-border'><td className='p-2'>{account.name}</td><td className='p-2'><ServiceAccountDescription name={account.name} description={account.description || ''} /></td><td className='p-2'>{account.keys.flatMap(key => key.scopes).map(scope => <div key={`${scope.method} ${scope.route}`}><code className='text-xs'>{scope.method} {scope.route}</code></div>)}</td><td className='p-2 whitespace-nowrap'><AccountDate value={account.created_at} /></td><td className='p-2 whitespace-nowrap'><AccountDate value={account.keys.map(key => key.lastUsedAt).filter((value): value is string => Boolean(value)).sort().at(-1)} empty='Never' /></td><td className='p-2'><div className='flex items-center justify-end gap-1'><EditServiceAccountButton name={account.name} description={account.description || ''} onSave={async details => {
                    const saved = await request(`/${encodeURIComponent(account.id)}`, { method: 'PATCH', body: JSON.stringify(details) })
                    setAccounts(current => current.map(item => item.id === account.id ? { ...item, name: saved.name, description: saved.description } : item))
                }} /><DeleteAccountButton alwaysConfirm name={account.name} onDelete={async () => { await request(`/${encodeURIComponent(account.id)}`, { method: 'DELETE' }); await load() }} /></div></td></tr>)}
            </tbody></table></div>
            {!visibleAccounts.length && <p className='text-sm text-ui-muted'>{activeAccounts.length ? 'No service accounts match your search.' : 'No service accounts yet.'}</p>}
        </>}
    </div>
}
