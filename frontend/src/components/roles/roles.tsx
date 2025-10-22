import { cookies } from 'next/headers'
import DashboardRole from './dashboardRole'
import fetchRoles from '@/utils/roles/fetchRoles'

export default async function Roles() {
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value || ''
    const id = Cookies.get('id')?.value || ''
    const roles = await fetchRoles({ id, token })

    return (
        <div className='grid w-full p-2 outline-1 outline-dark rounded-lg gap-2'>
            <div className='flex justify-between'>
                <h1 className='font-semibold text-lg self-center'>Roles</h1>
            </div>
            {(roles as Role[]).map((role) => <DashboardRole key={role.id} role={role} />)}
        </div>
    )
}
