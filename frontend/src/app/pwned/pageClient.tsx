'use client'

import ErrorNotice from '@/components/error/errorNotice'
import PwnedSearch from '@/components/pwned/pwnedSearch'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import postPwned from '@/utils/pwned/checkPassword'
import { ArrowLeft, Eye, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { FormEvent, useState } from 'react'

export default function PwnedPageClient() {
    const [password, setPassword] = useState('')
    const [didSearch, setDidSearch] = useState(false)
    const [breached, setBreached] = useState(false)
    const [breachCount, setBreachCount] = useState<number | null>(null)
    const [busy, setBusy] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const canSubmit = password.length > 0 && !busy

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()
        setError(null)

        if (!password.length) {
            return
        }

        setBusy(true)
        try {
            const result = await postPwned(password)
            if (!result) {
                return setError('Unable to check the dataset right now.')
            }

            setBreached(!result.ok)
            setBreachCount(result.count)
            setDidSearch(true)
        } finally {
            setBusy(false)
        }
    }

    function clear() {
        setPassword('')
        setBreached(false)
        setDidSearch(false)
        setBreachCount(null)
        setError(null)
    }

    return (
        <div className='rounded-xl border border-white/10 bg-dark/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-md md:p-5'>
            <div className='grid gap-5'>
                <div className='flex items-start justify-between gap-4'>
                    <div className='grid gap-1'>
                        <div className='flex items-center gap-2 text-lg font-semibold text-bright/88'>
                            <Eye className={`h-5 w-5 ${didSearch ? breached ? 'text-red-300' : 'text-emerald-300' : 'text-[#f0a17a]'}`} />
                            {didSearch ? 'Password check result' : 'Check password exposure'}
                        </div>
                        <p className='text-sm leading-6 text-bright/45'>
                            {didSearch
                                ? breached ? 'The exact password was found in breach data.' : 'No exact match was found in the indexed breach data.'
                                : 'Search for an exact password match without storing it in the browser.'}
                        </p>
                    </div>
                    {didSearch ? (
                        <div className={`grid h-10 w-10 place-items-center rounded-lg border ${breached ? 'border-red-400/20 bg-red-500/10 text-red-200' : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'}`}>
                            {breached ? <ShieldX className='h-4 w-4' /> : <ShieldCheck className='h-4 w-4' />}
                        </div>
                    ) : null}
                </div>

                {didSearch ? (
                    <PwnedSearch breached={breached} breachCount={breachCount} password={password} />
                ) : (
                    <form onSubmit={handleSubmit} className='grid gap-3'>
                        <ErrorNotice compact message={error} />
                        <label className='grid gap-2'>
                            <span className='text-xs font-medium uppercase tracking-[0.18em] text-bright/34'>Password</span>
                            <input
                                type='password'
                                placeholder='Enter password to check'
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                required
                                autoComplete='off'
                                className='h-11 rounded-lg border border-white/10 bg-white/[0.045] px-3 text-sm text-bright outline-none transition placeholder:text-bright/28 focus:border-[#f07d33]/55 focus:bg-white/[0.065]'
                            />
                        </label>
                        <button
                            type='submit'
                            disabled={!canSubmit}
                            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-semibold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/5 disabled:text-bright/35'
                        >
                            <Search className='h-4 w-4' />
                            {busy ? 'Checking...' : 'Check password'}
                        </button>
                    </form>
                )}

                {didSearch ? (
                    <div className='flex justify-end'>
                        <button
                            type='button'
                            onClick={clear}
                            className='inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm font-medium text-bright/60 transition hover:bg-white/7 hover:text-bright'
                        >
                            <ArrowLeft className='h-4 w-4' />
                            Check another
                        </button>
                    </div>
                ) : (
                    <p className='text-xs leading-5 text-bright/32'>
                        Exact matches only. Partial passwords and longer variants are not treated as matches.
                    </p>
                )}
            </div>
        </div>
    )
}
