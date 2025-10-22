'use client'

import Notify from '@/components/notify/notify'
import { getLink } from '@/utils/links/get'
import prettyDate from '@/utils/prettyDate'
import { ArrowLeft, ChartColumn, Eye, Globe, Rocket, Watch } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

export default function LinkStatsPageClient() {
    const [query, setQuery] = useState('')
    const [link, setLink] = useState<FullLink | null>()
    const [error, setError] = useState<string | null>(null)
    const color = query.length > 0 ? 'bg-blue-500/80 cursor-pointer glow-blue' : 'bg-dark cursor-not-allowed glow-blue'

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()

        if (query.length <= 0) {
            return
        }

        const result = await getLink(query)

        if (typeof result === 'number') {
            return setError('Link does not exist')
        }

        if (!result) {
            return setError('Please try again later.')
        }

        if (result) {
            setLink(result)
        }
    }

    useEffect(() => {
        if (!error) {
            return
        }

        const timeout = setTimeout(() => {
            setError('')
        }, 5000)

        return () => clearTimeout(timeout)
    }, [error])

    return (
        <div className='w-full h-full bg-light p-4 space-y-4 relative'>
            <div className='h-full grid place-items-center'>
                <div className='flex flex-col items-center gap-4'>
                    <div className='flex gap-2'>
                        <ChartColumn />
                        <h1 className='text-xl'>Link statistics</h1>
                    </div>
                    <form onSubmit={handleSubmit} className='grid gap-2'>
                        {error && <Notify message={error} />}
                        <input
                            className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden z-10'
                            placeholder='Link'
                            onChange={(e) => setQuery(e.target.value)}
                            value={query}
                            required
                        />
                        <button
                            type='submit'
                            className={`${color} w-full rounded-lg px-2 py-1 text-gray-300`}
                        >
                            <h1>Search</h1>
                        </button>
                    </form>
                    {link && (
                        <div className='grid gap-2'>
                            <div className='flex gap-2'>
                                <Rocket />
                                <h1>{link.id}</h1>
                            </div>
                            <div className='flex gap-2'>
                                <Globe />
                                <h1>{link.path}</h1>
                            </div>
                            <div className='flex gap-2'>
                                <Watch />
                                <h1>{prettyDate(new Date().toISOString())}</h1>
                            </div>
                            <div className='flex gap-2'>
                                <Eye />
                                <h1>{link.visits}</h1>
                            </div>
                        </div>
                    )}
                </div>
                <Link href='/g' className='absolute bottom-4 right-4 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                    <ArrowLeft />
                </Link> 
            </div>
        </div>
    )
}
