'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import login, { PendingDeletionError } from '@/utils/login/login'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import config from '@/config'
import { ArrowRight } from 'lucide-react'
import fetchWithRetry from '@/utils/fetchWithRetry'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import ErrorNotice from '@/components/error/errorNotice'

type LoginPageProps = {
    path: string | null
    serverInternal: boolean
    serverExpired: boolean
}

export default function LoginPage({ path, serverInternal, serverExpired }: LoginPageProps) {
    const router = useRouter()
    const [mode, setMode] = useState<'login' | 'signup' | 'request-reset' | 'verify-reset'>('login')
    const [resetUserId, setResetUserId] = useState('')
    const [busy, setBusy] = useState(false)
    const [signupName, setSignupName] = useState('')
    const [signupUsername, setSignupUsername] = useState('')
    const [signupPassword, setSignupPassword] = useState('')
    const passwordCounts = countPassword(signupPassword)
    const signupPasswordIsValid =
        signupPassword.length >= 16
        && passwordCounts.numbers >= 2
        && passwordCounts.symbols >= 2
        && passwordCounts.lowercase >= 2
        && passwordCounts.uppercase >= 2
    const reservedUsername = reservedUsernames.includes(signupUsername.trim().toLowerCase())
    const canCreateAccount = signupName.trim() && signupUsername.trim() && signupPasswordIsValid && !reservedUsername

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const id = formData.get('username') as string
        const password = formData.get('password') as string

        try {
            const data = await login(id, password)
            if (data) {
                completeAuth(data)
                return
            }

            if (!data) {
                setError('Please try again later.')
            }
        } catch (error) {
            if (error instanceof PendingDeletionError) {
                const params = new URLSearchParams({
                    id: error.id,
                    restoreToken: error.restoreToken,
                    deletionScheduledAt: error.deletionScheduledAt,
                })
                router.push(`/account-pending-deletion?${params.toString()}`)
                return
            }
            if ('message' in (error as { message: string })) {
                const message = (error as { message: string }).message
                try {
                    const msg = JSON.parse(message)
                    return setError(msg?.error || message)
                } catch {
                    setError(message
                        ? message.toLowerCase().includes('unauthorized')
                            ? 'Unauthorized.'
                            : message
                        : 'Unknown error! Please contact @eirikhanasand.')
                }
            }

            setError(error instanceof Error
                ? error.message.toLowerCase().includes('unauthorized')
                    ? 'Unauthorized.'
                    : error.message
                : 'Unknown error! Please contact @eirikhanasand.')
        }
    }

    async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        if (!signupPasswordIsValid) {
            return setError('Choose a stronger password.')
        }
        if (reservedUsername) {
            return setError('This username is reserved.')
        }

        const formData = new FormData(e.currentTarget)
        const name = String(formData.get('name') || '').trim()
        const id = String(formData.get('username') || '').trim()
        const password = String(formData.get('password') || '')
        setBusy(true)
        try {
            const response = await fetchWithRetry(`${config.url.api}/user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, id, password }),
                timeoutMs: config.abortTimeout,
                retries: 2,
            })
            const responseText = await response.text()
            const data = parseSignupResponse(responseText)
            if (!response.ok || data.error) {
                return setError(data.error || 'Unable to create account.')
            }
            if (!data.token) {
                return setError('Account created, but login could not be completed.')
            }

            completeAuth(data)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to create account.')
        } finally {
            setBusy(false)
        }
    }

    async function handleResetRequest(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setBusy(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        const id = String(formData.get('resetUserId') || '').trim()
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                return setError(data?.error || 'Unable to send reset code.')
            }

            setResetUserId(id)
            setMode('verify-reset')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to send reset code.')
        } finally {
            setBusy(false)
        }
    }

    async function handleResetVerify(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setBusy(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        const code = String(formData.get('code') || '').trim()
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: resetUserId, code }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                return setError(data?.error || 'Invalid reset code.')
            }

            router.push(`/reset-password?id=${encodeURIComponent(resetUserId)}#token=${encodeURIComponent(data.resetToken)}`)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Invalid reset code.')
        } finally {
            setBusy(false)
        }
    }

    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const { condition: expired } = useClearStateAfter({ initialState: serverExpired, timeout: 8000 })

    function completeAuth(data: { name: string, id: string, avatar?: string | null, token: string, expires_at?: string | null, roles?: unknown[] }) {
        setCookieWithExpiresAt('name', data.name, data.expires_at)
        setCookieWithExpiresAt('id', data.id, data.expires_at)
        setCookieWithExpiresAt('avatar', data.avatar ?? '', data.expires_at)
        setCookieWithExpiresAt('access_token', data.token, data.expires_at)
        setCookieWithExpiresAt('roles', JSON.stringify(data.roles ?? []), data.expires_at)
        window.location.assign(appRoute(path || '/dashboard'))
    }

    function changeMode(nextMode: typeof mode) {
        setError(null)
        setMode(nextMode)
    }

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            window.location.assign(appRoute('/dashboard'))
        }
    }, [])

    return (
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-[392px] gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='font-serif text-[46px] font-semibold leading-none text-bright'>Hanasand</h1>
                    <div className='h-px w-11 bg-bright/20' />
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-white/10 bg-dark/70 p-3 shadow-[0_14px_42px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                    {(expired && path) && <ErrorNotice variant='info' message={`Token expired. You will be redirected back to ${path} after reauthenticating.`} />}
                    {(internal && path) && <ErrorNotice message={`${path} is internal. Please log in.`} />}

                    <Notify message={error as string | null} />
                    {mode === 'login' && (
                        <div className='grid gap-3'>
                            <form
                                className='flex w-full flex-col gap-2 self-center'
                                onSubmit={handleSubmit}
                            >
                                <input
                                    type='text'
                                    name='username'
                                    placeholder='Username'
                                    className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                    required
                                />
                                <input
                                    type='password'
                                    name='password'
                                    placeholder='Password'
                                    className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                    required
                                />
                                <div className='mt-1 flex items-center gap-3'>
                                    <button
                                        type='submit'
                                        className='group inline-flex h-9 min-w-24 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-bold text-background transition hover:bg-white'
                                    >
                                        Log in
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => changeMode('signup')}
                                        className='inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'
                                    >
                                        Sign up
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => changeMode('request-reset')}
                                        className='ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-bright/42 transition hover:bg-white/6 hover:text-bright/72'
                                    >
                                        Forgot?
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {mode === 'signup' && (
                        <form
                            className='flex w-full flex-col gap-2 self-center'
                            onSubmit={handleSignup}
                        >
                            <input
                                type='text'
                                name='username'
                                value={signupUsername}
                                onChange={(e) => setSignupUsername(e.target.value)}
                                placeholder='Username'
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                required
                            />
                            {reservedUsername && <p className='px-1 text-xs font-semibold text-orange-100/70'>Reserved username.</p>}
                            <input
                                type='text'
                                name='name'
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                placeholder='Name'
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                required
                            />
                            <input
                                type='password'
                                name='password'
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                placeholder='Password'
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                required
                            />
                            {signupPassword && !signupPasswordIsValid && (
                                <p className='px-1 text-xs leading-5 text-bright/45'>
                                    16 chars, 2 lowercase, 2 uppercase, 2 numbers, 2 symbols.
                                </p>
                            )}
                            <div className='mt-1 flex items-center gap-3'>
                                <button
                                    type='submit'
                                    disabled={busy || !canCreateAccount}
                                    className='group inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-bold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/5 disabled:text-bright/35'
                                >
                                    {busy ? 'Creating' : 'Create account'}
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                </button>
                                <button
                                    type='button'
                                    onClick={() => changeMode('login')}
                                    className='inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'
                                >
                                    Log in
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'request-reset' && (
                        <form className='flex w-full flex-col gap-2 self-center' onSubmit={handleResetRequest}>
                            <input
                                type='text'
                                name='resetUserId'
                                placeholder='Username'
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                required
                            />
                            <div className='mt-1 flex items-center gap-3'>
                                <button
                                    type='submit'
                                    disabled={busy}
                                    className='group inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-bold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    {busy ? 'Sending' : 'Send code'}
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                </button>
                                <button type='button' onClick={() => changeMode('login')} className='h-9 rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'>
                                    Back
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'verify-reset' && (
                        <form className='flex w-full flex-col gap-2 self-center' onSubmit={handleResetVerify}>
                            <input
                                type='text'
                                name='code'
                                inputMode='numeric'
                                pattern='[0-9]{6}'
                                maxLength={6}
                                placeholder='6 digit code'
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-center text-sm font-semibold text-bright outline-none transition placeholder:text-bright/35 focus:border-[#f07d33]/55 focus:bg-white/[0.075]'
                                required
                            />
                            <div className='mt-1 flex items-center gap-3'>
                                <button
                                    type='submit'
                                    disabled={busy}
                                    className='group inline-flex h-9 min-w-28 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-bold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Continue
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                </button>
                                <button type='button' onClick={() => changeMode('request-reset')} className='h-9 rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'>
                                    Again
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    )
}

function appRoute(path: string) {
    if (typeof window === 'undefined' || window.location.hostname !== 'hanasand.com') {
        return path
    }

    return new URL(path, 'https://www.hanasand.com').toString()
}

function countPassword(password: string) {
    let numbers = 0
    let symbols = 0
    let lowercase = 0
    let uppercase = 0

    for (const char of password) {
        if (!isNaN(Number(char))) {
            numbers++
        }
        if (/[^a-zA-Z0-9]/.test(char)) {
            symbols++
        }
        if (/[a-z]/.test(char)) {
            lowercase++
        }
        if (/[A-Z]/.test(char)) {
            uppercase++
        }
    }

    return { numbers, symbols, lowercase, uppercase }
}

function parseSignupResponse(responseText: string) {
    try {
        return JSON.parse(responseText)
    } catch {
        return { error: responseText || 'Unable to create account.' }
    }
}
