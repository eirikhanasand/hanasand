'use client'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const authPrimaryButtonClass = 'group flex h-10 w-full items-center justify-between rounded-lg bg-ui-text px-3.5 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authSecondaryLinkClass = 'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:border-ui-primary hover:text-ui-text'

export default function SecureAccountPage() {
    const [token, setToken] = useState('')
    const [tokenLoaded, setTokenLoaded] = useState(false)
    const [busy, setBusy] = useState(false)
    const [locked, setLocked] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        setToken(params.get('token') || '')
        window.history.replaceState(null, '', window.location.pathname)
        setTokenLoaded(true)
    }, [])

    async function lockAccount() {
        if (!token || busy || locked) return
        setBusy(true)
        setError(null)
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/lock-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) return setError(data?.error || 'Unable to lock your account.')
            setLocked(true)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to lock your account.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className='grid min-h-app-viewport w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-98 gap-4'>
                <div className='grid justify-items-center gap-2 pb-2 text-center'>
                    <h1 className='text-[40px] font-semibold leading-none tracking-normal text-ui-text'>Hanasand</h1>
                    <p className='text-sm font-medium text-ui-muted'>Secure your account.</p>
                </div>
                <div className='grid w-full gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-md md:p-5'>
                    <div className='grid gap-1 px-1'>
                        <div className='flex items-center justify-center gap-2 text-ui-text'>
                            <ShieldAlert className='h-4 w-4 text-ui-primary' />
                            <h2 className='text-base font-medium tracking-normal'>{locked ? 'Your account is locked' : 'Wasn’t you? Lock your account.'}</h2>
                        </div>
                        <p className='text-center text-xs leading-5 text-ui-muted'>
                            {locked
                                ? 'Your sessions have been signed out. Reset your password before signing in again.'
                                : 'This will sign out all devices and block sign-ins until you reset your password.'}
                        </p>
                    </div>
                    <ErrorNotice compact message={error as string | null} />
                    {!tokenLoaded ? (
                        <p className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-center text-xs text-ui-muted'>Checking security link...</p>
                    ) : locked ? (
                        <Link href='/login' className={authPrimaryButtonClass}>
                            Go to login
                            <ArrowRight className='h-4 w-4' />
                        </Link>
                    ) : token ? (
                        <button type='button' onClick={lockAccount} disabled={busy} className={authPrimaryButtonClass}>
                            {busy ? 'Locking account...' : 'Lock account'}
                            <ArrowRight className='h-4 w-4' />
                        </button>
                    ) : (
                        <ErrorNotice compact variant='info' message='This security link is missing or expired. Use the reset link in your email or start a reset from login.' />
                    )}
                    {!locked ? (
                        <Link href='/login' className={authSecondaryLinkClass}>
                            <ArrowLeft className='h-4 w-4' />
                            Back to login
                        </Link>
                    ) : null}
                </div>
            </div>
        </section>
    )
}
