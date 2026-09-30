import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import HostConsoleClient from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect('/logout?path=/login%3Fpath%3D/system/console%26expired=true')
    }
    return <DashboardPage className='h-full'><HostConsoleClient /></DashboardPage>
}
