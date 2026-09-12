'use client'

import Link from 'next/link'
import { useState } from 'react'
import DeleteVmDialog from '../vms/deleteVmDialog'
import restoreVM from '@/utils/vms/fetch/restoreVM'
import { TerminalSquare } from 'lucide-react'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import deleteVM from '@/utils/vms/fetch/deleteVM'
import { ArrowRight, Cpu, HardDrive, Network, Trash2 } from 'lucide-react'
import Notify from '../notify/notify'
import prettyDate from '@/utils/date/prettyDate'
import formatDescription from '@/utils/vms/formatDescription'
import formatStatus from '@/utils/vms/formatStatus'
import { useRouter } from 'next/navigation'
import RestartButtons from '../vms/restartButtons'
import { vmActionStyle } from '../vms/actionStyle'

export default function VMRow({ vm, update }: { vm: VM, update: () => void }) {
    const router = useRouter()
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [busy, setBusy] = useState(false)
    const [deleteError, setDeleteError] = useState('')
    const deleted = Boolean(vm.deleted_at)
    const expired = Boolean(vm.delete_after && new Date(vm.delete_after).getTime() <= Date.now())
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const name = vm.name || 'Unnamed virtual machine'
    const ip = vm.device_eth0_ipv4_address || 'IP pending'
    const status = deleted ? 'Scheduled for deletion' : formatStatus(vm.status) || 'Syncing'
    const os = [vm.config_image_os, vm.config_image_version].filter(Boolean).join(' ')
    const image = os || formatDescription(vm.config_image_description)
    const lastUsed = vm.last_used ? prettyDate(vm.last_used) : vm.last_checked ? `Checked ${prettyDate(vm.last_checked)}` : 'Telemetry pending'
    const statusNote = (vm as VM & { status_reason?: string }).status_reason || ''
    const editors = vm.access_users?.length || 0

    function openDetails() {
        if (!vm.name) {
            setMessage('This virtual machine is missing its instance name.')
            return
        }
        router.push(`/vm/${vm.name}`)
    }

    async function handleDelete(confirmation: string) {
        if (!vm.name || busy) return
        setBusy(true)
        setDeleteError('')
        try {
            const result = await deleteVM(vm.name, confirmation)
            if (result.status === 200) setConfirmingDelete(false)
            else { setDeleteError(result.message); setMessage(result.message) }
            update()
        } finally { setBusy(false) }
    }

    async function handleRestore() {
        if (busy) return
        setBusy(true)
        try {
            const result = await restoreVM(name)
            setMessage(result.message)
            update()
        } finally { setBusy(false) }
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
                        {statusNote && <p className='mt-1 text-xs text-ui-muted'>{statusNote}</p>}
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
                            {!deleted && <Link href={`/vms/${encodeURIComponent(name)}/console`} aria-label={`Open ${name} console`} title='Open console' className={`${vmActionStyle} w-9 text-ui-primary`}>
                                <TerminalSquare className='h-4 w-4' />
                            </Link>}
                            {!deleted && <button
                                type='button'
                                onClick={openDetails}
                                className={`${vmActionStyle} px-3 text-ui-primary`}
                                data-vm-primary-action
                            >
                                Open details
                                <ArrowRight className='h-4 w-4' />
                            </button>}
                            {!deleted && <RestartButtons vm={vm} />}
                        </div>
                        {deleted && <div className='max-w-sm rounded-lg border border-ui-warning/35 bg-ui-warning/10 p-3 text-sm'>
                            <p>{expired ? 'Recovery period ended. Permanent deletion is pending.' : `Restore before ${new Date(vm.delete_after!).toLocaleString()}.`}</p>
                            <p className='mt-1 text-ui-muted'>{vm.deletion_error ? 'Dashboard access is blocked. The host is retrying the shutdown.' : 'The VM is disabled while scheduled for deletion.'}</p>
                            {vm.deletion_error && <p role='alert' className='mt-2 text-ui-danger'>The host operation failed: {vm.deletion_error}</p>}
                            <button type='button' disabled={busy || expired} onClick={() => void handleRestore()} className={`${vmActionStyle} mt-3 px-3 text-ui-primary`}>{busy ? 'Restoring…' : 'Restore VM'}</button>
                        </div>}
                        {!deleted && <details data-vm-danger-actions>
                            <summary className={`${vmActionStyle} w-full cursor-pointer list-none px-3 text-ui-primary [&::-webkit-details-marker]:hidden`}>
                                Danger actions
                            </summary>
                            <div className='pt-2'>
                                <button
                                    type='button'
                                    onClick={() => { setDeleteError(''); setConfirmingDelete(true) }}
                                    className={`${vmActionStyle} px-3 text-ui-danger`}
                                >
                                    <Trash2 className='h-4 w-4' />
                                    Delete VM
                                </button>
                            </div>
                        </details>}
                    </div>
                </div>
            </div>
            {confirmingDelete && <DeleteVmDialog name={name} busy={busy} error={deleteError} onCancel={() => setConfirmingDelete(false)} onConfirm={confirmation => void handleDelete(confirmation)} />}
            <div className='absolute top-2 right-2 z-1200'>
                <Notify className='px-4' message={message} />
            </div>
        </>
    )
}
