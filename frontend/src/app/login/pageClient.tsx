'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import login, { PendingDeletionError } from '@/utils/login/login'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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

const authInputClass = 'h-10 rounded-lg border border-[#d8dee9] bg-white px-3.5 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
const authPrimaryButtonClass = 'group inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:border disabled:border-[#d8dee9] disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
const authGhostButtonClass = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-[#596170] transition hover:bg-[#f8fafc] hover:text-[#171a21] disabled:cursor-not-allowed disabled:text-[#98a2b3]'

export default function LoginPage({ path, serverInternal, serverExpired }: LoginPageProps) {
    const router = useRouter()
    const [mode, setMode] = useState<'login' | 'signup' | 'request-reset' | 'verify-reset'>('login')
    const [resetUserId, setResetUserId] = useState('')
    const [resetCode, setResetCode] = useState('')
    const [busy, setBusy] = useState(false)
    const [hydrated, setHydrated] = useState(false)
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

        setBusy(true)
        try {
            const data = await login(id, password)
            if (data) {
                completeAuth()
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
        } finally {
            setBusy(false)
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
            const response = await fetchWithRetry('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, id, password }),
                timeoutMs: 10000,
                retries: 2,
            })
            const responseText = await response.text()
            const data = parseSignupResponse(responseText)
            if (!response.ok || data.error) {
                return setError(data.error || 'Unable to create account.')
            }
            if (!data.id || !data.name) {
                return setError('Account created, but login could not be completed.')
            }

            completeAuth()
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

    async function verifyResetCode(code: string) {
        if (busy) {
            return
        }

        setBusy(true)
        setError(null)
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

    async function handleResetVerify(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (resetCode.length === 6) {
            await verifyResetCode(resetCode)
        }
    }

    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const { condition: expired } = useClearStateAfter({ initialState: serverExpired, timeout: 8000 })
    const redirectPath = safeRedirectPath(path)

    function completeAuth() {
        void waitForAuthCookies().finally(() => window.location.assign(redirectPath))
    }

    function changeMode(nextMode: typeof mode) {
        setError(null)
        if (nextMode !== 'verify-reset') {
            setResetCode('')
        }
        setMode(nextMode)
    }

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id && !serverInternal && !serverExpired) {
            router.push(redirectPath)
        }
        setHydrated(true)
    }, [redirectPath, router, serverExpired, serverInternal])

    return (
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-[#f7f8fb] px-4 py-10 text-[#171a21] md:px-10'>
            <div className='grid w-full max-w-[392px] gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='text-[42px] font-semibold leading-none tracking-normal text-[#171a21]'>Hanasand</h1>
                    <p className='text-sm leading-6 text-[#596170]'>Sign in to the console.</p>
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                    {(expired && path) && <ErrorNotice variant='info' message={`Token expired. You will be redirected back to ${path} after reauthenticating.`} />}
                    {(internal && path) && <ErrorNotice variant='info' message={`Sign in to continue to ${path}.`} />}

                    <Notify message={error as string | null} />
                    {mode === 'login' && (
                        <div className='grid gap-3'>
                            <form
                                className='flex w-full flex-col gap-2 self-center'
                                onSubmit={handleSubmit}
                                method='post'
                            >
                                <label className='grid gap-1.5'>
                                    <span className='text-xs font-semibold text-[#596170]'>Username</span>
                                    <input
                                        type='text'
                                        name='username'
                                        placeholder='buyer-team'
                                        className={authInputClass}
                                        autoComplete='username'
                                        required
                                    />
                                </label>
                                <label className='grid gap-1.5'>
                                    <span className='text-xs font-semibold text-[#596170]'>Password</span>
                                    <input
                                        type='password'
                                        name='password'
                                        placeholder='Enter your password'
                                        className={authInputClass}
                                        autoComplete='current-password'
                                        required
                                    />
                                </label>
                                <div className='mt-1 flex items-center gap-3'>
                                    <button
                                        type='submit'
                                        disabled={!hydrated || busy}
                                        className={`${authPrimaryButtonClass} min-w-24`}
                                    >
                                        {busy ? 'Logging in' : 'Log in'}
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                    </button>
                                    <button
                                        type='button'
                                        disabled={!hydrated}
                                        onClick={() => changeMode('signup')}
                                        className={authGhostButtonClass}
                                    >
                                        Sign up
                                    </button>
                                    <button
                                        type='button'
                                        disabled={!hydrated}
                                        onClick={() => changeMode('request-reset')}
                                        className='ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-[#667085] transition hover:bg-[#f8fafc] hover:text-[#171a21] disabled:cursor-not-allowed disabled:text-[#98a2b3]'
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
                            method='post'
                        >
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-semibold text-[#596170]'>Username</span>
                                <input
                                    type='text'
                                    name='username'
                                    value={signupUsername}
                                    onChange={(e) => setSignupUsername(e.target.value)}
                                    placeholder='buyer-team'
                                    className={authInputClass}
                                    autoComplete='username'
                                    required
                                />
                            </label>
                            {reservedUsername && <p className='px-1 text-xs font-semibold text-[#8a5a00]'>Reserved username.</p>}
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-semibold text-[#596170]'>Name</span>
                                <input
                                    type='text'
                                    name='name'
                                    value={signupName}
                                    onChange={(e) => setSignupName(e.target.value)}
                                    placeholder='QA Buyer'
                                    className={authInputClass}
                                    autoComplete='name'
                                    required
                                />
                            </label>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-semibold text-[#596170]'>Password</span>
                                <input
                                    type='password'
                                    name='password'
                                    value={signupPassword}
                                    onChange={(e) => setSignupPassword(e.target.value)}
                                    placeholder='Create a strong password'
                                    className={authInputClass}
                                    autoComplete='new-password'
                                    required
                                />
                            </label>
                            {signupPassword && !signupPasswordIsValid && (
                                <p className='px-1 text-xs leading-5 text-[#667085]'>
                                    16 chars, 2 lowercase, 2 uppercase, 2 numbers, 2 symbols.
                                </p>
                            )}
                            <div className='mt-1 flex items-center gap-3'>
                                <button
                                    type='submit'
                                    disabled={!hydrated || busy || !canCreateAccount}
                                    className={`${authPrimaryButtonClass} min-w-36`}
                                >
                                    {busy ? 'Creating' : 'Create account'}
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                </button>
                                <button
                                    type='button'
                                    onClick={() => changeMode('login')}
                                    className={authGhostButtonClass}
                                >
                                    Log in
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'request-reset' && (
                        <form className='flex w-full flex-col gap-2 self-center' onSubmit={handleResetRequest} method='post'>
                            <label className='grid gap-1.5'>
                                <span className='text-xs font-semibold text-[#596170]'>Username</span>
                                <input
                                    type='text'
                                    name='resetUserId'
                                    placeholder='buyer-team'
                                    className={authInputClass}
                                    autoComplete='username'
                                    required
                                />
                            </label>
                            <div className='mt-1 flex items-center gap-3'>
                                <button
                                    type='submit'
                                    disabled={busy}
                                    className={`${authPrimaryButtonClass} min-w-28`}
                                >
                                    {busy ? 'Sending' : 'Send code'}
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                                </button>
                                <button type='button' onClick={() => changeMode('login')} className={authGhostButtonClass}>
                                    Back
                                </button>
                            </div>
                        </form>
                    )}

                    {mode === 'verify-reset' && (
                        <form className='flex w-full flex-col gap-2 self-center' onSubmit={handleResetVerify} method='post'>
                            <ResetCodeInput
                                value={resetCode}
                                setValue={setResetCode}
                                disabled={busy}
                                onComplete={verifyResetCode}
                            />
                            <div className='mt-1 flex items-center gap-3'>
                                <button type='button' onClick={() => changeMode('request-reset')} className={authGhostButtonClass}>
                                    Again
                                </button>
                                <p className='ml-auto text-xs font-medium text-[#667085]'>
                                    {busy ? 'Verifying...' : 'Verifies automatically'}
                                </p>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </section>
    )
}

function ResetCodeInput({
    value,
    setValue,
    disabled,
    onComplete,
}: {
    value: string
    setValue: (value: string) => void
    disabled: boolean
    onComplete: (code: string) => void | Promise<void>
}) {
    const inputsRef = useRef<Array<HTMLInputElement | null>>([])
    const submittedCodeRef = useRef('')
    const code = value.padEnd(6, ' ').slice(0, 6).split('')

    useEffect(() => {
        if (value.length < 6) {
            submittedCodeRef.current = ''
            return
        }
        if (disabled || submittedCodeRef.current === value) {
            return
        }

        submittedCodeRef.current = value
        void onComplete(value)
    }, [disabled, onComplete, value])

    function updateCode(nextValue: string, focusIndex?: number) {
        const normalized = nextValue.replace(/\D/g, '').slice(0, 6)
        setValue(normalized)
        if (focusIndex !== undefined) {
            requestAnimationFrame(() => inputsRef.current[Math.min(focusIndex, 5)]?.focus())
        }
    }

    return (
        <div className='grid gap-2'>
            <div className='grid grid-cols-6 gap-1.5'>
                {code.map((digit, index) => (
                    <input
                        key={index}
                        ref={(element) => { inputsRef.current[index] = element }}
                        type='text'
                        inputMode='numeric'
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Reset code digit ${index + 1}`}
                        value={digit.trim()}
                        disabled={disabled}
                        onChange={(event) => {
                            const digits = event.target.value.replace(/\D/g, '')
                            if (digits.length > 1) {
                                updateCode(`${value.slice(0, index)}${digits}${value.slice(index + digits.length)}`, index + digits.length)
                                return
                            }
                            updateCode(`${value.slice(0, index)}${digits}${value.slice(index + 1)}`, digits ? index + 1 : index)
                        }}
                        onPaste={(event) => {
                            event.preventDefault()
                            updateCode(event.clipboardData.getData('text'), 5)
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Backspace' && !value[index] && index > 0) {
                                event.preventDefault()
                                updateCode(`${value.slice(0, index - 1)}${value.slice(index)}`, index - 1)
                            }
                            if (event.key === 'ArrowLeft' && index > 0) {
                                event.preventDefault()
                                inputsRef.current[index - 1]?.focus()
                            }
                            if (event.key === 'ArrowRight' && index < 5) {
                                event.preventDefault()
                                inputsRef.current[index + 1]?.focus()
                            }
                        }}
                        className='h-11 rounded-lg border border-[#d8dee9] bg-white text-center text-base font-semibold text-[#171a21] outline-none transition focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff] disabled:cursor-not-allowed disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
                    />
                ))}
            </div>
        </div>
    )
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

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
        return '/dashboard'
    }

    return path
}

async function waitForAuthCookies() {
    for (let attempt = 0; attempt < 20; attempt++) {
        if (getCookie('access_token') && getCookie('id')) {
            return
        }
        await new Promise(resolve => window.setTimeout(resolve, 50))
    }
}

function parseSignupResponse(responseText: string) {
    try {
        return JSON.parse(responseText)
    } catch {
        return { error: responseText || 'Unable to create account.' }
    }
}
