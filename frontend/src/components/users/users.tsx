import { cookies } from 'next/headers'
import fetchUsers from '@/utils/users/fetchUsers'
import { DashboardPanel } from '@/components/dashboard/ui'
import UsersList from './usersList'

export default async function Users({ initialUsers }: { initialUsers?: User[] }) {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value
    const users = initialUsers || await fetchUsers({ id, token })

    return (
        <DashboardPanel className='grid h-fit min-w-0 w-full gap-2 p-4'>
            <UsersList users={users} />
        </DashboardPanel>
    )
}
