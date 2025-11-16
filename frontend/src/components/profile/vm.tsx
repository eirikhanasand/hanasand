'use client'
import useKeyPress from '@/hooks/keyPressed'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteVM from '@/utils/vms/deleteVM'
import { Trash2 } from 'lucide-react'
import Notify from '../notify/notify'
import prettyDate from '@/utils/prettyDate'

export default function VMRow({ vm, update }: { vm: VM, update: () => void }) {
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const keys = useKeyPress('shift')

    async function handleClick() {
        if (keys['shift']) {
            const result = await deleteVM(vm.id)
            if (result.status === 200) {
                update()
            } else {
                setMessage(result.message)
            }
        }
    }

    return (
        <>
            <div
                onClick={handleClick}
                className={`rounded-lg ${keys['shift']
                        ? 'hover:bg-red-500/10 hover:outline hover:outline-red-500/20 select-none'
                        : 'hover:bg-dark'
                    } cursor-pointer p-2 max-w-full overflow-hidden group gap-2 w-full justify-between items-center`}
            >
                <div className='flex w-full items-center'>
                    <div className='flex-1 overflow-auto'>
                        <div className='flex gap-2'>
                            <div className='flex gap-2 items-center max-h-5 min-w-fit'>
                                <h1 className='text-sm font-semibold text-bright/70'>{vm.name}</h1>
                            </div>
                            <h1 className='text-almostbright text-sm overflow-auto noscroll max-h-5 whitespace-nowrap'>{vm.vm_ip}</h1>
                        </div>
                        <div className='flex gap-1 text-almostbright/70 text-xs justify-between items-center'>
                            <div className='flex gap-1 items-center'>
                                <span>ID: {vm.id}</span>
                                <span className='font-bold'>·</span>
                                <span>Created</span>
                                <span>{prettyDate(vm.created_at)}</span>
                                <span>by</span>
                                <span>{vm.created_by}</span>
                                <span>Owner:</span>
                                <span>{vm.owner}</span>
                                <span>Access:</span>
                                <span>{vm.access_users.join(', ') || 'None'}</span>
                            </div>
                        </div>
                    </div>
                    {keys['shift'] && <Trash2 className='hidden group-hover:block group-hover:min-w-fit stroke-red-500 w-5 h-5' />}
                </div>
            </div>
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' background='bg-dark' message={message} />
            </div>
        </>
    )
}
