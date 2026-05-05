'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import login from '@/utils/login/login'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import config from '@/config'
import { ArrowRight } from 'lucide-react'

type LoginPageProps = {
    path: string | null
    serverInternal: boolean
    serverExpired: boolean
}

export default function LoginPage({ path, serverInternal, serverExpired }: LoginPageProps) {
    const router = useRouter()
    const [mode, setMode] = useState<'login' | 'request-reset' | 'verify-reset'>('login')
    const [resetUserId, setResetUserId] = useState('')
    const [busy, setBusy] = useState(false)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const id = formData.get('username') as string
        const password = formData.get('password') as string

        try {
            const data = await login(id, password)
            if (data) {
                setCookieWithExpiresAt('name', data.name, data.expires_at)
                setCookieWithExpiresAt('id', data.id, data.expires_at)
                setCookieWithExpiresAt('avatar', data.avatar ?? '', data.expires_at)
                setCookieWithExpiresAt('access_token', data.token, data.expires_at)
                setCookieWithExpiresAt('roles', JSON.stringify(data.roles ?? []), data.expires_at)
                router.push(path || '/dashboard')
                return
            }

            if (!data) {
                setError('Please try again later.')
            }
        } catch (error) {
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

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            router.push('/dashboard')
        }
    }, [router])

    return (
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-[392px] gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='font-serif text-[46px] font-semibold leading-none text-bright'>Hanasand</h1>
                    <div className='h-px w-11 bg-bright/20' />
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-white/10 bg-dark/70 p-3 shadow-[0_14px_42px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                    {(expired && path) && <p className='rounded-lg border border-blue-400/20 bg-blue-500/10 p-3 text-sm text-blue-100'>Token expired. You will be redirected back to {path} after reauthenticating.</p>}
                    {(internal && path) && <p className='rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100'>{path} is internal. Please log in.</p>}

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
                                    className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
                                    required
                                />
                                <input
                                    type='password'
                                    name='password'
                                    placeholder='Password'
                                    className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
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
                                    <Link
                                        href='/register'
                                        className='inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'
                                    >
                                        Sign up
                                    </Link>
                                    <button
                                        type='button'
                                        onClick={() => setMode('request-reset')}
                                        className='ml-auto h-9 rounded-lg px-2 text-sm font-semibold text-bright/42 transition hover:bg-white/6 hover:text-bright/72'
                                    >
                                        Forgot?
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {mode === 'request-reset' && (
                        <form className='flex w-full flex-col gap-2 self-center' onSubmit={handleResetRequest}>
                            <input
                                type='text'
                                name='resetUserId'
                                placeholder='Username'
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
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
                                <button type='button' onClick={() => setMode('login')} className='h-9 rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'>
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
                                className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-center text-sm font-semibold text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
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
                                <button type='button' onClick={() => setMode('request-reset')} className='h-9 rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'>
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
