'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { CaseRow } from './cases-client'

type MonitoringCase = CaseRow & {
    occurrences: number, automationId: string, resolvedAt?: string,
    notifications: Array<{ messageId?: string, deliveredAt?: string, error?: string, nextAttemptAt?: string }>,
}

export function MonitoringCaseDetail({ caseId, organizationId }: { caseId: string, organizationId?: string }) {
    const [item, setItem] = useState<MonitoringCase | null>(null)
    const [error, setError] = useState('')
    const [revision, setRevision] = useState(0)
    useEffect(() => {
        const controller = new AbortController()
        setError('')
        const params = new URLSearchParams(organizationId ? { organizationId } : {})
        fetch(`/api/cases/${encodeURIComponent(caseId)}?${params}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
            const payload = await response.json()
            if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Case unavailable.')
            setItem(payload.case)
        }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
        return () => controller.abort()
    }, [caseId, organizationId, revision])
    const date = (value?: string) => value ? new Date(value).toLocaleString() : '—'
    return <section className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 text-ui-text'>
        <Link className='text-sm text-ui-primary' href={`/cases${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`}>← Cases</Link>
        <h1 className='text-lg font-semibold'>{item?.title || caseId}</h1>
        {error && <div role='alert' className='text-ui-danger'>{error} <button className='underline' onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
        {!item && !error && <p>Loading case…</p>}
        {item && <>
            <p className='whitespace-pre-wrap wrap-break-word'>{item.summary}</p>
            <dl className='grid grid-cols-2 gap-3 text-sm'><dt>Status</dt><dd>{item.status}</dd><dt>Severity</dt><dd>{item.severity}</dd><dt>Occurrences</dt><dd>{item.occurrences}</dd><dt>First seen</dt><dd>{date(item.createdAt)}</dd><dt>Last seen</dt><dd>{date(item.updatedAt)}</dd><dt>Recovered</dt><dd>{date(item.resolvedAt)}</dd></dl>
            <p className='text-sm text-ui-muted'>This case closes when the health check recovers and reopens if the same issue returns.</p>
            <Link className='text-sm text-ui-primary underline' href={`/automation/health?monitor=${encodeURIComponent(item.automationId)}`}>View health check</Link>
            <h2 className='font-semibold'>Notifications</h2>
            {item.notifications.length ? item.notifications.map((notification, index) => <div className='text-sm' key={index}>{notification.error ? <p className='text-ui-danger'>{notification.error}</p> : <p>{notification.deliveredAt ? `Delivered ${date(notification.deliveredAt)}` : 'Delivery pending'}</p>}{notification.messageId && <p>Message: {notification.messageId}</p>}</div>) : <p className='text-sm text-ui-muted'>No notifications recorded.</p>}
        </>}
    </section>
}
