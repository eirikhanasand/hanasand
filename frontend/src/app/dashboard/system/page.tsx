import VmPage from '../vms/page'
import { canViewHostMetrics } from '@/utils/vms/hostAccess'
import ResiliencePanel from '@/components/system/resilience'
import DockerStoragePanel from '@/components/system/dockerStorage'
import { cookies } from 'next/headers'
import SystemDashboard from './clientPage'
import getSystemSnapshot from '@/utils/vms/fetch/getSystemSnapshot'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default async function page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/system%26expired=true')
    }

    if (!await canViewHostMetrics()) return <VmPage />

    const { systemTelemetry, dockerTelemetry, vms, vmMetrics } = await getSystemSnapshot(id, token)

    return (
        <DashboardPage className='h-full min-w-0 grid-cols-[minmax(0,1fr)] max-xl:[overflow-wrap:anywhere] max-xl:[&_*]:min-w-0'>
            <DashboardHeader
                title='System'
                description='Operate containers, host resources, and virtual machines from one live surface.'
            />
            <ResiliencePanel />
            <DockerStoragePanel />
            <SystemDashboard
                id={id}
                token={token}
                systemTelemetry={systemTelemetry}
                dockerTelemetry={dockerTelemetry}
                vms={vms}
                vmMetrics={vmMetrics}
            />
        </DashboardPage>
    )
}
