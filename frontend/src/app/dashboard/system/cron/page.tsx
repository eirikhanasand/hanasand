import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import CronJobsClient from './pageClient'

export default async function Page() {
    const cookieStore = await cookies()
    const id = cookieStore.get('id')?.value || ''
    const token = cookieStore.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system/cron%26expired=true')
    }

    return (
        <DashboardPage className='h-full'>
            <DashboardHeader
                title='Cron jobs'
                description='Managed host schedules, health checks, and failover maintenance jobs.'
            />
            <CronJobsClient />
        </DashboardPage>
    )
}
