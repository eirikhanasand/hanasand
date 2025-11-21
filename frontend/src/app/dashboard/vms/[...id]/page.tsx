import getVM from '@/utils/vms/fetch/getVM'
import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import VMClient from './clientPage'
import getVMDetails from '@/utils/vms/fetch/metrics/getVMDetails'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const userId = Cookies.get('id')?.value
    if (!userId || !token) {
        return redirect(`/logout?path=/login%3Fpath%3D/dashboard/vms/${id}%26expired=true`)
    }

    const vmResponse = await getVM(id, token, userId)
    const details = await getVMDetails(id, token, userId)
    const metrics = await getVMMetrics(id, token, userId)
    const vm = Array.isArray(vmResponse) && vmResponse.length ? vmResponse[0] : null
    if (!vm) {
        return null
    }

    return (
        <div className="h-full px-8 pb-4 md:px-16 lg:px-32 space-y-6">
            <VMClient vm={vm} details={details} metrics={metrics} />
        </div>
    )
}
