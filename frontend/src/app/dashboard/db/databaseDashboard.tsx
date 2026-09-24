import { AlertTriangle, ArchiveRestore, CheckCircle2, ChevronDown, Clock3, DatabaseBackup, HardDrive, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { DatabaseOverview } from '@/utils/db/internal'
import DatabaseWorkbench from './databaseWorkbench'
import DatabaseRefresh from './databaseRefresh'
import DatabaseInventory from './databaseInventory'
import QueryCard from './queryCard'


export function DatabaseDashboard({ overview }: { overview: DatabaseOverview }) {
    const storage = overview.storage
    const fresh = Boolean(storage && !storage.stale)
    const disk = fresh ? storage?.disk : null
    const issues = storage?.instances.filter(instance => instance.status !== 'healthy') || []
    const daily = disk?.dailyGrowthBytes
    const days = disk?.daysUntilFull


    return <DashboardPage>
        <DatabaseRefresh />
        <DatabaseWorkbench overview={overview}>
        <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4' aria-label='Storage health' data-db-monitor-metrics data-clusters={overview.clusterCount} data-databases={overview.databaseCount} data-storage-bytes={overview.totalSizeBytes}>
            <MetricCard icon={<HardDrive />} label='Disk free' value={disk ? formatBytes(disk.availableBytes) : 'Unavailable'} detail={disk ? `${formatBytes(disk.totalBytes)} total · ${storage?.host}` : 'Storage measurements unavailable'} />
            <MetricCard icon={<TrendingUp />} label='Growth / day' value={daily == null ? 'Measuring' : `${daily < 0 ? '−' : '+'}${formatBytes(Math.abs(daily))}`} detail={disk ? `Net disk change · ${Math.min(24, disk.sampleSeconds / 3600).toFixed(1)}h sampled` : 'No recent measurement'} />
            <MetricCard icon={<Clock3 />} label='Disk full in' value={!disk || daily == null ? 'Not enough history' : days == null ? 'Not growing' : days < 1 ? `${Math.max(1, Math.round(days * 24))} hours` : `${Math.round(days)} days`} detail='Estimated at the measured rate' />
            <MetricCard icon={fresh && !issues.length ? <CheckCircle2 /> : <AlertTriangle />} label='Database health' value={!fresh ? 'Not verified' : issues.length ? `${issues.length} need attention` : 'Healthy'} detail={storage ? `Checked ${formatDateTime(storage.sampledAt)}` : 'Inventory unavailable'} />
        </section>
        </DatabaseWorkbench>

        <DashboardPanel className='min-w-0 overflow-hidden' id='storage-inventory'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border px-5 py-4'>
                <h2 className='text-base font-semibold'>Storage and databases</h2>
                <div className='flex flex-wrap items-center gap-3'><span className='text-xs text-ui-muted'>{storage?.stale ? 'Last known sizes · status stale' : storage ? storage.host : 'Hanasand cluster only · host inventory unavailable'}</span><DatabaseActions /></div>
            </div>
            {storage ? <DatabaseInventory instances={storage.instances} stale={!fresh} /> : <p className='p-5 text-sm text-ui-muted'>Database inventory unavailable.</p>}
        </DashboardPanel>


        <Disclosure title='Queries' id='active-queries' detail={`${overview.queries.length} shown · ${overview.queries.filter(q => q.isLongRunning).length} long-running · Long-running after ${formatTime(overview.longRunningThresholdSeconds)} · Checked ${formatDateTime(overview.generatedAt)}`}>
            {overview.queries.length ? <div className='space-y-5 divide-y divide-ui-border [&>div+div]:pt-5'>{overview.queries.map((query, index) => <QueryCard key={`${query.database}-${query.user}-${query.query}-${index}`} query={query} duration={formatTime(query.durationSeconds)} />)}</div> : <p className='text-sm text-ui-muted'>{overview.status === 'unavailable' ? 'Query activity unavailable.' : 'No active queries.'}</p>}
        </Disclosure>
        <Disclosure title='Longest running query' detail={overview.longestQuery ? formatTime(overview.longestQuery.durationSeconds) : 'None'}>
            {overview.longestQuery ? <QueryCard query={overview.longestQuery} duration={formatTime(overview.longestQuery.durationSeconds)} /> : <p className='text-sm text-ui-muted'>No query to show.</p>}
        </Disclosure>
    </DashboardPage>
}

function Disclosure({ title, detail, id, children }: { title: string, detail: string, id?: string, children: ReactNode }) {
    return <details id={id} className='group min-w-0 rounded-lg border border-ui-border bg-ui-panel'>
        <summary className='flex cursor-pointer list-none flex-wrap items-center gap-3 p-5 focus-visible:outline-ui-primary [&::-webkit-details-marker]:hidden'>
            <ChevronDown aria-hidden className='h-4 w-4 text-ui-muted transition group-open:rotate-180' /><h2 className='text-base font-semibold'>{title}</h2><span className='ml-auto text-xs text-ui-muted'>{detail}</span>
        </summary><div className='min-w-0 border-t border-ui-border p-5'>{children}</div>
    </details>
}

export function DatabaseActions() {
    return (
        <div className='flex flex-wrap gap-2'>
            <ActionLink href='/db/backups' icon={<DatabaseBackup className='h-4 w-4' />} label='Backups' />
            <ActionLink href='/db/restore' icon={<ArchiveRestore className='h-4 w-4' />} label='Restore' />
        </div>
    )
}

function ActionLink({ href, icon, label }: { href: string, icon: ReactNode, label: string }) {
    return (
        <Link
            href={href}
            className='inline-flex items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 py-2 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-primary/10'
        >
            {icon}
            {label}
        </Link>
    )
}

function MetricCard({ icon, label, value, detail }: { icon: ReactNode, label: string, value: string, detail: string }) {
    return <DashboardPanel className='min-w-0 p-4'>
        <div className='flex items-center gap-2 text-sm text-ui-muted'><span aria-hidden className='text-ui-primary [&>svg]:h-4 [&>svg]:w-4'>{icon}</span>{label}</div>
        <p className='mt-3 text-xl font-semibold tabular-nums'>{value}</p><p className='mt-2 text-xs text-ui-muted'>{detail}</p>
    </DashboardPanel>
}

function formatBytes(bytes: number | null) {
    if (bytes === null || !Number.isFinite(bytes)) return '—'
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1000 && index < units.length - 1) {
        value /= 1000
        index++
    }
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

function formatTime(value?: number | null) {
    if (!Number.isFinite(value ?? NaN) || !value) return '0s'
    if (value < 60) return `${Math.round(value)}s`
    if (value < 3600) return `${Math.round(value / 60)}m`
    return `${Math.round(value / 3600)}h`
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit' }) + ' UTC'
}
