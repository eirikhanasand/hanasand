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
    const [checkedPrefix, setCheckedPrefix] = useState('')
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
            setBreached(!result.ok)
            setBreachCount(result.count)
            setCheckedPrefix(result.checkedPrefix || '')
            setDidSearch(true)
            setPassword('')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to check the dataset right now.')
        } finally {
            setBusy(false)
        }
    }

    function clear() {
        setPassword('')
        setBreached(false)
        setDidSearch(false)
        setBreachCount(null)
        setCheckedPrefix('')
        setError(null)
    }

    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-5 shadow-sm md:p-6'>
            <div className='grid gap-5'>
                <div className='flex items-start justify-between gap-4'>
                    <div className='grid gap-1'>
                        <div className='flex items-center gap-2 text-lg font-semibold text-ui-text'>
                            <Eye className={`h-5 w-5 ${didSearch ? breached ? 'text-ui-danger' : 'text-ui-success' : 'text-ui-primary'}`} />
                            {didSearch ? 'Password check result' : 'Check password exposure'}
                        </div>
                        <p className='text-sm leading-6 text-ui-muted'>
                            {didSearch
                                ? breached ? 'The exact password was found in breach data.' : 'No exact match was found in the indexed breach data.'
                                : 'Search for an exact password match without sending the password or full hash to Hanasand.'}
                        </p>
                    </div>
                    {didSearch ? (
                        <div className={`grid h-10 w-10 place-items-center rounded-lg border ${breached ? 'border-ui-danger bg-ui-danger/10 text-ui-danger' : 'border-ui-success bg-ui-success/10 text-ui-success'}`}>
                            {breached ? <ShieldX className='h-4 w-4' /> : <ShieldCheck className='h-4 w-4' />}
                        </div>
                    ) : null}
                </div>

                {didSearch ? (
                    <PwnedSearch breached={breached} breachCount={breachCount} checkedPrefix={checkedPrefix} />
                ) : (
                    <form onSubmit={handleSubmit} className='grid gap-3'>
                        <ErrorNotice compact message={error} />
                        <label className='grid gap-2'>
                            <span className='text-xs font-semibold uppercase text-ui-primary'>Password</span>
                            <input
                                type='password'
                                placeholder='Enter password to check'
                                onChange={(e) => setPassword(e.target.value)}
                                value={password}
                                required
                                autoComplete='off'
                                className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                            />
                        </label>
                        <button
                            type='submit'
                            disabled={!canSubmit}
                            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
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
                            className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'
                        >
                            <ArrowLeft className='h-4 w-4' />
                            Check another
                        </button>
                    </div>
                ) : (
                    <p className='text-xs leading-5 text-ui-muted'>
                        Exact matches only. The browser hashes locally, sends only the first five SHA-1 characters, and compares the returned range on this device.
                    </p>
                )}
            </div>
        </div>
    )
}
