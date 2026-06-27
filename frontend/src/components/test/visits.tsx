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
        <div className='flex min-w-0 gap-2 rounded-lg p-2 text-sm text-[#344054] transition hover:bg-[#f2f5f9] dark:text-[#d5dceb] dark:hover:bg-white/6'>
            <Eye className='h-4 w-4 shrink-0 text-[#667085] dark:text-[#9aa8bf]' />
            <span className='min-w-0 wrap-break-word'>{visits}</span>
        </div>
    )
}
