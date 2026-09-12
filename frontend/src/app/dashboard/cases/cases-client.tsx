'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export type CaseResolution = { id?: string, type: 'human' | 'ai' | 'automation' | 'unknown', actor?: string, at?: string, note?: string, confirmedBy?: string, confirmedAt?: string }

export type CaseRow = {
    id: string, caseId?: string, title: string, summary?: string, status: string,
    actor?: string, victimName?: string, company?: string, reviewState?: string, source?: string, severity?: string, priority?: string, assignedOwner?: string,
    resolution?: CaseResolution, organizationId?: string, updatedAt?: string, createdAt?: string,
}

export default function CasesClient({ organizationId }: { organizationId?: string }) {
    const [rows, setRows] = useState<CaseRow[]>([])
    const [warnings, setWarnings] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [revision, setRevision] = useState(0)
    const [page, setPage] = useState(1)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState('active')
    const [severity, setSeverity] = useState('all')
    const [source, setSource] = useState('all')
    const [owner, setOwner] = useState('all')
    const [resolutionType, setResolutionType] = useState('all')
    const [review, setReview] = useState('all')
    const [cursor, setCursor] = useState<string | null>(null)
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        const params = new URLSearchParams(organizationId ? { organizationId } : {})
        if (!cursor) params.set('page', String(page))
        if (cursor) params.set('cursor', cursor)
        fetch(`/api/cases?${params}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : payload.error?.message || 'Cases are unavailable. Please retry.')
            const incoming: CaseRow[] = payload.items || payload.cases || []
            setRows(current => page > 1 ? Array.from(new Map([...current, ...incoming].map(row => [row.caseId || row.id, row])).values()) : incoming)
            setNextCursor(payload.nextCursor || null)
            setWarnings(payload.warnings || [])
        }).catch(error => {
            if (!controller.signal.aborted) setWarnings([error.message || 'Cases are unavailable.'])
        }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
        return () => controller.abort()
    }, [organizationId, revision, page, cursor])
    const visible = rows.filter(row => {
        const active = !['resolved', 'closed', 'suppressed', 'false_positive'].includes(row.status)
        if (status !== 'all' && (status === 'active' ? !active : row.status !== status)) return false
        if (severity !== 'all' && (row.severity || row.priority) !== severity) return false
        if (source !== 'all' && (row.source || 'intelligence') !== source) return false
        if (owner !== 'all' && (row.assignedOwner || 'unassigned') !== owner) return false
        if (resolutionType !== 'all' && row.resolution?.type !== resolutionType) return false
        if (review === 'confirmed' && !row.resolution?.confirmedAt) return false
        if (review === 'pending' && (!['ai', 'automation'].includes(row.resolution?.type || '') || row.resolution?.confirmedAt)) return false
        return [row.id, row.title, row.summary, row.actor, row.victimName, row.company, row.source, row.assignedOwner, row.organizationId].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase())
    })
    return <section className='min-w-0 rounded-lg border border-ui-border bg-ui-panel'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
            <div><h1 className='text-lg font-semibold text-ui-text'>Cases</h1><p className='text-sm text-ui-muted'>Cases across the service, including health monitoring and dark web monitoring.</p></div>
            <button type='button' aria-label='Refresh cases' title='Refresh cases' className='inline-flex h-8 w-8 items-center justify-center rounded text-ui-primary hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary' onClick={() => { setPage(1); setCursor(null); setRevision(value => value + 1) }}>
                <RefreshCw className='h-4 w-4' aria-hidden='true' />
            </button>
        </div>
        <div className='flex flex-wrap gap-3 p-4'>
            <input aria-label='Search cases' placeholder='Search cases' value={query} onChange={event => setQuery(event.target.value)} className='min-w-0 flex-1 rounded border border-ui-border bg-ui-canvas p-2 text-ui-text' />
        </div>
        <div className='flex flex-wrap items-end gap-3 px-4 pb-4'>
            <CaseFilter label='Status' value={status} onChange={setStatus} options={['active', 'all', 'open', 'in_progress', 'escalated', 'resolved', 'closed', 'suppressed', 'false_positive']} />
            <CaseFilter label='Severity' value={severity} onChange={setSeverity} options={['all', 'critical', 'high', 'medium', 'low']} />
            <CaseFilter label='Source' value={source} onChange={setSource} options={['all', 'monitoring', 'intelligence']} />
            <CaseFilter label='Owner' value={owner} onChange={setOwner} options={['all', 'unassigned', ...Array.from(new Set(rows.map(row => row.assignedOwner).filter((value): value is string => Boolean(value)))).sort()]} />
            <CaseFilter label='Resolved by' value={resolutionType} onChange={value => { setResolutionType(value); if (value !== 'all') setStatus('all') }} options={['all', 'human', 'ai', 'automation', 'unknown']} />
            <CaseFilter label='Human review' value={review} onChange={value => { setReview(value); if (value !== 'all') setStatus('all') }} options={['all', 'pending', 'confirmed']} />
            <button type='button' className='px-2 py-2 text-sm text-ui-primary' onClick={() => { setQuery(''); setStatus('active'); setSeverity('all'); setSource('all'); setOwner('all'); setResolutionType('all'); setReview('all') }}>Reset filters</button>
        </div>
        {warnings.map(warning => <p role='alert' key={warning} className='px-4 pb-3 text-sm text-ui-danger'>{warning}</p>)}
        {loading ? <p className='p-4 text-ui-muted'>Loading cases…</p> : <>
            <p className='px-4 pb-3 text-xs text-ui-muted'>{visible.length} matching · {rows.length} cases loaded{nextCursor ? ' · More cases available below' : ''}</p>
            {!visible.length ? <p className='p-4 text-ui-muted'>{warnings.length ? 'No cases could be displayed from the available sources.' : rows.length ? 'No cases match the current filters.' : 'No cases yet.'}</p> : <div className='overflow-x-auto'><table className='w-full text-left text-sm'>
                <thead className='border-y border-ui-border bg-ui-raised text-ui-muted'><tr>{['Case', 'Severity / status', 'Owner', 'Updated'].map(label => <th key={label} className='p-4'>{label}</th>)}</tr></thead>
                <tbody className='divide-y divide-ui-border'>{visible.map(row => <tr key={row.caseId || row.id} className='text-ui-text'>
                    <td className='p-4'><Link className='font-semibold text-ui-primary hover:underline' href={`/cases/${encodeURIComponent(row.caseId || row.id)}${row.organizationId || organizationId ? `?organizationId=${encodeURIComponent(row.organizationId || organizationId!)}` : ''}`}>{row.title || row.id}</Link>{[row.actor, row.victimName || row.company, row.organizationId].filter(Boolean).map(value => <p className='mt-1 text-xs text-ui-muted' key={value}>{value}</p>)}{row.summary && <p className='mt-1 max-w-xl wrap-break-word text-xs text-ui-muted'>{row.summary}</p>}</td>
                    <td className='p-4'>{row.severity || row.priority || '—'} · {row.status.replaceAll('_', ' ')}{row.resolution && <p className='mt-1 text-xs text-ui-muted'>{row.resolution.type === 'ai' ? 'AI resolved' : row.resolution.type === 'automation' ? 'Automatically recovered' : row.resolution.type === 'unknown' ? 'Resolver not recorded' : `Resolved by ${row.resolution.actor || 'human'}`}{['ai', 'automation'].includes(row.resolution.type) && (row.resolution.confirmedAt ? ' · Human confirmed' : ' · Needs human review')}</p>}</td><td className='p-4'>{row.assignedOwner || 'Unassigned'}</td><td className='p-4'>{row.updatedAt || row.createdAt ? new Date(row.updatedAt || row.createdAt!).toLocaleString() : '—'}</td>
                </tr>)}</tbody>
            </table></div>}
            {nextCursor && <button className='p-4 text-ui-primary' onClick={() => { setCursor(nextCursor); setPage(current => current + 1) }}>Load more cases</button>}
        </>}
    </section>
}

function CaseFilter({ label, value, onChange, options }: { label: string, value: string, onChange: (value: string) => void, options: string[] }) {
    const display = (option: string) => option === 'active' ? 'Active cases' : option === 'ai' ? 'AI' : option.replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
    return <label className='grid gap-1 text-xs text-ui-muted'>{label}<select aria-label={label} className='rounded border border-ui-border bg-ui-canvas p-2 text-sm text-ui-text' value={value} onChange={event => onChange(event.target.value)}>{options.map(option => <option key={option} value={option}>{display(option)}</option>)}</select></label>
}
