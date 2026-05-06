'use client'

import ErrorNotice from '@/components/error/errorNotice'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { setCookieWithExpiresAt } from '@/utils/cookies/cookies'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

export default function PendingDeletionPage({
    id,
    restoreToken,
    deletionScheduledAt,
}: {
    id: string
    restoreToken: string
    deletionScheduledAt: string
}) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const canRestore = Boolean(id && restoreToken)
    const deletionDate = useMemo(() => {
        if (!deletionScheduledAt) return 'the scheduled deletion time'
        return new Intl.DateTimeFormat('en', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(deletionScheduledAt))
    }, [deletionScheduledAt])

    async function restore() {
        if (busy) return
        setBusy(true)
        setError(null)
        try {
            const response = await fetch(`${config.url.api}/user/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restoreToken }),
            })
            const data = await response.json().catch(() => null)
            if (!response.ok) {
                return setError(data?.error || 'Unable to restore account.')
            }
            if (data?.token) {
                setCookieWithExpiresAt('name', data.name, data.expires_at)
                setCookieWithExpiresAt('id', data.id, data.expires_at)
                setCookieWithExpiresAt('avatar', data.avatar ?? '', data.expires_at)
                setCookieWithExpiresAt('access_token', data.token, data.expires_at)
                setCookieWithExpiresAt('roles', JSON.stringify(data.roles ?? []), data.expires_at)
                router.push('/dashboard')
                return
            }
            router.push('/login')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to restore account.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-[392px] gap-4'>
                <div className='grid justify-items-center gap-2 pb-3 text-center'>
                    <h1 className='font-serif text-[46px] font-semibold leading-none text-bright'>Hanasand</h1>
                    <div className='h-px w-11 bg-bright/20' />
                </div>

                <div className='grid w-full gap-3 rounded-lg border border-white/10 bg-dark/70 p-3 shadow-[0_14px_42px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                    <div className='grid gap-2 px-1 py-1'>
                        <h2 className='text-base font-semibold text-bright'>Account pending deletion</h2>
                        <p className='text-sm leading-6 text-bright/52'>
                            {id ? `@${id}` : 'This account'} is scheduled to be permanently deleted on {deletionDate}.
                        </p>
                    </div>
                    <ErrorNotice compact message={error} />
                    {!canRestore ? (
                        <ErrorNotice
                            compact
                            variant='info'
                            message='This restore link is missing account recovery details. Go back to login and request a fresh sign-in.'
                        />
                    ) : null}
                    <div className='mt-1 flex items-center gap-3'>
                        <button
                            type='button'
                            onClick={() => router.push('/login')}
                            className='inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-bright/52 transition hover:bg-white/6 hover:text-bright/78'
                        >
                            <ArrowLeft className='h-4 w-4' />
                            Go back
                        </button>
                        <button
                            type='button'
                            disabled={busy || !canRestore}
                            onClick={() => void restore()}
                            className='ml-auto inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-bold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {busy ? 'Restoring' : 'Restore'}
                            <RotateCcw className='h-4 w-4' />
                        </button>
                    </div>
                </div>
            </div>
        </section>
    )
}
