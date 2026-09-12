'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'
import DeleteAccountButton from './deleteAccountButton'
import AccountDate from './accountDate'

type Endpoint = { method: string, route: string, label: string }
type Account = { id: string, name: string, active: boolean, created_at: string | null, keys: { lastUsedAt: string | null, scopes: Endpoint[] }[] }

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
    const [secret, setSecret] = useState('')
    const [copied, setCopied] = useState(false)
    const [copyError, setCopyError] = useState('')
    const [error, setError] = useState('')
    const [ready, setReady] = useState(false)
    const [pending, setPending] = useState(false)
    const load = useCallback(async () => {
        const data = await request()
        setAccounts(data.accounts)
        setEndpoints(data.endpoints)
        setReady(true)
    }, [])
    useEffect(() => { void load().catch(error => setError(error.message)) }, [load])

    return <div className='grid gap-5'>
        {error && <p role='alert' className='text-ui-danger'>{error}</p>}
        {!ready && !error && <p>Loading service accounts…</p>}
        {ready && <>
            <form className='grid gap-4' onSubmit={async event => {
                event.preventDefault()
                setPending(true); setError(''); setSecret(''); setCopied(false); setCopyError('')
                try {
                    const result = await request('', { method: 'POST', body: JSON.stringify({ name, scopes: endpoints.filter(endpoint => selected.includes(endpoint.route)).map(({ method, route }) => ({ method, route })) }) })
                    setSecret(result.secret); setName(''); setSelected([])
                    await load()
                } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create service account.') }
                finally { setPending(false) }
            }}>
                <label className='grid gap-1 text-sm'>Name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder='Production health monitor' className='max-w-md rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></label>
                <fieldset className='grid gap-1 rounded-lg border border-ui-border p-3'><legend className='px-1 text-sm font-semibold'>Allowed endpoints</legend>
                    {endpoints.map(endpoint => <label key={endpoint.route} className='flex items-start gap-3 rounded-md px-2 py-2 text-sm transition hover:bg-ui-primary/5'><input className='mt-0.5 accent-ui-primary' type='checkbox' checked={selected.includes(endpoint.route)} onChange={event => setSelected(current => event.target.checked ? [...current, endpoint.route] : current.filter(route => route !== endpoint.route))} /><span className='grid gap-0.5 sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-2'>{endpoint.label} <code className='text-xs text-ui-muted'>{endpoint.method} {endpoint.route}</code></span></label>)}
                </fieldset>
                <button disabled={pending || !selected.length} className='w-fit rounded-lg bg-ui-primary px-4 py-2 font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Creating…' : 'Create service account'}</button>
            </form>
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
            <div className='overflow-x-auto'><table className='w-full text-left text-sm'><thead><tr><th className='p-2'>Name</th><th className='p-2'>Endpoints</th><th className='p-2'>Created</th><th className='p-2'>Last used</th><th className='p-2'><span className='sr-only'>Actions</span></th></tr></thead><tbody>
                {accounts.filter(account => account.active).map(account => <tr key={account.id} className='border-t border-ui-border'><td className='p-2'>{account.name}</td><td className='p-2'>{account.keys.flatMap(key => key.scopes).map(scope => <div key={`${scope.method} ${scope.route}`}><code className='text-xs'>{scope.method} {scope.route}</code></div>)}</td><td className='p-2 whitespace-nowrap'><AccountDate value={account.created_at} /></td><td className='p-2 whitespace-nowrap'><AccountDate value={account.keys.map(key => key.lastUsedAt).filter((value): value is string => Boolean(value)).sort().at(-1)} empty='Never' /></td><td className='p-2'><DeleteAccountButton name={account.name} onDelete={async () => { await request(`/${encodeURIComponent(account.id)}`, { method: 'DELETE' }); await load() }} /></td></tr>)}
            </tbody></table></div>
            {!accounts.some(account => account.active) && <p className='text-sm text-ui-muted'>No service accounts yet.</p>}
        </>}
    </div>
}
