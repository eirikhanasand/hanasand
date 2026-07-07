'use client'
import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { ArrowLeft, ArrowRight, KeyRound } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type ResetPasswordPageProps = {
    userId: string
}

const authInputClass = 'h-10 rounded-lg border border-ui-border bg-ui-raised px-3.5 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/15'
const authPrimaryButtonClass = 'group flex h-10 w-full items-center justify-between rounded-lg bg-ui-text px-3.5 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authSecondaryLinkClass = 'flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-muted transition hover:border-ui-primary hover:text-ui-text'

export default function ResetPasswordPage({ userId }: ResetPasswordPageProps) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState(false)
    const [resetToken, setResetToken] = useState('')
    const [tokenLoaded, setTokenLoaded] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        setResetToken(params.get('token') || '')
        setTokenLoaded(true)
    }, [])

    async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        const password = String(formData.get('password') || '')
        const confirmPassword = String(formData.get('confirmPassword') || '')

        if (password !== confirmPassword) {
            return setError('Passwords do not match.')
        }

        setBusy(true)
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, resetToken, password }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                return setError(data?.error || 'Unable to reset password.')
            }

            setDone(true)
            setTimeout(() => router.push('/login'), 1200)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to reset password.')
        } finally {
            setBusy(false)
        }
    }

    const missingResetSession = tokenLoaded && (!userId || !resetToken)

    return (
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-98 gap-4'>
                <div className='grid justify-items-center gap-2 pb-2 text-center'>
                    <h1 className='text-[40px] font-semibold leading-none tracking-normal text-ui-text'>Hanasand</h1>
                    <p className='text-sm font-medium text-ui-muted'>Update your console password.</p>
                </div>

                <div className='grid w-full gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-md md:p-5'>
                    <div className='grid gap-1 px-1'>
                        <div className='flex items-center justify-center gap-2 text-ui-text'>
                            <KeyRound className='h-4 w-4 text-ui-primary' />
                            <h2 className='text-base font-medium tracking-normal'>New password</h2>
                        </div>
                        <p className='text-center text-xs leading-5 text-ui-muted'>Choose a new password for your Hanasand account.</p>
                    </div>

                    <ErrorNotice compact message={error as string | null} />
                    {done ? <ErrorNotice compact variant='success' message='Password updated. Redirecting to login.' /> : null}
                    {!tokenLoaded ? (
                        <p className='rounded-lg border border-ui-border bg-ui-raised px-3 py-2 text-center text-xs text-ui-muted'>Preparing reset session...</p>
                    ) : missingResetSession ? (
                        <div className='grid gap-3'>
                            <ErrorNotice compact variant='info' message='This reset link is missing or expired. Request a new code from the login page.' />
                            <Link href='/login' className={authSecondaryLinkClass}>
                                <ArrowLeft className='h-4 w-4' />
                                Back to login
                            </Link>
                        </div>
                    ) : (
                        <form className='flex w-full flex-col gap-3 self-center' onSubmit={handleSubmit}>
                            <input
                                type='password'
                                name='password'
                                placeholder='New password'
                                className={authInputClass}
                                required
                            />
                            <input
                                type='password'
                                name='confirmPassword'
                                placeholder='Confirm password'
                                className={authInputClass}
                                required
                            />
                            <button
                                type='submit'
                                disabled={busy || done}
                                className={authPrimaryButtonClass}
                            >
                                {busy ? 'Saving...' : 'Set password'}
                                <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    )
}
