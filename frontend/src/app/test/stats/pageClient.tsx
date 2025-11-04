'use client'

import Notify from '@/components/notify/notify'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import prettyDate from '@/utils/prettyDate'
import { fetchTest } from '@/utils/test/fetchTest'
import { ArrowLeft, ChartColumn, Eye, Globe, Rocket, Watch } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useState } from 'react'

export default function TestStatsPageClient() {
    const [query, setQuery] = useState('')
    const [test, setTest] = useState<Test | null>()
    const [error, setError] = useState<string | null>(null)
    const color = query.length > 0 
        ? 'bg-orange-500/80 cursor-pointer glow-orange-small'
        : 'bg-dark cursor-not-allowed glow-orange-small'

    async function handleSubmit(e: FormEvent<HTMLElement>) {
        e.preventDefault()

        if (query.length <= 0) {
            return
        }

        const result = await fetchTest(query)
        if (!result) {
            return setError('Please try again later.')
        }

        if (result) {
            setTest(result)
        }
    }

    useClearStateAfter({ condition: error, set: setError })

    return (
        <div className='w-full h-full bg-light p-4 space-y-4 relative'>
            <div className='h-full grid place-items-center'>
                <div className='flex flex-col items-center gap-4'>
                    <div className='flex gap-2'>
                        <ChartColumn className='stroke-orange-500' />
                        <h1 className='text-xl'>Test results</h1>
                    </div>
                    <form onSubmit={handleSubmit} className='grid gap-2'>
                        {error && <Notify message={error} />}
                        <input
                            className='bg-dark w-full rounded-md px-2 py-1 focus:outline-hidden z-10'
                            placeholder='Test'
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
                    {test && (
                        <div className='grid gap-2'>
                            <div className='flex gap-2'>
                                <Rocket />
                                <h1>{JSON.stringify(test)}</h1>
                            </div>
                            <div className='flex gap-2'>
                                <Globe />
                                {/* <h1>{test.path}</h1> */}
                            </div>
                            <div className='flex gap-2'>
                                <Watch />
                                <h1>{prettyDate(new Date().toISOString())}</h1>
                            </div>
                            <div className='flex gap-2'>
                                <Eye />
                                <h1>{test.visits}</h1>
                            </div>
                        </div>
                    )}
                </div>
                <Link href='/test' className='group absolute bottom-4 right-4 rounded-lg hover:bg-[#6464641a] h-12 w-12 grid place-items-center cursor-pointer'>
                    <ArrowLeft className='group-hover:stroke-[#e25822]' />
                </Link> 
            </div>
        </div>
    )
}
