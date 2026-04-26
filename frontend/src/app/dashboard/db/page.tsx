import { Database, HardDrive, PlayCircle, Server, TimerReset } from 'lucide-react'
import Link from 'next/link'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import { getDatabaseOverview } from '@/utils/db/internal'

export default async function DatabasePage() {
    const overview = await getDatabaseOverview()

    if (typeof overview === 'string') {
        return (
            <DashboardPage>
                <DashboardHeader eyebrow='Operations' title='Database' />
                <DashboardPanel className='p-5 text-sm text-red-100'>{overview}</DashboardPanel>
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
                            className={`
                                rounded-lg border border-white/10 bg-black/18
                                px-3 py-2 text-sm text-bright/75 transition
                                hover:border-orange-300/35 hover:bg-orange-300/8
                            `}
                        >
                            Backups
                        </Link>
                        <Link
                            href='/dashboard/db/restore'
                            className={`
                                rounded-lg border border-white/10 bg-black/18
                                px-3 py-2 text-sm text-bright/75 transition
                                hover:border-orange-300/35 hover:bg-orange-300/8
                            `}
                        >
                            Restore
                        </Link>
                    </div>
                }
            />

            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <MetricCard icon={<Server className='h-4 w-4 text-sky-300' />} label='Clusters' value={String(overview.clusterCount)} />
                <MetricCard icon={<Database className='h-4 w-4 text-emerald-300' />} label='Databases' value={String(overview.databaseCount)} />
                <MetricCard icon={<HardDrive className='h-4 w-4 text-orange-300' />} label='Storage' value={formatBytes(overview.totalSizeBytes)} />
                <MetricCard icon={<PlayCircle className='h-4 w-4 text-violet-300' />} label='Active queries' value={String(overview.activeQueries)} />
            </div>

            <div className='grid gap-4 xl:grid-cols-[1.2fr_0.8fr]'>
                <DashboardPanel className='p-5'>
                    <div className='flex items-center gap-2 text-bright'>
                        <TimerReset className='h-4 w-4 text-orange-300' />
                        <h2 className='text-lg font-semibold'>Runtime</h2>
                    </div>
                    <div className='mt-4 grid gap-3 md:grid-cols-2'>
                        <article className='rounded-2xl bg-black/18 p-4'>
                            <p className='text-xs uppercase tracking-[0.18em] text-bright/35'>Snapshot</p>
                            <p className='mt-2 text-sm text-bright/75'>{new Date(overview.generatedAt).toLocaleString()}</p>
                        </article>
                        <article className='rounded-2xl bg-black/18 p-4'>
                            <p className='text-xs uppercase tracking-[0.18em] text-bright/35'>Average active query runtime</p>
                            <p className='mt-2 text-sm text-bright/75'>{formatTime(overview.averageQuerySeconds)}</p>
                        </article>
                    </div>
                </DashboardPanel>

                <DashboardPanel className='p-5'>
                    <div className='flex items-center gap-2 text-bright'>
                        <TimerReset className='h-4 w-4 text-orange-300' />
                        <h2 className='text-lg font-semibold'>Longest running query</h2>
                    </div>
                    <div className='mt-4 rounded-2xl bg-black/18 p-4 text-sm text-bright/70'>
                        <p><span className='text-bright/40'>Database:</span> {longestQuery?.database || '—'}</p>
                        <p className='mt-2'><span className='text-bright/40'>State:</span> {longestQuery?.state || '—'}</p>
                        <p className='mt-2'><span className='text-bright/40'>Duration:</span> {formatTime(longestQuery?.durationSeconds)}</p>
                        <pre className={`
                            mt-4 max-h-48 overflow-auto whitespace-pre-wrap 
                            wrap-break-word rounded-xl border border-white/5
                            bg-black/20 p-3 text-xs text-bright/62
                        `}>
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
                                <h2 className='text-lg font-semibold text-bright'>{cluster.name || cluster.id}</h2>
                                <p className='mt-1 text-sm text-bright/45'>
                                    {[cluster.engine, cluster.version, cluster.host].filter(Boolean).join(' · ') || 'Cluster details unavailable'}
                                </p>
                            </div>
                            <div className='flex flex-wrap gap-2 text-xs text-bright/55'>
                                <span className='rounded-full border border-white/5 bg-white/5 px-3 py-1'>
                                    {cluster.databaseCount} databases
                                </span>
                                <span className='rounded-full border border-white/5 bg-white/5 px-3 py-1'>
                                    {cluster.activeQueries} active queries
                                </span>
                                <span className='rounded-full border border-white/5 bg-white/5 px-3 py-1'>
                                    {formatBytes(cluster.totalSizeBytes)}
                                </span>
                            </div>
                        </div>
                        {cluster.error ? (
                            <div className='mt-4 rounded-2xl bg-red-500/10 p-4 text-sm text-red-100'>{cluster.error}</div>
                        ) : (
                            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
                                {cluster.databases.map((database) => (
                                    <article key={`${cluster.id}-${database.name}`} className='rounded-2xl bg-black/18 p-4 text-sm text-bright/70'>
                                        <h3 className='font-semibold text-bright'>{database.name}</h3>
                                        <p className='mt-2'><span className='text-bright/40'>Tables:</span> {database.tableCount}</p>
                                        <p className='mt-2'><span className='text-bright/40'>Connections:</span> {database.activeConnections ?? 0}</p>
                                        <p className='mt-2'><span className='text-bright/40'>Size:</span> {formatBytes(database.sizeBytes)}</p>
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
            <div className='flex items-center justify-between text-bright/55'>
                <span className='text-sm'>{label}</span>
                {icon}
            </div>
            <p className='mt-3 text-3xl font-semibold tracking-[-0.04em] text-bright'>{value}</p>
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
