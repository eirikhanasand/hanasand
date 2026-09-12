'use client'

import { useCallback, useEffect, useState } from 'react'
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
            <form className='grid gap-3' onSubmit={async event => {
                event.preventDefault()
                setPending(true); setError(''); setSecret('')
                try {
                    const result = await request('', { method: 'POST', body: JSON.stringify({ name, scopes: endpoints.filter(endpoint => selected.includes(endpoint.route)).map(({ method, route }) => ({ method, route })) }) })
                    setSecret(result.secret); setName(''); setSelected([])
                    await load()
                } catch (error) { setError(error instanceof Error ? error.message : 'Unable to create service account.') }
                finally { setPending(false) }
            }}>
                <label className='grid gap-1 text-sm'>Name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder='Production health monitor' className='max-w-md rounded-lg border border-ui-border bg-ui-raised px-3 py-2' /></label>
                <fieldset className='grid gap-2 rounded-lg border border-ui-border p-3'><legend className='px-1 text-sm font-semibold'>Allowed endpoints</legend>
                    {endpoints.map(endpoint => <label key={endpoint.route} className='flex items-center gap-2 text-sm'><input type='checkbox' checked={selected.includes(endpoint.route)} onChange={event => setSelected(current => event.target.checked ? [...current, endpoint.route] : current.filter(route => route !== endpoint.route))} /><span>{endpoint.label} <code className='text-xs text-ui-muted'>{endpoint.method} {endpoint.route}</code></span></label>)}
                </fieldset>
                <button disabled={pending || !selected.length} className='w-fit rounded-lg bg-ui-primary px-4 py-2 font-semibold text-ui-canvas disabled:opacity-50'>{pending ? 'Creating…' : 'Create service account'}</button>
            </form>
            {secret && <div role='status' className='grid gap-2 rounded-lg border border-ui-border p-3'><p>Save this key now. It is shown only once. Send it in the X-API-Key header.</p><code className='break-all select-all'>{secret}</code><button className='w-fit rounded border border-ui-border px-3 py-1' onClick={() => setSecret('')}>Dismiss key</button></div>}
            <div className='overflow-x-auto'><table className='w-full text-left text-sm'><thead><tr><th className='p-2'>Name</th><th className='p-2'>Endpoints</th><th className='p-2'>Created</th><th className='p-2'>Last used</th><th className='p-2'><span className='sr-only'>Actions</span></th></tr></thead><tbody>
                {accounts.filter(account => account.active).map(account => <tr key={account.id} className='border-t border-ui-border'><td className='p-2'>{account.name}</td><td className='p-2'>{account.keys.flatMap(key => key.scopes).map(scope => <div key={`${scope.method} ${scope.route}`}><code className='text-xs'>{scope.method} {scope.route}</code></div>)}</td><td className='p-2 whitespace-nowrap'><AccountDate value={account.created_at} /></td><td className='p-2 whitespace-nowrap'><AccountDate value={account.keys.map(key => key.lastUsedAt).filter((value): value is string => Boolean(value)).sort().at(-1)} empty='Never' /></td><td className='p-2'><DeleteAccountButton name={account.name} onDelete={async () => { await request(`/${encodeURIComponent(account.id)}`, { method: 'DELETE' }); await load() }} /></td></tr>)}
            </tbody></table></div>
            {!accounts.some(account => account.active) && <p className='text-sm text-ui-muted'>No service accounts yet.</p>}
        </>}
    </div>
}
