import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import HostSshKeysClient from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect('/logout?path=/login%3Fpath%3D/system/ssh-keys%26expired=true')
    }
    return <DashboardPage>
        <DashboardHeader title='SSH keys' description='Manage SSH access to Hanasand and Inspur.' />
        <HostSshKeysClient />
    </DashboardPage>
}
