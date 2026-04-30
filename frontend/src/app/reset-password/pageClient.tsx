'use client'
import Notify from '@/components/notify/notify'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { ArrowRight, KeyRound, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type ResetPasswordPageProps = {
    userId: string
}

export default function ResetPasswordPage({ userId }: ResetPasswordPageProps) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const [done, setDone] = useState(false)
    const [resetToken, setResetToken] = useState('')
    const [tokenLoaded, setTokenLoaded] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        setResetToken(params.get('token') || '')
        setTokenLoaded(true)
    }, [])

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        const formData = new FormData(e.currentTarget)
        const password = String(formData.get('password') || '')
        const confirmPassword = String(formData.get('confirmPassword') || '')

        if (password !== confirmPassword) {
            return setError('Passwords do not match.')
        }

        setBusy(true)
        try {
            const response = await fetch(`${config.url.api}/auth/password-reset/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: userId, resetToken, password }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                return setError(data?.error || 'Unable to reset password.')
            }

            setDone(true)
            setTimeout(() => router.push('/login'), 1200)
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to reset password.')
        } finally {
            setBusy(false)
        }
    }

    const missingResetSession = tokenLoaded && (!userId || !resetToken)

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
                            <div className='mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-amber-500/12 text-amber-300'>
                                <KeyRound className='h-5 w-5' />
                            </div>
                            <p className='mt-5 text-xs uppercase tracking-[0.35em] text-bright/35'>Reset password</p>
                            <h1 className='mt-3 text-3xl font-semibold tracking-[-0.04em] text-bright md:text-4xl'>New password</h1>
                        </div>

                        <Notify message={error as string | null} />
                        {done && <div className='rounded-xl border border-emerald-400/20 bg-emerald-500/12 p-3 text-sm text-emerald-100'>Password updated.</div>}
                        {!tokenLoaded ? null : missingResetSession ? (
                            <Link href='/login' className='w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-semibold text-bright/80 transition hover:bg-white/10'>
                                Back to login
                            </Link>
                        ) : (
                            <form className='flex w-full flex-col gap-3 self-center' onSubmit={handleSubmit}>
                                <input
                                    type='password'
                                    name='password'
                                    placeholder='New password'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                <input
                                    type='password'
                                    name='confirmPassword'
                                    placeholder='Confirm password'
                                    className='rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-medium text-bright outline-none transition focus:border-orange-300/50 focus:bg-white/9'
                                    required
                                />
                                <button
                                    type='submit'
                                    disabled={busy || done}
                                    className='group flex w-full items-center justify-between rounded-2xl bg-bright/86 px-4 py-3 text-sm font-semibold text-background/90 shadow-[0_10px_30px_rgba(255,255,255,0.08)] transition hover:bg-bright/92 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Set password
                                    <ArrowRight className='h-4 w-4 transition group-hover:translate-x-1' />
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
