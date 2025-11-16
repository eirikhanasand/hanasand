import VMDetailClient from '@/components/vms/vmClientDetails'
import getVM from '@/utils/vms/getVM'
import getVMMetrics from '@/utils/vms/metrics/getVMMetrics'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id[0]
    const vm = await getVM(id)
    const metrics = await getVMMetrics(id)

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
