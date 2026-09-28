import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/ui'
import config from '@/config'
import LogsPageClient from './pageClient'
import type { Metrics } from './throughputMetrics'

export type LogsPageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}
type LogsPageRenderProps = LogsPageProps & { loadThroughputMetrics?: boolean }

export default async function LogsPage({ searchParams, loadThroughputMetrics = false }: LogsPageRenderProps) {
    const Cookies = await cookies()
    const params = await searchParams
    const serviceParam = Array.isArray(params?.service) ? params?.service[0] : params?.service
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/logs%26expired=true')
    }
    let initialMetrics: Metrics | null = null
    if (loadThroughputMetrics) {
        try {
            const response = await fetch(`${config.url.api}/logs/metrics/public`, { next: { revalidate: 5 }, signal: AbortSignal.timeout(1500) })
            if (response.ok) initialMetrics = await response.json() as Metrics
        } catch {
            // The dashboard can render while the shared metrics snapshot is being recovered.
        }
    }

    return (
        <DashboardPage className='gap-4 px-2 py-4'>
            <main className='grid gap-5' data-logs-dashboard>
                <LogsPageClient
                    initialServiceFilter={serviceParam || 'all'}
                    initialMetrics={initialMetrics}
                />
            </main>
        </DashboardPage>
    )
}
