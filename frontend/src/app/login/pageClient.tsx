'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import config from '@/config'
import { ArrowRight, Fingerprint, KeyRound } from 'lucide-react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import ErrorNotice from '@/components/error/errorNotice'
import { decodePasskeyRequestOptions, passkeyCredentialToJSON } from '@/utils/auth/passkeys'

type LoginPageProps = {
    path: string | null
    serverInternal: boolean
    serverExpired: boolean
}

const authInputClass = 'h-10 rounded-lg border border-ui-border bg-ui-panel px-3.5 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
const authPrimaryButtonClass = 'group inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authGhostButtonClass = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:cursor-not-allowed disabled:text-ui-muted/60'
const passwordRequirementMessage = 'Password must be at least 16 characters and include 2 lowercase letters, 2 uppercase letters, 2 numbers, and 2 symbols.'

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

    function handleSubmit() {
        setBusy(true)
    }

    function handleSignup(e: React.SyntheticEvent<HTMLFormElement>) {
        setError(null)
        if (!signupPasswordIsValid) {
            e.preventDefault()
            return setError(passwordRequirementMessage)
        }
        if (reservedUsername) {
            e.preventDefault()
            return setError('This username is reserved.')
        }

        setBusy(true)
    }

    async function handleResetRequest(e: React.SyntheticEvent<HTMLFormElement>) {
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

    async function handleResetVerify(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        if (resetCode.length === 6) {
            await verifyResetCode(resetCode)
        }
    }

    async function handlePasskeyLogin() {
        if (!window.PublicKeyCredential || !navigator.credentials) {
            return setError('This browser does not support passkeys.')
        }

        setBusy(true)
        setError(null)
        try {
            const optionsResponse = await fetch('/api/auth/passkeys/authenticate/options', { cache: 'no-store' })
            const options = await optionsResponse.json().catch(() => null)
            if (!optionsResponse.ok || !options?.challengeId || !options?.publicKey) {
                return setError(options?.error || 'No passkey challenge is available.')
            }

            const credential = await navigator.credentials.get({
                publicKey: decodePasskeyRequestOptions(options.publicKey),
            }) as PublicKeyCredential | null
            if (!credential) {
                return setError('No passkey was selected.')
            }

            const verifyResponse = await fetch('/api/auth/passkeys/authenticate/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: options.challengeId,
                    credential: passkeyCredentialToJSON(credential),
                }),
            })
            const data = await verifyResponse.json().catch(() => null)
            if (!verifyResponse.ok) {
                return setError(data?.error || 'Passkey login failed.')
            }

            router.push(redirectPath)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Passkey login failed.')
        } finally {
            setBusy(false)
        }
    }

    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const { condition: expired } = useClearStateAfter({ initialState: serverExpired, timeout: 8000 })
    const redirectPath = safeRedirectPath(path)
    const ssoHref = `/api/auth/sso/start?redirectPath=${encodeURIComponent(redirectPath)}`

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
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-98 gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='text-[42px] font-semibold leading-none tracking-normal text-ui-primary'>Hanasand</h1>
                    <p className='text-sm leading-6 text-ui-muted'>Sign in to the console.</p>
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-lg'>
                    {(expired && path) && <ErrorNotice variant='info' message={`Token expired. You will be redirected back to ${path} after reauthenticating.`} />}
                    {(internal && path) && <ErrorNotice variant='info' message={`Sign in to continue to ${path}.`} />}

                    <Notify message={error as string | null} />
                    {mode === 'login' && (
                        <div className='grid gap-3'>
                            <form
                                className='flex w-full flex-col gap-2 self-center'
                                action='/api/auth/login'
                                onSubmit={handleSubmit}
                                method='post'
                            >
                                <input type='hidden' name='redirectPath' value={redirectPath} />
                                <label className='grid gap-1.5' htmlFor='login-username'>
                                    <span className='text-xs font-semibold text-ui-muted'>Username</span>
                                    <input
                                        id='login-username'
                                        type='text'
                                        name='username'
                                        placeholder='Username'
                                        className={authInputClass}
                                        autoComplete='username'
                                        required
                                    />
                                </label>
                                <label className='grid gap-1.5' htmlFor='login-password'>
                                    <span className='text-xs font-semibold text-ui-muted'>Password</span>
                                    <input
                                        id='login-password'
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
                                        className='ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text disabled:cursor-not-allowed disabled:text-ui-muted/60'
                                    >
                                        Reset password
                                    </button>
                                </div>
                            </form>
                            <div className='grid gap-2 border-t border-ui-border pt-3'>
                                <button
                                    type='button'
                                    onClick={handlePasskeyLogin}
                                    disabled={!hydrated || busy}
                                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel focus:outline-none focus:ring-4 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:text-ui-muted'
                                >
                                    <Fingerprint className='h-4 w-4 text-ui-primary' />
                                    Sign in with passkey
                                </button>
                                <a
                                    href={ssoHref}
                                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-panel focus:outline-none focus:ring-4 focus:ring-ui-primary/20'
                                >
                                    <KeyRound className='h-4 w-4 text-ui-primary' />
                                    Continue with SSO
                                </a>
                            </div>
                        </div>
                    )}

                    {mode === 'signup' && (
                        <form
                            className='flex w-full flex-col gap-2 self-center'
                            action='/api/auth/register'
                            onSubmit={handleSignup}
                            method='post'
                        >
                            <input type='hidden' name='redirectPath' value={redirectPath} />
                            <label className='grid gap-1.5' htmlFor='login-signup-username'>
                                <span className='text-xs font-semibold text-ui-muted'>Username</span>
                                <input
                                    id='login-signup-username'
                                    type='text'
                                    name='username'
                                    value={signupUsername}
                                    onChange={(e) => setSignupUsername(e.target.value)}
                                    placeholder='Username'
                                    className={authInputClass}
                                    autoComplete='username'
                                    required
                                />
                            </label>
                            {reservedUsername && <p className='px-1 text-xs font-semibold text-ui-warning'>Reserved username.</p>}
                            <label className='grid gap-1.5' htmlFor='login-signup-name'>
                                <span className='text-xs font-semibold text-ui-muted'>Name</span>
                                <input
                                    id='login-signup-name'
                                    type='text'
                                    name='name'
                                    value={signupName}
                                    onChange={(e) => setSignupName(e.target.value)}
                                    placeholder='Full name'
                                    className={authInputClass}
                                    autoComplete='name'
                                    required
                                />
                            </label>
                            <label className='grid gap-1.5' htmlFor='login-signup-password'>
                                <span className='text-xs font-semibold text-ui-muted'>Password</span>
                                <input
                                    id='login-signup-password'
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
                                <p className='px-1 text-xs leading-5 text-ui-muted'>
                                    At least 16 characters, 2 lowercase, 2 uppercase, 2 numbers, 2 symbols.
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
                            <label className='grid gap-1.5' htmlFor='login-reset-username'>
                                <span className='text-xs font-semibold text-ui-muted'>Username</span>
                                <input
                                    id='login-reset-username'
                                    type='text'
                                    name='resetUserId'
                                    placeholder='Username'
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
                                    Send again
                                </button>
                                <p className='ml-auto text-xs font-medium text-ui-muted'>
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
                        className='h-11 rounded-lg border border-ui-border bg-ui-panel text-center text-base font-semibold text-ui-text outline-none transition focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20 disabled:cursor-not-allowed disabled:bg-ui-raised disabled:text-ui-muted'
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
