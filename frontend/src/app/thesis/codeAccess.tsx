'use client'
import { useCallback, useEffect, useState } from 'react'
import CodeReview from './codeReview'
type AccessState = 'checking' | 'member' | 'signed-out' | 'not-member' | 'error'
export default function CodeAccess({ canEdit, toolbar }: { canEdit: boolean, toolbar: HTMLElement | null }) {
    const [state, setState] = useState<AccessState>('checking')
    const checkAccess = useCallback(async(signal?: AbortSignal) => {
        try {
            const response = await fetch('/api/thesis/code/access', { cache: 'no-store', signal })
            const result = await response.json()
            if (signal?.aborted) return
            if (response.status === 401) setState('signed-out')
            else if (!response.ok) setState('error')
            else setState(result.authenticated ? 'member' : 'not-member')
        } catch { if (!signal?.aborted) setState('error') }
    }, [])
    useEffect(() => {
        const controller = new AbortController()
        void checkAccess(controller.signal)
        return () => controller.abort()
    }, [checkAccess])
    if (state === 'member') return <CodeReview canReview={canEdit} toolbar={toolbar} onLocked={() => { setState('checking'); void checkAccess() }} />
    if (state === 'checking') return <p className='code-access' role='status'>Checking Hanasand organization membership…</p>
    if (state === 'signed-out') return <p className='code-access'>Sign in with a Hanasand account that belongs to the Hanasand organization to view source code. <a href='/login' className='underline'>Sign in</a>.</p>
    if (state === 'not-member') return <p className='code-access'>Membership in the Hanasand organization is required to view source code.</p>
    return <div className='code-access'><p role='alert'>Organization membership could not be checked.</p><button type='button' onClick={() => { setState('checking'); void checkAccess() }}>Retry</button></div>
}
