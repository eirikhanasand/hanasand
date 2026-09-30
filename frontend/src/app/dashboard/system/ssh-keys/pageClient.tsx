'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import config from '@/config'
import { getCookie } from '@/utils/cookies/cookies'

type HostSshKey = { id: string, name: string, publicKey: string, fingerprint: string, createdAt: string }

export default function HostSshKeysClient() {
    const [keys, setKeys] = useState<HostSshKey[]>([])
    const [name, setName] = useState('')
    const [publicKey, setPublicKey] = useState('')
    const [loading, setLoading] = useState(true)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')

    const requestHeaders = useCallback(() => ({
        id: getCookie('id') || '',
        Authorization: 'Bearer ' + (getCookie('access_token') || ''),
    }), [])

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const response = await fetch(config.url.api + '/host-ssh-keys', { headers: requestHeaders(), cache: 'no-store' })
            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(body?.error || 'Unable to load SSH keys.')
            setKeys(Array.isArray(body?.keys) ? body.keys : [])
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to load SSH keys.')
        } finally {
            setLoading(false)
        }
    }, [requestHeaders])

    useEffect(() => { void load() }, [load])

    async function addKey(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setPending(true)
        setError('')
        setNotice('')
        try {
            const response = await fetch(config.url.api + '/host-ssh-keys', {
                method: 'POST',
                headers: { ...requestHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), publicKey: publicKey.trim() }),
            })
            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(body?.error || 'Unable to add SSH key.')
            setKeys(current => [body.key, ...current])
            setName('')
            setPublicKey('')
            setNotice('Key added to both hosts.')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to add SSH key.')
        } finally {
            setPending(false)
        }
    }

    async function removeKey(key: HostSshKey) {
        if (!window.confirm('Remove ' + key.name + ' from Hanasand and Inspur?')) return
        setPending(true)
        setError('')
        setNotice('')
        try {
            const response = await fetch(config.url.api + '/host-ssh-keys/' + encodeURIComponent(key.id), {
                method: 'DELETE',
                headers: requestHeaders(),
            })
            const body = await response.json().catch(() => null)
            if (!response.ok) throw new Error(body?.error || 'Unable to remove SSH key.')
            setKeys(current => current.filter(item => item.id !== key.id))
            setNotice('Key removed from both hosts.')
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to remove SSH key.')
        } finally {
            setPending(false)
        }
    }

    return <div className='grid gap-3'>
        <DashboardPanel className='grid gap-3 p-4'>
            <div>
                <h2 className='text-base font-semibold'>Add SSH key</h2>
                <p className='mt-1 text-sm text-ui-muted'>Keys added here apply to both hosts immediately. Existing SSH keys stay in place.</p>
            </div>
            <form onSubmit={event => void addKey(event)} className='grid gap-3 md:grid-cols-[minmax(10rem,0.7fr)_minmax(20rem,1.3fr)_auto] md:items-end'>
                <label className='grid gap-1 text-sm font-medium'>Name
                    <input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder='Work laptop' className='h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' />
                </label>
                <label className='grid gap-1 text-sm font-medium'>Public key
                    <textarea required value={publicKey} onChange={event => setPublicKey(event.target.value)} placeholder='ssh-ed25519 AAAA…' rows={3} spellCheck={false} autoCapitalize='off' className='min-h-20 resize-y rounded-lg border border-ui-border bg-ui-raised p-3 font-mono text-xs text-ui-text' />
                </label>
                <button type='submit' disabled={pending} className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-60'><Plus className='h-4 w-4' />{pending ? 'Applying…' : 'Add key'}</button>
            </form>
            {error ? <p role='alert' className='text-sm text-ui-danger'>{error}</p> : null}
            {notice ? <p role='status' className='text-sm text-ui-success'>{notice}</p> : null}
        </DashboardPanel>
        <DashboardPanel className='grid gap-3 p-4'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div><h2 className='text-base font-semibold'>Managed keys</h2><p className='mt-1 text-sm text-ui-muted'>{keys.length} key{keys.length === 1 ? '' : 's'} · Hanasand and Inspur</p></div>
                <button type='button' onClick={() => void load()} disabled={loading || pending} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold disabled:opacity-60'><RefreshCw className='h-4 w-4' />Refresh</button>
            </div>
            {loading ? <p role='status' className='text-sm text-ui-muted'>Loading SSH keys…</p> : keys.length ? <div className='overflow-x-auto'>
                <table className='w-full min-w-[920px] text-left text-sm'>
                    <thead className='text-xs text-ui-muted'><tr><th className='pb-2 pr-3'>Name</th><th className='pb-2 pr-3'>Public key</th><th className='pb-2 pr-3'>Fingerprint</th><th className='pb-2 pr-3'>Added</th><th className='pb-2'> </th></tr></thead>
                    <tbody>{keys.map(key => <tr key={key.id} className='border-t border-ui-border align-top'>
                        <td className='py-3 pr-3 font-medium'>{key.name}</td>
                        <td className='max-w-[30rem] break-all py-3 pr-3 font-mono text-xs text-ui-muted'>{key.publicKey}</td>
                        <td className='whitespace-nowrap py-3 pr-3 font-mono text-xs'>{key.fingerprint}</td>
                        <td className='whitespace-nowrap py-3 pr-3'><time dateTime={key.createdAt}>{new Date(key.createdAt).toLocaleString()}</time></td>
                        <td className='py-2 text-right'><button type='button' disabled={pending} onClick={() => void removeKey(key)} aria-label={'Remove ' + key.name} title='Remove key' className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border px-3 text-sm font-semibold text-ui-text hover:border-ui-danger disabled:opacity-60'><Trash2 className='h-4 w-4' />Remove</button></td>
                    </tr>)}</tbody>
                </table>
            </div> : <p className='text-sm text-ui-muted'>No keys have been added here.</p>}
        </DashboardPanel>
    </div>
}
