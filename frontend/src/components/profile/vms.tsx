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
        if (id) {
            const updatedVMs = await getVMs(id)
            setVms(updatedVMs)
        } else {
            return router.push('/login?internal=true&path=/profile')
        }
    }

    useEffect(() => {
        update()
    }, [])

    return (
        <DashboardPanel className='grid min-h-42 content-start gap-3 p-4'>
            <div className='mb-1 flex items-center justify-between gap-3'>
                <h2 className='text-base font-semibold text-bright/90'>Virtual Machines</h2>
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
                        <div className='flex min-w-full items-center gap-1 rounded-md border border-blue-300/30 bg-blue-400/12 px-2.5 py-1'>
                            <Info className='h-3 w-3 stroke-blue-400' />
                            <span className='text-[0.7rem] text-bright/62'>Managed</span>
                        </div>
                    </div>
                </Tooltip>
            </div>

            {vms.length > 0 ? (
                <div className='grid gap-2'>
                    {vms.map(vm => <VMRow update={update} key={vm.name} vm={vm} />)}
                </div>
            ) : (
                <div className='flex gap-1 text-sm text-bright/42'>
                    <span>No VMs found! Click</span>
                    <Link href='/s' className='text-bright/72 underline underline-offset-4'>here</Link>
                    <span>to create your first project.</span>
                </div>
            )}
        </DashboardPanel>
    )
}
