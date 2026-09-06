'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import AccessCodePanel from '@/components/accessCodePanel'
import CodeReview from './codeReview'

export default function CodeAccess({ canEdit, toolbar }: { canEdit: boolean, toolbar: HTMLElement | null }) {
    const [unlocked, setUnlocked] = useState(canEdit)
    const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
    const lock = useCallback(() => setUnlocked(false), [])
    useEffect(() => {
        if (canEdit) return
        let stopped = false
        fetch('/api/thesis/code/access', { cache: 'no-store' }).then(response => response.json()).then(result => {
            if (!stopped) setUnlocked(result.authenticated === true)
        }).catch(() => { if (!stopped) setError('Could not check access. Enter the code to try again.') })
        return () => { stopped = true }
    }, [canEdit])
    async function login(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setBusy(true); setError('')
        try {
            const response = await fetch('/api/thesis/code/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Could not unlock code.')
            setCode(''); setUnlocked(true)
        } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not unlock code.') }
        finally { setBusy(false) }
    }
    return unlocked ? <CodeReview canReview={canEdit} toolbar={toolbar} onLocked={lock} /> : <div className='code-access'>
        {error && <p role='alert' className='mt-4 text-sm text-ui-danger'>{error}</p>}
        <AccessCodePanel code={code} onChange={setCode} busy={busy} onSubmit={login} />
    </div>
}
