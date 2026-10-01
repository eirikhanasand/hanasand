'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, SlidersHorizontal } from 'lucide-react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { useWorkspace } from '@/components/organizations/workspaceProvider'
import { requestJson, type Rule } from '../detection-rules'
import CreateRuleDialog from '../create-rule-dialog'
import ReprocessRule from '../reprocess-rule'
import type { Condition } from '../condition-builder'

type LogPattern = {
    message: string
    service: string
    host: string
    level: string
    log_type: string
    action: string
    outcome: string
    severity: string
    protected_event_count: string
    event_count: string
    storage_bytes: string
}
type TuningData = { organizationId: string, generatedAt: string, logs: LogPattern[] }

const rowFields: Array<[keyof LogPattern, string]> = [
    ['message', 'message'], ['service', 'service'], ['host', 'host'], ['level', 'level'],
    ['log_type', 'log_type'], ['action', 'action'], ['outcome', 'outcome'], ['severity', 'severity'],
]
const numberFormat = new Intl.NumberFormat('en')

function formatBytes(value: number) {
    if (value < 1024) return `${value} B`
    const units = ['KB', 'MB', 'GB', 'TB']
    let amount = value / 1024, unit = 0
    while (amount >= 1024 && unit < units.length - 1) { amount /= 1024; unit++ }
    return `${amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`
}

function rulePreset(log: LogPattern) {
    const conditions: Condition[] = rowFields.map(([path]) => ({ path, operator: 'equals', value: String(log[path]), caseSensitive: true }))
    const name = `Suppress: ${log.message}`.slice(0, 120)
    const explanation = `Suppress repeated ${log.log_type} logs from ${log.service} on ${log.host}.`.slice(0, 500)
    return { name, explanation, stage: 'analyze', action: 'drop', conditions }
}

export default function TuningPage() {
    const { organizations } = useWorkspace()
    const [data, setData] = useState<TuningData | null>(null)
    const [selected, setSelected] = useState<LogPattern | null>(null)
    const [createdRule, setCreatedRule] = useState<Rule | null>(null)
    const [error, setError] = useState('')
    const canManage = organizations.some(organization => organization.id === data?.organizationId
        && ['owner', 'admin', 'editor'].includes(organization.role?.toLowerCase() || ''))
    const refresh = useCallback(async (signal?: AbortSignal) => {
        if (document.visibilityState !== 'visible') return
        try {
            const payload = await requestJson<TuningData>('/api/backend/logs/tuning', { cache: 'no-store', signal })
            if (!signal?.aborted) { setData(payload); setError('') }
        } catch (cause) {
            if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Log patterns could not be loaded.')
        }
    }, [])
    const completeReprocessing = useCallback(() => { void refresh() }, [refresh])

    useEffect(() => {
        const controller = new AbortController()
        void refresh(controller.signal)
        const interval = window.setInterval(() => void refresh(), 30_000)
        const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
        document.addEventListener('visibilitychange', onVisible)
        return () => { controller.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
    }, [refresh])

    const preset = useMemo(() => selected ? rulePreset(selected) : undefined, [selected])
    const displayedAt = data ? new Date(data.generatedAt).toLocaleTimeString() : ''

    return <DashboardPage className='!gap-5 !px-2 !py-4'>
        <header className='flex flex-wrap items-center justify-between gap-3'>
            <div><h1 className='flex items-center gap-2 text-2xl font-semibold'><SlidersHorizontal size={22} aria-hidden />Log tuning</h1>
                <p className='mt-1 text-sm text-ui-muted'>The 100 most common stored log patterns, ranked across all stored logs.</p></div>
            <button type='button' onClick={() => void refresh()} className='inline-flex items-center gap-2 rounded-lg border border-ui-border px-3 py-2 text-sm'><RefreshCw size={15} aria-hidden />Refresh</button>
        </header>

        {error && <p role='alert' className='rounded-lg border border-ui-danger/40 bg-ui-danger/10 p-3 text-sm text-ui-danger'>{error}</p>}
        {createdRule && data && <ReprocessRule key={createdRule.id} rule={createdRule} organizationId={data.organizationId} disabled={!canManage} defaultRange='all' onComplete={completeReprocessing} />}

        <DashboardPanel className='min-w-0 overflow-hidden'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border px-4 py-3'>
                <h2 className='font-semibold'>Stored log patterns</h2>
                <p className='text-xs text-ui-muted'>{data ? `Updated ${displayedAt}` : 'Loading patterns…'}</p>
            </div>
            <div className='overflow-x-auto'>
                <table className='w-full min-w-[52rem] table-fixed text-left text-sm'>
                    <thead className='bg-ui-raised text-xs text-ui-muted'><tr><th className='w-[38%] px-4 py-2'>Log</th><th className='w-[27%] px-4 py-2'>Source</th><th className='w-[13%] px-4 py-2 text-right'>Events</th><th className='w-[13%] px-4 py-2 text-right'>Row data</th><th className='w-[9%] px-4 py-2' /></tr></thead>
                    <tbody>{(data?.logs || []).map((log, index) => {
                        const protectedCount = Number(log.protected_event_count)
                        const allProtected = protectedCount >= Number(log.event_count)
                        const tunableFields = rowFields.every(([path]) => String(log[path]).length > 0 && String(log[path]).length <= 200)
                        const tunable = tunableFields && !allProtected
                        return <tr key={`${log.service}:${log.host}:${log.message}:${index}`} className='border-t border-ui-border align-top'>
                            <td className='px-4 py-3'><code className='block whitespace-pre-wrap wrap-break-word text-xs'>{log.message}</code><p className='mt-1 text-xs text-ui-muted'>{log.log_type} · {log.level} · {log.outcome} · {log.severity}</p>{protectedCount > 0 && <p className='mt-1 text-xs text-ui-warning'>{numberFormat.format(protectedCount)} failure or detection events are protected</p>}</td>
                            <td className='px-4 py-3 text-xs'><span className='font-medium'>{log.service}</span><br /><span className='text-ui-muted'>{log.host || 'Unknown host'} · {log.action}</span></td>
                            <td className='px-4 py-3 text-right tabular-nums'>{numberFormat.format(Number(log.event_count))}</td>
                            <td className='px-4 py-3 text-right tabular-nums' title={`${numberFormat.format(Number(log.storage_bytes))} bytes`}>{formatBytes(Number(log.storage_bytes))}</td>
                            <td className='px-4 py-3 text-right'><button type='button' disabled={!canManage || !tunable} onClick={() => { setSelected(log); setCreatedRule(null) }} className='rounded-md border border-ui-border px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50' title={allProtected ? 'Failure or detection evidence is kept by the existing protection rule.' : !tunableFields ? 'This log is missing fields needed for an exact rule.' : canManage ? undefined : 'An Hanasand editor is required to create a suppression rule'}>Tune</button></td>
                        </tr>
                    })}
                    {!data?.logs.length && <tr><td colSpan={5} className='px-4 py-10 text-center text-sm text-ui-muted'>{data ? 'No stored log patterns.' : 'Loading patterns…'}</td></tr>}</tbody>
                </table>
            </div>
        </DashboardPanel>
        <p className='text-xs text-ui-muted'>Row data estimates include each stored event row; PostgreSQL indexes and free space are excluded. This list refreshes every 30 seconds.</p>

        {selected && data && preset && <CreateRuleDialog key={`${selected.service}:${selected.host}:${selected.message}`} category='analysis' organizationId={data.organizationId} canManage={canManage} canManageRetention={canManage} rules={[]} initialPreset={preset} onClose={() => setSelected(null)} onCreated={rule => {
            setSelected(null); setCreatedRule(rule); setError(''); void refresh()
        }} />}
    </DashboardPage>
}
