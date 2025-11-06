'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import useKeyPress from '@/hooks/keyPressed'
import deleteUser from '@/utils/users/deleteUser'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Notify from '../notify/notify'

export default function DashboardUser({ user }: { user: UserWithRole }) {
    const [deleted, setDeleted] = useState(false)
    const keys = useKeyPress('Shift')
    const router = useRouter()
    const { condition: error, setCondition: setError } = useClearStateAfter()

    async function handleClick() {
        if (!keys['Shift']) {
            router.push(`/profile/${user.id}`)
        }

        if (keys['Shift']) {
            const result = await deleteUser(user.id)
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
                <h1 key={user.id}>{user.name}</h1>
                {keys['Shift'] && <Trash2 className='hidden group-hover:block w-5 h-5' />}
            </div>
            {deleted && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={`Deleted user ${user.id}.`} className=' min-w-full px-4 bg-light' />
            </div>}
            {error && <div className='absolute top-16 right-2 w-50 h-fit'>
                <Notify message={error} className=' min-w-full px-4 bg-light' />
            </div>}
        </div>
    )
}
