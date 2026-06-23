import { Database, HardDrive, PlayCircle, Server, TimerReset } from 'lucide-react'
import Link from 'next/link'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getDatabaseOverview } from '@/utils/db/internal'
import ErrorNotice from '@/components/error/errorNotice'

export default async function DatabasePage() {
    const overview = await getDatabaseOverview()

    if (typeof overview === 'string') {
        return (
            <DashboardPage>
                <DashboardHeader eyebrow='Operations' title='Database' />
                <DashboardPanel className='p-5'><ErrorNotice message={overview} /></DashboardPanel>
            </DashboardPage>
        )
    }

    const longestQuery = overview.longestQuery

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Operations'
                title='Database'
                actions={
                    <div className='flex flex-wrap gap-2'>
                        <Link
                            href='/dashboard/db/backups'
                            className='rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 text-sm font-semibold text-[#3d4758] shadow-sm transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'
                        >
                            Backups
                        </Link>
                        <Link
                            href='/dashboard/db/restore'
                            className='rounded-lg border border-[#dfe5ee] bg-white px-3 py-2 text-sm font-semibold text-[#3d4758] shadow-sm transition hover:border-[#b8c5ff] hover:bg-[#f4f7ff]'
                        >
                            Restore
                        </Link>
                    </div>
                }
            />

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <MetricCard icon={<Server className='h-4 w-4 text-[#3056d3]' />} label='Clusters' value={String(overview.clusterCount)} />
                <MetricCard icon={<Database className='h-4 w-4 text-[#147a3b]' />} label='Databases' value={String(overview.databaseCount)} />
                <MetricCard icon={<HardDrive className='h-4 w-4 text-[#8a5a00]' />} label='Storage' value={formatBytes(overview.totalSizeBytes)} />
                <MetricCard icon={<PlayCircle className='h-4 w-4 text-[#6941c6]' />} label='Active queries' value={String(overview.activeQueries)} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.2fr_0.8fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center gap-2 text-[#171a21]'>
                        <TimerReset className='h-4 w-4 text-[#3056d3]' />
                        <h2 className='text-lg font-semibold'>Runtime</h2>
                    </div>
                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        <article className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4'>
                            <p className='text-xs font-semibold uppercase text-[#667085]'>Snapshot</p>
                            <p className='mt-2 text-sm font-medium text-[#171a21]'>{new Date(overview.generatedAt).toLocaleString()}</p>
                        </article>
                        <article className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4'>
                            <p className='text-xs font-semibold uppercase text-[#667085]'>Average active query runtime</p>
                            <p className='mt-2 text-sm font-medium text-[#171a21]'>{formatTime(overview.averageQuerySeconds)}</p>
                        </article>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center gap-2 text-[#171a21]'>
                        <TimerReset className='h-4 w-4 text-[#3056d3]' />
                        <h2 className='text-lg font-semibold'>Longest running query</h2>
                    </div>
                    <div className='mt-4 rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4 text-sm text-[#596170]'>
                        <p><span className='font-semibold text-[#3d4758]'>Database:</span> {longestQuery?.database || '—'}</p>
                        <p className='mt-2'><span className='font-semibold text-[#3d4758]'>State:</span> {longestQuery?.state || '—'}</p>
                        <p className='mt-2'><span className='font-semibold text-[#3d4758]'>Duration:</span> {formatTime(longestQuery?.durationSeconds)}</p>
                        <pre className='mt-4 max-h-48 overflow-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-[#dfe5ee] bg-white p-3 text-xs text-[#596170]'>
                            {longestQuery?.query || 'No active query details available.'}
                        </pre>
                    </div>
                </DashboardPanel>
            </div>

            <div className='grid gap-4'>
                {overview.clusters.map((cluster) => (
                    <DashboardPanel key={cluster.id} className='p-5'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold text-[#171a21]'>{cluster.name || cluster.id}</h2>
                                <p className='mt-1 text-sm text-[#596170]'>
                                    {[cluster.engine, cluster.version, cluster.host].filter(Boolean).join(' · ') || 'Cluster details unavailable'}
                                </p>
                            </div>
                            <div className='flex flex-wrap gap-2 text-xs font-semibold text-[#3d4758]'>
                                <span className='rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1'>
                                    {cluster.databaseCount} databases
                                </span>
                                <span className='rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1'>
                                    {cluster.activeQueries} active queries
                                </span>
                                <span className='rounded-full border border-[#dfe5ee] bg-[#f8fafc] px-3 py-1'>
                                    {formatBytes(cluster.totalSizeBytes)}
                                </span>
                            </div>
                        </div>
                        {cluster.error ? (
                            <ErrorNotice className='mt-4' message={cluster.error} />
                        ) : (
                            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                {cluster.databases.map((database) => (
                                    <article key={`${cluster.id}-${database.name}`} className='rounded-lg border border-[#dfe5ee] bg-[#f8fafc] p-4 text-sm text-[#596170]'>
                                        <h3 className='font-semibold text-[#171a21]'>{database.name}</h3>
                                        <p className='mt-2'><span className='font-semibold text-[#3d4758]'>Tables:</span> {database.tableCount}</p>
                                        <p className='mt-2'><span className='font-semibold text-[#3d4758]'>Connections:</span> {database.activeConnections ?? 0}</p>
                                        <p className='mt-2'><span className='font-semibold text-[#3d4758]'>Size:</span> {formatBytes(database.sizeBytes)}</p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </DashboardPanel>
                ))}
            </div>
        </DashboardPage>
    )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between text-[#596170]'>
                <span className='text-sm'>{label}</span>
                {icon}
            </div>
            <p className='mt-3 text-3xl font-semibold text-[#171a21]'>{value}</p>
        </DashboardPanel>
    )
}

function formatBytes(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
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
    if (!Number.isFinite(value ?? NaN) || !value) return '—'
    if (value < 60) return `${Math.round(value)}s`
    return `${Math.round(value / 60)}m`
}
