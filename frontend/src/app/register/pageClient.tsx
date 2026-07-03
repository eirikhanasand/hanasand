'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, Building2, Mail } from 'lucide-react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import ErrorNotice from '@/components/error/errorNotice'

type RegisterPageProps = {
    path: string | null
    serverInternal: boolean
}

const authInputClass = 'h-10 rounded-lg border border-ui-border bg-ui-panel px-3.5 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
const authPrimaryButtonClass = 'group inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authGhostButtonClass = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
const passwordRequirementMessage = 'Password must be at least 16 characters and include 2 lowercase letters, 2 uppercase letters, 2 numbers, and 2 symbols.'

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
    const lengthColor = password.length > 0 ? password.length >= 16 ? 'text-ui-success' : 'text-ui-danger' : ''
    const numberColor = password.length > 0 ? passwordCounts.numbers >= 2 ? 'text-ui-success' : 'text-ui-danger' : ''
    const lowerCaseColor = password.length > 0 ? passwordCounts.lowercase >= 2 ? 'text-ui-success' : 'text-ui-danger' : ''
    const upperCaseColor = password.length > 0 ? passwordCounts.uppercase >= 2 ? 'text-ui-success' : 'text-ui-danger' : ''
    const specialCharacterColor = password.length > 0 ? passwordCounts.symbols >= 2 ? 'text-ui-success' : 'text-ui-danger' : ''
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const redirectPath = safeRedirectPath(path)

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        const formData = new FormData(e.currentTarget)
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
            e.preventDefault()
            return setError(passwordRequirementMessage)
        }
        if (submittedUsernameIsReserved) {
            e.preventDefault()
            return setError('This username is reserved. Choose another username.')
        }

        setBusy(true)
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
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text md:px-10'>
            <div className='grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,0.65fr)] lg:items-start'>
                <div className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:p-6'>
                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-ui-primary'>Enterprise onboarding</p>
                    <h1 className='text-4xl font-semibold leading-tight tracking-normal text-ui-text'>Create a console account or start a managed setup.</h1>
                    <p className='text-sm leading-6 text-ui-muted'>
                        Self-serve accounts are useful for evaluating search, reports, and dashboard workflows. Larger teams should start with a managed setup for SSO, tenant policy, webhook signing, retention, and procurement.
                    </p>
                    <div className='grid gap-3'>
                        <OnboardingItem title='Self-serve console' detail='Create an account now and continue to the dashboard.' />
                        <OnboardingItem title='Managed pilot' detail='Share company, watchlist, delivery, SSO, and compliance needs before rollout.' />
                        <OnboardingItem title='Procurement ready path' detail='Use contact sales for DPA, security review, invoice terms, or vendor onboarding.' />
                    </div>
                    <Link href='/contact?intent=sales' className='inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'>
                        Start managed setup
                        <ArrowRight className='h-4 w-4' />
                    </Link>
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-lg md:p-5'>
                    <div className='grid gap-1'>
                        <h2 className='text-xl font-semibold text-ui-text'>Create console account</h2>
                        <p className='text-sm leading-6 text-ui-muted'>Use a work identity when possible so support can connect the account to an organization later.</p>
                    </div>
                    {(internal && path) && <ErrorNotice variant='info' message={`Create an account to continue to ${path}.`} />}

                    <Notify message={error} />
                    <form
                        className='flex w-full flex-col gap-2 self-center'
                        action='/api/auth/register'
                        onSubmit={handleSubmit}
                        method='post'
                    >
                        <input type='hidden' name='redirectPath' value={redirectPath} />
                        <label className='grid gap-1.5' htmlFor='register-username'>
                            <span className='text-xs font-semibold text-ui-muted'>Username</span>
                            <input
                                id='register-username'
                                type='text'
                                name='username'
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder='security-admin'
                                className={authInputClass}
                                autoComplete='username'
                                required
                            />
                        </label>
                        {reservedUsername && <div className='rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-3 text-sm leading-6 text-ui-warning'>
                            This username is reserved.
                            <Link href='/reserved-usernames' className='ml-1 font-semibold underline underline-offset-4'>View reserved names.</Link>
                        </div>}
                        <label className='grid gap-1.5' htmlFor='register-name'>
                            <span className='text-xs font-semibold text-ui-muted'>Name</span>
                            <input
                                id='register-name'
                                type='text'
                                name='name'
                                placeholder='Avery Chen'
                                className={authInputClass}
                                autoComplete='name'
                                required
                            />
                        </label>
                        <label className='grid gap-1.5' htmlFor='register-email'>
                            <span className='flex items-center gap-1.5 text-xs font-semibold text-ui-muted'><Mail className='h-3.5 w-3.5' /> Work email <span className='font-normal text-ui-muted/70'>(optional)</span></span>
                            <input
                                id='register-email'
                                type='email'
                                name='businessEmail'
                                placeholder='avery@company.com'
                                className={authInputClass}
                                autoComplete='email'
                            />
                        </label>
                        <label className='grid gap-1.5' htmlFor='register-company'>
                            <span className='flex items-center gap-1.5 text-xs font-semibold text-ui-muted'><Building2 className='h-3.5 w-3.5' /> Company <span className='font-normal text-ui-muted/70'>(optional)</span></span>
                            <input
                                id='register-company'
                                type='text'
                                name='company'
                                placeholder='Acme Security'
                                className={authInputClass}
                                autoComplete='organization'
                            />
                        </label>
                        <label className='grid gap-1.5' htmlFor='register-password'>
                            <span className='text-xs font-semibold text-ui-muted'>Password</span>
                            <input
                                id='register-password'
                                type='password'
                                name='password'
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder='Create a strong password'
                                className={authInputClass}
                                autoComplete='new-password'
                                required
                            />
                        </label>
                        {!passwordIsValid && <div className='rounded-lg border border-ui-border bg-ui-raised p-3 text-xs leading-5 text-ui-muted'>
                            <p>
                                Password requires
                                <span className={`ml-1 font-bold ${lengthColor}`}>at least 16 characters</span>,
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

function OnboardingItem({ title, detail }: { title: string, detail: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-raised p-3'>
            <p className='text-sm font-semibold text-ui-text'>{title}</p>
            <p className='mt-1 text-sm leading-6 text-ui-muted'>{detail}</p>
        </div>
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

function safeRedirectPath(path: string | null) {
    if (!path || !path.startsWith('/') || path.startsWith('//')) {
        return '/dashboard'
    }

    return path
}
