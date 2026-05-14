import VMs from '@/components/profile/vms'
import { DashboardHeader, DashboardPage } from '@/components/dashboard/ui'
import getVMs from '@/utils/vms/fetch/getVMs'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page() {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const id = cookieStore.get('id')?.value
    const token = cookieStore.get('access_token')?.value
    const impersonatingId = cookieStore.get('impersonating_id')?.value || headerStore.get('x-impersonating-id') || ''
    const impersonationToken = cookieStore.get('impersonation_token')?.value || headerStore.get('x-impersonation-token') || ''

    if (!id || !token) {
        return redirect('/logout?path=/login%3Fpath%3D/dashboard/vms%26expired=true')
    }

    const effectiveId = impersonatingId || id
    const vms = await getVMs(effectiveId, token, id, impersonationToken)

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Virtual machines'
                title='Virtual Machines'
                description='Review managed project machines and open connection details.'
            />
            <div className='max-w-4xl'>
                <VMs vms={vms} />
            </div>
        </DashboardPage>
    )
}
