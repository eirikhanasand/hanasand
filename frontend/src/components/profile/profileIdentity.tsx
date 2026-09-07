'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { setCookie } from '@/utils/cookies/cookies'

export default function ProfileIdentity({ displayName, username }: { displayName: string, username: string }) {
    const router = useRouter()
    const [name, setName] = useState(displayName)
    const [handle, setHandle] = useState(username)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    async function save(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        setBusy(true)
        setError('')
        setNotice('')
        try {
            const response = await fetch('/api/backend/user/self', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username: handle }),
            })
            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Unable to update your profile.')
            setName(data.name)
            setHandle(data.username)
            setCookie('name', data.name)
            setNotice('Profile updated.')
            router.replace(`/profile/${encodeURIComponent(data.username)}`)
            router.refresh()
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to update your profile.')
        } finally { setBusy(false) }
    }
    const input = 'h-10 w-full rounded-lg border border-ui-border bg-ui-panel px-3 text-sm text-ui-text'
    return <form onSubmit={save} className='mt-4 grid max-w-xl gap-3'>
        <div className='grid gap-3 sm:grid-cols-2'>
            <label className='grid gap-1 text-sm'>Display name
                <input aria-label='Display name' autoComplete='name' className={input} value={name} onChange={event => setName(event.target.value)} required maxLength={100} disabled={busy} />
            </label>
            <label className='grid gap-1 text-sm'>Username
                <input aria-label='Username' autoComplete='username' className={input} value={handle} onChange={event => setHandle(event.target.value)} required minLength={3} maxLength={40} disabled={busy} />
            </label>
        </div>
        <p className='text-xs text-ui-muted'>Your display name can be shared with other people. Your username must be unique.</p>
        <button type='submit' disabled={busy || (name === displayName && handle === username)} className='w-fit rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-canvas disabled:opacity-50'>{busy ? 'Saving…' : 'Save profile'}</button>
        {error && <p role='alert' className='text-sm text-ui-danger'>{error}</p>}
        {notice && <p role='status' className='text-sm text-ui-muted'>{notice}</p>}
    </form>
}
