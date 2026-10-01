'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { DatabaseZap, TriangleAlert } from 'lucide-react'
import type { BackupFile, BackupOperation, BackupService } from '@/utils/db/internal'
import formatUtcDateTime from '@/utils/date/formatUtcDateTime'
import { restoreLiveBackupAction } from '../actions'

export default function LiveRestoreClient({ backups, service, file, loadError = '' }: { backups: BackupFile[], service?: BackupService, file: string, loadError?: string }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [confirmation, setConfirmation] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [result, setResult] = useState<BackupOperation | null>(null)
    const selected = backups.find(backup => backup.file === file)
    const activeOperation = service?.currentOperation || null
    const activeRestore = activeOperation?.kind === 'restore_live' ? activeOperation : null
    const targetDatabase = service?.database || ''
    const requiredConfirmation = targetDatabase ? `RESTORE ${targetDatabase}` : ''

    useEffect(() => {
        if (!isPending && !activeOperation) return
        const timer = window.setInterval(() => router.refresh(), 1500)
        return () => window.clearInterval(timer)
    }, [activeOperation, isPending, router])

    function runRestore() {
        if (!selected) return
        setMessage('')
        setError('')
        setResult(null)
        startTransition(async() => {
            const response = await restoreLiveBackupAction(selected.file, confirmation)
            if (typeof response === 'string') setError(response)
            else {
                setMessage(response.message)
                setResult(response.operation)
            }
            router.refresh()
        })
    }

    const canRun = Boolean(selected && targetDatabase && confirmation === requiredConfirmation && !isPending && !activeOperation)
    const visibleError = error || loadError
    const visibleOperation = activeRestore || result

    return (
        <main className='grid w-full gap-4 px-2 py-4' data-live-restore-console>
            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5'>
                <div className='flex items-center gap-2'>
                    <DatabaseZap className='h-5 w-5 text-ui-primary' />
                    <h1 className='text-xl font-semibold text-ui-text'>Restore live database</h1>
                </div>
                <p className='mt-2 text-sm text-ui-muted'>This replaces all data in {targetDatabase || 'the live database'} with the selected backup. Database requests may briefly fail while it switches.</p>
                <div className='mt-4 flex items-start gap-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-3 text-sm text-ui-warning'>
                    <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
                    <p>Choose the intended archive carefully. Type <code className='font-mono'>{requiredConfirmation || 'RESTORE database-name'}</code> to continue.</p>
                </div>
            </section>

            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-labelledby='live-restore-controls-heading'>
                <div className='flex items-center justify-between gap-3'>
                    <h2 id='live-restore-controls-heading' className='font-semibold text-ui-text'>Restore target</h2>
                    <Link href='/db/backups' className='text-sm font-semibold text-ui-primary hover:underline'>Back to backups</Link>
                </div>
                {selected ? (
                    <dl className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm sm:grid-cols-2'>
                        <Evidence label='Database' value={targetDatabase || 'Unavailable'} />
                        <Evidence label='Backup archive' value={selected.file} mono />
                        <Evidence label='Created' value={formatUtcDateTime(selected.mtime, 'Unknown')} />
                        <Evidence label='Size' value={selected.size || 'Not reported'} />
                        <Evidence label='Checksum' value={selected.checksumSha256 || (selected.verified ? 'Verified' : 'Verified during restore')} mono />
                    </dl>
                ) : (
                    <p role='alert' className='mt-4 rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-3 text-sm text-ui-text'>This backup archive is unavailable. Return to the backup list and select an available archive.</p>
                )}

                <label className='mt-4 grid gap-1.5 text-sm font-medium text-ui-text'>
                    Type <code className='font-mono text-ui-primary'>{requiredConfirmation || 'RESTORE database-name'}</code> to confirm
                    <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete='off' spellCheck={false} disabled={!targetDatabase} placeholder={requiredConfirmation || 'RESTORE database-name'} className='min-h-11 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-sm disabled:opacity-50' />
                </label>

                <button type='button' onClick={runRestore} disabled={!canRun} className='mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ui-danger px-4 text-sm font-semibold text-ui-canvas disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto' data-live-restore-action>
                    {activeRestore ? stageLabel(activeRestore.stage) : isPending ? 'Restoring database…' : 'Restore database'}
                </button>
                {visibleError && <p role='alert' className='mt-4 rounded-lg border border-ui-danger/30 bg-ui-raised/10 p-3 text-sm text-ui-text'>{visibleError}</p>}
                {message && <p role='status' className='mt-4 rounded-lg border border-ui-success/30 bg-ui-success/10 p-3 text-sm text-ui-success'>{message}</p>}
            </section>

            {visibleOperation && <RestoreEvidence operation={visibleOperation} />}
        </main>
    )
}

function RestoreEvidence({ operation }: { operation: BackupOperation }) {
    const stages = ['verifying_archive', 'creating_restore_database', 'restoring', 'checking_integrity', 'switching_live_database', 'removing_previous_database']
    return (
        <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-live='polite'>
            <div className='flex items-center justify-between gap-3'><h2 className='font-semibold text-ui-text'>Restore progress</h2><span className='capitalize text-ui-muted'>{operation.status}</span></div>
            <ol className='mt-4 grid gap-2 text-sm sm:grid-cols-3 xl:grid-cols-6'>
                {stages.map(stage => <li key={stage} className={`rounded-lg border p-2 ${operation.stage === stage ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border text-ui-muted'}`}>{stageLabel(stage)}</li>)}
            </ol>
            {operation.status === 'succeeded' && <p className='mt-4 text-sm text-ui-success'>{operation.restoredIntegrity?.schemas || 0} schemas and {operation.restoredIntegrity?.tables || 0} tables restored into {operation.targetDatabase}.</p>}
            {operation.error && <p className='mt-4 text-sm text-ui-text'>{operation.error}</p>}
        </section>
    )
}

function Evidence({ label, value, mono = false }: { label: string, value: string, mono?: boolean }) {
    return <div className='min-w-0'><dt className='text-xs font-semibold uppercase text-ui-muted'>{label}</dt><dd className={`mt-1 break-all text-ui-text ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd></div>
}

function stageLabel(value: string) {
    return value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}
