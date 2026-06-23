'use client'

import { Info } from 'lucide-react'
import { useEffect, useState } from 'react'
import VMRow from './vm'
import getVMs from '@/utils/vms/fetch/getVMs'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import Tooltip from '../tooltip/tooltip'
import Link from 'next/link'
import { DashboardPanel } from '../dashboard/ui'

export default function VMs({ vms: serverVMs }: { vms: VM[] }) {
    const [vms, setVms] = useState<VM[]>(serverVMs || [])
    const router = useRouter()

    async function update() {
        const id = getCookie('id')
        const impersonatingId = getCookie('impersonating_id')
        if (id) {
            const updatedVMs = await getVMs(impersonatingId || id, undefined, id)
            setVms(updatedVMs)
        } else {
            return router.push('/login?path=/profile')
        }
    }

    useEffect(() => {
        update()
    }, [])

    return (
        <DashboardPanel className='grid min-h-42 content-start gap-3 p-4'>
            <div className='mb-1 flex items-center justify-between gap-3'>
                <div>
                    <h2 className='text-base font-semibold text-[#171a21]'>Virtual machines</h2>
                    <p className='mt-1 text-sm text-[#596170]'>{vms.length} managed target{vms.length === 1 ? '' : 's'}</p>
                </div>
                <Tooltip
                    align='right'
                    content={
                        <h1>
                            VMs are created automatically when you make new projects.
                            You can only manage them from this page.
                        </h1>
                    }
                >
                    <div className='p-px'>
                        <div className='flex min-w-full items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1'>
                            <Info className='h-3 w-3 stroke-blue-600' />
                            <span className='text-[0.7rem] font-semibold text-blue-700'>Managed</span>
                        </div>
                    </div>
                </Tooltip>
            </div>

            {vms.length > 0 ? (
                <div className='grid gap-2'>
                    {vms.map(vm => <VMRow update={update} key={vm.name} vm={vm} />)}
                </div>
            ) : (
                <div className='flex flex-wrap gap-x-1 text-sm text-[#596170]'>
                    <span>No managed VMs yet.</span>
                    <Link href='/s' className='font-semibold text-[#1f4fd8] underline underline-offset-4'>Create a project</Link>
                    <span>to provision one.</span>
                </div>
            )}
        </DashboardPanel>
    )
}
