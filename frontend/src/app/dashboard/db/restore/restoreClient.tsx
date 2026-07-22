'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { DatabaseZap, ShieldCheck, TriangleAlert } from 'lucide-react'
import type { BackupFile, BackupOperation, BackupService } from '@/utils/db/internal'
import { restoreBackupAction } from '../actions'

export default function RestoreClient({ backups, service, loadError = '' }: { backups: BackupFile[], service?: BackupService, loadError?: string }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [file, setFile] = useState(backups[0]?.file || '')
    const [target, setTarget] = useState(defaultTarget())
    const [confirmation, setConfirmation] = useState('')
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const [result, setResult] = useState<BackupOperation | null>(null)
    const selected = backups.find(backup => backup.file === file)
    const activeDrill = service?.currentOperation?.kind === 'restore_drill' ? service.currentOperation : null
    const drillHistory = useMemo(() => (service?.operations || []).filter(operation => operation.kind === 'restore_drill'), [service?.operations])

    useEffect(() => {
        if (!isPending && !activeDrill) return
        const timer = window.setInterval(() => router.refresh(), 1500)
        return () => window.clearInterval(timer)
    }, [activeDrill, isPending, router])

    function runDrill() {
        setMessage('')
        setError('')
        setResult(null)
        startTransition(async() => {
            const response = await restoreBackupAction(file, target, confirmation)
            if (typeof response === 'string') setError(response)
            else {
                setMessage(response.message)
                setResult(response.operation)
            }
            router.refresh()
        })
    }

    const requiredConfirmation = `RESTORE ${target.trim().toLowerCase()}`
    const canRun = Boolean(file && /^restore_drill_[a-z0-9_]{1,48}$/.test(target) && confirmation === requiredConfirmation && !isPending && !service?.currentOperation)
    const visibleError = error || loadError

    return (
        <main className='mx-auto grid w-full max-w-6xl gap-4 p-4 sm:p-6' data-restore-operator-console>
            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5'>
                <div className='flex items-center gap-2'>
                    <DatabaseZap className='h-5 w-5 text-ui-primary' />
                    <h1 className='text-xl font-semibold text-ui-text'>Isolated restore drill</h1>
                </div>
                <p className='mt-2 text-sm text-ui-muted'>Verify an archive, restore it into a temporary database, check its table shape, and remove the temporary target. This workflow never restores over the live database.</p>
                <div className='mt-4 flex items-start gap-2 rounded-lg border border-ui-warning/30 bg-ui-warning/10 p-3 text-sm text-ui-warning'>
                    <TriangleAlert className='mt-0.5 h-4 w-4 shrink-0' />
                    <p>The target must begin with <code className='font-mono'>restore_drill_</code>. The API rejects the live database name and records failures durably.</p>
                </div>
            </section>

            <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-labelledby='restore-controls-heading'>
                <div className='flex items-center justify-between gap-3'>
                    <h2 id='restore-controls-heading' className='font-semibold text-ui-text'>Drill controls</h2>
                    <Link href='/dashboard/db/backups' className='text-sm font-semibold text-ui-primary hover:underline'>Back to backups</Link>
                </div>
                <div className='mt-4 grid gap-4'>
                    <label className='grid gap-1.5 text-sm font-medium text-ui-text'>
                        Backup archive
                        <select value={file} onChange={event => setFile(event.target.value)} className='min-h-11 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-xs'>
                            <option value=''>Select a real archive</option>
                            {backups.map(backup => <option key={backup.file} value={backup.file}>{backup.file} · {backup.size || 'size unknown'} · {backup.verified ? 'verified' : 'verify during drill'}</option>)}
                        </select>
                    </label>
                    <label className='grid gap-1.5 text-sm font-medium text-ui-text'>
                        Isolated target database
                        <input value={target} onChange={event => { setTarget(event.target.value.toLowerCase()); setConfirmation('') }} spellCheck={false} className='min-h-11 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-sm' />
                        <span className='text-xs font-normal text-ui-muted'>Lowercase letters, numbers, and underscores only; maximum 62 characters.</span>
                    </label>
                    <label className='grid gap-1.5 text-sm font-medium text-ui-text'>
                        Type <code className='font-mono text-ui-primary'>{requiredConfirmation}</code> to confirm
                        <input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete='off' spellCheck={false} placeholder={requiredConfirmation} className='min-h-11 rounded-lg border border-ui-border bg-ui-raised px-3 font-mono text-sm' />
                    </label>
                </div>

                {selected && (
                    <dl className='mt-4 grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3 text-sm sm:grid-cols-3'>
                        <Evidence label='Measured file' value={selected.size || 'Not reported'} />
                        <Evidence label='Checksum' value={selected.checksumSha256?.slice(0, 16) || 'Verified during drill'} mono />
                        <Evidence label='Release commit' value={selected.releaseCommit?.slice(0, 12) || 'Not reported'} mono />
                    </dl>
                )}

                <button type='button' onClick={runDrill} disabled={!canRun} className='mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto' data-restore-primary-action>
                    <ShieldCheck className='h-4 w-4' />
                    {activeDrill ? stageLabel(activeDrill.stage) : isPending ? 'Starting isolated drill…' : 'Run isolated restore drill'}
                </button>
                {visibleError && <p role='alert' className='mt-4 rounded-lg border border-ui-danger/30 bg-ui-danger/10 p-3 text-sm text-ui-danger'>{visibleError}</p>}
                {message && <p role='status' className='mt-4 rounded-lg border border-ui-success/30 bg-ui-success/10 p-3 text-sm text-ui-success'>{message}</p>}
            </section>

            {(activeDrill || result) && <DrillEvidence operation={activeDrill || result!} />}

            <section className='overflow-hidden rounded-xl border border-ui-border bg-ui-panel' aria-labelledby='restore-history-heading'>
                <div className='border-b border-ui-border p-4 sm:px-5'><h2 id='restore-history-heading' className='font-semibold text-ui-text'>Restore-drill audit history</h2></div>
                <div className='overflow-x-auto'>
                    <table className='min-w-[680px] w-full text-left text-sm'>
                        <thead className='bg-ui-raised text-xs uppercase text-ui-muted'><tr><th className='px-4 py-3'>Started</th><th className='px-4 py-3'>Target</th><th className='px-4 py-3'>Status</th><th className='px-4 py-3'>Integrity</th></tr></thead>
                        <tbody className='divide-y divide-ui-border'>
                            {drillHistory.map(operation => <tr key={operation.id} className='text-ui-text'><td className='px-4 py-3'>{formatDate(operation.startedAt)}</td><td className='px-4 py-3 font-mono text-xs'>{operation.targetDatabase}</td><td className='px-4 py-3 capitalize'>{operation.status}</td><td className='px-4 py-3 text-ui-muted'>{operation.error || integrityLabel(operation)}</td></tr>)}
                            {!drillHistory.length && <tr><td colSpan={4} className='px-4 py-8 text-center text-ui-muted'>No isolated restore drill has been attempted yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    )
}

function DrillEvidence({ operation }: { operation: BackupOperation }) {
    return (
        <section className='rounded-xl border border-ui-border bg-ui-panel p-4 sm:p-5' aria-live='polite'>
            <div className='flex items-center justify-between gap-3'><h2 className='font-semibold text-ui-text'>Current drill evidence</h2><span className='capitalize text-ui-muted'>{operation.status}</span></div>
            <ol className='mt-4 grid gap-2 text-sm sm:grid-cols-5'>
                {['verifying_archive', 'creating_isolated_database', 'restoring', 'checking_integrity', 'removing_isolated_database'].map(stage => <li key={stage} className={`rounded-lg border p-2 ${operation.stage === stage ? 'border-ui-primary bg-ui-primary/10 text-ui-primary' : 'border-ui-border text-ui-muted'}`}>{stageLabel(stage)}</li>)}
            </ol>
            {operation.status === 'succeeded' && <p className='mt-4 text-sm text-ui-success'>{integrityLabel(operation)} Target removed: {operation.targetRemoved ? 'yes' : 'no'}.</p>}
            {operation.error && <p className='mt-4 text-sm text-ui-danger'>{operation.error}</p>}
        </section>
    )
}

function Evidence({ label, value, mono = false }: { label: string, value: string, mono?: boolean }) {
    return <div><dt className='text-xs font-semibold uppercase text-ui-muted'>{label}</dt><dd className={`mt-1 break-all text-ui-text ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd></div>
}

function defaultTarget() {
    return `restore_drill_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
}

function integrityLabel(operation: BackupOperation) {
    if (!operation.restoredIntegrity) return stageLabel(operation.stage)
    return `${operation.restoredIntegrity.schemas} schemas, ${operation.restoredIntegrity.tables} tables, source match ${operation.sourceIntegrity?.tables === operation.restoredIntegrity.tables ? 'passed' : 'unavailable'}`
}

function stageLabel(value: string) {
    return value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase())
}

function formatDate(value?: string | null) {
    if (!value) return 'Never'
    const date = new Date(value)
    return Number.isFinite(date.getTime()) ? date.toLocaleString() : value
}
