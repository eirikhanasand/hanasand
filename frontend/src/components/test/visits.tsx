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
        <div className='grid min-w-0 grid-cols-[1.25rem_minmax(4.75rem,0.35fr)_minmax(0,1fr)] items-start gap-2 rounded-lg p-2 text-sm text-ui-text transition hover:bg-ui-raised'>
            <span className='grid h-5 w-5 place-items-center text-ui-muted'>
                <Eye className='h-4 w-4' />
            </span>
            <span className='text-xs font-semibold uppercase leading-5 text-ui-muted'>Visits</span>
            <span className='min-w-0 wrap-break-word leading-5'>{visits}</span>
        </div>
    )
}
