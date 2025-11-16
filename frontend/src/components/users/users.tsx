import { cookies } from 'next/headers'
import DashboardUser from './dashboardUser'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'

export default async function Users({ roles }: { roles: Role[] }) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const users = await fetchUsersWithRoles({ id, token })

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Users</h1>
            </div>
            {(users as UserWithRole[]).map((user) => <DashboardUser roles={roles} key={user.id} user={user} />)}
        </div>
    )
}
