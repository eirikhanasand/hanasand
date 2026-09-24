import { getErrorEvents, getLogServices, getLogDashboard } from '@/utils/logs/getLogs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import LogsPageClient from './pageClient'

export const dynamic = 'force-dynamic'

type LogsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
    const Cookies = await cookies()
    const params = await searchParams
    const serviceParam = Array.isArray(params?.service) ? params?.service[0] : params?.service
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/logs%26expired=true')
    }

    const [services, errors, dashboard] = await Promise.all([
        getLogServices({ token, id }),
        getErrorEvents({ token, id }),
        getLogDashboard({ token, id, params: params || {}, impersonationToken: Cookies.get('impersonation_token')?.value }),
    ])

    return (
        <DashboardPage className='gap-4 p-4 sm:p-5 lg:p-6'>
            <main className='grid gap-5' data-logs-dashboard>
                <LogsPageClient
                    initialData={dashboard.data}
                    initialError={dashboard.error}
                    initialServices={services}
                    initialErrors={errors}
                    initialServiceFilter={serviceParam || 'all'}
                />
            </main>
        </DashboardPage>
    )
}
