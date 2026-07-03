'use client'

import { useMemo, useState, useTransition } from 'react'
import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { restoreBackupAction } from '../actions'
import { dashboardPanelClass } from '@/components/dashboard/ui'
import type { BackupFile } from '@/utils/db/internal'

type GroupedBackup = BackupFile & { locations: string[] }

function formatDate(value?: string | null) {
    if (!value) return 'Timestamp syncing'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function RestoreClient({ backups }: { backups: BackupFile[] }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const [serviceFilter, setServiceFilter] = useState(searchParams.get('service') || '')
    const [dateFilter, setDateFilter] = useState(searchParams.get('date') || '')
    const [message, setMessage] = useState('')
    const [restoring, setRestoring] = useState('')
    const [isPending, startTransition] = useTransition()

    const groupedBackups = useMemo(() => {
        const groups: Record<string, GroupedBackup> = {}
        backups.forEach((backup) => {
            const key = `${backup.service}-${backup.file}`
            if (!groups[key]) {
                groups[key] = { ...backup, locations: backup.location ? [backup.location] : [] }
                return
            }
            if (backup.location && !groups[key].locations.includes(backup.location)) {
                groups[key].locations.push(backup.location)
            }
        })
        return Object.values(groups)
    }, [backups])

    function updateParam(key: string, value: string) {
        const params = new URLSearchParams(searchParams.toString())
        if (value) params.set(key, value)
        else params.delete(key)
        router.push(`${pathname}?${params.toString()}`)
    }

    function handleRestore(backup: GroupedBackup) {
        const key = `${backup.service}-${backup.file}`
        setRestoring(key)
        startTransition(async () => {
            const response = await restoreBackupAction(backup.service, backup.file)
            setMessage(typeof response === 'string' ? response : response.message)
            setRestoring('')
        })
    }

    return (
        <div className='grid gap-4'>
            <div className='flex flex-wrap items-center gap-3'>
                <input
                    value={serviceFilter}
                    onChange={(event) => {
                        const value = event.target.value
                        setServiceFilter(value)
                        updateParam('service', value)
                    }}
                    placeholder='Filter by service'
                    className='min-w-60 rounded-lg border border-[#26344d] bg-[#101827] px-3 py-2 text-sm text-[#edf4ff] outline-none focus:border-[#7aa5ff]'
                />
                <input
                    type='date'
                    value={dateFilter}
                    onChange={(event) => {
                        const value = event.target.value
                        setDateFilter(value)
                        updateParam('date', value)
                    }}
                    className='rounded-lg border border-[#26344d] bg-[#101827] px-3 py-2 text-sm text-[#edf4ff] outline-none focus:border-[#7aa5ff]'
                />
                {message && <p className='text-sm text-[#aab7cc]'>{message}</p>}
            </div>

            <div className='grid gap-4'>
                {groupedBackups.map((backup) => {
                    const key = `${backup.service}-${backup.file}`
                    return (
                        <article key={key} className={`${dashboardPanelClass} p-5`}>
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                <div>
                                    <h2 className='text-lg font-semibold text-[#edf4ff]'>{backup.service}</h2>
                                    <p className='mt-1 text-sm text-[#aab7cc]'>{backup.file}</p>
                                </div>
                                <button
                                    type='button'
                                    onClick={() => handleRestore(backup)}
                                    disabled={isPending}
                                    className='inline-flex items-center gap-2 rounded-lg border border-[#5f86ff] bg-[#122449] px-3 py-2 text-sm font-semibold text-[#9db8ff] transition hover:bg-[#18305f] disabled:opacity-60'
                                >
                                    <RotateCcw className='h-4 w-4' />
                                    {restoring === key ? 'Restoring…' : 'Restore'}
                                </button>
                            </div>
                            <div className='mt-4 grid gap-3 text-sm text-[#aab7cc] md:grid-cols-3'>
                                <div className='rounded-lg border border-[#26344d] bg-[#0b121e] p-4'>
                                    <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Locations</p>
                                    <p className='mt-2 font-medium text-[#edf4ff]'>{backup.locations.join(', ') || 'Storage location syncing'}</p>
                                </div>
                                <div className='rounded-lg border border-[#26344d] bg-[#0b121e] p-4'>
                                    <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Modified</p>
                                    <p className='mt-2 font-medium text-[#edf4ff]'>{formatDate(backup.mtime)}</p>
                                </div>
                                <div className='rounded-lg border border-[#26344d] bg-[#0b121e] p-4'>
                                    <p className='text-xs font-semibold uppercase text-[#8fa0ba]'>Size</p>
                                    <p className='mt-2 font-medium text-[#edf4ff]'>{backup.size || 'Measuring size'}</p>
                                </div>
                            </div>
                        </article>
                    )
                })}
                {!groupedBackups.length && (
                    <article className={`${dashboardPanelClass} p-5 text-sm text-[#aab7cc]`}>
                        Restore file stream is clear for the current filters.
                    </article>
                )}
            </div>
        </div>
    )
}
