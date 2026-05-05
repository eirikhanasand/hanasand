import { cookies } from 'next/headers'
import DashboardUser from './dashboardUser'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'
import { DashboardPanel } from '@/components/dashboard/ui'

export default async function Users({ roles }: { roles: Role[] }) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const users = await fetchUsersWithRoles({ id, token })

    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <div className='flex justify-between'>
                <h1 className='text-base font-semibold text-bright'>Users</h1>
            </div>
            {(users as UserWithRole[]).map((user) => <DashboardUser roles={roles} key={user.id} user={user} />)}
        </DashboardPanel>
    )
}
