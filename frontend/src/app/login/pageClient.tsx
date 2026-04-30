'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import login from '@/utils/login/login'
import Or from '@/utils/or'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import config from '@/config'
import { ArrowRight, KeyRound, ShieldCheck, Sparkles } from 'lucide-react'

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
                try {
                    const message = (error as { message: string }).message
                    const msg = JSON.parse(message)
                    return setError(msg?.error)
                } catch (error) {
                    setError(error instanceof Error
                        ? error.message.toLowerCase().includes('unauthorized')
                            ? 'Unauthorized.'
                            : error.message
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
            <div className='grid w-full max-w-[420px] gap-5'>
                <div className='grid justify-items-center text-center'>
                    <div className='icon-tile bg-orange-500/15 text-orange-300'>
                        <Sparkles className='h-5 w-5' />
                    </div>
                    <p className='mt-5 text-xs uppercase tracking-[0.35em] text-orange-200/80'>hanasand.com</p>
                </div>

                <div className='glass-panel spawn grid w-full overflow-hidden rounded-4xl p-5 md:p-8'>
                    <div className='mx-auto grid w-full max-w-[340px] gap-6'>
                        <div className='text-center'>
                            <p className='text-xs uppercase tracking-[0.35em] text-bright/35'>Secure login</p>
                            <h1 className='mt-3 text-3xl font-semibold tracking-[-0.04em] text-bright md:text-4xl'>Welcome back</h1>
                            <p className='mt-2 text-sm text-bright/45'>Open your workspace.</p>
                        </div>

                        {(expired && path) && <h1 className='grid w-full rounded-xl border border-blue-400/20 bg-blue-500/12 p-3 text-sm text-blue-100'>Token expired. You will be redirected back to {path} after reauthenticating.</h1>}
                        {(internal && path) && <h1 className='grid w-full rounded-xl border border-red-400/20 bg-red-500/12 p-3 text-sm text-red-100'>{path} is internal. Please log in.</h1>}

                        <Notify message={error as string | null} />
                        {mode === 'login' && (
                            <div className='grid gap-4'>
                                <form
                                    className='flex w-full flex-col gap-3 self-center'
                                    onSubmit={handleSubmit}
                                >
                                    <input
                                        type='text'
                                        name='username'
                                        placeholder='Username'
                                        className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                        required
                                    />
                                    <input
                                        type='password'
                                        name='password'
                                        placeholder='Password'
                                        className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                        required
                                    />
                                    <button
                                        type='submit'
                                        className='group flex w-full items-center justify-between rounded-2xl bg-bright/86 px-4 py-3 text-sm font-semibold text-background/90 shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition hover:bg-bright/92'
                                    >
                                        Login
                                        <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                                    </button>
                                </form>
                                <button
                                    type='button'
                                    onClick={() => setMode('request-reset')}
                                    className='text-sm font-semibold text-orange-200/80 transition hover:text-orange-100'
                                >
                                    Reset password
                                </button>
                                <Or className='z-10 text-bright/35' />
                                <Link href='/register' className='w-full flex flex-col gap-3 self-center'>
                                    <button
                                        type='submit'
                                        className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-bright/80 transition hover:bg-white/10'
                                    >
                                        Create account
                                    </button>
                                </Link>
                            </div>
                        )}

                        {mode === 'request-reset' && (
                            <form className='flex w-full flex-col gap-3 self-center' onSubmit={handleResetRequest}>
                                <input
                                    type='text'
                                    name='resetUserId'
                                    placeholder='Username'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                <button
                                    type='submit'
                                    disabled={busy}
                                    className='group flex w-full items-center justify-between rounded-2xl bg-bright/86 px-4 py-3 text-sm font-semibold text-background/90 shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition hover:bg-bright/92 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Send code
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                                </button>
                                <button type='button' onClick={() => setMode('login')} className='text-sm font-semibold text-bright/50 transition hover:text-bright/80'>
                                    Back to login
                                </button>
                            </form>
                        )}

                        {mode === 'verify-reset' && (
                            <form className='flex w-full flex-col gap-3 self-center' onSubmit={handleResetVerify}>
                                <input
                                    type='text'
                                    name='code'
                                    inputMode='numeric'
                                    pattern='[0-9]{6}'
                                    maxLength={6}
                                    placeholder='6 digit code'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-center text-sm font-semibold tracking-[0.35em] text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                <button
                                    type='submit'
                                    disabled={busy}
                                    className='group flex w-full items-center justify-between rounded-2xl bg-bright/86 px-4 py-3 text-sm font-semibold text-background/90 shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition hover:bg-bright/92 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Continue
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                                </button>
                                <button type='button' onClick={() => setMode('request-reset')} className='text-sm font-semibold text-bright/50 transition hover:text-bright/80'>
                                    Send another code
                                </button>
                            </form>
                        )}
                    </div>
                </div>
                <div className='grid gap-3 sm:grid-cols-2'>
                    <AuthInfo icon={<ShieldCheck className='h-4 w-4' />} label='Protect' value='Check passwords fast' tone='emerald' />
                    <AuthInfo icon={<KeyRound className='h-4 w-4' />} label='Create' value='Code and test APIs' tone='amber' />
                </div>
            </div>
        </section>
    )
}

function AuthInfo({ icon, label, value, tone }: { icon: React.ReactNode, label: string, value: string, tone: 'emerald' | 'amber' }) {
    const toneClass = tone === 'emerald' ? 'bg-emerald-500/12 text-emerald-300' : 'bg-amber-500/12 text-amber-300'
    return (
        <div className='glass-card rounded-3xl p-5'>
            <div className={`icon-tile ${toneClass}`}>{icon}</div>
            <p className='mt-4 text-xs uppercase tracking-[0.22em] text-bright/35'>{label}</p>
            <p className='mt-2 text-lg font-semibold text-bright'>{value}</p>
        </div>
    )
}
