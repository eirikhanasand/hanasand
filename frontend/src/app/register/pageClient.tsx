'use client'
import Notify from '@/components/notify/notify'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import fetchWithRetry from '@/utils/fetchWithRetry'
import Or from '@/utils/or'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Fingerprint, KeyRound, UserPlus } from 'lucide-react'

type RegisterPageProps = {
    path: string | null
    serverInternal: boolean
}

export default function RegisterPageClient({ path, serverInternal }: RegisterPageProps) {
    const router = useRouter()
    const [name, setName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [numbersInPasswordCount, setNumbersInPasswordCount] = useState(0)
    const [lowerCaseInPasswordCount, setLowercaseInPasswordCount] = useState(0)
    const [upperCaseInPasswordCount, setUppercaseInPasswordCount] = useState(0)
    const [specialCharactersInPasswordCount, setCharactersInPasswordCount] = useState(0)
    const passwordIsValid =
        password.length >= 16
        && numbersInPasswordCount >= 2
        && specialCharactersInPasswordCount >= 2
        && lowerCaseInPasswordCount >= 2
        && upperCaseInPasswordCount >= 2
    const lengthColor = password.length > 0 ? password.length >= 16 ? 'text-green-500' : 'text-red-500' : ''
    const numberColor = password.length > 0 ? numbersInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const lowerCaseColor = password.length > 0 ? lowerCaseInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const upperCaseColor = password.length > 0 ? upperCaseInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const specialCharacterColor = password.length > 0 ? specialCharactersInPasswordCount >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (!passwordIsValid) {
            return setError('Invalid password. Check the requirements.')
        }

        const formData = new FormData(e.currentTarget)
        const name = formData.get('name') as string
        const id = formData.get('username') as string
        const password = formData.get('password') as string
        try {
            const response = await fetchWithRetry(`${config.url.api}/user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, id, password }),
                timeoutMs: config.abortTimeout,
                retries: 2,
            })

            if (!response.ok) {
                throw new Error(await response.text())
            }

            const data = await response.json()
            if ('error' in data) {
                return setError(data.error)
            }

            if (data.token) {
                setCookieWithExpiresAt('name', data.name, data.expires_at)
                setCookieWithExpiresAt('id', data.id, data.expires_at)
                setCookieWithExpiresAt('avatar', data.avatar ?? '', data.expires_at)
                setCookieWithExpiresAt('access_token', data.token, data.expires_at)
                setCookieWithExpiresAt('roles', JSON.stringify(data.roles ?? []), data.expires_at)
                router.push(path || '/dashboard')
                return
            }

            setError(data.error || 'Account created, but login could not be completed.')
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

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id) {
            router.push('/dashboard')
            return
        }

        let numbers = 0
        let specialCharacters = 0
        let lowerCaseCharacters = 0
        let upperCaseCharacters = 0
        for (const char of password) {
            if (!isNaN(Number(char))) {
                numbers++
            }

            if (/[^a-zA-Z0-9]/.test(char)) {
                specialCharacters++
            }

            if (/[a-z]/.test(char)) {
                lowerCaseCharacters++
            }

            if (/[A-Z]/.test(char)) {
                upperCaseCharacters++
            }
        }

        setNumbersInPasswordCount(numbers)
        setCharactersInPasswordCount(specialCharacters)
        setLowercaseInPasswordCount(lowerCaseCharacters)
        setUppercaseInPasswordCount(upperCaseCharacters)
    }, [password, router])

    return (
        <section className='min-h-[90.5vh] w-full px-4 py-10 md:px-10 lg:px-24 grid place-items-center'>
            <div className='grid w-full max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center'>
                <div className='glass-panel spawn grid w-full overflow-hidden rounded-[2rem] p-5 md:p-8'>
                    <div className='grid gap-6'>
                        <div>
                            <div className='icon-tile bg-orange-500/15 text-orange-300'>
                                <UserPlus className='h-5 w-5' />
                            </div>
                            <p className='mt-5 text-xs uppercase tracking-[0.35em] text-bright/35'>Create access</p>
                            <h1 className='mt-3 text-3xl font-semibold tracking-[-0.04em] text-bright md:text-4xl'>Register account</h1>
                            <p className='mt-2 text-sm text-bright/45'>Strong credentials and a clean token are issued immediately after registration.</p>
                        </div>

                        {(internal && path) && <h1 className='grid w-full rounded-xl border border-red-400/20 bg-red-500/12 p-3 text-sm text-red-100'>
                            {path} is internal. Please log in.
                        </h1>}

                        <Notify message={error} />
                        <div className='grid gap-4'>
                            <form
                                className='w-full flex flex-col gap-3 self-center'
                                onSubmit={handleSubmit}
                            >
                                <input
                                    type='text'
                                    name='username'
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder='Username'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                <input
                                    type='text'
                                    name='name'
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder='Name'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                <input
                                    type='password'
                                    name='password'
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder='Password'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                {!passwordIsValid && <div className='rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-bright/55'>
                                    <h1>
                                        The password must be at
                                        least <span className={`font-bold ${lengthColor}`}>16
                                        </span> characters, contain at least <span className={`font-bold ${lowerCaseColor}`}>2
                                        </span> lowercase letters, <span className={`font-bold ${upperCaseColor}`}>2
                                        </span> uppercase letters, <span className={`font-bold ${numberColor}`}>2
                                        </span> numbers,
                                        and <span className={`font-bold ${specialCharacterColor}`}>2
                                        </span> special characters.
                                    </h1>
                                </div>}
                                <button
                                    type='submit'
                                    className={`group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                                        passwordIsValid
                                            ? 'cursor-pointer bg-bright text-background hover:bg-orange-200'
                                            : 'cursor-not-allowed border border-white/10 bg-white/5 text-bright/35'
                                    }`}
                                >
                                    Create account
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                                </button>
                            </form>
                            <Or className='z-10 text-bright/35' />
                        <Link href='/login' className='w-full flex flex-col gap-3 self-center'>
                            <button
                                type='submit'
                                className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-bright/80 transition hover:bg-white/10'
                            >
                                Login
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
                <div className='hidden gap-3 lg:grid'>
                    <RegisterInfo icon={<Fingerprint className='h-4 w-4' />} label='Identity' value='Bearer token only' tone='orange' />
                    <RegisterInfo icon={<KeyRound className='h-4 w-4' />} label='Password' value='16 chars, mixed entropy' tone='blue' />
                    <RegisterInfo icon={<CheckCircle2 className='h-4 w-4' />} label='Session' value='Roles attached immediately' tone='emerald' />
                </div>
            </div>
        </section>
    )
}

function RegisterInfo({ icon, label, value, tone }: { icon: React.ReactNode, label: string, value: string, tone: 'orange' | 'blue' | 'emerald' }) {
    const tones = {
        orange: 'bg-orange-500/12 text-orange-300',
        blue: 'bg-sky-500/12 text-sky-300',
        emerald: 'bg-emerald-500/12 text-emerald-300',
    }

    return (
        <div className='glass-card rounded-3xl p-5'>
            <div className={`icon-tile ${tones[tone]}`}>{icon}</div>
            <p className='mt-4 text-xs uppercase tracking-[0.22em] text-bright/35'>{label}</p>
            <p className='mt-2 text-lg font-semibold text-bright'>{value}</p>
        </div>
    )
}
