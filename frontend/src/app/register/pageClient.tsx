'use client'
import Notify from '@/components/notify/notify'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie, setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import fetchWithRetry from '@/utils/fetchWithRetry'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import ErrorNotice from '@/components/error/errorNotice'

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
    const reservedUsername = reservedUsernames.includes(username.trim().toLowerCase())
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
        if (reservedUsername) {
            return setError('This username is reserved. Choose another username.')
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
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-[392px] gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='font-serif text-[46px] font-semibold leading-none text-bright'>Hanasand</h1>
                    <div className='h-px w-11 bg-bright/20' />
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-white/10 bg-dark/70 p-3 shadow-[0_14px_42px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                    {(internal && path) && <ErrorNotice message={`${path} is internal. Please log in.`} />}

                    <Notify message={error} />
                    <form
                        className='flex w-full flex-col gap-2 self-center'
                        onSubmit={handleSubmit}
                    >
                        <input
                            type='text'
                            name='username'
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder='Username'
                            className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
                            required
                        />
                        {reservedUsername && <div className='rounded-lg border border-orange-300/15 bg-orange-400/10 p-3 text-sm leading-6 text-orange-100/80'>
                            This username is reserved.
                            <Link href='/reserved-usernames' className='ml-1 font-semibold underline underline-offset-4'>View reserved names.</Link>
                        </div>}
                        <input
                            type='text'
                            name='name'
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder='Name'
                            className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
                            required
                        />
                        <input
                            type='password'
                            name='password'
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder='Password'
                            className='h-10 rounded-lg border border-white/10 bg-white/[0.055] px-3.5 text-sm font-medium text-bright outline-none transition placeholder:text-bright/35 focus:border-[#e25822]/55 focus:bg-white/[0.075]'
                            required
                        />
                        {!passwordIsValid && <div className='rounded-lg border border-white/10 bg-white/4 p-3 text-xs leading-5 text-bright/52'>
                            <p>
                                Password:
                                <span className={`ml-1 font-bold ${lengthColor}`}>16 chars</span>,
                                <span className={`ml-1 font-bold ${lowerCaseColor}`}>2 lowercase</span>,
                                <span className={`ml-1 font-bold ${upperCaseColor}`}>2 uppercase</span>,
                                <span className={`ml-1 font-bold ${numberColor}`}>2 numbers</span>,
                                <span className={`ml-1 font-bold ${specialCharacterColor}`}>2 symbols</span>.
                            </p>
                        </div>}
                        <div className='mt-1 flex items-center gap-3'>
                            <button
                                type='submit'
                                disabled={!passwordIsValid || reservedUsername}
                                className={`group inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition ${
                                    passwordIsValid && !reservedUsername
                                        ? 'cursor-pointer bg-bright text-background hover:bg-white'
                                        : 'cursor-not-allowed border border-white/10 bg-white/5 text-bright/35'
                                }`}
                            >
                                Create account
                                <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                            </button>
                            <Link
                                href='/login'
                                className='inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'
                            >
                                Log in
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    )
}
