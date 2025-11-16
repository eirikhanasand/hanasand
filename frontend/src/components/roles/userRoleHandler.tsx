import { getCookie } from '@/utils/cookies'
import assignRole from '@/utils/roles/assignRole'
import unassignRole from '@/utils/roles/unassignRole'
import { Crown } from 'lucide-react'
import { redirect } from 'next/navigation'
import { useState } from 'react'

type UserRoleHandlerProps = {
    displayRoles: boolean
    roles: Role[]
}

export default function UserRoleHandler({ displayRoles, roles }: UserRoleHandlerProps) {
    if (!displayRoles) {
        return
    }

    return (
        <div className='bg-dark absolute right-2 top-10 rounded-lg w-fit h-fit overflow-auto p-2 z-10 select-none'>
            {roles.map((role) => <Role key={role.id} role={role} />)}
        </div>
    )
}

function Role({ role }: { role: Role }) {
    const [active, setActive] = useState(false)

    async function handleClick() {
        const id = getCookie('id')
        const token = getCookie('access_token')

        if (!id || !token) {
            return redirect('/logout?path=/login%3Fpath%3D/dashboard/management%26expired=true')
        }

        if (active) {
            const response = await unassignRole({ id, token, role: role.id })
            if (response.status) {
                setActive(false)
            }
        } else {
            const response = await assignRole({ id, token, role: role.id })
            if (response.status) {
                setActive(true)
            }
        }
    }

    return (
        <div className='flex justify-between h-8 max-h-8 gap-2'>
            <div className='flex justify-between w-full self-center gap-2'>
                <h1>{role.name}</h1>
                {role.priority === 0 ? <Crown className='self-center stroke-amber-300 h-5 w-5' /> : <h1>{role.priority}</h1>}
            </div>
            <input
                checked={active}
                onChange={handleClick}
                type='checkbox'
                className='
                    w-4 h-4
                    self-center
                    appearance-none
                    rounded-md
                    border border-white/30
                    bg-white/10
                    backdrop-blur-md
                    shadow-[0_4px_20px_rgba(0,0,0,0.25)]
                    cursor-pointer
                    transition-all
                    checked:bg-white/30
                    checked:border-white/60
                    checked:shadow-[0_0_12px_rgba(255,255,255,0.6)]
                '
            />
        </div>
    )
}
