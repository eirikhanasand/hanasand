import { getErrorEvents, getLogs, getLogServices, getRealtimeLogs } from '@/utils/logs/getLogs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
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
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/logs%26expired=true')
    }

    const [services, logs, realtime, errors] = await Promise.all([
        getLogServices({ token, id }),
        getLogs({ token, id, level: 'error' }),
        getRealtimeLogs({ token, id }),
        getErrorEvents({ token, id }),
    ])

    return (
        <DashboardPage className='gap-4 p-4 sm:p-5 lg:p-6'>
            <main className='grid gap-5' data-logs-dashboard>
                <DashboardHeader
                    eyebrow='Operations'
                    title='Logs'
                    description='Live runtime output, native host signals, and stored error records for production operations.'
                />
                <LogsPageClient
                    id={id}
                    token={token}
                    initialServices={services}
                    initialStoredLogs={logs}
                    initialRealtime={realtime}
                    initialErrors={errors}
                    initialServiceFilter={serviceParam || 'all'}
                />
            </main>
        </DashboardPage>
    )
}
