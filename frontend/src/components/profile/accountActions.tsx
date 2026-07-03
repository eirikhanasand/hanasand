'use client'

import config from '@/config'
import { DashboardPanel } from '@/components/dashboard/ui'
import { getCookie, removeCookies } from '@/utils/cookies/cookies'
import { Fingerprint, LogOut, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { decodePasskeyCreationOptions, passkeyCredentialToJSON } from '@/utils/auth/passkeys'

export default function AccountActions({ isSelf }: { isSelf: boolean }) {
    const router = useRouter()
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')

    if (!isSelf) return null

    function clearAndGoLogin() {
        removeCookies('access_token', 'id', 'name', 'avatar', 'roles')
        router.push('/login')
    }

    async function deleteAccount() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id || busy) return
        setBusy(true)
        setMessage('')
        try {
            const response = await fetch(`${config.url.api}/user/self`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                    id,
                },
            })
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
                }),
            })
            const data = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) {
                setMessage(data?.error || 'Unable to save passkey.')
                return
            }

            setMessage('Passkey added. You can use it on the login page.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to add passkey.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <DashboardPanel className='p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h2 className='text-base font-semibold text-[#171a21]'>Account</h2>
                    <p className='mt-1 text-sm text-[#596170]'>Session and deletion controls.</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <button onClick={() => void addPasskey()} disabled={busy} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#364152] hover:bg-[#f2f5f9] disabled:opacity-60'>
                        <Fingerprint className='h-4 w-4' />
                        Add passkey
                    </button>
                    <button onClick={clearAndGoLogin} className='inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#364152] hover:bg-[#f2f5f9]'>
                        <LogOut className='h-4 w-4' />
                        Log out
                    </button>
                    <button onClick={() => setConfirmDelete(true)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 hover:bg-red-100'>
                        <Trash2 className='h-4 w-4' />
                        Delete account
                    </button>
                </div>
            </div>
            {message && <p className='mt-3 text-sm text-red-700'>{message}</p>}

            {confirmDelete && (
                <div className='fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 backdrop-blur-sm'>
                    <div className='grid w-full max-w-sm gap-4 rounded-xl border border-[#dde3ec] bg-white p-4 shadow-2xl'>
                        <div>
                            <h3 className='text-lg font-semibold text-[#171a21]'>Delete account?</h3>
                            <p className='mt-2 text-sm leading-6 text-[#596170]'>
                                Your account will be logged out everywhere and scheduled for permanent deletion after 30 days.
                            </p>
                        </div>
                        <div className='flex justify-end gap-2'>
                            <button onClick={() => setConfirmDelete(false)} className='h-9 rounded-lg px-3 text-sm font-semibold text-[#596170] hover:bg-[#f2f5f9]'>Cancel</button>
                            <button disabled={busy} onClick={() => void deleteAccount()} className='h-9 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60'>
                                {busy ? 'Scheduling' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardPanel>
    )
}
