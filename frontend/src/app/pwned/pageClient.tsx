'use client'

import ErrorNotice from '@/components/error/errorNotice'
import PwnedSearch from '@/components/pwned/pwnedSearch'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import postBloomHashLookup from '@/utils/pwned/checkHash'
import { ArrowLeft, Eye, Search, ShieldCheck, ShieldX } from 'lucide-react'
import { SyntheticEvent, useState } from 'react'

export default function PwnedPageClient() {
    const [hashInput, setHashInput] = useState('')
    const [didSearch, setDidSearch] = useState(false)
    const [breached, setBreached] = useState(false)
    const [breachCount, setBreachCount] = useState<number | null>(null)
    const [checkedPrefix, setCheckedPrefix] = useState('')
    const [busy, setBusy] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()

    async function handleSubmit(e: SyntheticEvent<HTMLElement>) {
        e.preventDefault()
        setError(null)

        if (!hashInput.trim().length) {
            return
        }

        setBusy(true)
        try {
            const result = await postBloomHashLookup(hashInput)
            setBreached(!result.ok)
            setBreachCount(result.count)
            setCheckedPrefix(result.checkedPrefix || '')
            setDidSearch(true)
            setHashInput('')
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Unable to check the dataset right now.')
        } finally {
            setBusy(false)
        }
    }

    function clear() {
        setHashInput('')
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
                            {didSearch ? 'Hash exposure result' : 'Check Bloom hash exposure'}
                        </div>
                        <p className='text-sm leading-6 text-ui-muted'>
                            {didSearch
                                ? breached ? 'The submitted hash matched the Bloom-indexed exposure range.' : 'No exact hash match was found in the checked Bloom range.'
                                : 'Submit a complete SHA-1 hash. Only the first five characters leave this page.'}
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
                        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 text-xs leading-5 text-ui-muted' data-bloom-hash-safety-boundary>
                            <div className='flex items-center gap-2 font-semibold text-ui-text'>
                                <ShieldCheck className='h-4 w-4 text-ui-success' />
                                Bloom prefix boundary
                            </div>
                            <p>
                                Generate the SHA-1 hash in a trusted local tool. This lookup does not ask for, derive, or transmit the underlying secret.
                            </p>
                        </div>
                        <label className='grid gap-2'>
                            <span className='text-xs font-semibold uppercase text-ui-primary'>SHA-1 hash</span>
                            <input
                                type='text'
                                inputMode='text'
                                spellCheck={false}
                                autoCapitalize='characters'
                                placeholder='40-character SHA-1 hash'
                                onChange={(e) => setHashInput(e.target.value.toUpperCase())}
                                value={hashInput}
                                required
                                autoComplete='off'
                                pattern='[A-Fa-f0-9]{40}'
                                className='h-11 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-medium text-ui-text outline-none transition placeholder:text-ui-muted focus:border-ui-primary focus:ring-4 focus:ring-ui-primary/20'
                            />
                        </label>
                        <button
                            type='submit'
                            disabled={busy}
                            className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:bg-ui-primary/90 disabled:cursor-not-allowed disabled:border disabled:border-ui-border disabled:bg-ui-raised disabled:text-ui-muted'
                        >
                            <Search className='h-4 w-4' />
                            {busy ? 'Checking...' : 'Run Bloom lookup'}
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
                            Check another SHA-1 hash
                        </button>
                    </div>
                ) : (
                    <p className='text-xs leading-5 text-ui-muted'>
                        Exact matches only. The full hash stays in the browser; the API receives only the prefix needed for the range query.
                    </p>
                )}
            </div>
        </div>
    )
}
