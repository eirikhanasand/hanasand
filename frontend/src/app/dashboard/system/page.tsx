import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import { cookies } from 'next/headers'
import SystemDashboard from './clientPage'
import getDockerContainers from '@/utils/vms/fetch/metrics/getDockerContainers'
import getSystemMetrics from '@/utils/vms/fetch/metrics/getSystemMetrics'
import { redirect } from 'next/navigation'
import getVMList from '@/utils/vms/fetch/getVMList'

export default async function page() {
    const systemMetrics = await getSystemMetrics()
    const dockerContainers = await getDockerContainers()
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const id = Cookies.get('id')?.value
    if (!id || !token) {
        return redirect(`/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true`)
    }

    const vms = await getVMList(id, token)
    const vmMetrics = await getVMMetrics(id, token, id)

    return (
        <div className="h-full px-8 pb-4 md:px-16 lg:px-32 space-y-6">
            <h1 className="font-semibold text-2xl text-bright/80">System Dashboard</h1>
            <SystemDashboard
                systemMetrics={systemMetrics}
                dockerContainers={dockerContainers}
                vms={vms}
                vmMetrics={vmMetrics}
            />
        </div>
    )
}
