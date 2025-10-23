'use client'

import ClearStateAfter from '@/hooks/clearStateAfter'
import useKeyPress from '@/hooks/keyPressed'
import { Crown, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Notify from '../notify/notify'
import deleteRole from '@/utils/roles/deleteRole'

export default function DashboardRole({ role }: { role: Role }) {
    const [deleted, setDeleted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const keys = useKeyPress('Shift')
    const router = useRouter()
    ClearStateAfter({ condition: error, set: setError, timeout: 5000 })

    async function handleClick() {
        if (!keys['Shift']) {
            router.push(`/roles/${role.id}`)
        }

        if (keys['Shift']) {
            const result = await deleteRole(role.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group'>
            <div onClick={handleClick} className={`flex cursor-pointer justify-between p-2 ${keys['Shift'] ? 'hover:bg-red-500' : 'hover:bg-dark'} rounded-lg hover:scale-[1.005]`}>
                <h1 key={role.id}>{role.name}</h1>
                <div className='flex gap-2'>
                    <div className='flex gap-2'>
                        {role.priority !== 0 && <h1>{role.priority}</h1>}
                        {role.priority === 0 && <Crown className='stroke-amber-300 h-5 w-5' />}
                    </div>
                    {keys['Shift'] && <Trash2 className='hidden group-hover:block w-5 h-5' />}
                </div>
            </div>
            {deleted && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={`Deleted role ${role.id}.`} className=' min-w-full px-4 bg-light' />
            </div>}
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className=' min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
