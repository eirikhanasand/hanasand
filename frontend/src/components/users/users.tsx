import { cookies } from 'next/headers'
import DashboardUser from './dashboardUser'
import fetchUsersWithRoles from '@/utils/users/fetchUsersWithRoles'

export default async function Users({ roles }: { roles: Role[] }) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const users = await fetchUsersWithRoles({ id, token })

    return (
        <section className='grid h-fit min-w-0 w-full gap-2 rounded-xl border border-white/10 bg-white/4 p-4'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Users</h1>
            </div>
            {(users as UserWithRole[]).map((user) => <DashboardUser roles={roles} key={user.id} user={user} />)}
        </section>
    )
}
