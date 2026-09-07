import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { formatTiDate, getTiAdminOverview, sourceCaptures, sourceRuns } from '@/utils/tiAdmin/ops'
import ManualRunButton from '../../manualRunButton'

export const dynamic = 'force-dynamic'

export default async function TiSourceDetailPage(props: { params: Promise<{ id: string }>, searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await props.params
    const overview = await getTiAdminOverview(null, { sourceId: params.id })
    const source = overview.sources.find(item => item.id === params.id)
    const failed = overview.availability.failedResources
    if (!source && !failed.includes('source-operations')) return notFound()
    if (!source) return (
        <DashboardPage>
            <div role='alert'><h1 className='text-xl font-semibold'>Source unavailable</h1><p className='mt-2 text-sm text-ui-muted'>We couldn’t load this source. Try refreshing the page.</p></div>
            <Link href='/ti/sources' className='text-ui-primary'>Back to sources</Link>
        </DashboardPage>
    )

    const runs = sourceRuns(overview, source.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    const captures = sourceCaptures(overview, source.id)
    const latest = runs[0]
    const issues: string[] = []
    if (source.status === 'review' || source.status === 'candidate') issues.push('This source needs review before collection can start.')
    if (source.healthState === 'failed') issues.push(source.lastError || 'The last check failed. Try running the source again.')
    else if (latest?.status === 'failed') issues.push(latest.message || 'The latest run failed.')
    if (source.healthState === 'stale') issues.push('Checks are overdue.')
    if (source.backoffUntil && Date.parse(source.backoffUntil) > Date.now()) issues.push(`Retry scheduled for ${formatTiDate(source.backoffUntil)}.`)
    const unavailable = [
        failed.includes('source-operations') ? 'Source status could not be refreshed.' : '',
        failed.includes('collection-runs') ? 'Run history could not be loaded.' : '',
        failed.includes('captures') ? 'Evidence could not be loaded.' : '',
    ].filter(Boolean)

    return (
        <DashboardPage>
            <header className='flex flex-wrap items-center justify-between gap-3'>
                <div><h1 className='text-xl font-semibold text-ui-text'>{source.name}</h1><p className='mt-1 text-sm text-ui-muted'>{source.family.replaceAll('_', ' ')}</p></div>
                <ManualRunButton sourceId={source.id} label='Run now' queries={source.domains.filter(domain => !domain.includes('only'))} />
            </header>
            <div className='flex flex-wrap items-center gap-4 text-sm'>
                <Link href='/ti/sources' className='inline-flex items-center gap-2 text-ui-primary'><ArrowLeft className='h-4 w-4' />Sources</Link>
                {httpUrl(source.url) && <a href={source.url} target='_blank' rel='noopener noreferrer' className='inline-flex items-center gap-2 text-ui-primary'>Open source<ExternalLink className='h-4 w-4' /></a>}
            </div>
            {!!unavailable.length && <div role='alert' className='rounded-md border border-ui-border p-4 text-sm text-ui-warning'>{unavailable.join(' ')} Refresh to try again.</div>}
            <DashboardPanel className='p-4'>
                <dl className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                    <Stat label='Status' value={label(source.status)} />
                    <Stat label='Health' value={label(source.healthState)} />
                    <Stat label='Access' value={label(source.accessMethod)} />
                    <Stat label='Last check' value={formatTiDate(source.lastCheckedAt || source.lastRunAt)} />
                    <Stat label='Next check' value={source.status === 'paused' ? 'Paused' : formatTiDate(source.nextRunAt)} />
                    <Stat label='Interval' value={source.cadenceMinutes >= 60 ? `${Math.round(source.cadenceMinutes / 60)} hr` : `${source.cadenceMinutes} min`} />
                    <Stat label='Hits' value={source.retainedEvidenceCount.toLocaleString()} />
                </dl>
            </DashboardPanel>
            {!!issues.length && <DashboardPanel className='p-4'>
                <h2 className='font-semibold text-ui-text'>Needs attention</h2>
                <ul className='mt-2 grid list-disc gap-2 pl-5 text-sm text-ui-muted'>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>
            </DashboardPanel>}
            <DashboardPanel className='min-w-0 overflow-hidden p-0'>
                <h2 className='border-b border-ui-border p-4 font-semibold text-ui-text'>Recent runs</h2>
                {runs.length ? <div className='overflow-x-auto'><table className='w-full text-left text-sm'>
                    <thead className='text-ui-muted'><tr>{['Started', 'Status', 'Duration', 'Hits', 'Message'].map(title => <th key={title} className='px-4 py-3 font-medium'>{title}</th>)}</tr></thead>
                    <tbody>{runs.map(run => <tr key={run.id} className='border-t border-ui-border'>
                        <td className='whitespace-nowrap px-4 py-3'>{formatTiDate(run.startedAt)}</td>
                        <td className='px-4 py-3'>{label(run.status)}</td>
                        <td className='whitespace-nowrap px-4 py-3'>{duration(run.startedAt, run.finishedAt)}</td>
                        <td className='px-4 py-3'>{run.captures}</td>
                        <td className='min-w-48 px-4 py-3 text-ui-muted'>{run.message || '—'}</td>
                    </tr>)}</tbody>
                </table></div> : <p className='p-4 text-sm text-ui-muted'>{failed.includes('collection-runs') ? 'Run history unavailable.' : 'No runs recorded yet.'}</p>}
            </DashboardPanel>
            <DashboardPanel className='min-w-0 p-4'>
                <h2 className='font-semibold text-ui-text'>Recent evidence</h2>
                <div className='mt-3 grid gap-3'>
                    {captures.map(capture => <article key={capture.id} className='min-w-0 rounded-md border border-ui-border p-4'>
                        <h3 className='wrap-break-word font-medium text-ui-text'>{capture.title}</h3>
                        <p className='mt-2 whitespace-pre-wrap wrap-break-word text-sm text-ui-muted'>{capture.normalizedEvidence?.excerpt || capture.resultSummary}</p>
                        <p className='mt-3 text-xs text-ui-muted'>Published {formatTiDate(capture.publishedAt)} · Captured {formatTiDate(capture.capturedAt)}</p>
                        {httpUrl(capture.pageUrl) && <a href={capture.pageUrl} target='_blank' rel='noopener noreferrer' className='mt-3 inline-flex items-center gap-2 text-sm text-ui-primary'>Open original<ExternalLink className='h-4 w-4' /></a>}
                        {(capture.normalizedEvidence?.text || capture.screenshotLabel !== 'not captured') && <details className='mt-3 text-sm'>
                            <summary className='cursor-pointer text-ui-primary'>Details</summary>
                            {capture.normalizedEvidence?.text && <p className='mt-2 whitespace-pre-wrap wrap-break-word text-ui-muted'>{capture.normalizedEvidence.text}</p>}
                            {capture.screenshotLabel !== 'not captured' && <p className='mt-2 break-all text-ui-muted'>Screenshot: {capture.screenshotLabel} · {formatTiDate(capture.screenshotTakenAt)}</p>}
                        </details>}
                    </article>)}
                    {!captures.length && <p className='text-sm text-ui-muted'>{failed.includes('captures') ? 'Evidence unavailable.' : 'No evidence collected yet.'}</p>}
                </div>
            </DashboardPanel>
        </DashboardPage>
    )
}

function Stat({ label, value }: { label: string, value: string }) {
    return <div><dt className='text-sm text-ui-muted'>{label}</dt><dd className='mt-1 wrap-break-word font-medium text-ui-text'>{value}</dd></div>
}

function label(value: string) {
    const text = value.replaceAll('_', ' ')
    return text ? text[0].toUpperCase() + text.slice(1) : 'Not recorded'
}

function httpUrl(value: string) {
    try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

function duration(start: string, end?: string) {
    if (!end) return '—'
    const seconds = Math.round((Date.parse(end) - Date.parse(start)) / 1000)
    if (!Number.isFinite(seconds) || seconds < 0) return '—'
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}
