'use client'

import ErrorNotice from '@/components/error/errorNotice'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getLink } from '@/utils/links/get'
import prettyDate from '@/utils/date/prettyDate'
import { ArrowLeft, ChartColumn, Eye, Globe, Rocket, Search, Watch } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { normalizeShortcut } from '../pageClient'

export default function LinkStatsPageClient() {
    const [query, setQuery] = useState('')
    const [link, setLink] = useState<FullLink | null>()
    const [busy, setBusy] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const shortcut = normalizeShortcut(query)
    const canSearch = Boolean(shortcut && !busy)

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()
        setError(null)

        if (!shortcut) {
            setError('Enter the shortcut name, not the full destination URL.')
            return
        }

        setBusy(true)
        try {
            const result = await getLink(shortcut)

            if (typeof result === 'number') {
                setLink(null)
                return setError('Shortcut does not exist.')
            }

            if (!result) {
                return setError('Please try again later.')
            }

            setLink(result)
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className='grid min-h-[calc(100vh-4.5rem)] w-full place-items-center bg-[#f7f8fb] px-4 py-10 text-[#171a21] md:px-10'>
            <div className='grid w-full max-w-md gap-3'>
                <div className='rounded-lg border border-[#dfe5ee] bg-white p-4 shadow-[0_20px_70px_rgba(26,35,55,0.10)]'>
                    <div className='grid gap-4'>
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-[#171a21]'>
                                <ChartColumn className='h-5 w-5 text-[#3056d3]' />
                                Shortcut statistics
                            </div>
                            <p className='text-sm leading-6 text-[#596170]'>Look up a short link by its `/g/` shortcut name.</p>
                        </div>
                        <form onSubmit={handleSubmit} className='grid gap-3'>
                            <ErrorNotice compact message={error} />
                            <label className='grid gap-2'>
                                <span className='text-xs font-semibold uppercase text-[#3056d3]'>Shortcut</span>
                                <div className='flex h-11 overflow-hidden rounded-lg border border-[#d8dee9] bg-white focus-within:border-[#3056d3] focus-within:ring-4 focus-within:ring-[#dce6ff]'>
                                    <span className='flex items-center border-r border-[#e4e7ec] bg-[#f8fafc] px-3 text-sm text-[#667085]'>/g/</span>
                                    <input
                                        className='min-w-0 flex-1 bg-transparent px-3 text-sm text-[#171a21] outline-none placeholder:text-[#8c95a5]'
                                        placeholder='team-notes'
                                        onChange={(e) => setQuery(e.target.value)}
                                        value={query}
                                        required
                                    />
                                </div>
                            </label>
                            <button
                                type='submit'
                                disabled={!canSearch}
                                className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#171a21] px-4 text-sm font-semibold text-white transition hover:bg-[#2b2f39] disabled:cursor-not-allowed disabled:border disabled:border-[#d8dee9] disabled:bg-[#f5f7fb] disabled:text-[#98a2b3]'
                            >
                                <Search className='h-4 w-4' />
                                {busy ? 'Searching...' : 'Search'}
                            </button>
                        </form>
                        {link && (
                            <div className='grid gap-2 rounded-lg border border-[#e0e5ed] bg-[#f8fafc] p-3 text-sm text-[#596170]'>
                                <Stat icon={<Rocket className='h-4 w-4' />} label='Shortcut' value={`/g/${link.id}`} />
                                <Stat icon={<Globe className='h-4 w-4' />} label='Destination' value={link.path} />
                                <Stat icon={<Watch className='h-4 w-4' />} label='Created' value={prettyDate(link.timestamp)} />
                                <Stat icon={<Eye className='h-4 w-4' />} label='Visits' value={String(link.visits)} />
                            </div>
                        )}
                    </div>
                </div>
                <div className='flex justify-end'>
                    <Link href='/g' className='grid h-10 w-10 place-items-center rounded-lg border border-[#d8dee9] bg-white text-[#596170] transition hover:border-[#bdc7d5] hover:text-[#171a21]' aria-label='Back to shortcut creator'>
                        <ArrowLeft className='h-4 w-4' />
                    </Link>
                </div>
            </div>
        </section>
    )
}

function Stat({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className='grid grid-cols-[auto_6rem_minmax(0,1fr)] items-center gap-2'>
            <span className='text-[#667085]'>{icon}</span>
            <span className='text-xs font-semibold uppercase text-[#667085]'>{label}</span>
            <span className='min-w-0 truncate text-right text-[#344054]'>{value}</span>
        </div>
    )
}
