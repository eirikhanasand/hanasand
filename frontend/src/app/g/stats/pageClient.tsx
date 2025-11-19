'use client'

import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getLink } from '@/utils/links/get'
import prettyDate from '@/utils/prettyDate'
import { ArrowLeft, ChartColumn, Eye, Globe, Rocket, Watch } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function LinkStatsPageClient() {
    const [query, setQuery] = useState('')
    const [link, setLink] = useState<FullLink | null>()
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const isValidLink = query.length > 0 && query.includes('.') && !query.includes(' ') && !query.endsWith('.')
    const color = isValidLink ? 'bg-blue-500/80 cursor-pointer' : 'outline outline-dark cursor-not-allowed'

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()

        if (!isValidLink) {
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

    return (
        <div className='w-full h-full outline outline-dark p-4 space-y-4 relative'>
            <div className='h-full grid place-items-center z-100'>
                <div className='flex flex-col items-center gap-4'>
                    <div className='flex gap-2'>
                        <ChartColumn />
                        <h1 className='text-xl'>Link statistics</h1>
                    </div>
                    <form onSubmit={handleSubmit} className='grid gap-2'>
                        <Notify color='bg-blue-500/20' background='bg-blue-500/10 outline outline-blue-500/35' message={error} />
                        <input
                            className='outline outline-dark w-full rounded-md px-2 py-1 focus:outline-blue-500/50 caret-blue-500 z-10'
                            placeholder='Link'
                            onChange={(e) => setQuery(e.target.value)}
                            value={query}
                            required
                        />
                        <button
                            type='submit'
                            className={`${color} w-full rounded-lg px-2 py-1 text-bright/80`}
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
                <Link href='/g' className='group absolute bottom-4 right-4 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                    <ArrowLeft className='group-hover:stroke-blue-500' />
                </Link> 
            </div>
        </div>
    )
}
