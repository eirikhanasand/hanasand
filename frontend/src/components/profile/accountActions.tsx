'use client'

import { DashboardPanel } from '@/components/dashboard/ui'
import { removeCookies } from '@/utils/cookies/cookies'
import { Check, Fingerprint, LogOut, Pencil, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { decodePasskeyCreationOptions, passkeyCredentialToJSON } from '@/utils/auth/passkeys'

type PasskeyRow = {
    credentialId: string
    label: string
    algorithm: string
    createdAt: string
    lastUsedAt: string | null
}

export default function AccountActions({ isSelf }: { isSelf: boolean }) {
    const router = useRouter()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [passkeys, setPasskeys] = useState<PasskeyRow[]>([])
    const [editingPasskeyId, setEditingPasskeyId] = useState('')
    const [passkeyLabel, setPasskeyLabel] = useState('')

    if (!isSelf) return null

    function clearAndGoLogin() {
        removeCookies('access_token', 'id', 'name', 'avatar', 'roles')
        router.push('/login')
    }

    async function refreshPasskeys() {
        const response = await fetch('/api/auth/passkeys', { cache: 'no-store' }).catch(() => null)
        if (!response) return
        const data = await response.json().catch(() => null)
        if (response.ok && Array.isArray(data?.passkeys)) {
            setPasskeys(data.passkeys)
        }
    }

    async function deleteAccount() {
        if (busy) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch('/api/backend/user/self', { method: 'DELETE' })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                setMessage(data?.error || 'Unable to schedule deletion.')
                return
            }
            clearAndGoLogin()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to schedule deletion.')
        } finally {
            setBusy(false)
        }
    }

    async function addPasskey() {
        if (!window.PublicKeyCredential || !navigator.credentials) {
            return setMessage('This browser does not support passkeys.')
        }
        if (busy) return

        setBusy(true)
        setMessage('')
        try {
            const optionsResponse = await fetch('/api/auth/passkeys/register/options', { cache: 'no-store' })
            const options = await optionsResponse.json().catch(() => null)
            if (!optionsResponse.ok || !options?.challengeId || !options?.publicKey) {
                setMessage(options?.error || 'Unable to start passkey enrollment.')
                return
            }

            const credential = await navigator.credentials.create({
                publicKey: decodePasskeyCreationOptions(options.publicKey),
            }) as PublicKeyCredential | null
            if (!credential) {
                setMessage('No passkey was created.')
                return
            }

            const verifyResponse = await fetch('/api/auth/passkeys/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: options.challengeId,
                    credential: passkeyCredentialToJSON(credential),
                    label: defaultPasskeyLabel(),
                }),
            })
            const data = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) {
                setMessage(data?.error || 'Unable to save passkey.')
                return
            }

            setMessage('Passkey added. You can use it on the login page.')
            await refreshPasskeys()
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to add passkey.')
        } finally {
            setBusy(false)
        }
    }

    async function removePasskey(credentialId: string) {
        if (busy) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, { method: 'DELETE' })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                setMessage(data?.error || 'Unable to remove passkey.')
                return
            }
            setPasskeys(current => current.filter(passkey => passkey.credentialId !== credentialId))
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to remove passkey.')
        } finally {
            setBusy(false)
        }
    }

    async function renamePasskey(credentialId: string) {
        const label = passkeyLabel.trim().replace(/\s+/g, ' ')
        if (busy || !label) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch(`/api/auth/passkeys/${encodeURIComponent(credentialId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                setMessage(data?.error || 'Unable to rename passkey.')
                return
            }
            setPasskeys(current => current.map(passkey => passkey.credentialId === credentialId ? { ...passkey, label: data?.label || label } : passkey))
            setEditingPasskeyId('')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to rename passkey.')
        } finally {
            setBusy(false)
        }
    }

    useEffect(() => {
        if (isSelf) {
            void refreshPasskeys()
        }
    }, [isSelf])

    return (
        <DashboardPanel className='p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h2 className='text-base font-semibold text-ui-text'>Account</h2>
                    <p className='mt-1 text-sm text-ui-muted'>Session and deletion controls.</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <button onClick={() => void addPasskey()} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised disabled:opacity-60'>
                        <Fingerprint className='h-4 w-4' />
                        Add passkey
                    </button>
                    <button onClick={clearAndGoLogin} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text hover:bg-ui-raised'>
                        <LogOut className='h-4 w-4' />
                        Log out
                    </button>
                    <button onClick={() => setConfirmDelete(true)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-danger/40 bg-ui-danger/10 px-3 text-sm font-semibold text-ui-danger hover:bg-ui-danger/15'>
                        <Trash2 className='h-4 w-4' />
                        Delete account
                    </button>
                </div>
            </div>
            {message && <p className='mt-3 text-sm text-ui-danger'>{message}</p>}
            <div className='mt-4 grid gap-2'>
                {passkeys.map(passkey => (
                    <div key={passkey.credentialId} className='flex min-w-0 flex-col gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='min-w-0 flex-1'>
                            {editingPasskeyId === passkey.credentialId ? (
                                <form className='flex w-full min-w-0 max-w-full gap-2' onSubmit={(event) => {
                                    event.preventDefault()
                                    void renamePasskey(passkey.credentialId)
                                }}>
                                    <input
                                        value={passkeyLabel}
                                        onChange={event => setPasskeyLabel(event.target.value)}
                                        maxLength={80}
                                        className='h-9 min-w-0 flex-1 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20'
                                        aria-label='Passkey name'
                                    />
                                    <button type='submit' disabled={busy || !passkeyLabel.trim()} className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-success disabled:opacity-60' aria-label='Save passkey name'>
                                        <Check className='h-4 w-4' />
                                    </button>
                                    <button type='button' disabled={busy} onClick={() => setEditingPasskeyId('')} className='grid h-9 w-9 place-items-center rounded-lg border border-ui-border bg-ui-panel text-ui-muted disabled:opacity-60' aria-label='Cancel rename'>
                                        <X className='h-4 w-4' />
                                    </button>
                                </form>
                            ) : (
                                <p className='text-sm font-semibold text-ui-text'>{passkey.label || 'Passkey'}</p>
                            )}
                            <p className='mt-1 text-xs text-ui-muted'>
                                {passkey.algorithm} · {passkey.lastUsedAt ? `Last used ${formatDate(passkey.lastUsedAt)}` : `Added ${formatDate(passkey.createdAt)}`}
                            </p>
                        </div>
                        <div className='flex shrink-0 flex-wrap gap-2'>
                            <button disabled={busy} onClick={() => {
                                setEditingPasskeyId(passkey.credentialId)
                                setPasskeyLabel(passkey.label || 'Passkey')
                            }} className='inline-flex h-8 items-center gap-1.5 rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text hover:bg-ui-canvas disabled:opacity-60'>
                                <Pencil className='h-3.5 w-3.5' />
                                Rename
                            </button>
                            <button disabled={busy} onClick={() => void removePasskey(passkey.credentialId)} className='h-8 rounded-lg border border-ui-danger/40 bg-ui-danger/10 px-3 text-xs font-semibold text-ui-danger hover:bg-ui-danger/15 disabled:opacity-60'>
                                Remove
                            </button>
                        </div>
                    </div>
                ))}
                {!passkeys.length && <div className='rounded-lg border border-dashed border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>No passkeys enrolled.</div>}
            </div>

            {confirmDelete && (
                <div className='fixed inset-0 z-50 grid place-items-center bg-ui-canvas/45 px-4 backdrop-blur-sm'>
                    <div className='grid w-full max-w-sm gap-4 rounded-xl border border-ui-border bg-ui-panel p-4 shadow-2xl shadow-ui-canvas/40'>
                        <div>
                            <h3 className='text-lg font-semibold text-ui-text'>Delete account?</h3>
                            <p className='mt-2 text-sm leading-6 text-ui-muted'>
                                Your account will be logged out everywhere and scheduled for permanent deletion after 30 days.
                            </p>
                        </div>
                        <div className='flex justify-end gap-2'>
                            <button onClick={() => setConfirmDelete(false)} className='h-9 rounded-lg px-3 text-sm font-semibold text-ui-muted hover:bg-ui-raised'>Cancel</button>
                            <button disabled={busy} onClick={() => void deleteAccount()} className='h-9 rounded-lg bg-ui-danger px-4 text-sm font-bold text-ui-canvas hover:bg-ui-danger disabled:opacity-60'>
                                {busy ? 'Scheduling' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardPanel>
    )
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function defaultPasskeyLabel() {
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    if (/iPhone/i.test(userAgent)) return 'Passkey iPhone'
    if (/iPad/i.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'Passkey iPad'
    if (/Mac/i.test(platform)) return 'Passkey Mac'
    if (/Win/i.test(platform)) return 'Passkey Windows'
    if (/Android/i.test(userAgent)) return 'Passkey Android'
    if (/Linux/i.test(platform)) return 'Passkey Linux'
    return 'Passkey'
}
