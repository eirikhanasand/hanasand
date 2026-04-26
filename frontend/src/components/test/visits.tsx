'use client'

import { fetchVisits } from '@/utils/test/fetchVisits'
import { Eye } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Visits({ id, serverVisits }: { id: number, serverVisits: number }) {
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
        <div className='flex min-w-0 gap-2 rounded-lg p-2 hover:bg-dark'>
            <Eye className='h-5 w-5 shrink-0' />
            <h1 className='min-w-0 break-words'>{visits}</h1>
        </div>
    )
}
