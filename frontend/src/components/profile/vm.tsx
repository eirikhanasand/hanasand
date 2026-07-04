'use client'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteVM from '@/utils/vms/fetch/deleteVM'
import { ArrowRight, Cpu, HardDrive, Network, Trash2 } from 'lucide-react'
import Notify from '../notify/notify'
import prettyDate from '@/utils/date/prettyDate'
import formatDescription from '@/utils/vms/formatDescription'
import formatStatus from '@/utils/vms/formatStatus'
import { useRouter } from 'next/navigation'
import RestartButtons from '../vms/restartButtons'

export default function VMRow({ vm, update }: { vm: VM, update: () => void }) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const name = vm.name || 'Unnamed virtual machine'
    const ip = vm.device_eth0_ipv4_address || 'IP pending'
    const status = formatStatus(vm.status) || 'Syncing'
    const os = [vm.config_image_os, vm.config_image_version].filter(Boolean).join(' ')
    const image = os || formatDescription(vm.config_image_description)
    const lastUsed = vm.last_used ? prettyDate(vm.last_used) : vm.last_checked ? `Checked ${prettyDate(vm.last_checked)}` : 'Telemetry pending'
    const editors = vm.access_users?.length || 0

    function openDetails() {
        if (!vm.name) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        router.push(`/dashboard/vm/${vm.name}`)
    }

    async function handleDelete() {
        if (!vm.name) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        const result = await deleteVM(vm.name)
        if (result.status === 200) {
            update()
        } else {
            setMessage(result.message)
        }
    }

    return (
        <>
            <div
                className='rounded-lg border border-ui-border bg-ui-raised p-3 transition hover:border-ui-border hover:bg-ui-panel'
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
                    <div className='grid min-w-0 gap-2 justify-self-start sm:justify-self-end'>
                        <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
                            <button
                                type='button'
                                onClick={openDetails}
                                className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary hover:bg-ui-raised'
                                data-vm-primary-action
                            >
                                Open details
                                <ArrowRight className='h-4 w-4' />
                            </button>
                            <RestartButtons vm={vm} />
                        </div>
                        <details className='rounded-md border border-ui-border bg-ui-panel' data-vm-danger-actions>
                            <summary className='cursor-pointer list-none px-3 py-2 text-xs font-semibold text-ui-muted transition hover:bg-ui-raised [&::-webkit-details-marker]:hidden'>
                                Danger actions
                            </summary>
                            <div className='border-t border-ui-border p-2'>
                                <button
                                    type='button'
                                    onClick={() => void handleDelete()}
                                    className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-danger/35 bg-ui-danger/10 px-3 text-sm font-semibold text-ui-danger transition hover:bg-ui-danger/15'
                                >
                                    <Trash2 className='h-4 w-4' />
                                    Delete VM
                                </button>
                            </div>
                        </details>
                    </div>
                </div>
            </div>
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' message={message} />
            </div>
        </>
    )
}
