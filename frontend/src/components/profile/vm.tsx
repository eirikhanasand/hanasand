'use client'
import useKeyPress from '@/hooks/keyPressed'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteVM from '@/utils/vms/fetch/deleteVM'
import { Cpu, HardDrive, Network, Trash2 } from 'lucide-react'
import Notify from '../notify/notify'
import prettyDate from '@/utils/date/prettyDate'
import formatDescription from '@/utils/vms/formatDescription'
import formatStatus from '@/utils/vms/formatStatus'
import { useRouter } from 'next/navigation'
import RestartButtons from '../vms/restartButtons'

export default function VMRow({ vm, update }: { vm: VM, update: () => void }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const keys = useKeyPress('shift')
    const name = vm.name || 'Unnamed virtual machine'
    const ip = vm.device_eth0_ipv4_address || 'IP pending'
    const status = formatStatus(vm.status) || 'Syncing'
    const os = [vm.config_image_os, vm.config_image_version].filter(Boolean).join(' ')
    const image = os || formatDescription(vm.config_image_description)
    const lastUsed = vm.last_used ? prettyDate(vm.last_used) : vm.last_checked ? `Checked ${prettyDate(vm.last_checked)}` : 'Telemetry pending'
    const editors = vm.access_users?.length || 0

    async function handleClick() {
        if (keys['shift']) {
            const result = await deleteVM(vm.name)
            if (result.status === 200) {
                update()
            } else {
                setMessage(result.message)
            }
        } else {
            if (!vm.name) {
                setMessage('This virtual machine is missing its instance name.')
                return
            }
            router.push(`/dashboard/vm/${vm.name}`)
        }
    }

    return (
        <>
            <div
                onClick={handleClick}
                className={`group cursor-pointer rounded-lg border border-white/8 bg-white/[0.025] p-3 transition ${keys['shift']
                    ? 'select-none hover:border-red-400/30 hover:bg-red-500/10'
                    : 'hover:border-white/14 hover:bg-white/[0.045]'
                }`}
            >
                <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                    <div className='min-w-0'>
                        <div className='flex min-w-0 flex-wrap items-center gap-2'>
                            <h3 className='truncate text-sm font-medium text-bright/88'>{name}</h3>
                            <span className='rounded-md border border-white/8 bg-white/5 px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-bright/48'>Virtual machine</span>
                            <span className={`rounded-md px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] ${status === 'Running'
                                ? 'border border-green-300/20 bg-green-400/10 text-green-200/82'
                                : status === 'Stopped'
                                    ? 'border border-red-300/18 bg-red-400/10 text-red-200/78'
                                    : 'border border-yellow-300/18 bg-yellow-400/10 text-yellow-100/76'
                            }`}>{status}</span>
                        </div>
                        <p className='mt-1 truncate text-xs text-bright/42'>
                            {ip} · Owner {vm.owner || vm.created_by || 'Unknown'} · Last used {lastUsed} · {editors} editor{editors === 1 ? '' : 's'}
                        </p>
                        <div className='mt-3 flex min-w-0 flex-wrap gap-2 text-[0.72rem] text-bright/48'>
                            <span className='inline-flex items-center gap-1 rounded-md bg-white/[0.035] px-2 py-1'>
                                <HardDrive className='h-3 w-3' />
                                <span className='truncate'>{image}</span>
                            </span>
                            <span className='inline-flex items-center gap-1 rounded-md bg-white/[0.035] px-2 py-1'>
                                <Cpu className='h-3 w-3' />
                                <span>{vm.limits_cpu ? `${vm.limits_cpu} CPU` : 'CPU pending'}</span>
                            </span>
                            <span className='inline-flex items-center gap-1 rounded-md bg-white/[0.035] px-2 py-1'>
                                <Network className='h-3 w-3' />
                                <span>{vm.limits_memory || 'Memory pending'}</span>
                            </span>
                        </div>
                    </div>
                    {!keys['shift'] && <div className='min-w-0 justify-self-start sm:justify-self-end'><RestartButtons vm={vm} /></div>}
                    {keys['shift'] && (
                        <div className='hidden rounded-md px-3 py-2 group-hover:grid hover:bg-bright/3 sm:place-items-center'>
                            <Trash2 className='h-5 w-5 stroke-red-500' />
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
