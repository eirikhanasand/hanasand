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
                className={`group cursor-pointer rounded-lg border border-ui-border bg-ui-raised p-3 transition ${keys['shift']
                    ? 'select-none hover:border-ui-danger/35 hover:bg-ui-danger/10'
                    : 'hover:border-ui-border hover:bg-ui-panel'
                }`}
            >
                <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'>
                    <div className='min-w-0'>
                        <div className='flex min-w-0 flex-wrap items-center gap-2'>
                            <h3 className='truncate text-sm font-semibold text-ui-text'>{name}</h3>
                            <span className='rounded-md border border-ui-border bg-ui-primary/10 px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-ui-muted'>Virtual machine</span>
                            <span className={`rounded-md px-2 py-0.5 text-[0.68rem] font-medium uppercase tracking-[0.08em] ${status === 'Running'
                                ? 'border border-ui-success/35 bg-ui-success/10 text-ui-success'
                                : status === 'Stopped'
                                    ? 'border border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
                                    : 'border border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
                            }`}>{status}</span>
                        </div>
                        <p className='mt-1 truncate text-xs text-ui-muted'>
                            {ip} · Owner {vm.owner || vm.created_by || 'Unknown'} · Last used {lastUsed} · {editors} editor{editors === 1 ? '' : 's'}
                        </p>
                        <div className='mt-3 flex min-w-0 flex-wrap gap-2 text-[0.72rem] text-ui-muted'>
                            <span className='inline-flex items-center gap-1 rounded-md border border-ui-border bg-ui-canvas px-2 py-1'>
                                <HardDrive className='h-3 w-3' />
                                <span className='truncate'>{image}</span>
                            </span>
                            <span className='inline-flex items-center gap-1 rounded-md border border-ui-border bg-ui-canvas px-2 py-1'>
                                <Cpu className='h-3 w-3' />
                                <span>{vm.limits_cpu ? `${vm.limits_cpu} CPU` : 'CPU pending'}</span>
                            </span>
                            <span className='inline-flex items-center gap-1 rounded-md border border-ui-border bg-ui-canvas px-2 py-1'>
                                <Network className='h-3 w-3' />
                                <span>{vm.limits_memory || 'Memory pending'}</span>
                            </span>
                        </div>
                    </div>
                    {!keys['shift'] && <div className='min-w-0 justify-self-start sm:justify-self-end'><RestartButtons vm={vm} /></div>}
                    {keys['shift'] && (
                        <div className='hidden rounded-md px-3 py-2 group-hover:grid hover:bg-ui-danger/10 sm:place-items-center'>
                            <Trash2 className='h-5 w-5 stroke-ui-danger' />
                        </div>
                    )}
                </div>
            </div>
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' message={message} />
            </div>
        </>
    )
}
