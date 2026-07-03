import { cookies } from 'next/headers'
import SystemDashboard from './clientPage'
import getDockerContainers from '@/utils/vms/fetch/metrics/getDockerContainers'
import getSystemMetrics from '@/utils/vms/fetch/metrics/getSystemMetrics'
import getVMsMetrics from '@/utils/vms/fetch/metrics/getVMsMetrics'
import { redirect } from 'next/navigation'
import getVMList from '@/utils/vms/fetch/getVMList'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

export default async function page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true')
    }

    const [systemTelemetry, dockerTelemetry, vms, vmMetrics] = await Promise.all([
        getSystemMetrics({ id, token }),
        getDockerContainers({ id, token }),
        getVMList(id, token),
        getVMsMetrics({ id, token })
    ])

    return (
        <DashboardPage className='h-full'>
            <DashboardHeader
                title='System'
                description='Operate containers, host resources, and virtual machines from one live surface.'
            />
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
