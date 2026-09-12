'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'

export type CaseRow = {
    id: string, caseId?: string, title: string, summary?: string, status: string,
    actor?: string, victimName?: string, company?: string, reviewState?: string, source?: string, severity?: string, priority?: string, assignedOwner?: string,
    organizationId?: string, updatedAt?: string, createdAt?: string,
}

export default function CasesClient({ organizationId }: { organizationId?: string }) {
    const [rows, setRows] = useState<CaseRow[]>([])
    const [warnings, setWarnings] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [revision, setRevision] = useState(0)
    const [page, setPage] = useState(1)
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [status, setStatus] = useState('all')
    useEffect(() => {
        const controller = new AbortController()
        setLoading(true)
        const params = new URLSearchParams(organizationId ? { organizationId } : {})
        params.set('page', String(page))
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
    }, [organizationId, revision, page])
    const visible = rows.filter(row => (status === 'all' || row.status === status) && [row.id, row.title, row.summary, row.actor, row.victimName, row.company, row.source, row.assignedOwner, row.organizationId].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase()))
    return <section className='min-w-0 rounded-lg border border-ui-border bg-ui-panel'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-ui-border p-4'>
            <div><h1 className='text-lg font-semibold text-ui-text'>Cases</h1><p className='text-sm text-ui-muted'>Cases across the service, including health monitoring and dark web monitoring.</p></div>
            <button type='button' aria-label='Refresh cases' title='Refresh cases' className='inline-flex h-8 w-8 items-center justify-center rounded text-ui-primary hover:bg-ui-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary' onClick={() => { setPage(1); setRevision(value => value + 1) }}>
                <RefreshCw className='h-4 w-4' aria-hidden='true' />
            </button>
        </div>
        <div className='flex flex-wrap gap-3 p-4'>
            <input aria-label='Search cases' placeholder='Search cases' value={query} onChange={event => setQuery(event.target.value)} className='min-w-0 flex-1 rounded border border-ui-border bg-ui-canvas p-2 text-ui-text' />
            <select aria-label='Filter cases by status' value={status} onChange={event => setStatus(event.target.value)} className='rounded border border-ui-border bg-ui-canvas p-2 text-ui-text'><option value='all'>All statuses</option>{Array.from(new Set(rows.map(row => row.status))).sort().map(value => <option key={value} value={value}>{value}</option>)}</select>
        </div>
        {warnings.map(warning => <p role='alert' key={warning} className='px-4 pb-3 text-sm text-ui-danger'>{warning}</p>)}
        {loading ? <p className='p-4 text-ui-muted'>Loading cases…</p> : <>
            <p className='px-4 pb-3 text-xs text-ui-muted'>{visible.length} of {rows.length} cases</p>
            {!visible.length ? <p className='p-4 text-ui-muted'>{warnings.length ? 'No cases could be displayed from the available sources.' : rows.length ? 'No cases match the current filters.' : 'No cases yet.'}</p> : <div className='overflow-x-auto'><table className='w-full text-left text-sm'>
                <thead className='border-y border-ui-border bg-ui-raised text-ui-muted'><tr>{['Case', 'Severity / status', 'Owner', 'Updated'].map(label => <th key={label} className='p-4'>{label}</th>)}</tr></thead>
                <tbody className='divide-y divide-ui-border'>{visible.map(row => <tr key={row.caseId || row.id} className='text-ui-text'>
                    <td className='p-4'><Link className='font-semibold text-ui-primary hover:underline' href={`/cases/${encodeURIComponent(row.caseId || row.id)}${row.organizationId || organizationId ? `?organizationId=${encodeURIComponent(row.organizationId || organizationId!)}` : ''}`}>{row.title || row.id}</Link>{[row.actor, row.victimName || row.company, row.organizationId].filter(Boolean).map(value => <p className='mt-1 text-xs text-ui-muted' key={value}>{value}</p>)}{row.summary && <p className='mt-1 max-w-xl wrap-break-word text-xs text-ui-muted'>{row.summary}</p>}</td>
                    <td className='p-4'>{row.severity || row.priority || '—'} · {row.status}</td><td className='p-4'>{row.assignedOwner || 'Unassigned'}</td><td className='p-4'>{row.updatedAt || row.createdAt ? new Date(row.updatedAt || row.createdAt!).toLocaleString() : '—'}</td>
                </tr>)}</tbody>
            </table></div>}
            {nextCursor && <button className='p-4 text-ui-primary' onClick={() => setPage(current => current + 1)}>Load more cases</button>}
        </>}
    </section>
}
