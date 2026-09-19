'use client'

import VMRow from '@/components/profile/vm'
import ErrorNotice from '@/components/error/errorNotice'
import Link from 'next/link'
import RestartButtons from '@/components/vms/restartButtons'
import { vmActionStyle } from '@/components/vms/actionStyle'
import { RefreshCcw, TerminalSquare } from 'lucide-react'
import smallDate from '@/utils/date/smallDate'
import VMDetails from '@/components/vms/vmDetails'
import VMAccess from '@/components/vms/vmAccess'
import useVMConnection from '@/components/vms/useVMConnection'
import VMHardware from '@/components/vms/vmHardware'
import VMNetwork from '@/components/vms/vmNetwork'
import VMOverview from '@/components/vms/vmOverview'
import { useState } from 'react'
import getVM from '@/utils/vms/fetch/getVM'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import getVMDetails from '@/utils/vms/fetch/metrics/getVMDetails'
import useVMMetrics from '@/components/vms/useVMMetrics'
import VMMetrics from '@/components/vms/vmMetrics'
import VMHostOptions from '@/components/vms/vmHostOptions'

type VMClientProps = {
    vm: VM
    details: VMDetails | null
    metrics: VMMetrics[]
    connection: VMConnectionDetails | null
}

export default function VMClient({ vm: serverVM, details: serverDetails, metrics: serverMetrics, connection: serverConnection }: VMClientProps) {
    const [vm, setVM] = useState<VM>(serverVM)
    const [details, setDetails] = useState(serverDetails)
    const [refreshing, setRefreshing] = useState(false)
    const [refreshError, setRefreshError] = useState<string | null>(null)
    const { metrics, error: metricsError, refresh: refreshMetrics } = useVMMetrics(serverVM.name, serverMetrics)
    const { connection, error: connectionError, refresh: refreshConnection } = useVMConnection(serverVM.name, serverConnection)
    const router = useRouter()
    const boxStyle = 'w-full rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'
    const boxTitleStyle = 'text-base font-medium text-ui-text'

    async function handleRefresh() {
        if (refreshing) return
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!id || !token) {
            return router.push(`/login?path=${encodeURIComponent(`/vms/${serverVM.name}`)}`)
        }
        setRefreshing(true)
        setRefreshError(null)
        try {
            const freshDetails = await getVMDetails(serverVM.name, token, id, true)
            if (!freshDetails || !freshDetails.last_checked) throw new Error('The VM host did not return updated details. Please try again.')
            // Use the refreshed snapshot in every card; retain ownership and host settings.
            setDetails(freshDetails)
            setVM(current => ({ ...current, ...freshDetails }))
            refreshConnection()
            refreshMetrics()
            const vmResponse = await getVM(serverVM.name)
            if (Array.isArray(vmResponse) && vmResponse.length) setVM({ ...vmResponse[0], ...freshDetails })
        } catch (error) {
            setRefreshError(error instanceof Error ? error.message : 'Unable to refresh VM details. Please try again.')
        } finally {
            setRefreshing(false)
        }
    }

    if (vm.deleted_at) return <VMRow vm={vm} update={() => void handleRefresh()} />

    return (
        <div className='grid gap-3'>
            <div className='flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                <div>
                    <p className='text-[10px] font-semibold uppercase tracking-[0.18em] text-ui-muted'>Virtual machine</p>
                    <h1 className='mt-1.5 text-xl font-medium text-ui-text sm:text-2xl'>{vm.name}</h1>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <RestartButtons vm={vm} onUpdated={() => void handleRefresh()} />
                    <Link href={`/vms/${encodeURIComponent(vm.name)}/console`} aria-label={`Open ${vm.name} console`} title='Open console' className={`${vmActionStyle} w-9 text-ui-primary`}><TerminalSquare className='h-4 w-4' /></Link>
                    <button
                        type='button'
                        aria-label='Refresh VM details'
                        aria-busy={refreshing}
                        disabled={refreshing}
                        className='group flex h-9 items-center justify-between gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-ui-muted transition hover:border-ui-primary hover:bg-ui-raised hover:text-ui-text'
                        onClick={handleRefresh}
                    >
                        <span className='text-sm'>{refreshing ? 'Refreshing…' : `Last checked ${smallDate(vm.last_checked)}`}</span>
                        <RefreshCcw className={`h-4 w-4 text-ui-primary ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>
            {refreshError && <ErrorNotice message={refreshError} actionLabel='Retry' onAction={() => void handleRefresh()} />}
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <VMOverview boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
                <VMHardware boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} />
                <VMNetwork boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
                <VMDetails boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} details={details} />
            </div>
            <div className='grid gap-3'>
                <VMHostOptions boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} onUpdate={setVM} />
                <VMAccess boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} connection={connection} error={connectionError} />
            </div>
            <div className='grid gap-3'>
                <VMMetrics boxStyle={boxStyle} boxTitleStyle={boxTitleStyle} vm={vm} metrics={metrics} error={metricsError} />
            </div>
        </div>
    )
}
