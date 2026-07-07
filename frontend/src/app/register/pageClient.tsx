'use client'
import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowRight, Building2, CheckCircle2, Mail, ShieldCheck } from 'lucide-react'
import { reservedUsernames } from '@/utils/auth/reservedUsernames'
import ErrorNotice from '@/components/error/errorNotice'

type RegisterPageProps = {
    path: string | null
    serverInternal: boolean
}

type ManagedSetupResult = {
    ticketId: string
    nextStep: string
}

const authInputClass = 'h-10 rounded-lg border border-ui-border bg-ui-panel px-3.5 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
const authPrimaryButtonClass = 'group inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
const authGhostButtonClass = 'inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-ui-muted transition hover:bg-ui-raised hover:text-ui-text'
const passwordRequirementMessage = 'Password must be at least 16 characters and include 2 lowercase letters, 2 uppercase letters, 2 numbers, and 2 symbols.'

export default function RegisterPageClient({ path, serverInternal }: RegisterPageProps) {
    const router = useRouter()
    const [hydrated, setHydrated] = useState(false)
    const [busy, setBusy] = useState(false)
    const [setupBusy, setSetupBusy] = useState(false)
    const [managedSetupResult, setManagedSetupResult] = useState<ManagedSetupResult | null>(null)
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
    const { condition: setupError, setCondition: setSetupError } = useClearStateAfter()
    const { condition: internal } = useClearStateAfter({ initialState: serverInternal })
    const redirectPath = safeRedirectPath(path)

    function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
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

    async function handleManagedSetup(e: React.SyntheticEvent<HTMLFormElement>) {
        e.preventDefault()
        setManagedSetupResult(null)
        setSetupError(null)

        const formData = new FormData(e.currentTarget)
        const name = String(formData.get('setupName') || '').trim()
        const email = String(formData.get('setupEmail') || '').trim()
        const company = String(formData.get('setupCompany') || '').trim()
        const context = String(formData.get('setupContext') || '').trim()

        if (!name || !email || !company || context.length < 20) {
            return setSetupError('Name, work email, company, and a short monitoring context are required.')
        }

        setSetupBusy(true)
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    company,
                    subject: 'Managed Hanasand onboarding request',
                    message: `Managed setup request\n\nCompany: ${company}\nMonitoring context: ${context}`,
                    intent: 'enterprise',
                    plan: 'managed-onboarding',
                    deliveryPreference: 'email',
                    replyWindow: 'this-week',
                    securityReview: true,
                }),
            })
            const payload = await response.json().catch(() => ({})) as { error?: string, ticketId?: string, nextStep?: string }
            if (!response.ok || payload.error) {
                throw new Error(payload.error || 'Managed setup intake is temporarily unavailable.')
            }

            setManagedSetupResult({
                ticketId: payload.ticketId || 'received',
                nextStep: payload.nextStep || 'We received the request. Expect a reply by email with coverage fit and setup steps.',
            })
            e.currentTarget.reset()
        } catch (err) {
            setSetupError(err instanceof Error ? err.message : 'Managed setup intake is temporarily unavailable.')
        } finally {
            setSetupBusy(false)
        }
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
                        <OnboardingItem title='Managed pilot' detail='Send company, watchlist, delivery, SSO, and compliance needs before rollout.' />
                        <OnboardingItem title='Procurement ready path' detail='Use contact sales for DPA, security review, invoice terms, or vendor onboarding.' />
                    </div>
                    <form className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4' onSubmit={handleManagedSetup} data-managed-onboarding-intake='true'>
                        <div className='flex items-start gap-2'>
                            <ShieldCheck className='mt-0.5 h-4 w-4 shrink-0 text-ui-primary' />
                            <div>
                                <h2 className='text-sm font-semibold text-ui-text'>Request managed setup</h2>
                                <p className='mt-1 text-xs leading-5 text-ui-muted'>Creates an intake ticket for coverage fit, tenant setup, SSO, retention, and procurement review.</p>
                            </div>
                        </div>
                        <Notify message={setupError} />
                        {managedSetupResult ? (
                            <div className='rounded-lg border border-ui-success/30 bg-ui-success/10 p-3 text-sm leading-6 text-ui-success' data-managed-onboarding-result='true'>
                                <div className='flex items-center gap-2 font-semibold'>
                                    <CheckCircle2 className='h-4 w-4' />
                                    Setup request received
                                </div>
                                <p className='mt-1'>Ticket <span className='font-mono font-semibold'>{managedSetupResult.ticketId}</span>. {managedSetupResult.nextStep}</p>
                            </div>
                        ) : null}
                        <div className='grid gap-2 sm:grid-cols-2'>
                            <label className='grid gap-1.5' htmlFor='managed-setup-name'>
                                <span className='text-xs font-semibold text-ui-muted'>Name</span>
                                <input id='managed-setup-name' name='setupName' placeholder='Avery Chen' autoComplete='name' className={authInputClass} required />
                            </label>
                            <label className='grid gap-1.5' htmlFor='managed-setup-email'>
                                <span className='flex items-center gap-1.5 text-xs font-semibold text-ui-muted'><Mail className='h-3.5 w-3.5' /> Work email</span>
                                <input id='managed-setup-email' name='setupEmail' type='email' placeholder='avery@company.com' autoComplete='email' className={authInputClass} required />
                            </label>
                        </div>
                        <label className='grid gap-1.5' htmlFor='managed-setup-company'>
                            <span className='flex items-center gap-1.5 text-xs font-semibold text-ui-muted'><Building2 className='h-3.5 w-3.5' /> Company</span>
                            <input id='managed-setup-company' name='setupCompany' placeholder='Acme Security' autoComplete='organization' className={authInputClass} required />
                        </label>
                        <label className='grid gap-1.5' htmlFor='managed-setup-context'>
                            <span className='text-xs font-semibold text-ui-muted'>Monitoring context</span>
                            <textarea
                                id='managed-setup-context'
                                name='setupContext'
                                placeholder='Company domains, vendors, delivery preference, SSO or procurement deadline'
                                className='min-h-24 rounded-lg border border-ui-border bg-ui-panel px-3.5 py-2.5 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                                required
                            />
                        </label>
                        <button type='submit' disabled={setupBusy} className={authPrimaryButtonClass}>
                            {setupBusy ? 'Sending' : 'Send setup request'}
                            <ArrowRight className='h-4 w-4 transition group-hover:translate-x-0.5' />
                        </button>
                    </form>
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-lg md:p-5'>
                    <div className='grid gap-1'>
                        <h2 className='text-xl font-semibold text-ui-text'>Create console account</h2>
                        <p className='text-sm leading-6 text-ui-muted'>Use this for individual evaluation. Team rollout, SSO, retention, and procurement should use the managed setup request.</p>
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
