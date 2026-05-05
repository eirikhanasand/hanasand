'use client'

import { RefreshCcw } from 'lucide-react'
import smallDate from '@/utils/date/smallDate'
import VMDetails from '@/components/vms/vmDetails'
import VMAccess from '@/components/vms/vmAccess'
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
    connection: VMConnectionDetails | null
}

export default function VMClient({ vm: serverVM, details: serverDetails, metrics: serverMetrics, connection: serverConnection }: VMClientProps) {
    const [vm, setVM] = useState<VM>(serverVM)
    const [details, setDetails] = useState(serverDetails)
    const [metrics, setMetrics] = useState(serverMetrics)
    const [connection] = useState(serverConnection)
    const router = useRouter()
    const boxStyle = 'w-full rounded-xl border border-white/10 bg-white/[0.035] p-4'
    const boxTitleStyle = 'text-base font-semibold text-bright'

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

        const metricsResponse = await getVMMetrics(serverVM.name, token, id)
        if (metricsResponse) {
            setMetrics(metricsResponse)
        }
    }

    return (
        <div className='grid gap-3'>
            <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.28em] text-bright/32'>Virtual machine</p>
                    <h1 className='mt-1.5 text-xl font-semibold text-bright sm:text-2xl'>{vm.name}</h1>
                </div>
                <div
                    className='group flex h-9 cursor-pointer items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-bright/70 hover:bg-white/10'
                    onClick={handleRefresh}
                >
                    <h1 className='text-sm'>Last checked {smallDate(vm.last_checked)}</h1>
                    <button className='group-hover:cursor-pointer group-hover:text-bright'>
                        <RefreshCcw className='w-4 h-4' />
                    </button>
                </div>
            </div>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <VMOverview boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
                <VMHardware boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} />
                <VMNetwork boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
                <VMDetails boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
            </div>
            <div className='grid gap-3'>
                <VMAccess boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} connection={connection} />
            </div>
            <div className='grid gap-3'>
                <VMMetrics boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} metrics={metrics} />
            </div>
        </div>
    )
}
