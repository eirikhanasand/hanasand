import { cookies } from 'next/headers'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'
import { DashboardPanel } from '@/components/dashboard/ui'
import UsersList from './usersList'

export default async function Users({ roles, initialUsers }: { roles: Role[], initialUsers?: UserWithRole[] }) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const users = initialUsers || await fetchUsersWithRoles({ id, token })

    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <UsersList users={users as UserWithRole[]} roles={roles} />
        </DashboardPanel>
    )
}
