'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { DatabaseBackup, RefreshCw, ShieldCheck } from 'lucide-react'
import type { BackupFile, BackupOperation, BackupService } from '@/utils/db/internal'
import { triggerBackupAction, verifyBackupAction } from '../actions'

type BackupPageProps = {
    backups: BackupService[]
    files: BackupFile[]
    loadError?: string
}

export default function BackupPage({ backups, files, loadError = '' }: BackupPageProps) {
    const service = backups[0]
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [verifying, setVerifying] = useState('')

    useEffect(() => {
        if (!service?.currentOperation) return
        const timer = window.setInterval(() => router.refresh(), 2000)
        return () => window.clearInterval(timer)
    }, [router, service?.currentOperation])

    function runBackup() {
        setMessage('')
        setError('')
        startTransition(async() => {
            const response = await triggerBackupAction()
            if (typeof response === 'string') setError(response)
            else setMessage(response.message)
            router.refresh()
        })
    }

    function verify(file: string) {
        setMessage('')
        setError('')
        setVerifying(file)
        startTransition(async() => {
            const response = await verifyBackupAction(file)
            if (typeof response === 'string') setError(response)
            else setMessage(response.message)
            setVerifying('')
            router.refresh()
        })
    }

    const busy = isPending || Boolean(service?.currentOperation)
    const visibleError = error || loadError || service?.error || ''

    return (
        <main className='mx-auto grid w-full max-w-7xl gap-4 p-4 sm:p-6' data-backup-operator-console>
            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' data-backup-primary-flow>
                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                    <div>
                        <div className='flex items-center gap-2'>
                            <DatabaseBackup className='h-5 w-5 text-ui-primary' />
                            <h1 className='text-xl font-semibold text-ui-text'>Database backup and recovery</h1>
                        </div>
                        <p className='mt-2 text-sm text-ui-muted'>Verified PostgreSQL archives, retention evidence, and isolated restore drills.</p>
                    </div>
                    <button
                        type='button'
                        onClick={runBackup}
                        disabled={busy}
                        className='inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60'
                        data-backup-primary-action
                    >
                        <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                        {service?.currentOperation ? stageLabel(service.currentOperation.stage) : isPending ? 'Running backup…' : 'Run verified backup'}
                    </button>
                </div>
                {visibleError && <p role='alert' className='mt-4 rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-3 text-sm text-ui-danger'>{visibleError}</p>}
                {message && <p role='status' className='mt-4 rounded-lg border border-ui-success/30 bg-ui-success/10 p-3 text-sm text-ui-success'>{message}</p>}
            </section>

            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-labelledby='backup-runtime-heading'>
                <div className='flex items-center justify-between gap-3'>
                    <h2 id='backup-runtime-heading' className='font-semibold text-ui-text'>Runtime evidence</h2>
                    <Status value={service?.status || 'Unavailable'} />
                </div>
                <dl className='mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4'>
                    <Evidence label='Last attempt' value={formatDate(service?.lastAttempt)} />
                    <Evidence label='Last success' value={formatDate(service?.lastSuccess)} />
                    <Evidence label='Last failure' value={formatDate(service?.lastFailure)} detail={service?.lastError || undefined} />
                    <Evidence label='Next automatic run' value={service?.scheduleEnabled ? formatDate(service.nextBackup) : 'Paused'} detail={service?.schedule ? `${service.schedule} ${service.scheduleTimezone || 'UTC'}` : undefined} />
                    <Evidence label='Storage target' value={service?.storageTarget || 'Not reported'} mono />
                    <Evidence label='Retention' value={service?.retention || 'Not reported'} detail={retentionLabel(service)} />
                    <Evidence label='Latest checksum' value={shortHash(service?.latestChecksum)} detail={service?.latestVerifiedAt ? `Verified ${formatDate(service.latestVerifiedAt)}` : 'No verification metadata'} mono />
                    <Evidence label='Release commit' value={shortHash(service?.releaseCommit)} mono />
                </dl>
            </section>

            <section className='overflow-hidden rounded-xl border border-ui-border bg-ui-panel' aria-labelledby='backup-files-heading'>
                <div className='flex flex-col gap-2 border-b border-ui-border p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
                    <div>
                        <h2 id='backup-files-heading' className='font-semibold text-ui-text'>Backup files</h2>
                        <p className='mt-1 text-sm text-ui-muted'>{files.length} archive{files.length === 1 ? '' : 's'} measured from {service?.storageTarget || 'configured storage'}.</p>
                    </div>
                    <Link href='/dashboard/db/restore' className='text-sm font-semibold text-ui-primary hover:underline'>Open restore drills</Link>
                </div>
                <div className='overflow-x-auto'>
                    <table className='min-w-[760px] w-full text-left text-sm'>
                        <thead className='bg-ui-raised text-xs uppercase text-ui-muted'>
                            <tr><th className='px-4 py-3'>Archive</th><th className='px-4 py-3'>Created</th><th className='px-4 py-3'>Size</th><th className='px-4 py-3'>Verification</th><th className='px-4 py-3 text-right'>Action</th></tr>
                        </thead>
                        <tbody className='divide-y divide-ui-border'>
                            {files.map(file => (
                                <tr key={file.file} className='text-ui-text'>
                                    <td className='px-4 py-3 font-mono text-xs'>{file.file}</td>
                                    <td className='px-4 py-3'>{formatDate(file.mtime)}</td>
                                    <td className='px-4 py-3'>{file.size || '—'}</td>
                                    <td className='px-4 py-3'>{file.verified ? <span className='inline-flex items-center gap-1 text-ui-success'><ShieldCheck className='h-4 w-4' /> {shortHash(file.checksumSha256)}</span> : <span className='text-ui-warning'>Unverified</span>}</td>
                                    <td className='px-4 py-3 text-right'>
                                        <button type='button' disabled={busy} onClick={() => verify(file.file)} className='min-h-9 rounded-md border border-ui-border px-3 font-semibold hover:bg-ui-raised disabled:opacity-50'>
                                            {verifying === file.file ? 'Verifying…' : 'Verify checksum'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {!files.length && <tr><td colSpan={5} className='px-4 py-8 text-center text-ui-muted'>No archive exists. Run the first verified backup.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>

            <OperationHistory operations={service?.operations || []} />
        </main>
    )
}

function OperationHistory({ operations }: { operations: BackupOperation[] }) {
    return (
        <section className='overflow-hidden rounded-xl border border-ui-border bg-ui-panel' aria-labelledby='backup-history-heading'>
            <div className='border-b border-ui-border p-4 sm:px-5'>
                <h2 id='backup-history-heading' className='font-semibold text-ui-text'>Persistent operation history</h2>
                <p className='mt-1 text-sm text-ui-muted'>Terminal failures and interrupted runs remain visible after restart.</p>
            </div>
            <div className='overflow-x-auto'>
                <table className='min-w-[760px] w-full text-left text-sm'>
                    <thead className='bg-ui-raised text-xs uppercase text-ui-muted'><tr><th className='px-4 py-3'>Started</th><th className='px-4 py-3'>Operation</th><th className='px-4 py-3'>Status</th><th className='px-4 py-3'>Duration</th><th className='px-4 py-3'>Evidence</th></tr></thead>
                    <tbody className='divide-y divide-ui-border'>
                        {operations.map(operation => (
                            <tr key={operation.id} className='text-ui-text'>
                                <td className='px-4 py-3'>{formatDate(operation.startedAt)}</td>
                                <td className='px-4 py-3'>{operationLabel(operation)}</td>
                                <td className='px-4 py-3'><Status value={operation.status} /></td>
                                <td className='px-4 py-3'>{formatDuration(operation.durationMs)}</td>
                                <td className='max-w-md px-4 py-3 text-ui-muted'>{operation.error || operation.file || stageLabel(operation.stage)}</td>
                            </tr>
                        ))}
                        {!operations.length && <tr><td colSpan={5} className='px-4 py-8 text-center text-ui-muted'>No operation has been attempted yet.</td></tr>}
                    </tbody>
                </table>
            </div>
        </section>
    )
}

function Evidence({ label, value, detail, mono = false }: { label: string, value: string, detail?: string, mono?: boolean }) {
    return <div className='min-w-0'><dt className='text-xs font-semibold uppercase text-ui-muted'>{label}</dt><dd className={`mt-1 wrap-break-word font-medium text-ui-text ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>{detail && <dd className='mt-1 wrap-break-word text-xs text-ui-muted'>{detail}</dd>}</div>
}

function Status({ value }: { value: string }) {
    const normalized = value.toLowerCase()
    const color = normalized === 'succeeded' || normalized === 'healthy' ? 'text-ui-success' : normalized === 'failed' || normalized === 'interrupted' || normalized === 'unavailable' ? 'text-ui-danger' : 'text-ui-warning'
    return <span className={`rounded-full border border-current/25 px-2 py-1 text-xs font-semibold capitalize ${color}`}>{value.replaceAll('_', ' ')}</span>
}

function retentionLabel(service?: BackupService) {
    const outcome = service?.retentionOutcome
    return outcome ? `Last pass examined ${outcome.examined}, deleted ${outcome.deleted}` : 'No completed retention pass yet'
}

function operationLabel(operation: BackupOperation) {
    if (operation.kind === 'restore_drill') return `Restore drill → ${operation.targetDatabase || 'isolated target'}`
    return `${operation.kind === 'backup' ? 'Backup' : 'Checksum verification'} · ${operation.trigger}`
}

function stageLabel(value: string) {
    return value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

function formatDate(value?: string | null) {
    if (!value) return 'Never'
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}

function formatDuration(value: number | null) {
    if (value === null) return '—'
    return value < 1000 ? `${value}ms` : `${Math.round(value / 1000)}s`
}

function shortHash(value?: string | null) {
    return value ? value.slice(0, 12) : 'Not reported'
}
