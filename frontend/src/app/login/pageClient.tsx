'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import login from '@/utils/login/login'
import Or from '@/utils/or'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ArrowRight, KeyRound, ShieldCheck, Sparkles } from 'lucide-react'

type LoginPageProps = {
    path: string | null
    serverInternal: boolean
    serverExpired: boolean
}

export default function LoginPage({ path, serverInternal, serverExpired }: LoginPageProps) {
    const router = useRouter()

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
        <section className='min-h-[90.5vh] w-full px-4 py-10 md:px-10 lg:px-24 grid place-items-center'>
            <div className='grid w-full max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center'>
                <div className='hidden gap-5 lg:grid'>
                    <div className='glass-panel rounded-[2rem] p-8'>
                        <div className='icon-tile bg-orange-500/15 text-orange-300'>
                            <Sparkles className='h-5 w-5' />
                        </div>
                        <p className='mt-8 text-xs uppercase tracking-[0.35em] text-orange-200/80'>hanasand.com</p>
                        <h1 className='mt-4 max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.05em] text-bright'>
                            Fast access to the control plane.
                        </h1>
                        <p className='mt-5 max-w-lg text-sm leading-7 text-bright/55'>
                            Sessions now refresh cleanly in the background, so dashboard access stays stable while requests retry transient server stalls.
                        </p>
                    </div>
                    <div className='grid gap-3 sm:grid-cols-2'>
                        <AuthInfo icon={<ShieldCheck className='h-4 w-4' />} label='Session' value='Sliding 24h token' tone='emerald' />
                        <AuthInfo icon={<KeyRound className='h-4 w-4' />} label='Latency' value='Retry protected' tone='amber' />
                    </div>
                </div>

                <div className='glass-panel spawn grid w-full overflow-hidden rounded-[2rem] p-5 md:p-8'>
                    <div className='grid gap-6'>
                        <div>
                            <p className='text-xs uppercase tracking-[0.35em] text-bright/35'>Secure login</p>
                            <h1 className='mt-3 text-3xl font-semibold tracking-[-0.04em] text-bright md:text-4xl'>Welcome back</h1>
                            <p className='mt-2 text-sm text-bright/45'>Enter your credentials to continue to the dashboard.</p>
                        </div>

                        {(expired && path) && <h1 className='grid w-full rounded-xl border border-blue-400/20 bg-blue-500/12 p-3 text-sm text-blue-100'>Token expired. You will be redirected back to {path} after reauthenticating.</h1>}
                        {(internal && path) && <h1 className='grid w-full rounded-xl border border-red-400/20 bg-red-500/12 p-3 text-sm text-red-100'>{path} is internal. Please log in.</h1>}

                        <Notify message={error as string | null} />
                        <div className='grid gap-4'>
                            <form
                                className='w-full flex flex-col gap-3 self-center'
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
                                    className='group flex items-center justify-between rounded-2xl bg-bright px-4 py-3 text-sm font-semibold text-background transition hover:bg-orange-200'
                                >
                                    Login
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                                </button>
                            </form>
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
                </div>
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
