import { getCookie } from '@/utils/cookies/cookies'
import assignRole from '@/utils/roles/assignRole'
import getUserRoles from '@/utils/roles/getUserRoles'
import unassignRole from '@/utils/roles/unassignRole'
import { Crown } from 'lucide-react'
import { redirect } from 'next/navigation'
import { useEffect, useState } from 'react'

type UserRoleHandlerProps = {
    displayRoles: boolean
    roles: Role[]
    user: UserWithRole
}

export default function UserRoleHandler({ displayRoles, roles, user }: UserRoleHandlerProps) {
    const [userRoles, setUserRoles] = useState<MinimalRole[]>([])

    useEffect(() => {
        if (!displayRoles) {
            return
        }

        (async() => {
            const id = getCookie('id')
            const token = getCookie('access_token')

            if (!id || !token) {
                return redirect('/logout?path=/login%3Fpath%3D/dashboard/management%26expired=true')
            }

            const response = await getUserRoles({ id, token, target: user.id })
            setUserRoles(response)
        })()
    }, [displayRoles, user.id])

    if (!displayRoles) {
        return null
    }

    return (
        <div className='absolute right-2 top-10 z-10 h-fit w-fit select-none overflow-auto rounded-lg border border-ui-border bg-ui-panel p-2 shadow-lg shadow-ui-canvas/10'>
            {roles.map((role) => <Role key={role.id} role={role} user={user} userRoles={userRoles} />)}
        </div>
    )
}

function Role({ role, user, userRoles }: { role: Role, user: UserWithRole, userRoles: MinimalRole[] }) {
    const [active, setActive] = useState(false)

    useEffect(() => {
        setActive(userRoles.some((r) => r.role_id === role.id || r.role_id === role.name))
    }, [role.id, role.name, userRoles])

    async function handleClick() {
        const id = getCookie('id')
        const token = getCookie('access_token')

        if (!id || !token) {
            return redirect('/logout?path=/login%3Fpath%3D/dashboard/management%26expired=true')
        }

        if (active) {
            const response = await unassignRole({ id, token, role: role.id, target: user.id })
            if (response.status) {
                setActive(false)
            }
        } else {
            const response = await assignRole({ id, token, role: role.id, target: user.id })
            if (response.status) {
                setActive(true)
            }
        }
    }

    return (
        <div className='flex h-8 max-h-8 justify-between gap-2'>
            <div className='flex w-full justify-between gap-2 self-center text-ui-text'>
                <h1>{role.name}</h1>
                {role.priority === 0 ? <Crown className='h-5 w-5 self-center stroke-ui-warning' /> : <h1>{role.priority}</h1>}
            </div>
            <input
                aria-label={`${active ? 'Remove' : 'Assign'} ${role.id} for ${user.id}`}
                checked={active}
                onChange={handleClick}
                type='checkbox'
                className='
                    w-4 h-4
                    self-center
                    appearance-none
                    rounded-md
                    border border-ui-border
                    bg-ui-raised
                    backdrop-blur-md
                    shadow-[0_4px_20px_rgba(0,0,0,0.25)]
                    cursor-pointer
                    transition-all
                    checked:border-ui-primary
                    checked:bg-ui-primary/30
                    checked:shadow-[0_0_12px_var(--ui-primary)]
                '
            />
        </div>
    )
}
