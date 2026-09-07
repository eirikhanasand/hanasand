import { cookies } from 'next/headers'
import getUserRoles from '@/utils/roles/getUserRoles'
import RoleList from './roleList'

export default async function Roles({ roles }: { roles: Role[] }) {
    const jar = await cookies()
    const assigned = await getUserRoles({ id: jar.get('id')?.value || '', token: jar.get('access_token')?.value || '' })
    const ownRoles = roles.filter(role => assigned.some(item => item.role_id === role.id))
    return <RoleList roles={roles} canManage={assigned.some(role => role.role_id === 'user_admin')} highestPriority={Math.min(...ownRoles.map(role => role.priority))} />
}
