'use client'

import deleteThought from '@/utils/thoughts/deleteThought'
import { BrainCircuit, Trash2 } from 'lucide-react'
import { useState } from 'react'
import useKeyPress from '@/hooks/keyPressed'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import ErrorNotice from '../error/errorNotice'

export default function DashboardThought({ thought }: { thought: Thought }) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const router = useRouter()

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/thought/${thought.id}`)
        }

        if (keys['shift']) {
            const result = await deleteThought(thought.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group grid gap-2'>
            <button
                type='button'
                onClick={handleClick}
                className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg p-2 text-left transition ${keys['shift'] ? 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'text-[#394150] hover:bg-[#f4f7fb]'}`}
            >
                <span className='flex min-w-0 items-center gap-2'>
                    <BrainCircuit className='h-4 w-4 shrink-0 text-[#798498]' />
                    <span className='min-w-0 truncate text-sm'>{thought.title || thought.id}</span>
                </span>
                {keys['shift'] && <Trash2 className='h-4 w-4 shrink-0 text-red-600' />}
            </button>
            <ErrorNotice compact variant='success' message={deleted ? `Deleted thought ${thought.id}.` : null} />
            <ErrorNotice compact message={error as string | null} />
        </div>
    )
}
