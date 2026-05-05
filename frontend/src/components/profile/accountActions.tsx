'use client'

import config from '@/config'
import { DashboardPanel } from '@/components/dashboard/ui'
import { getCookie, removeCookies } from '@/utils/cookies/cookies'
import { LogOut, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

    return (
        <DashboardPanel className='p-4'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <h2 className='text-base font-semibold text-bright'>Account</h2>
                    <p className='mt-1 text-sm text-bright/40'>Session and deletion controls.</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <button onClick={clearAndGoLogin} className='inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-semibold text-bright/70 hover:bg-white/10'>
                        <LogOut className='h-4 w-4' />
                        Log out
                    </button>
                    <button onClick={() => setConfirmDelete(true)} className='inline-flex h-9 items-center gap-2 rounded-lg border border-red-300/10 bg-red-500/10 px-3 text-sm font-semibold text-red-100/80 hover:bg-red-500/20'>
                        <Trash2 className='h-4 w-4' />
                        Delete account
                    </button>
                </div>
            </div>
            {message && <p className='mt-3 text-sm text-red-100/80'>{message}</p>}

            {confirmDelete && (
                <div className='fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm'>
                    <div className='grid w-full max-w-sm gap-4 rounded-xl border border-white/10 bg-dark p-4 shadow-2xl'>
                        <div>
                            <h3 className='text-lg font-semibold text-bright'>Delete account?</h3>
                            <p className='mt-2 text-sm leading-6 text-bright/52'>
                                Your account will be logged out everywhere and scheduled for permanent deletion after 30 days.
                            </p>
                        </div>
                        <div className='flex justify-end gap-2'>
                            <button onClick={() => setConfirmDelete(false)} className='h-9 rounded-lg px-3 text-sm font-semibold text-bright/52 hover:bg-white/6'>Cancel</button>
                            <button disabled={busy} onClick={() => void deleteAccount()} className='h-9 rounded-lg bg-red-500/14 px-4 text-sm font-bold text-red-100 hover:bg-red-500/22 disabled:opacity-60'>
                                {busy ? 'Scheduling' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardPanel>
    )
}
