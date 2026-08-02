import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import AptUpdatesClient from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    if (!cookieStore.get('id')?.value || !cookieStore.get('access_token')?.value) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/updates%26expired=true')
    }
    return <DashboardPage className='h-full'><DashboardHeader title='Host updates' description='Monitor Ubuntu updates on the hanasand host with a three-day review window for regular packages and immediate installation for verified Ubuntu security updates.' /><AptUpdatesClient /></DashboardPage>
}
