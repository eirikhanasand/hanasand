import { getLogs, getLogServices, getRealtimeLogs } from '@/utils/logs/getLogs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LogsPageClient from './pageClient'

export const dynamic = 'force-dynamic'

export default async function LogsPage() {
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    if (!token || !id) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/logs%26expired=true')
    }

    const [services, logs, realtime] = await Promise.all([
        getLogServices({ token, id }),
        getLogs({ token, id, level: 'error' }),
        getRealtimeLogs({ token, id }),
    ])

    return (
        <LogsPageClient
            id={id}
            token={token}
            initialServices={services}
            initialStoredLogs={logs}
            initialRealtime={realtime}
        />
    )
}
