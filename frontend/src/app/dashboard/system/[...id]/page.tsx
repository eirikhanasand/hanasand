import VMDetailClient from '@/components/vms/vmClientDetails'
import getVM from '@/utils/vms/fetch/getVM'
import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const userId = Cookies.get('id')?.value
    if (!userId || !token) {
        return redirect(`/logout?path=/login%3Fpath%3D/dashboard/system/${id}%26expired=true`)
    }

    const vmResponse = await getVM(id, token, userId)
    const vm = Array.isArray(vmResponse) && vmResponse.length ? vmResponse[0] : null
    const metrics = await getVMMetrics(id, token, userId)
    if (!vm) {
        return null
    }

    return (
        <div className="h-full px-8 pb-4 md:px-16 lg:px-32 space-y-6">
            <h1 className="font-semibold text-2xl">{vm.name} Management</h1>
            <VMDetailClient vm={vm} metrics={metrics} />
        </div>
    )
}
