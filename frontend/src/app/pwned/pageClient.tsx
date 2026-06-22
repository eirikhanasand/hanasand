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
        <div className='rounded-lg border border-[#dfe5ee] bg-white p-5 shadow-[0_20px_70px_rgba(26,35,55,0.10)] md:p-6'>
            <div className='grid gap-5'>
                <div className='flex items-start justify-between gap-4'>
                    <div className='grid gap-1'>
                        <div className='flex items-center gap-2 text-lg font-semibold text-[#171a21]'>
                            <Eye className={`h-5 w-5 ${didSearch ? breached ? 'text-[#b42318]' : 'text-[#147a3b]' : 'text-[#3056d3]'}`} />
                            {didSearch ? 'Password check result' : 'Check password exposure'}
                        </div>
                        <p className='text-sm leading-6 text-[#596170]'>
                            {didSearch
                                ? breached ? 'The exact password was found in breach data.' : 'No exact match was found in the indexed breach data.'
                                : 'Search for an exact password match without storing it in the browser.'}
                        </p>
                    </div>
                    {didSearch ? (
                        <div className={`grid h-10 w-10 place-items-center rounded-lg border ${breached ? 'border-[#fecdca] bg-[#fff1f0] text-[#b42318]' : 'border-[#bde8ca] bg-[#e9f8ef] text-[#147a3b]'}`}>
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
                            <span className='text-xs font-semibold uppercase text-[#3056d3]'>Password</span>
                            <input
                                type='password'
                                placeholder='Enter password to check'
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                required
                                autoComplete='off'
                                className='h-11 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-medium text-[#171a21] outline-none transition placeholder:text-[#8c95a5] focus:border-[#3056d3] focus:ring-4 focus:ring-[#dce6ff]'
                            />
                        </label>
                        <button
                            type='submit'
                            disabled={!canSubmit}
                            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:border disabled:border-[#d8dee9] disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
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
                            className='inline-flex h-10 items-center gap-2 rounded-lg border border-[#d8dee9] bg-white px-3 text-sm font-semibold text-[#344054] transition hover:border-[#bdc7d5]'
                        >
                            <ArrowLeft className='h-4 w-4' />
                            Check another
                        </button>
                    </div>
                ) : (
                    <p className='text-xs leading-5 text-[#667085]'>
                        Exact matches only. Partial passwords and longer variants are not treated as matches.
                    </p>
                )}
            </div>
        </div>
    )
}
