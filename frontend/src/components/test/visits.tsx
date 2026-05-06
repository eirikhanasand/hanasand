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
        <div className='flex min-w-0 gap-2 rounded-lg p-2 text-sm text-bright/66 transition hover:bg-white/[0.045]'>
            <Eye className='h-4 w-4 shrink-0 text-bright/42' />
            <span className='min-w-0 wrap-break-word'>{visits}</span>
        </div>
    )
}
