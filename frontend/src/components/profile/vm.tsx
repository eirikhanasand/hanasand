'use client'
import useKeyPress from '@/hooks/keyPressed'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteVM from '@/utils/vms/fetch/deleteVM'
import { Trash2 } from 'lucide-react'
import Notify from '../notify/notify'
import prettyDate from '@/utils/date/prettyDate'
import formatDescription from '@/utils/vms/formatDescription'
import Tag from '../tags/tag'
import formatStatus from '@/utils/vms/formatStatus'
import { useRouter } from 'next/navigation'
import RestartButtons from '../vms/restartButtons'

export default function VMRow({ vm, update }: { vm: VM, update: () => void }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const type = vm.type === 'virtual-machine' ? 'VM' : 'Container'

    async function handleClick() {
        if (keys['shift']) {
            const result = await deleteVM(vm.name)
            if (result.status === 200) {
                update()
            } else {
                setMessage(result.message)
            }
        } else {
            router.push(`/dashboard/vm/${vm.name}`)
        }
    }

    return (
        <>
            <div
                onClick={handleClick}
                className={`rounded-lg group ${keys['shift']
                        ? 'hover:bg-red-500/10 hover:outline hover:outline-red-500/20 select-none'
                        : 'hover:bg-dark'
                    } cursor-pointer p-2 max-w-full overflow-hidden group gap-2 w-full justify-between items-center`}
            >
                <div className='flex w-full items-center gap-2 h-full'>
                    <div className='flex-1 overflow-auto grid gap-1'>
                        <div className='flex gap-2 items-center justify-between'>
                            <div className='flex gap-2 items-center'>
                                <div className='flex gap-2 items-center min-w-fit'>
                                    <h1 className='text-sm font-semibold text-bright/70'>{vm.name}</h1>
                                    <h1 className='text-almostbright text-xs pt-1'>
                                        {vm.device_eth0_ipv4_address}
                                    </h1>
                                </div>
                            </div>
                            <div className='flex gap-1 items-center w-fit'>
                                <Tag color='orange' text={formatDescription(vm.config_image_description)} />
                                <Tag color='green' icon='cpu' text={vm.limits_cpu} />
                                <Tag color='green' icon='ram' text={vm.limits_memory} />
                                <Tag color='blue' text={type} />
                            </div>
                        </div>
                        <div className='flex gap-1 text-almostbright/70 text-xs justify-between items-center'>
                            <div className='flex gap-1 items-center'>
                                <span>Owner: {vm.owner}</span>
                                <span className='font-bold'>·</span>
                                <span>Last used</span>
                                <span>{prettyDate(vm.last_used)}.</span>
                                <span>{vm.access_users.length}</span>
                                <span>editors.</span>
                            </div>
                            <div className='flex w-fit gap-1 items-center'>
                                <Tag 
                                    color='dynamic' 
                                    text={formatStatus(vm.status)} 
                                    map={{ 
                                        'stopped': { color: 'red', icon: 'error' },
                                        'idle': { color: 'yellow', icon: 'warning' },
                                        'running': { color: 'green', icon: 'success' },
                                    }}
                                />
                                <Tag color='blue' icon='refresh' text={vm.last_checked} date='minimal' />
                            </div>
                        </div>
                    </div>
                    {!keys['shift'] && <RestartButtons vm={vm} />}
                    {keys['shift'] && (
                        <div className='hidden group-hover:grid hover:bg-bright/3 rounded-md h-full px-3 place-items-center'>
                            <Trash2 className='stroke-red-500 w-5 h-5' />
                        </div>
                    )}
                </div>
            </div>
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' background='bg-dark' message={message} />
            </div>
        </>
    )
}
