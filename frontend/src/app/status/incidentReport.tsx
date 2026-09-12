'use client'

import { useState } from 'react'
import type { ServiceIncident } from '@/utils/status/getStatus'

const PAGE_SIZE = 25
const timestamp = (at: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(at)) + ' UTC'
const labels: Record<string, string> = { investigating: 'Issue detected', monitoring: 'Service update', resolved: 'Recovery confirmed' }

export default function IncidentReport({ incident }: { incident: ServiceIncident }) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
    const updates = [...incident.updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    const resolved = incident.status === 'resolved'
    const cause = incident.cause && incident.cause.trim() !== incident.summary.trim()
        ? incident.cause : 'No confirmed root cause was recorded. Monitoring observations alone do not establish why the incident happened.'
    return <article className='overflow-hidden rounded-xl border border-ui-border bg-ui-panel'>
        <header className='border-b border-ui-border p-6 sm:p-8'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-ui-primary'>{incident.service}</p>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${resolved ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'}`}>{resolved ? 'Resolved' : 'Active incident'}</span>
            </div>
            <h1 className='mt-3 text-2xl font-semibold tracking-tight text-ui-text sm:text-3xl'>{incident.title}</h1>
            <dl className='mt-5 grid gap-4 text-sm sm:grid-cols-3'>
                <div><dt className='text-ui-muted'>Affected component</dt><dd className='mt-1 font-medium text-ui-text'>{incident.check_name}</dd></div>
                <div><dt className='text-ui-muted'>First detected</dt><dd className='mt-1 text-ui-text'><time dateTime={incident.started_at}>{timestamp(incident.started_at)}</time></dd></div>
                <div><dt className='text-ui-muted'>{resolved ? 'Recovery confirmed' : 'Current status'}</dt><dd className='mt-1 text-ui-text'>{incident.resolved_at ? <time dateTime={incident.resolved_at}>{timestamp(incident.resolved_at)}</time> : 'No healthy result recorded yet'}</dd></div>
            </dl>
        </header>
        <div className='grid gap-6 border-b border-ui-border p-6 sm:grid-cols-2 sm:p-8'>
            <section><h2 className='font-semibold text-ui-text'>Impact</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>{incident.summary}</p></section>
            <section><h2 className='font-semibold text-ui-text'>Cause</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>{cause}</p></section>
        </div>
        <section aria-labelledby='incident-updates' className='p-6 sm:p-8'>
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
                <h2 id='incident-updates' className='text-lg font-semibold text-ui-text'>Incident updates</h2>
                <p className='text-xs text-ui-muted'>Latest first · {updates.length} updates · All times UTC</p>
            </div>
            <ol className='mt-6 border-l border-ui-border'>
                {updates.slice(0, visibleCount).map((update, index) => <li key={`${update.at}-${index}`} className='relative pb-7 pl-6 last:pb-0'>
                    <span aria-hidden='true' className={`absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-ui-panel ${update.status === 'resolved' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    <div className='flex flex-wrap items-baseline justify-between gap-2'>
                        <h3 className='font-semibold text-ui-text'>{labels[update.status] || update.status}</h3>
                        <time dateTime={update.at} className='text-xs tabular-nums text-ui-muted'>{timestamp(update.at)}</time>
                    </div>
                    <p className='mt-2 text-sm leading-6 text-ui-muted'>{update.message}</p>
                    {update.evidence && <div className='mt-3 rounded-lg border border-ui-border bg-ui-canvas px-4 py-3'>
                        <p className='text-xs font-medium text-ui-text'>Recorded check result</p>
                        <p className='mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-ui-muted'>{update.evidence}</p>
                    </div>}
                </li>)}
            </ol>
            {!updates.length && <p className='mt-4 text-sm text-ui-muted'>No timeline updates were recorded.</p>}
            {visibleCount < updates.length && <button type='button' className='mt-6 rounded-lg border border-ui-border px-4 py-2 text-sm font-medium text-ui-text hover:bg-ui-canvas' onClick={() => setVisibleCount(count => count + PAGE_SIZE)}>Show older updates ({updates.length - visibleCount} remaining)</button>}
        </section>
    </article>
}
