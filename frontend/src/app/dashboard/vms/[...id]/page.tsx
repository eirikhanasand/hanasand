import getVM from '@/utils/vms/fetch/getVM'
import getVMMetrics from '@/utils/vms/fetch/metrics/getVMMetrics'
import VMClient from './clientPage'
import getVMDetails from '@/utils/vms/fetch/metrics/getVMDetails'
import getVMConnection from '@/utils/vms/fetch/getVMConnection'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, RefreshCcw } from 'lucide-react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'

export default async function Page(props: { params: Promise<{ id: string[] }> }) {
    const params = await props.params
    const id = params.id.join('/')
    const Cookies = await cookies()
    const token = Cookies.get('access_token')?.value
    const userId = Cookies.get('id')?.value
    if (!userId || !token) {
        return redirect(`/logout?path=/login%3Fpath%3D/dashboard/vms/${id}%26expired=true`)
    }

    const vmResponse = await getVM(id, token, userId)
    const details = await getVMDetails(id, token, userId)
    const metrics = await getVMMetrics(id, token, userId)
    const connection = await getVMConnection(id, token, userId)
    const vm = Array.isArray(vmResponse) && vmResponse.length ? vmResponse[0] : null
    if (!vm) {
        return (
            <DashboardPage>
                <DashboardHeader
                    eyebrow='Virtual machines'
                    title='VM detail unavailable'
                    description={`The console could not load "${id}". The machine may have been deleted, renamed, or the VM API may be reconnecting.`}
                    actions={(
                        <Link href='/dashboard/vms' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                            <ArrowLeft className='h-4 w-4' />
                            Back to VMs
                        </Link>
                    )}
                />
                <DashboardPanel className='grid gap-4 p-5'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Next safe action</h2>
                        <p className='mt-2 max-w-2xl text-sm leading-6 text-ui-muted'>
                            Reopen the VM inventory to confirm the current machine name and status. If the machine still appears there, refresh this detail route after the metrics service reconnects.
                        </p>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <Link href='/dashboard/vms' className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                            <ArrowLeft className='h-4 w-4' />
                            Open inventory
                        </Link>
                        <Link href={`/dashboard/vms/${params.id.map(segment => encodeURIComponent(segment)).join('/')}`} className='inline-flex h-10 items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                            <RefreshCcw className='h-4 w-4' />
                            Retry detail
                        </Link>
                    </div>
                </DashboardPanel>
            </DashboardPage>
        )
    }

    return (
        <DashboardPage>
            <VMClient
                vm={vm}
                details={details}
                metrics={metrics}
                connection={connection}
            />
        </DashboardPage>
    )
}
