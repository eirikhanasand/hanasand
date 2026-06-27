'use client'

import { fetchVisits } from '@/utils/test/fetchVisits'
import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Visits({ id, serverVisits }: { id: string | number, serverVisits: number }) {
    const [visits, setVisits] = useState(serverVisits)

    useEffect(() => {
        (async() => {
            const clientVisits = await fetchVisits(id)
            if (clientVisits) {
                setVisits(clientVisits)
            }
        })()
    }, [id])

    return (
        <div className='grid min-w-0 grid-cols-[1.25rem_minmax(4.75rem,0.35fr)_minmax(0,1fr)] items-start gap-2 rounded-lg p-2 text-sm text-[#344054] transition hover:bg-[#f2f5f9] dark:text-[#d5dceb] dark:hover:bg-white/6'>
            <span className='grid h-5 w-5 place-items-center text-[#667085] dark:text-[#9aa8bf]'>
                <Eye className='h-4 w-4' />
            </span>
            <span className='text-xs font-semibold uppercase leading-5 text-[#667085] dark:text-[#9aa8bf]'>Visits</span>
            <span className='min-w-0 wrap-break-word leading-5'>{visits}</span>
        </div>
    )
}
