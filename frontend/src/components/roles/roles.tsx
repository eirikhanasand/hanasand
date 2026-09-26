import { cookies } from 'next/headers'
import getUserRoles from '@/utils/roles/getUserRoles'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'
import RoleList from './roleList'

export default async function Roles({ roles }: { roles: Role[] }) {
    const jar = await cookies()
    const id = jar.get('id')?.value || ''
    const token = jar.get('access_token')?.value || ''
    const [assigned, users] = await Promise.all([
        getUserRoles({ id, token }),
        fetchUsersWithRoles({ id, token, cache: 'no-store' })
    ])
    const ownRoles = roles.filter(role => assigned.some(item => item.role_id === role.id))
    return <RoleList roles={roles} users={users} canManage={assigned.some(role => ['administrator', 'user_admin'].includes(role.role_id))} highestPriority={Math.min(...ownRoles.map(role => role.priority))} />
}
