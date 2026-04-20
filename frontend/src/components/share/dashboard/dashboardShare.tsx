'use client'

import deleteThought from '@/utils/thoughts/deleteThought'
import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import Notify from '../../notify/notify'
import useKeyPress from '@/hooks/keyPressed'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'

export default function DashboardShare({ share }: { share: Share }) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const router = useRouter()

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/s/${share.id}`)
        }

        if (keys['shift']) {
            const result = await deleteThought(share.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group'>
            <div onClick={handleClick} className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-3 transition-colors ${keys['shift'] ? 'hover:bg-red-500/30' : 'hover:bg-dark/70'}`}>
                <div className='min-w-0'>
                    <h1 key={share.id} className='truncate font-medium text-bright/88'>{share.alias || share.path || share.id}</h1>
                    <p className='mt-1 truncate text-xs text-bright/35'>{share.id}</p>
                </div>
                {keys['shift'] && <Trash2 className='hidden group-hover:block w-5 h-5' />}
            </div>
            {deleted && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={`Deleted share ${share.id}.`} className='min-w-full px-4 bg-light' />
            </div>}
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className='min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
