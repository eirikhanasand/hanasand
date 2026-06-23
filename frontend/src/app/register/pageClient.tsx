'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
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

type SignupResponse = {
    error?: string
    name?: string
    id?: string
    avatar?: string | null
    token?: string
    expires_at?: string | null
    roles?: unknown[]
}

const authInputClass = 'h-10 rounded-lg border border-[#d8dee9] bg-white px-3.5 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
const authPrimaryButtonClass = 'group inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:border disabled:border-[#d8dee9] disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
const authGhostButtonClass = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-[#596170] transition hover:bg-[#f8fafc] hover:text-[#171a21]'

export default function RegisterPageClient({ path, serverInternal }: RegisterPageProps) {
    const router = useRouter()
    const [hydrated, setHydrated] = useState(false)
    const [busy, setBusy] = useState(false)
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const passwordCounts = countPassword(password)
    const passwordIsValid =
        password.length >= 16
        && passwordCounts.numbers >= 2
        && passwordCounts.symbols >= 2
        && passwordCounts.lowercase >= 2
        && passwordCounts.uppercase >= 2
    const reservedUsername = reservedUsernames.includes(username.trim().toLowerCase())
    const lengthColor = password.length > 0 ? password.length >= 16 ? 'text-green-500' : 'text-red-500' : ''
    const numberColor = password.length > 0 ? passwordCounts.numbers >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const lowerCaseColor = password.length > 0 ? passwordCounts.lowercase >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const upperCaseColor = password.length > 0 ? passwordCounts.uppercase >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const specialCharacterColor = password.length > 0 ? passwordCounts.symbols >= 2 ? 'text-green-500' : 'text-red-500' : ''
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const redirectPath = safeRedirectPath(path)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        const formData = new FormData(e.currentTarget)
        const name = String(formData.get('name') || '').trim()
        const id = String(formData.get('username') || '').trim()
        const password = String(formData.get('password') || '')
        const submittedPasswordCounts = countPassword(password)
        const submittedPasswordIsValid =
            password.length >= 16
            && submittedPasswordCounts.numbers >= 2
            && submittedPasswordCounts.symbols >= 2
            && submittedPasswordCounts.lowercase >= 2
            && submittedPasswordCounts.uppercase >= 2
        const submittedUsernameIsReserved = reservedUsernames.includes(id.toLowerCase())

        if (!submittedPasswordIsValid) {
            return setError('Invalid password. Check the requirements.')
        }
        if (submittedUsernameIsReserved) {
            return setError('This username is reserved. Choose another username.')
        }

        setBusy(true)
        try {
            const response = await fetchWithRetry('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, id, password }),
                timeoutMs: 10000,
                retries: 2,
            })
            const responseText = await response.text()
            const data = parseSignupResponse(responseText)

            if (!response.ok || data.error) {
                return setError(data.error || 'Unable to create account.')
            }

            if (data.name && data.id) {
                completeAuth()
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
        } finally {
            setBusy(false)
        }
    }

    function completeAuth() {
        window.location.assign(redirectPath)
    }

    useEffect(() => {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (token && id && !serverInternal) {
            router.push(redirectPath)
        }

        setHydrated(true)
    }, [redirectPath, router, serverInternal])

    return (
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-[#f7f8fb] px-4 py-10 text-[#171a21] md:px-10'>
            <div className='grid w-full max-w-[392px] gap-4'>
                <div className='grid justify-items-center gap-2 pb-2 text-center'>
                    <h1 className='text-[40px] font-semibold leading-none tracking-normal text-[#171a21]'>Hanasand</h1>
                    <p className='text-sm font-medium text-[#667085]'>Create your console account.</p>
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-[#e4e7ec] bg-white p-4 shadow-[0_18px_55px_rgba(16,24,40,0.08)] md:p-5'>
                    {(internal && path) && <ErrorNotice variant='info' message={`Create an account to continue to ${path}.`} />}

                    <Notify message={error} />
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
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder='buyer-team'
                                className={authInputClass}
                                autoComplete='username'
                                required
                            />
                        </label>
                        {reservedUsername && <div className='rounded-lg border border-[#ffd27a] bg-[#fff8e6] p-3 text-sm leading-6 text-[#8a5a00]'>
                            This username is reserved.
                            <Link href='/reserved-usernames' className='ml-1 font-semibold underline underline-offset-4'>View reserved names.</Link>
                        </div>}
                        <label className='grid gap-1.5'>
                            <span className='text-xs font-semibold text-[#596170]'>Name</span>
                            <input
                                type='text'
                                name='name'
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
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder='Create a strong password'
                                className={authInputClass}
                                autoComplete='new-password'
                                required
                            />
                        </label>
                        {!passwordIsValid && <div className='rounded-lg border border-[#e4e7ec] bg-[#f8fafc] p-3 text-xs leading-5 text-[#667085]'>
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
                                disabled={!hydrated || busy || reservedUsername}
                                className={authPrimaryButtonClass}
                            >
                                {busy ? 'Creating' : hydrated ? 'Create account' : 'Preparing'}
                                <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                            </button>
                            <Link
                                href={path ? `/login?path=${encodeURIComponent(redirectPath)}` : '/login'}
                                role='button'
                                className={authGhostButtonClass}
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

function countPassword(value: string) {
    let numbers = 0
    let symbols = 0
    let lowercase = 0
    let uppercase = 0

    for (const char of value) {
        if (/\d/.test(char)) {
            numbers++
        } else if (/[a-z]/.test(char)) {
            lowercase++
        } else if (/[A-Z]/.test(char)) {
            uppercase++
        } else {
            symbols++
        }
    }

    return { numbers, symbols, lowercase, uppercase }
}

function parseSignupResponse(responseText: string): SignupResponse {
    try {
        return JSON.parse(responseText) as SignupResponse
    } catch {
        return { error: responseText || 'Unable to create account.' }
    }
}

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
        return '/dashboard'
    }

    return path
}
