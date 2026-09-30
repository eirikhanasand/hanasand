import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import HostsOverview from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect('/logout?path=/login%3Fpath%3D/system/hosts%26expired=true')
    }
    return <DashboardPage>
        <DashboardHeader title='Hosts' description='Inspur and OVH' />
        <HostsOverview />
    </DashboardPage>
}
