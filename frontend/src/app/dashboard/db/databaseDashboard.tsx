import { AlertTriangle, ArchiveRestore, CheckCircle2, ChevronDown, Clock3, DatabaseBackup, HardDrive, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import type { DatabaseOverview, DatabaseQueryActivity } from '@/utils/db/internal'
import DatabaseWorkbench from './databaseWorkbench'
import DatabaseRefresh from './databaseRefresh'

type StorageInstance = NonNullable<DatabaseOverview['storage']>['instances'][number]
type StorageRow = { instance: StorageInstance, database: Omit<StorageInstance['databases'][number], 'sizeBytes'> & { sizeBytes: number | null } }

export function DatabaseDashboard({ overview }: { overview: DatabaseOverview }) {
    const storage = overview.storage
    const fresh = Boolean(storage && !storage.stale)
    const disk = fresh ? storage?.disk : null
    const issues = storage?.instances.filter(instance => instance.status !== 'healthy') || []
    const daily = disk?.dailyGrowthBytes
    const days = disk?.daysUntilFull
    const rows = storage?.instances.flatMap<StorageRow>(instance => instance.databases.length
        ? instance.databases.map(database => ({ instance, database }))
        : [{ instance, database: { name: 'Unavailable', sizeBytes: null, connections: null, replica: false, memory: false } }])

    return <DashboardPage>
        <DatabaseRefresh />
        <DashboardHeader title='Database' actions={<DatabaseActions />} />
        <section className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4' aria-label='Storage health' data-db-monitor-metrics data-clusters={overview.clusterCount} data-databases={overview.databaseCount} data-storage-bytes={overview.totalSizeBytes}>
            <MetricCard icon={<HardDrive />} label='Disk free' value={disk ? formatBytes(disk.availableBytes) : 'Unavailable'} detail={disk ? `${formatBytes(disk.totalBytes)} total · ${storage?.host}` : 'Storage measurements unavailable'} />
            <MetricCard icon={<TrendingUp />} label='Growth / day' value={daily == null ? 'Measuring' : `${daily < 0 ? '−' : '+'}${formatBytes(Math.abs(daily))}`} detail={disk ? `Net disk change · ${Math.min(24, disk.sampleSeconds / 3600).toFixed(1)}h sampled` : 'No recent measurement'} />
            <MetricCard icon={<Clock3 />} label='Disk full in' value={!disk || daily == null ? 'Not enough history' : days == null ? 'Not growing' : days < 1 ? `${Math.max(1, Math.round(days * 24))} hours` : `${Math.round(days)} days`} detail='Estimated at the measured rate' />
            <MetricCard icon={fresh && !issues.length ? <CheckCircle2 /> : <AlertTriangle />} label='Database health' value={!fresh ? 'Not verified' : issues.length ? `${issues.length} need attention` : 'Healthy'} detail={storage ? `Checked ${formatDateTime(storage.sampledAt)}` : 'Inventory unavailable'} />
        </section>

        <DashboardPanel className='min-w-0 overflow-hidden' id='storage-inventory'>
            <div className='flex flex-wrap items-center justify-between gap-2 border-b border-ui-border px-5 py-4'>
                <h2 className='text-base font-semibold'>Storage and databases</h2>
                <span className='text-xs text-ui-muted'>{storage?.stale ? 'Last known sizes · status stale' : storage ? storage.host : 'Hanasand cluster only · host inventory unavailable'}</span>
            </div>
            <div className='overflow-x-auto'><table className='w-full text-left text-sm'>
                <thead className='bg-ui-raised text-xs text-ui-muted'><tr>
                    {['Database', 'Instance', 'Health', 'Tables', 'Connections', 'Size'].map(label => <th key={label} className={`px-5 py-3 font-medium ${label === 'Size' ? 'text-right' : ''}`}>{label}</th>)}
                </tr></thead>
                <tbody className='divide-y divide-ui-border'>
                    {rows ? rows.map(({ instance, database }) => <tr key={`${instance.id}/${database.name}`}>
                        <td className='px-5 py-3 font-medium'>{database.name}{database.replica && <span className='ml-2 rounded bg-ui-raised px-2 py-1 text-xs text-ui-muted'>Replica</span>}</td>
                        <td className='px-5 py-3 text-xs text-ui-muted'>{instance.id}<span className='block'>{instance.engine}</span></td>
                        <td className='px-5 py-3'><span className={`inline-flex items-center gap-1.5 ${fresh && instance.status === 'healthy' ? 'text-ui-success' : 'text-ui-warning'}`}>
                            {fresh && instance.status === 'healthy' ? <CheckCircle2 className='h-4 w-4' aria-hidden /> : <AlertTriangle className='h-4 w-4' aria-hidden />}
                            {!fresh ? 'Unknown' : instance.status === 'healthy' ? 'Healthy' : instance.status === 'unhealthy' ? 'Unhealthy' : 'Unavailable'}
                        </span></td>
                        <td className='px-5 py-3 tabular-nums'>{instance.id === 'hanasand_database' ? overview.clusters.flatMap(c => c.databases).find(d => d.name === database.name)?.tableCount ?? '—' : '—'}</td>
                        <td className='px-5 py-3 tabular-nums'>{database.connections ?? '—'}</td>
                        <td className='whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums'>{formatBytes(database.sizeBytes)}{database.memory && <span className='ml-1 text-xs font-normal text-ui-muted'>RAM</span>}</td>
                    </tr>) : overview.clusters.flatMap(cluster => cluster.databases.map(database => <tr key={`${cluster.id}/${database.name}`}>
                        <td className='px-5 py-3'>{database.name}</td><td className='px-5 py-3'>{cluster.name}</td><td className='px-5 py-3'>Unknown</td><td className='px-5 py-3'>{database.tableCount ?? '—'}</td><td className='px-5 py-3'>{database.activeConnections ?? '—'}</td><td className='px-5 py-3 text-right'>{formatBytes(database.sizeBytes)}</td>
                    </tr>))}
                </tbody>
            </table></div>
        </DashboardPanel>

        {overview.status !== 'unavailable' ? <DatabaseWorkbench overview={overview} /> : <p role='alert' className='text-sm text-ui-warning'>{overview.health.message}</p>}
        <Disclosure title='Queries' id='active-queries' detail={`${overview.queries.length} shown · ${overview.queries.filter(q => q.isLongRunning).length} long-running`}>
            <p className='text-xs text-ui-muted'>Long-running after {formatTime(overview.longRunningThresholdSeconds)} · Checked {formatDateTime(overview.generatedAt)}</p>
            {overview.queries.length ? <QueryTable queries={overview.queries} /> : <p className='mt-3 text-sm text-ui-muted'>{overview.status === 'unavailable' ? 'Query activity unavailable.' : 'No active queries.'}</p>}
        </Disclosure>
        <Disclosure title='Longest running query' detail={overview.longestQuery ? formatTime(overview.longestQuery.durationSeconds) : 'None'}>
            {overview.longestQuery ? <LongestQuery query={overview.longestQuery} /> : <p className='text-sm text-ui-muted'>No query to show.</p>}
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

function QueryTable({ queries }: { queries: DatabaseQueryActivity[] }) {
    return (
        <div className='mt-3 overflow-x-auto'>
            <table className='min-w-full text-left text-sm'>
                <thead className='border-b border-ui-border text-xs uppercase text-ui-muted'>
                    <tr>
                        <th className='py-2 pr-3 font-semibold'>Duration</th>
                        <th className='px-3 py-2 font-semibold'>Database</th>
                        <th className='px-3 py-2 font-semibold'>User</th>
                        <th className='px-3 py-2 font-semibold'>State</th>
                        <th className='px-3 py-2 font-semibold'>Wait</th>
                        <th className='py-2 pl-3 font-semibold'>Query</th>
                    </tr>
                </thead>
                <tbody className='divide-y divide-ui-border'>
                    {queries.map((query, index) => (
                        <tr key={`${query.database}-${query.user}-${query.durationSeconds}-${index}`} className='align-top text-ui-text'>
                            <td className='whitespace-nowrap py-2 pr-3 font-semibold text-ui-text'>
                                {formatTime(query.durationSeconds)}
                                {query.isLongRunning && <span className='ml-2 rounded-full bg-ui-danger/10 px-2 py-0.5 text-xs text-ui-danger'>Long</span>}
                            </td>
                            <td className='px-3 py-2'>{query.database || 'Database syncing'}</td>
                            <td className='px-3 py-2'>{query.user || 'User syncing'}</td>
                            <td className='px-3 py-2'>{query.state || 'State syncing'}</td>
                            <td className='px-3 py-2'>{[query.waitEventType, query.waitEvent].filter(Boolean).join(' / ') || 'Clear'}</td>
                            <td className='max-w-[28rem] py-2 pl-3 text-xs text-ui-muted'>
                                <code className='wrap-break-word'>{query.query || 'Query text unavailable'}</code>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

function LongestQuery({ query }: { query: DatabaseQueryActivity }) {
    return (
        <div className='mt-3 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
            <div className='grid gap-3 sm:grid-cols-3 xl:grid-cols-5'>
                <Fact label='Database' value={query.database || 'Database syncing'} />
                <Fact label='User' value={query.user || 'User syncing'} />
                <Fact label='State' value={query.state || 'State syncing'} />
                <Fact label='Duration' value={formatTime(query.durationSeconds)} />
                <Fact label='Wait' value={[query.waitEventType, query.waitEvent].filter(Boolean).join(' / ') || 'Clear'} />
            </div>
            <pre className='mt-3 max-h-96 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-ui-border bg-ui-panel p-3 text-xs text-ui-muted'>
                {query.query || 'Query text unavailable'}
            </pre>
        </div>
    )
}

function Fact({ label, value }: { label: string, value: string }) {
    return (
        <p>
            <span className='font-semibold text-ui-text'>{label}:</span> {value}
        </p>
    )
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
