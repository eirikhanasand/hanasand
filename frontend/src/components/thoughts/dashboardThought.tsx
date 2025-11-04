'use client'

import deleteThought from '@/utils/thoughts/deleteThought'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import Notify from '../notify/notify'
import useKeyPress from '@/hooks/keyPressed'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function DashboardThought({ thought }: { thought: Thought }) {
    const [deleted, setDeleted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const keys = useKeyPress('Shift')
    const router = useRouter()

    async function handleClick() {
        if (!keys['Shift']) {
            router.push(`/thought/${thought.id}`)
        }

        if (keys['Shift']) {
            const result = await deleteThought(thought.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    useClearStateAfter({ condition: error, set: setError })

    return (
        <div className='group'>
            <div onClick={handleClick} className={`flex cursor-pointer justify-between p-2 ${keys['Shift'] ? 'hover:bg-red-500' : 'hover:bg-dark'} rounded-lg hover:scale-[1.005]`}>
                <h1 key={thought.id}>{thought.title}</h1>
                {keys['Shift'] && <Trash2 className='hidden group-hover:block w-5 h-5' />}
            </div>
            {deleted && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={`Deleted thought ${thought.id}.`} className=' min-w-full px-4 bg-light' />
            </div>}
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className=' min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
