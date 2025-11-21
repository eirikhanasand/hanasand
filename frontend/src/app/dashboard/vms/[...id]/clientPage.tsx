'use client'

import { RefreshCcw } from 'lucide-react'
import smallDate from '@/utils/date/smallDate'
import VMDetails from '@/components/vms/vmDetails'
import VMHardware from '@/components/vms/vmHardware'
import VMNetwork from '@/components/vms/vmNetwork'
import VMOverview from '@/components/vms/vmOverview'
import { useState } from 'react'
import getVM from '@/utils/vms/fetch/getVM'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import getVMDetails from '@/utils/vms/fetch/metrics/getVMDetails'
import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import VMMetrics from '@/components/vms/vmMetrics'

type VMClientProps = {
    vm: VM
    details: VMDetails | null
    metrics: VMMetrics[]
}

export default function VMClient({ vm: serverVM, details: serverDetails, metrics: serverMetrics }: VMClientProps) {
    const [vm, setVM] = useState<VM>(serverVM)
    const [details, setDetails] = useState(serverDetails)
    const [metrics, setMetrics] = useState(serverMetrics)
    const router = useRouter()
    const boxStyle = 'outline outline-dark p-2 rounded-md w-full'
    const boxTitleStyle = 'text-lg font-semibold'

    async function handleRefresh() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!id || !token) {
            return router.push(`/logout?path=/login%3Fpath%3D/dashboard/vms/${id}%26expired=true`)
        }

        const vmResponse = await getVM(serverVM.name)
        if (Array.isArray(vmResponse) && vmResponse.length) {
            setVM(vmResponse[0])
        }

    
        const detailsResponse = await getVMDetails(serverVM.name, token, id)
        if (detailsResponse) {
            setDetails(detailsResponse)
        }

        const metricsResponse = await getVMMetrics(serverVM.name)
        if (metricsResponse) {
            setMetrics(metricsResponse)
        }
    }

    async function handleRestartVM(vmId: string) {
        await fetch(`/api/vm/${vmId}/restart`, { method: 'POST' })
    }

    return (
        <div className="grid gap-2">
            <div className='flex w-full justify-between'>
                <h1 className="font-semibold text-2xl">{vm.name}</h1>
                <div
                    className="flex justify-between items-center cursor-pointer gap-2 text-bright/80 rounded-md hover:bg-bright/5 px-3 group"
                    onClick={handleRefresh}
                >
                    <h1>Last checked {smallDate(vm.last_checked)}</h1>
                    <button className="group-hover:text-green-400">
                        <RefreshCcw className='w-5 h-5' />
                    </button>
                </div>
            </div>
            <div className='flex w-full justify-between gap-2'>
                <VMOverview boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
                <VMHardware boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} />
                <VMNetwork boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
                <VMDetails boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
            </div>
            <div className='flex w-full justify-between gap-2'>
                <VMMetrics boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} metrics={metrics} />
            </div>
        </div>
    )
}
