'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import Notify from '../notify/notify'
import useKeyPress from '@/hooks/keyPressed'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteProject from '@/utils/projects/deleteProject'
import prettyDate from '@/utils/date/prettyDate'

export default function DashboardProject({ project }: { project: Project }) {
    const [deleted, setDeleted] = useState(false)
    const { condition: error, setCondition: setError } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const router = useRouter()

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/p/${project.alias}`)
        }

        if (keys['shift']) {
            const result = await deleteProject(project.alias)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group'>
            <div onClick={handleClick} className={`flex cursor-pointer justify-between rounded-lg px-3 py-2 transition ${keys['shift'] ? 'hover:bg-red-500/30' : 'hover:bg-white/6'}`}>
                <div className='flex w-full items-center justify-between gap-3 text-bright/80'>
                    <h1 className='truncate text-sm font-medium'>{project.alias}</h1>
                    <h1 className='shrink-0 text-xs text-bright/40'>{prettyDate(project.last_updated)}</h1>
                </div>
                {keys['shift'] && <Trash2 className='hidden group-hover:block w-5 h-5' />}
            </div>
            {deleted && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={`Deleted project ${project.alias}.`} className=' min-w-full px-4 bg-light' />
            </div>}
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className=' min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
