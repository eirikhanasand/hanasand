'use client'

import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { DashboardPanel } from '@/components/dashboard/ui'
import { createProfileSshKey, removeProfileSshKey, type ProfileSshKey } from '@/utils/sshKeys'

export default function SshKeys({ initialKeys }: { initialKeys: ProfileSshKey[] | null }) {
    const [keys, setKeys] = useState(initialKeys)
    const [adding, setAdding] = useState(false)
    const [name, setName] = useState('')
    const [publicKey, setPublicKey] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    async function addKey(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true)
        setError('')
        try {
            const result = await createProfileSshKey(name.trim(), publicKey.trim())
            if (!result.ok || !result.key) throw new Error(result.error || 'Unable to add this key.')
            setKeys(previous => [result.key!, ...(previous || [])])
            setName('')
            setPublicKey('')
            setAdding(false)
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to add this key.')
        } finally {
            setBusy(false)
        }
    }

    async function removeKey(key: ProfileSshKey) {
        setBusy(true)
        setError('')
        try {
            const result = await removeProfileSshKey(key.id)
            if (!result.ok) throw new Error(result.error || 'Unable to remove this key.')
            setKeys(previous => previous?.filter(item => item.id !== key.id) || [])
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Unable to remove this key.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <DashboardPanel className='h-fit p-4'>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <h1 className='text-base font-semibold text-ui-text'>SSH Keys</h1>
                    <p className='mt-1 text-sm text-ui-muted'>{keys?.length || 0} keys</p>
                </div>
                <button type='button' onClick={() => { setError(''); setAdding(true) }} className='flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'>
                    <Plus className='h-4 w-4' /> Add key
                </button>
            </div>
            {error && <p role='alert' className='mt-3 rounded-lg border border-ui-danger/30 bg-ui-danger/5 px-3 py-2 text-sm text-ui-danger'>{error}</p>}
            {keys === null ? (
                <p role='alert' className='mt-4 rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-4 text-sm text-ui-danger'>Unable to load SSH keys. Refresh the page to try again.</p>
            ) : keys.length ? (
                <div className='mt-4 overflow-x-auto rounded-lg border border-ui-border'>
                    <table className='w-full min-w-[720px] text-left text-sm'>
                        <thead className='bg-ui-raised text-xs uppercase tracking-wide text-ui-muted'>
                            <tr><th scope='col' className='px-4 py-3'>Key</th><th scope='col' className='px-4 py-3'>Fingerprint</th><th scope='col' className='px-4 py-3'>Added</th><th scope='col' className='px-4 py-3'>Last used</th><th scope='col' className='w-12 px-3 py-3'><span className='sr-only'>Actions</span></th></tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {keys.map(key => <tr key={key.id}>
                                <th scope='row' className='px-4 py-3 font-medium text-ui-text'>
                                    <span className='block'>{key.name}</span>
                                    <span className='mt-0.5 block text-xs font-normal text-ui-muted'>{key.keyType}</span>
                                </th>
                                <td className='px-4 py-3 font-mono text-xs text-ui-muted'>{key.fingerprint}</td>
                                <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatDate(key.addedAt)}</td>
                                <td className='whitespace-nowrap px-4 py-3 text-ui-muted'>{formatDateTime(key.lastUsedAt)}</td>
                                <td className='px-3 py-3 text-right'>
                                    <button type='button' disabled={busy} onClick={() => void removeKey(key)} aria-label={`Remove ${key.name}`} title='Remove key' className='rounded-lg p-2 text-ui-muted transition hover:bg-ui-danger/10 hover:text-ui-danger disabled:opacity-50'>
                                        <Trash2 className='h-4 w-4' />
                                    </button>
                                </td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className='mt-4 rounded-lg border border-dashed border-ui-border bg-ui-raised p-4 text-sm text-ui-muted'>No keys added.</p>
            )}
            {adding && <div className='fixed inset-0 z-50 grid place-items-center bg-ui-canvas/75 px-4 backdrop-blur-sm' onClick={() => !busy && setAdding(false)}>
                <div role='dialog' aria-modal='true' aria-labelledby='add-ssh-key-title' className='w-full max-w-xl rounded-xl border border-ui-border bg-ui-panel p-4 shadow-2xl' onClick={event => event.stopPropagation()}>
                    <div className='mb-4 flex items-center justify-between gap-3'>
                        <h2 id='add-ssh-key-title' className='text-lg font-semibold text-ui-text'>Add SSH key</h2>
                        <button type='button' disabled={busy} onClick={() => setAdding(false)} aria-label='Close' className='grid h-8 w-8 place-items-center rounded-lg border border-ui-border text-ui-muted hover:text-ui-text'><X className='h-4 w-4' /></button>
                    </div>
                    <form onSubmit={event => void addKey(event)} className='flex flex-col gap-4'>
                        <div className='flex flex-col gap-1'>
                            <label htmlFor='ssh-key-name' className='text-sm font-semibold text-ui-text'>Name</label>
                            <input id='ssh-key-name' value={name} onChange={event => setName(event.target.value)} required maxLength={100} placeholder='Work laptop' className='rounded-lg border border-ui-border bg-ui-raised p-2 text-ui-text placeholder:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/40' />
                        </div>
                        <div className='flex flex-col gap-1'>
                            <label htmlFor='ssh-public-key' className='text-sm font-semibold text-ui-text'>Public key</label>
                            <textarea id='ssh-public-key' value={publicKey} onChange={event => setPublicKey(event.target.value)} required spellCheck={false} placeholder='ssh-ed25519 AAAA… device-name' className='h-28 resize-y rounded-lg border border-ui-border bg-ui-raised p-2 font-mono text-sm text-ui-text placeholder:font-sans placeholder:text-ui-muted focus:outline-none focus:ring-2 focus:ring-ui-primary/40' />
                        </div>
                        {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
                        <div className='flex justify-end gap-2'>
                            <button type='button' disabled={busy} onClick={() => setAdding(false)} className='h-9 rounded-lg px-3 text-sm font-semibold text-ui-muted hover:bg-ui-raised'>Cancel</button>
                            <button type='submit' disabled={busy} className='h-9 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-50'>{busy ? 'Applying…' : 'Add key'}</button>
                        </div>
                    </form>
                </div>
            </div>}
        </DashboardPanel>
    )
}

function formatDate(value: string) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Unknown' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

function formatDateTime(value: string | null) {
    if (!value) return 'Not recorded'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? 'Unknown' : `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}
