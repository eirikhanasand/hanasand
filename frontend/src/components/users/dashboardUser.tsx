'use client'

import useClearStateAfter from '@/hooks/useClearStateAfter'
import useKeyPress from '@/hooks/keyPressed'
import deleteUser from '@/utils/users/deleteUser'
import { Crown, Pencil, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Notify from '../notify/notify'
import UserRoleHandler from '../roles/userRoleHandler'

export default function DashboardUser({ user, roles }: { user: UserWithRole, roles: Role[] }) {
    const { condition: deleted, setCondition: setDeleted } = useClearStateAfter()
    const [displayRoles, setDisplayRoles] = useState(false)
    const keys = useKeyPress('shift')
    const router = useRouter()
    const { condition: error, setCondition: setError } = useClearStateAfter()

    async function handleRoles(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        e.stopPropagation()
        e.preventDefault()
        setDisplayRoles(!displayRoles)
    }

    async function handleClick() {
        if (!keys['shift']) {
            router.push(`/profile/${user.id}`)
        }

        if (keys['shift']) {
            const result = await deleteUser(user.id)
            if (result.status === 200) {
                setDeleted(true)
            } else {
                setError(result.message)
            }
        }
    }

    return (
        <div className='group relative h-10 min-h-10 max-h-10'>
            <div onClick={handleClick} className={`flex cursor-pointer justify-between p-2 ${keys['shift'] ? 'hover:bg-red-500/15 hover:outline hover:outline-red-500/30' : 'hover:bg-dark'} rounded-lg hover:scale-[1.005]`}>
                <h1 className='self-center' key={user.id}>{user.name}</h1>
                {keys['shift'] && <Trash2 className='hidden group-hover:block w-5 h-5 stroke-red-500' />}
                {!keys['shift'] && <div className='group flex items-center gap-2'>
                    {user.highest_role_priority === 0 && <Crown className='w-5 h-5 stroke-amber-300' />}
                    <div onClick={handleRoles} className='hidden group-hover:grid rounded-lg hover:bg-[#6464641a] h-7 w-7 place-items-center cursor-pointer'>
                        {displayRoles 
                            ? <X className='w-4 h-4 self-center stroke-bright/50' />
                            : <Pencil className='w-4 h-4 self-center stroke-bright/50' />
                        }
                    </div>
                </div>}
            </div>
            <UserRoleHandler user={user} displayRoles={displayRoles} roles={roles} />
            {deleted && <div className='absolute top-16 right-2 w-50 h-fit z-100'>
                <Notify color='bg-blue-500' background='bg-bright/3 backdrop-blur-md' message={`Deleted user ${user.id}.`} className=' min-w-full px-4 outline outline-dark' />
            </div>}
            {error && <div className='absolute top-16 right-2 w-50 h-fit z-100'>
                <Notify background='bg-bright/3 backdrop-blur-md' message={`Deleted user ${user.id}.`} className=' min-w-full px-4 outline outline-dark' />
            </div>}
        </div>
    )
}
