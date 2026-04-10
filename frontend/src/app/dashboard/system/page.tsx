import { cookies } from 'next/headers'
import SystemDashboard from './clientPage'
import getDockerContainers from '@/utils/vms/fetch/metrics/getDockerContainers'
import getSystemMetrics from '@/utils/vms/fetch/metrics/getSystemMetrics'
import getVMsMetrics from '@/utils/vms/fetch/metrics/getVMsMetrics'
import { redirect } from 'next/navigation'
import getVMList from '@/utils/vms/fetch/getVMList'

export default async function page() {
    const Cookies = await cookies()
    const id = Cookies.get('id')?.value || ''
    const token = Cookies.get('access_token')?.value || ''

    if (!id || !token) {
        return redirect(`/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true`)
    }

    const [system, dockerContainers, vms, vmMetrics] = await Promise.all([
        getSystemMetrics({ id, token }),
        getDockerContainers({ id, token }),
        getVMList(id, token),
        getVMsMetrics({ id, token })
    ])

    return (
        <div className="h-full px-8 pb-4 md:px-16 lg:px-32 space-y-6">
            <h1 className="font-semibold text-2xl text-bright/80">System Dashboard</h1>
            <SystemDashboard
                system={system}
                dockerContainers={dockerContainers}
                vms={vms}
                vmMetrics={vmMetrics}
            />
        </div>
    )
}
