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
                className={`flex min-w-0 cursor-pointer items-center justify-between gap-3 rounded-lg p-2 text-left transition ${keys['shift'] ? 'border border-red-300/12 bg-red-300/6 text-red-100/78 hover:bg-red-300/10' : 'text-bright/72 hover:bg-white/[0.045]'}`}
            >
                <span className='flex min-w-0 items-center gap-2'>
                    <BrainCircuit className='h-4 w-4 shrink-0 text-bright/38' />
                    <span className='min-w-0 truncate text-sm'>{thought.title || thought.id}</span>
                </span>
                {keys['shift'] && <Trash2 className='h-4 w-4 shrink-0 text-red-200/80' />}
            </button>
            <ErrorNotice compact variant='success' message={deleted ? `Deleted thought ${thought.id}.` : null} />
            <ErrorNotice compact message={error as string | null} />
        </div>
    )
}
