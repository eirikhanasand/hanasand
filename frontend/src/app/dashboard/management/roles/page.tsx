import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Roles from '@/components/roles/roles'
import { DashboardPage } from '@/components/dashboard/ui'
import getRoles from '@/utils/roles/getRoles'

export default async function Page() {
    const jar = await cookies()
    const id = jar.get('id')?.value
    const token = jar.get('access_token')?.value
    if (!id || !token) redirect('/login?path=/management/roles')
    const roles = await getRoles({ id, token, cache: 'no-store' })
    return <DashboardPage><Roles roles={roles} /></DashboardPage>
}
