import VmPage from '../vms/page'
import { canViewHostMetrics } from '@/utils/vms/hostAccess'
import DockerStoragePanel from '@/components/system/dockerStorage'
import { cookies } from 'next/headers'
import SystemDashboard from './clientPage'
import getSystemSnapshot from '@/utils/vms/fetch/getSystemSnapshot'
import { redirect } from 'next/navigation'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'

type SystemSection = 'overview' | 'virtual-machines' | 'containers'

const sectionDescriptions: Record<SystemSection, string> = {
    overview: 'Host health and storage.',
    'virtual-machines': 'Review virtual machines and their current status.',
    containers: 'Inspect Docker containers and their live details.',
}

export default async function SystemPageContent({ section }: { section: SystemSection }) {
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
            <DashboardHeader title='System' description={sectionDescriptions[section]} />
            {section === 'overview' ? <>
                <div id='system-overview-statistics-target' className='min-w-0 [&:empty]:hidden' />
                <DockerStoragePanel />
            </> : null}
            <SystemDashboard
                id={id}
                token={token}
                systemTelemetry={systemTelemetry}
                dockerTelemetry={dockerTelemetry}
                vms={vms}
                vmMetrics={vmMetrics}
                section={section}
            />
        </DashboardPage>
    )
}
