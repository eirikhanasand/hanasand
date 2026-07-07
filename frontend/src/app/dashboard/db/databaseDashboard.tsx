import { Activity, AlertTriangle, ArchiveRestore, Clock3, Database, DatabaseBackup, HardDrive, PlayCircle, Radio, Server, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import ErrorNotice from '@/components/error/errorNotice'
import type { DatabaseOverview, DatabaseQueryActivity } from '@/utils/db/internal'
import DatabaseWorkbench from './databaseWorkbench'

export function DatabaseDashboard({ overview }: { overview: DatabaseOverview }) {
    const unavailable = overview.status === 'unavailable'
    const longRunningQueries = overview.queries.filter(query => query.isLongRunning)
    const activeQueryCount = overview.activeQueries ?? overview.queries.filter(query => query.state === 'active').length
    const databaseRows = overview.clusters.flatMap(cluster => cluster.databases.map(database => ({ cluster, database })))
    const primaryHref = unavailable ? '/dashboard/logs' : activeQueryCount > 0 ? '#active-queries' : '#storage-inventory'
    const primaryAction = unavailable ? 'Open logs' : activeQueryCount > 0 ? 'Review queries' : 'Review inventory'
    const primaryTitle = unavailable
        ? 'Restore telemetry before triage'
        : longRunningQueries.length
            ? 'Review long-running queries now'
            : activeQueryCount > 0
                ? 'Watch active query pressure'
                : 'Confirm inventory and backup readiness'
    const primaryDetail = unavailable
        ? overview.health.detail || overview.health.message
        : longRunningQueries.length
            ? `${longRunningQueries.length} query${longRunningQueries.length === 1 ? '' : 'ies'} exceeded the ${formatTime(overview.longRunningThresholdSeconds)} watch threshold.`
            : activeQueryCount > 0
                ? `${activeQueryCount} active query${activeQueryCount === 1 ? '' : 'ies'} are running with no long-running rows right now.`
                : `${overview.databaseCount ?? databaseRows.length} databases are indexed; use the inventory to confirm storage and backup context.`
    const queryStateText = unavailable
        ? 'Long-running query state: telemetry reconnecting.'
        : longRunningQueries.length
            ? `Long-running query state: ${longRunningQueries.length} long-running query${longRunningQueries.length === 1 ? '' : 'ies'} need review.`
            : 'Long-running query state: no long-running queries right now.'
    const monitorMetrics = [
        { label: 'Clusters', value: formatNumberMetric(overview.clusterCount) },
        { label: 'Databases', value: formatNumberMetric(overview.databaseCount) },
        { label: 'Storage', value: overview.totalSizeBytes === null ? 'Metering' : formatBytes(overview.totalSizeBytes) },
        { label: 'Active queries', value: String(activeQueryCount) },
        { label: 'Long-running', value: String(longRunningQueries.length) },
    ]

    return (
        <DashboardPage>
            <DashboardHeader eyebrow='Operations' title='Database' actions={<DatabaseActions />} />

            <DashboardPanel className={`p-4 ${unavailable ? 'border-ui-danger/30 bg-ui-danger/10' : 'border-ui-success/30 bg-ui-success/10'}`}>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div className='flex min-w-0 gap-3'>
                        {unavailable ? <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-ui-danger' /> : <ShieldCheck className='mt-0.5 h-5 w-5 shrink-0 text-ui-success' />}
                        <div className='min-w-0'>
                            <p className={`mb-1 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${unavailable ? 'border-ui-danger/30 bg-ui-danger/15 text-ui-danger' : 'border-ui-success/30 bg-ui-success/15 text-ui-success'}`}>
                                {unavailable ? 'Unavailable' : 'Live'}
                            </p>
                            <p className='text-sm font-semibold text-ui-text'>{overview.health.message}</p>
                            {overview.health.detail && <p className='mt-1 text-sm text-ui-muted'>{overview.health.detail}</p>}
                        </div>
                    </div>
                    <p className='shrink-0 text-xs font-medium text-ui-muted'>Checked {formatDateTime(overview.generatedAt)}</p>
                </div>
            </DashboardPanel>

            <DashboardPanel className='p-4'>
                <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center' data-db-primary-triage>
                    <div className='min-w-0'>
                        <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>Recommended next</span>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{activeQueryCount} active</span>
                            <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{longRunningQueries.length} long-running</span>
                        </div>
                        <h2 className='mt-3 text-lg font-semibold text-ui-text'>{primaryTitle}</h2>
                        <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{primaryDetail}</p>
                        <p className='mt-2 text-sm font-semibold text-ui-text' data-db-long-running-state>{queryStateText}</p>
                        <div className='mt-3 grid gap-2 sm:grid-cols-5' data-db-monitor-metrics>
                            {monitorMetrics.map(metric => (
                                <div key={metric.label} className='rounded-md border border-ui-border bg-ui-panel px-3 py-2'>
                                    <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-ui-muted'>{metric.label}</p>
                                    <p className='mt-1 text-sm font-semibold text-ui-text'>{metric.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    <Link
                        href={primaryHref}
                        className='inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ui-primary/40 sm:w-auto'
                        data-db-primary-action
                    >
                        {primaryAction}
                    </Link>
                </div>
            </DashboardPanel>

            <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-db-telemetry-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-raised sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Telemetry details and counters</span>
                    <span className='text-xs font-medium text-ui-muted'>{overview.clusterCount ?? 0} clusters, {overview.databaseCount ?? databaseRows.length} databases, {formatBytes(overview.totalSizeBytes)}</span>
                </summary>
                <div className='grid gap-3 border-t border-ui-border p-3'>
                    <section className='grid gap-3 xl:grid-cols-3' data-db-operation-lanes>
                        <OperationLane
                            icon={<Radio className='h-4 w-4' />}
                            title='Telemetry poll'
                            value={unavailable ? 'retrying' : 'live'}
                            detail={unavailable ? overview.health.detail || overview.health.message : `${databaseRows.length} database rows read from PostgreSQL telemetry`}
                            tone={unavailable ? 'bad' : 'ok'}
                        />
                        <OperationLane
                            icon={<Activity className='h-4 w-4' />}
                            title='Query watcher'
                            value={`${activeQueryCount} active`}
                            detail={longRunningQueries.length ? `${longRunningQueries.length} long-running query${longRunningQueries.length === 1 ? '' : 'ies'} need review` : 'No long-running queries right now'}
                            tone={longRunningQueries.length ? 'watch' : 'ok'}
                        />
                        <OperationLane
                            icon={<HardDrive className='h-4 w-4' />}
                            title='Inventory stream'
                            value={overview.totalSizeBytes === null ? 'connecting' : formatBytes(overview.totalSizeBytes)}
                            detail={overview.clusters.length ? `${overview.clusters.length} cluster${overview.clusters.length === 1 ? '' : 's'}, ${overview.databaseCount ?? databaseRows.length} databases tracked` : 'Checking PostgreSQL access for cluster inventory'}
                            tone={overview.clusters.length ? 'ok' : 'watch'}
                        />
                    </section>

                    <div className='grid gap-3 md:grid-cols-3 xl:grid-cols-6' data-db-metrics>
                        <MetricCard icon={<Server className='h-4 w-4 text-ui-primary' />} label='Clusters' value={formatNumberMetric(overview.clusterCount)} />
                        <MetricCard icon={<Database className='h-4 w-4 text-ui-success' />} label='Databases' value={formatNumberMetric(overview.databaseCount)} />
                        <MetricCard icon={<HardDrive className='h-4 w-4 text-ui-warning' />} label='Storage' value={overview.totalSizeBytes === null ? 'Metering' : formatBytes(overview.totalSizeBytes)} />
                        <MetricCard icon={<PlayCircle className='h-4 w-4 text-ui-primary' />} label='Active queries' value={String(activeQueryCount)} />
                        <MetricCard icon={<Clock3 className='h-4 w-4 text-ui-primary' />} label='Avg active runtime' value={formatTime(overview.averageQuerySeconds)} />
                        <MetricCard icon={<AlertTriangle className='h-4 w-4 text-ui-danger' />} label='Long-running' value={String(longRunningQueries.length)} />
                    </div>
                </div>
            </details>

            <div className='grid gap-4 xl:grid-cols-[1.35fr_0.65fr]'>
                <DashboardPanel className='p-4' id='active-queries'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Active and long-running queries</h2>
                            <p className='mt-1 text-xs text-ui-muted'>Long-running threshold: {formatTime(overview.longRunningThresholdSeconds)}. Last checked {formatDateTime(overview.generatedAt)}.</p>
                        </div>
                    </div>
                    {unavailable ? (
                        <EmptyState title='Query telemetry unavailable' body='The dashboard is polling the database metrics endpoint. Fix the connection noted above to restore active query rows.' />
                    ) : overview.queries.length ? (
                        <QueryTable queries={overview.queries} />
                    ) : (
                        <EmptyState title='Query watcher live' body='Active and long-running query rows stream here as PostgreSQL reports them.' />
                    )}
                    {!unavailable && overview.queries.length > 0 && longRunningQueries.length === 0 && (
                        <p className='mt-3 rounded-md border border-ui-border bg-ui-canvas px-3 py-2 text-sm font-medium text-ui-text'>
                            Live watch: no long-running queries right now.
                        </p>
                    )}
                </DashboardPanel>

                <DashboardPanel className='p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Longest running query</h2>
                    {overview.longestQuery ? (
                        <LongestQuery query={overview.longestQuery} />
                    ) : (
                        <EmptyState title={unavailable ? 'Query watcher retrying' : 'Query watcher live'} body={unavailable ? 'Query details return when PostgreSQL telemetry is readable.' : 'Longest-query detail streams here when PostgreSQL reports query pressure.'} />
                    )}
                </DashboardPanel>
            </div>

            {!unavailable && <DatabaseWorkbench overview={overview} />}

            <div className='grid gap-4 xl:grid-cols-[1fr_0.7fr]'>
                <DashboardPanel className='p-4' id='storage-inventory'>
                    <h2 className='text-base font-semibold text-ui-text'>Storage and databases</h2>
                    {overview.clusters.length ? (
                        <div className='mt-3 overflow-x-auto'>
                            <table className='min-w-full text-left text-sm'>
                                <thead className='border-b border-ui-border text-xs uppercase text-ui-muted'>
                                    <tr>
                                        <th className='py-2 pr-3 font-semibold'>Database</th>
                                        <th className='px-3 py-2 font-semibold'>Tables</th>
                                        <th className='px-3 py-2 font-semibold'>Connections</th>
                                        <th className='py-2 pl-3 text-right font-semibold'>Size</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-ui-border'>
                                    {overview.clusters.flatMap(cluster => cluster.databases.map(database => (
                                        <tr key={`${cluster.id}-${database.name}`} className='text-ui-text'>
                                            <td className='py-2 pr-3 font-semibold text-ui-text'>{database.name}</td>
                                            <td className='px-3 py-2'>{database.tableCount ?? 'Counting'}</td>
                                            <td className='px-3 py-2'>{database.activeConnections ?? 0}</td>
                                            <td className='py-2 pl-3 text-right'>{formatBytes(database.sizeBytes)}</td>
                                        </tr>
                                    )))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState title='Inventory stream retrying' body='Database rows return when PostgreSQL telemetry is readable.' />
                    )}
                </DashboardPanel>

                <DashboardPanel className='p-4'>
                    <h2 className='text-base font-semibold text-ui-text'>Cluster context</h2>
                    {overview.clusters.length ? overview.clusters.map(cluster => (
                        <div key={cluster.id} className='mt-3 rounded-md border border-ui-border bg-ui-canvas p-3 text-sm text-ui-muted'>
                            <p className='font-semibold text-ui-text'>{cluster.name || cluster.id}</p>
                            <p className='mt-1'>{[cluster.engine, cluster.version, cluster.host].filter(Boolean).join(' · ')}</p>
                            <div className='mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-ui-text'>
                                <span>{cluster.databaseCount} DBs</span>
                                <span>{cluster.activeQueries} active</span>
                                <span>{formatBytes(cluster.totalSizeBytes)}</span>
                            </div>
                            {cluster.error && <ErrorNotice className='mt-3' message={cluster.error} />}
                        </div>
                    )) : (
                        <EmptyState title='Cluster stream retrying' body='Cluster context returns when the API database host and credentials can read telemetry.' />
                    )}
                    <div className='mt-3 rounded-md border border-ui-border bg-ui-panel p-3 text-sm text-ui-muted'>
                        <p className='font-semibold text-ui-text'>Backup actions</p>
                        <p className='mt-1'>Backups shows the active backup lane and schedule. Restore opens indexed restore files once the database and backup service are connected.</p>
                    </div>
                </DashboardPanel>
            </div>
        </DashboardPage>
    )
}

function OperationLane({ icon, title, value, detail, tone }: { icon: ReactNode, title: string, value: string, detail: string, tone: 'ok' | 'watch' | 'bad' }) {
    return (
        <DashboardPanel className='overflow-hidden p-0 border-ui-border bg-ui-panel'>
            <div className='flex items-center justify-between gap-3 border-b border-ui-border bg-ui-panel px-4 py-3'>
                <div className='flex min-w-0 items-center gap-2 text-sm font-semibold text-ui-text'>
                    <span className={operationToneText(tone)}>{icon}</span>
                    <span className='truncate'>{title}</span>
                </div>
                <span className={`h-2 w-2 rounded-full ${operationToneDot(tone)}`} />
            </div>
            <div className='p-4'>
                <p className='line-clamp-1 text-lg font-semibold text-ui-text'>{value}</p>
                <p className='mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ui-muted'>{detail}</p>
            </div>
        </DashboardPanel>
    )
}

export function DatabaseActions() {
    return (
        <div className='flex flex-wrap gap-2'>
            <ActionLink href='/dashboard/db/backups' icon={<DatabaseBackup className='h-4 w-4' />} label='Backups' />
            <ActionLink href='/dashboard/db/restore' icon={<ArchiveRestore className='h-4 w-4' />} label='Restore' />
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

function MetricCard({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <DashboardPanel className='p-3'>
            <div className='flex items-center justify-between gap-2 text-ui-muted'>
                <span className='text-xs font-medium uppercase'>{label}</span>
                {icon}
            </div>
            <p className='mt-2 text-xl font-semibold text-ui-text'>{value}</p>
        </DashboardPanel>
    )
}

function operationToneText(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'text-ui-success'
    if (tone === 'watch') return 'text-ui-warning'
    return 'text-ui-danger'
}

function operationToneDot(tone: 'ok' | 'watch' | 'bad') {
    if (tone === 'ok') return 'bg-ui-success shadow-sm'
    if (tone === 'watch') return 'bg-ui-warning shadow-sm'
    return 'bg-ui-danger shadow-sm'
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
            <div className='grid grid-cols-2 gap-2'>
                <Fact label='Database' value={query.database || 'Database syncing'} />
                <Fact label='User' value={query.user || 'User syncing'} />
                <Fact label='State' value={query.state || 'State syncing'} />
                <Fact label='Duration' value={formatTime(query.durationSeconds)} />
                <Fact label='Wait' value={[query.waitEventType, query.waitEvent].filter(Boolean).join(' / ') || 'Clear'} />
            </div>
            <pre className='mt-3 max-h-40 overflow-auto whitespace-pre-wrap wrap-break-word rounded-md border border-ui-border bg-ui-panel p-3 text-xs text-ui-muted'>
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

function EmptyState({ title, body }: { title: string, body: string }) {
    return (
        <div className='mt-3 rounded-md border border-dashed border-ui-border bg-ui-canvas px-3 py-3 text-sm'>
            <p className='font-semibold text-ui-text'>{title}</p>
            <p className='mt-1 text-ui-muted'>{body}</p>
        </div>
    )
}

function formatNumberMetric(value: number | null) {
    return value === null ? 'Connecting' : String(value)
}

function formatBytes(bytes: number | null) {
    if (!Number.isFinite(bytes ?? NaN) || !bytes || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let value = bytes
    let index = 0
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index++
    }
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`
}

function formatTime(value?: number | null) {
    if (!Number.isFinite(value ?? NaN) || !value) return 'Quiet'
    if (value < 60) return `${Math.round(value)}s`
    if (value < 3600) return `${Math.round(value / 60)}m`
    return `${Math.round(value / 3600)}h`
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString()
}
