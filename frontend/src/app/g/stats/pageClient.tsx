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
        <section className='grid min-h-[90.5vh] w-full place-items-center px-4 py-8 md:px-10'>
            <div className='grid w-full max-w-md gap-3'>
                <div className='rounded-xl border border-white/10 bg-dark/70 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-md'>
                    <div className='grid gap-4'>
                        <div className='grid gap-1'>
                            <div className='flex items-center gap-2 text-lg font-semibold text-bright/88'>
                                <ChartColumn className='h-5 w-5 text-[#f0a17a]' />
                                Shortcut statistics
                            </div>
                            <p className='text-sm leading-6 text-bright/45'>Look up a short link by its `/g/` shortcut name.</p>
                        </div>
                        <form onSubmit={handleSubmit} className='grid gap-3'>
                            <ErrorNotice compact message={error} />
                            <label className='grid gap-2'>
                                <span className='text-xs font-medium uppercase tracking-[0.18em] text-bright/34'>Shortcut</span>
                                <div className='flex h-11 overflow-hidden rounded-lg border border-white/10 bg-white/[0.045] focus-within:border-[#f07d33]/55 focus-within:bg-white/[0.065]'>
                                    <span className='flex items-center border-r border-white/8 px-3 text-sm text-bright/32'>/g/</span>
                                    <input
                                        className='min-w-0 flex-1 bg-transparent px-3 text-sm text-bright outline-none placeholder:text-bright/28'
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
                                className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-bright px-4 text-sm font-semibold text-background transition hover:bg-white disabled:cursor-not-allowed disabled:border disabled:border-white/10 disabled:bg-white/5 disabled:text-bright/35'
                            >
                                <Search className='h-4 w-4' />
                                {busy ? 'Searching...' : 'Search'}
                            </button>
                        </form>
                        {link && (
                            <div className='grid gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3 text-sm text-bright/70'>
                                <Stat icon={<Rocket className='h-4 w-4' />} label='Shortcut' value={`/g/${link.id}`} />
                                <Stat icon={<Globe className='h-4 w-4' />} label='Destination' value={link.path} />
                                <Stat icon={<Watch className='h-4 w-4' />} label='Created' value={prettyDate(link.timestamp)} />
                                <Stat icon={<Eye className='h-4 w-4' />} label='Visits' value={String(link.visits)} />
                            </div>
                        )}
                    </div>
                </div>
                <div className='flex justify-end'>
                    <Link href='/g' className='grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.035] text-bright/58 transition hover:bg-white/7 hover:text-bright' aria-label='Back to shortcut creator'>
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
            <span className='text-bright/42'>{icon}</span>
            <span className='text-xs font-medium uppercase tracking-[0.16em] text-bright/34'>{label}</span>
            <span className='min-w-0 truncate text-right text-bright/74'>{value}</span>
        </div>
    )
}
