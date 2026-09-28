import { emptyErrorEvents, getErrorEvents, getLogServices, getLogDashboard } from '@/utils/logs/getLogs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import LogsPageClient from './pageClient'

export type LogsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LogsPage({ searchParams, view = 'dashboard' }: LogsPageProps & { view?: 'dashboard' | 'realtime' | 'search' | 'errors' }) {
    const Cookies = await cookies()
    const params = await searchParams
    const serviceParam = Array.isArray(params?.service) ? params?.service[0] : params?.service
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/logs%26expired=true')
    }

    const [services, errors, dashboard] = await Promise.all([
        view === 'realtime' ? Promise.resolve([]) : getLogServices({ token, id }),
        view === 'dashboard' || view === 'errors' ? getErrorEvents({ token, id }) : Promise.resolve(emptyErrorEvents()),
        getLogDashboard({ token, id, view, params: params || {}, impersonationToken: Cookies.get('impersonation_token')?.value }),
    ])

    return (
        <DashboardPage className='gap-4 px-2 py-4'>
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
