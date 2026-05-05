import DashboardArticles from '@/components/articles/dashboardArticles'
import Roles from '@/components/roles/roles'
import Thoughts from '@/components/thoughts/thoughts'
import Users from '@/components/users/users'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import getRoles from '@/utils/roles/getRoles'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default async function Page() {
    const Cookies = await cookies()
    const name = Cookies.get('name')?.value
    const id = Cookies.get('id')?.value
    const token = Cookies.get('access_token')?.value || ''
    if (!name || !id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard%26expired=true')
    }

    const roles = await getRoles({ id, token })
    void name

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Admin'
                title='Management'
                description='Users, roles, articles, and thoughts.'
            />
            <div className='grid gap-3 xl:grid-cols-2 xl:items-start'>
                <DashboardArticles />
                <Thoughts />
                <Users roles={roles} />
                <Roles roles={roles} />
            </div>
        </DashboardPage>
    )
}
