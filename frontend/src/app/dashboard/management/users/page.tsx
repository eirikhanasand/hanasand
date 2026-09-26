import Users from '@/components/users/users'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import getRoles from '@/utils/roles/getRoles'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { Shield, UserRound, UsersRound } from 'lucide-react'
import { isReservedPlaceholder } from '@/utils/users/isReservedPlaceholder'
import type { ReactNode } from 'react'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''
    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const [roles, users] = await Promise.all([
        getRoles({ id, token, cache: 'no-store' }),
        fetchUsersWithRoles({ id, token, cache: 'no-store' })
    ])
    void name
    const reservedCount = users.filter(isReservedPlaceholder).length
    const assignedUsers = users.filter((user) => user.highest_role_id).length
    const priorityRole = [...roles].sort((a, b) => a.priority - b.priority)[0]

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Admin'
                title='User management'
                description='User access, role coverage, reserved accounts, and support controls.'
            />
            <section className='grid gap-3 md:grid-cols-3'>
                <AdminMetric icon={<UsersRound className='h-4 w-4' />} label='Users' value={String(users.length)} detail={`${assignedUsers} with roles`} />
                <AdminMetric icon={<Shield className='h-4 w-4' />} label='Roles' value={String(roles.length)} detail={priorityRole ? `Highest: ${priorityRole.name}` : 'roles are ready'} />
                <AdminMetric icon={<UserRound className='h-4 w-4' />} label='Reserved' value={String(reservedCount)} detail='Reserved accounts' />
            </section>
            <Users roles={roles} initialUsers={users} />
        </DashboardPage>
    )
}

function AdminMetric({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return (
        <DashboardPanel className='border-ui-border bg-ui-panel p-3'>
            <div className='flex items-center justify-between gap-3'>
                <span className='text-sm text-ui-muted'>{label}</span>
                <span className='text-ui-muted'>{icon}</span>
            </div>
            <div className='mt-1 text-xl font-medium text-ui-text'>{value}</div>
            <p className='mt-1 text-xs text-ui-muted'>{detail}</p>
        </DashboardPanel>
    )
}
