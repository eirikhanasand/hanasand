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
            router.push(`/project/${project.alias}`)
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
            <div onClick={handleClick} className={`flex cursor-pointer justify-between p-2 ${keys['shift'] ? 'hover:bg-red-500' : 'hover:bg-dark'} rounded-lg hover:scale-[1.005]`}>
                <div className='flex justify-between w-full items-center text-bright/80'>
                    <h1>{project.alias}</h1>
                    <h1 className='text-bright/60 text-sm self-center'>{prettyDate(project.last_updated)}</h1>
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
