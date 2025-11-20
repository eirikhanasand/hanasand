import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import getVMs from '@/utils/vms/fetch/getVMs'
import { cookies } from 'next/headers'
import SystemDashboard from './clientPage'
import getDockerContainers from '@/utils/vms/fetch/metrics/getDockerContainers'
import getSystemMetrics from '@/utils/vms/fetch/metrics/getSystemMetrics'

export default async function page() {
    const systemMetrics = await getSystemMetrics()
    const dockerContainers = await getDockerContainers()
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value || ''
    const vms = await getVMs(id)
    const vmMetrics = await getVMMetrics(id)

    return (
        <div className="h-full px-8 pb-4 md:px-16 lg:px-32 space-y-6">
            <h1 className="font-semibold text-2xl">System Dashboard</h1>
            <SystemDashboard
                systemMetrics={systemMetrics}
                dockerContainers={dockerContainers}
                vms={vms}
                vmMetrics={vmMetrics}
            />
        </div>
    )
}
