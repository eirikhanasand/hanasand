'use client'

import { Info, Minus, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import VMRow from './vm'
import getVMs from '@/utils/vms/getVMs'
import { getCookie } from '@/utils/cookies'
import { useRouter } from 'next/navigation'
import Tooltip from '../tooltip/tooltip'
import Link from 'next/link'

export default function VMs({ vms: serverVMs }: { vms: VM[] }) {
    const [vms, setVms] = useState<VM[]>(serverVMs || [])
    const router = useRouter()

    async function update() {
        const id = getCookie('id')
        if (id) {
            const updatedVMs = await getVMs(id)
            setVms(updatedVMs)
        } else {
            return router.push(`/login?internal=true&path=/profile`)
        }
    }

    useEffect(() => {
        update()
    }, [])

    return (
        <div className='grid h-fit w-full p-2 outline-1 outline-dark rounded-lg'>
            <div className='flex justify-between mb-2 items-center'>
                <h1 className='font-semibold text-lg self-center'>Virtual Machines</h1>
                <Tooltip
                    align='right'
                    content={
                        <h1>
                            VMs are created automatically when you make new projects.
                            You can only view them, give access to new users, or
                            delete them on this page.
                        </h1>
                    }
                >
                    <div className='p-[1px]'>
                        <div className="p-1 outline outline-blue-400/40 min-w-full bg-blue-400/20 rounded-md flex gap-1 items-center px-4">
                            <Info className="h-3 w-3 stroke-blue-400" />
                            <span className="text-white/70 text-[0.7rem]">Managed</span>
                        </div>
                    </div>
                </Tooltip>
            </div>

            {vms.length > 0 ? (
                vms.map(vm => <VMRow update={update} key={vm.id} vm={vm} />)
            ) : (
                <div className='flex gap-1 text-sm text-almostbright'>
                    <span>No VMs found! Click</span>
                    <Link href='/s' className='text-blue-500'>here</Link>
                    <span>to create your first project.</span>
                </div>
            )}
        </div>
    )
}
