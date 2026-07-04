'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock3,
    Copy,
    Cpu,
    Database,
    ExternalLink,
    HardDrive,
    Mail,
    MemoryStick,
    PauseCircle,
    PlayCircle,
    RefreshCcw,
    ServerCog,
    StopCircle,
    TerminalSquare,
    Timer,
    Workflow,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import ErrorNotice from '@/components/error/errorNotice'
import { DashboardPanel } from '@/components/dashboard/ui'
import config from '@/config'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import { getCookie } from '@/utils/cookies/cookies'
import stopAllVms from '@/utils/vms/fetch/stopAllVms'
import restartDocker from '@/utils/vms/fetch/restartDocker'
import type { RuntimeLog } from '@/utils/logs/getLogs'
import {
    containerCpuMetric,
    containerHealth,
    containerMemoryMetric,
    formatBytes,
    formatDateTime,
    formatDuration,
    formatPercent,
    isFresh,
    normalizeDockerTelemetry,
    normalizeSystemTelemetry,
    type MetricState,
} from './systemPresentation'

type SystemDashboardProps = {
    id: string
    token: string
    systemTelemetry: SystemMetricsApiResponse
    dockerTelemetry: DockerTelemetryResponse
    vms: VM[]
    vmMetrics: VMMetrics[]
}

type SystemSummary = {
    label: string
    value: string
    note: string
    icon: ReactNode
    tone?: 'ok' | 'warn' | 'bad'
}

const relatedLinks = [
    { href: '/dashboard/logs', label: 'Logs', icon: <TerminalSquare className='h-4 w-4' /> },
    { href: '/dashboard/cron-jobs', label: 'Cron Jobs', icon: <Workflow className='h-4 w-4' /> },
    { href: '/dashboard/db', label: 'Database', icon: <Database className='h-4 w-4' /> },
    { href: '/dashboard/mail', label: 'Mail', icon: <Mail className='h-4 w-4' /> },
    { href: '/dashboard/system/ai', label: 'AI Metrics', icon: <Activity className='h-4 w-4' /> },
]

export default function SystemDashboard({
    id,
    token,
    systemTelemetry,
    dockerTelemetry: initialDockerTelemetry,
    vms,
    vmMetrics,
}: SystemDashboardProps) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const initialSystemTelemetry = useMemo(() => normalizeSystemTelemetry(systemTelemetry), [systemTelemetry])
    const [systemSnapshot, setSystemSnapshot] = useState<SystemSnapshot | null>(initialSystemTelemetry.system)
    const [systemUnavailableReason, setSystemUnavailableReason] = useState(initialSystemTelemetry.unavailable_reason || '')
    const [dockerTelemetry, setDockerTelemetry] = useState<DockerTelemetryResponse>(() => normalizeDockerTelemetry(initialDockerTelemetry))
    const [lastUpdated, setLastUpdated] = useState(dockerTelemetry.generated_at || new Date().toISOString())
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [refreshSeconds, setRefreshSeconds] = useState(15)
    const [refreshing, setRefreshing] = useState(false)
    const [selectedContainerId, setSelectedContainerId] = useState<string>(dockerTelemetry.containers[0]?.id || '')
    const [logs, setLogs] = useState<RuntimeLog[]>([])
    const [logsReason, setLogsReason] = useState('')
    const [logsLoading, setLogsLoading] = useState(false)

    const containers = useMemo(
        () => dockerTelemetry.containers.filter((container): container is DockerContainer => Boolean(container)),
        [dockerTelemetry.containers]
    )
    const selectedContainer = containers.find((container) => container.id === selectedContainerId) || containers[0] || null
    const runningContainers = containers.filter((container) => (container.state || container.status || '').toLowerCase().includes('running')).length
    const unavailableStats = containers.filter((container) => !container.stats && typeof container.cpu !== 'number' && typeof container.memory !== 'number').length
    const normalizedVms = Array.isArray(vms) ? vms.filter((vm): vm is VM => Boolean(vm)) : []
    const normalizedMetrics = Array.isArray(vmMetrics) ? vmMetrics.filter((metric): metric is VMMetrics => Boolean(metric)) : []
    const runningVms = normalizedVms.filter((vm) => (vm.status ?? '').toLowerCase() === 'running').length
    const stoppedVms = normalizedVms.filter((vm) => (vm.status ?? '').toLowerCase() === 'stopped').length
    const telemetryFresh = isFresh(lastUpdated, refreshSeconds * 2500)
    const unhealthyContainers = containers.filter((container) => {
        const tone = containerHealth(container).tone
        return tone === 'bad' || tone === 'warn'
    })
    const telemetryBlocked = Boolean(dockerTelemetry.unavailable_reason || (systemUnavailableReason && !systemSnapshot))
    const primaryHref = telemetryBlocked
        ? '#system-telemetry'
        : unhealthyContainers.length
            ? '#system-containers'
            : normalizedVms.length
                ? '#system-vms'
                : '#system-containers'
    const primaryTitle = telemetryBlocked
        ? 'Recover telemetry first'
        : unhealthyContainers.length
            ? 'Inspect container health'
            : normalizedVms.length
                ? 'Review virtual machines'
                : 'Wait for runtime inventory'
    const primaryDetail = telemetryBlocked
        ? dockerTelemetry.unavailable_reason || systemUnavailableReason || 'System telemetry is reconnecting.'
        : unhealthyContainers.length
            ? `${unhealthyContainers.length} container${unhealthyContainers.length === 1 ? '' : 's'} need review before VM operations.`
            : normalizedVms.length
                ? `${runningVms} VMs running, ${stoppedVms} stopped, with ${runningContainers}/${containers.length || 0} containers active.`
                : 'Container and VM inventory will appear when the live system streams respond.'
    const primaryActionLabel = telemetryBlocked
        ? 'Review telemetry'
        : unhealthyContainers.length
            ? 'Inspect containers'
            : normalizedVms.length
                ? 'Review VMs'
                : 'Open containers'

    const summary = useMemo<SystemSummary[]>(() => {
        const memoryPercent = systemSnapshot?.memory?.percent ? `${systemSnapshot.memory.percent}%` : 'Connecting'
        return [
            {
                label: 'Runtime',
                value: containers.length ? `${runningContainers}/${containers.length}` : '0',
                note: containers.length ? 'containers running' : 'container inventory checking',
                icon: <ServerCog className='h-4 w-4' />,
                tone: unavailableStats ? 'warn' : 'ok',
            },
            {
                label: 'CPU load',
                value: formatLoad(systemSnapshot?.load),
                note: '1 / 5 / 15 min',
                icon: <Cpu className='h-4 w-4' />,
            },
            {
                label: 'Memory',
                value: systemUnavailableReason && !systemSnapshot ? 'Unavailable' : memoryPercent,
                note: systemSnapshot ? `${formatBytes(systemSnapshot.memory.used)} / ${formatBytes(systemSnapshot.memory.total)}` : systemUnavailableReason || 'host telemetry connecting',
                icon: <MemoryStick className='h-4 w-4' />,
                tone: systemUnavailableReason && !systemSnapshot ? 'warn' : undefined,
            },
            {
                label: 'VMs',
                value: String(normalizedVms.length),
                note: `${runningVms} running, ${stoppedVms} stopped`,
                icon: <HardDrive className='h-4 w-4' />,
            },
        ]
    }, [containers.length, normalizedVms.length, runningContainers, runningVms, stoppedVms, systemSnapshot, systemUnavailableReason, unavailableStats])

    const loadContainerLogs = useCallback(async (container: DockerContainer | null) => {
        if (!container) {
            setLogs([])
            setLogsReason('')
            return
        }

        setLogsLoading(true)
        setLogsReason('')
        const params = new URLSearchParams({ limit: '120', service: container.name })
        try {
            const response = await fetch(`${config.url.api}/logs/realtime?${params.toString()}`, {
                cache: 'no-store',
                headers: { id, Authorization: `Bearer ${token}` },
            })

            if (response.status === 401) {
                router.push('/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true')
                return
            }

            if (!response.ok) {
                throw new Error(await response.text())
            }

            const body = await response.json()
            setLogs(Array.isArray(body.logs) ? body.logs as RuntimeLog[] : [])
            setLogsReason(typeof body.unavailable_reason === 'string' ? body.unavailable_reason : '')
        } catch (error) {
            setLogs([])
            setLogsReason(error instanceof Error ? error.message : 'Unable to load container logs.')
        } finally {
            setLogsLoading(false)
        }
    }, [id, router, token])

    const refreshAll = useCallback(async () => {
        setRefreshing(true)
        try {
            const [metricsResponse, dockerResponse] = await Promise.all([
                fetch(`${config.url.api}/metrics`, {
                    cache: 'no-store',
                    headers: { id, Authorization: `Bearer ${token}` },
                }),
                fetch(`${config.url.api}/docker`, {
                    cache: 'no-store',
                    headers: { id, Authorization: `Bearer ${token}` },
                }),
            ])

            if (metricsResponse.status === 401 || dockerResponse.status === 401) {
                router.push('/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true')
                return
            }

            if (metricsResponse.ok) {
                const raw = await metricsResponse.json()
                const telemetry = normalizeSystemTelemetry(raw)
                setSystemSnapshot(telemetry.system)
                setSystemUnavailableReason(telemetry.unavailable_reason || '')
            } else {
                setSystemUnavailableReason(await responseErrorMessage(metricsResponse, 'System telemetry'))
            }

            if (dockerResponse.ok) {
                const raw = await dockerResponse.json()
                const telemetry = normalizeDockerTelemetry(raw)
                setDockerTelemetry(telemetry)
                setLastUpdated(telemetry.generated_at || new Date().toISOString())
                if (!selectedContainerId && telemetry.containers[0]?.id) {
                    setSelectedContainerId(telemetry.containers[0].id)
                }
            } else {
                const dockerUnavailableReason = await responseErrorMessage(dockerResponse, 'Docker telemetry')
                setDockerTelemetry((current) => ({
                    ...current,
                    source: 'unavailable',
                    unavailable_reason: dockerUnavailableReason,
                    generated_at: new Date().toISOString(),
                }))
                setLastUpdated(new Date().toISOString())
            }

            setMessage('System telemetry refreshed.')
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to refresh system telemetry.')
        } finally {
            setRefreshing(false)
        }
    }, [id, router, selectedContainerId, setMessage, token])

    useEffect(() => {
        if (!autoRefresh) return
        const interval = window.setInterval(() => void refreshAll(), refreshSeconds * 1000)
        return () => window.clearInterval(interval)
    }, [autoRefresh, refreshAll, refreshSeconds])

    useEffect(() => {
        void loadContainerLogs(selectedContainer)
    }, [loadContainerLogs, selectedContainer])

    async function handleRestartContainer(container: DockerContainer) {
        const label = container.name || container.id.slice(0, 12)
        if (!window.confirm(`Restart ${label}? Active requests in this container may be interrupted.`)) return
        setMessage(await restartDocker(container.id))
        await refreshAll()
    }

    async function handleStopAll() {
        if (!window.confirm('Stop all virtual machines? This can interrupt active VM sessions.')) return
        const cookieToken = getCookie('access_token')
        const cookieId = getCookie('id')
        if (!cookieToken || !cookieId) {
            return router.push('/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true')
        }

        const response = await stopAllVms(cookieToken, cookieId)
        setMessage(response.message)
    }

    async function copyContainer(container: DockerContainer) {
        try {
            await navigator.clipboard.writeText(`${container.name} ${container.id}`)
            setMessage(`Copied ${container.name}.`)
        } catch {
            setMessage('Clipboard access is unavailable in this browser context.')
        }
    }

    return (
        <div className='grid gap-4'>
            <ErrorNotice compact variant='info' className='max-w-3xl' message={message as string | null} />

            <DashboardPanel className='p-4' id='system-telemetry'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                        <div className='flex flex-wrap items-center gap-2'>
                            <StatusBadge fresh={telemetryFresh} />
                            <span className='rounded-full border border-ui-border bg-ui-raised px-2.5 py-1 text-xs font-semibold text-ui-text'>
                                Source: {sourceLabel(dockerTelemetry.source)}
                            </span>
                        </div>
                        <p className='mt-2 text-sm text-ui-muted'>Live poll {formatDateTime(lastUpdated)}</p>
                        {dockerTelemetry.unavailable_reason && (
                            <p className='mt-2 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                                Docker telemetry degraded: {dockerTelemetry.unavailable_reason}
                            </p>
                        )}
                        {systemUnavailableReason && !systemSnapshot && (
                            <p className='mt-2 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>
                                Host telemetry degraded: {systemUnavailableReason}
                            </p>
                        )}
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <button
                            type='button'
                            onClick={() => void refreshAll()}
                            className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-raised'
                        >
                            <RefreshCcw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Refreshing' : 'Refresh'}
                        </button>
                        <button
                            type='button'
                            onClick={() => setAutoRefresh((value) => !value)}
                            className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold shadow-sm transition ${
                                autoRefresh ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-primary' : 'border-ui-border bg-ui-panel text-ui-text hover:bg-ui-raised'
                            }`}
                        >
                            {autoRefresh ? <PauseCircle className='h-4 w-4' /> : <PlayCircle className='h-4 w-4' />}
                            Auto
                        </button>
                        <label className='flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm'>
                            <Timer className='h-4 w-4 text-ui-muted' />
                            <select
                                value={refreshSeconds}
                                onChange={(event) => setRefreshSeconds(Number(event.target.value))}
                                className='bg-transparent outline-none'
                                aria-label='Refresh interval'
                            >
                                <option value={5}>5s</option>
                                <option value={15}>15s</option>
                                <option value={30}>30s</option>
                                <option value={60}>60s</option>
                            </select>
                        </label>
                    </div>
                </div>
            </DashboardPanel>

            <DashboardPanel className='grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center' data-system-primary-triage>
                <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 text-xs font-semibold text-ui-muted'>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>Recommended next</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{runningContainers}/{containers.length || 0} containers running</span>
                        <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1'>{runningVms} VMs running</span>
                    </div>
                    <h2 className='mt-3 text-lg font-semibold text-ui-text'>{primaryTitle}</h2>
                    <p className='mt-1 max-w-3xl text-sm leading-6 text-ui-muted'>{primaryDetail}</p>
                </div>
                <a
                    href={primaryHref}
                    className='inline-flex min-h-10 w-full items-center justify-center rounded-md bg-ui-primary px-4 text-sm font-semibold text-ui-canvas shadow-sm transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ui-primary/35 sm:w-auto'
                    data-system-primary-action
                >
                    {primaryActionLabel}
                </a>
            </DashboardPanel>

            <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-system-summary-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Host, container, and VM counters</span>
                    <span className='text-xs font-medium text-ui-muted'>{sourceLabel(dockerTelemetry.source)}, {formatDateTime(lastUpdated)}</span>
                </summary>
                <section className='grid gap-3 border-t border-ui-border p-3 sm:grid-cols-2 xl:grid-cols-4' data-system-summary-metrics>
                    {summary.map((item) => <SummaryCard key={item.label} item={item} />)}
                </section>
            </details>

            <section className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]' id='system-containers' data-system-containers>
                <DashboardPanel className='p-4'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-semibold text-ui-text'>Docker containers</h2>
                            <p className='mt-1 text-sm text-ui-muted'>{containers.length} reporting, {unavailableStats} streaming partial resource stats.</p>
                        </div>
                        <LinkButton href='/dashboard/logs' icon={<TerminalSquare className='h-4 w-4' />} label='Open Logs' />
                    </div>
                    {containers.length ? (
                        <div className='mt-4 overflow-x-auto'>
                            <table className='min-w-full text-left text-sm'>
                                <thead className='border-b border-ui-border text-xs uppercase text-ui-muted'>
                                    <tr>
                                        <th className='py-2 pr-3 font-semibold'>Container</th>
                                        <th className='px-3 py-2 font-semibold'>Health</th>
                                        <th className='px-3 py-2 font-semibold'>CPU</th>
                                        <th className='px-3 py-2 font-semibold'>Memory</th>
                                        <th className='px-3 py-2 font-semibold'>Ports</th>
                                        <th className='py-2 pl-3 text-right font-semibold'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-ui-border'>
                                    {containers.map((container) => (
                                        <ContainerRow
                                            key={container.id}
                                            container={container}
                                            selected={selectedContainer?.id === container.id}
                                            globalReason={dockerTelemetry.unavailable_reason}
                                            onSelect={() => setSelectedContainerId(container.id)}
                                            onCopy={() => void copyContainer(container)}
                                            onRestart={() => void handleRestartContainer(container)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState title='Container inventory checking' body={dockerTelemetry.unavailable_reason || 'Docker inventory is reconnecting to the live container stream.'} />
                    )}
                </DashboardPanel>

                <ContainerDetails
                    container={selectedContainer}
                    globalReason={dockerTelemetry.unavailable_reason}
                    logs={logs}
                    logsReason={logsReason}
                    logsLoading={logsLoading}
                    onRefreshLogs={() => void loadContainerLogs(selectedContainer)}
                    onCopy={() => selectedContainer ? void copyContainer(selectedContainer) : undefined}
                    onRestart={() => selectedContainer ? void handleRestartContainer(selectedContainer) : undefined}
                />
            </section>

            <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel' data-system-related-disclosure>
                <summary className='flex cursor-pointer list-none flex-col gap-1 px-4 py-3 text-sm font-semibold text-ui-text transition hover:bg-ui-panel sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden'>
                    <span>Related operations</span>
                    <span className='text-xs font-medium text-ui-muted'>{relatedLinks.length} linked consoles</span>
                </summary>
                <div className='flex flex-wrap gap-2 border-t border-ui-border p-3' data-system-related-links>
                    {relatedLinks.map((link) => <LinkButton key={link.href} {...link} />)}
                </div>
            </details>

            <DashboardPanel className='p-4' id='system-vms' data-system-vms>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-base font-semibold text-ui-text'>Virtual machines</h2>
                        <p className='mt-1 text-sm text-ui-muted'>{runningVms} running, {stoppedVms} stopped, {normalizedVms.length - runningVms - stoppedVms} checking status.</p>
                    </div>
                    <Link href='/dashboard/vms' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text transition hover:border-ui-primary/35 hover:bg-ui-raised'>
                        Open VM inventory
                    </Link>
                </div>
                {normalizedVms.length ? (
                    <div className='mt-4 overflow-x-auto'>
                        <table className='min-w-full text-left text-sm'>
                            <thead className='border-b border-ui-border text-xs uppercase text-ui-muted'>
                                <tr>
                                    <th className='py-2 pr-3 font-semibold'>Name</th>
                                    <th className='px-3 py-2 font-semibold'>Owner</th>
                                    <th className='px-3 py-2 font-semibold'>CPU</th>
                                    <th className='px-3 py-2 font-semibold'>Memory</th>
                                    <th className='px-3 py-2 font-semibold'>Status</th>
                                    <th className='py-2 pl-3 text-right font-semibold'>Open</th>
                                </tr>
                            </thead>
                            <tbody className='divide-y divide-ui-border'>
                                {normalizedVms.map((vm) => {
                                    const latestMetrics = normalizedMetrics
                                        .filter((metric) => metric.name === vm.name)
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
                                    return <VmTableRow key={vm.name} vm={vm} metrics={latestMetrics} />
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState title='VM inventory checking' body='Managed VM rows stream here as the inventory feed reports.' />
                )}
                <details className='mt-4 rounded-md border border-ui-border bg-ui-raised' data-system-vm-danger-actions>
                    <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/20 [&::-webkit-details-marker]:hidden'>
                        <span>VM danger actions</span>
                        <span className='text-xs font-medium text-ui-muted'>Stop all VMs</span>
                    </summary>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-t border-ui-border p-3'>
                        <p className='max-w-2xl text-sm leading-6 text-ui-muted'>Use this only for a planned maintenance window or emergency containment. Active VM sessions can be interrupted.</p>
                        <button
                            type='button'
                            onClick={handleStopAll}
                            className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-danger/35 bg-ui-danger/10 px-3 text-sm font-semibold text-ui-danger transition hover:bg-ui-danger/15'
                            data-system-stop-all-vms
                        >
                            <StopCircle className='h-4 w-4' />
                            Stop all VMs
                        </button>
                    </div>
                </details>
            </DashboardPanel>
        </div>
    )
}

function ContainerRow({
    container,
    selected,
    globalReason,
    onSelect,
    onCopy,
    onRestart,
}: {
    container: DockerContainer
    selected: boolean
    globalReason?: string
    onSelect: () => void
    onCopy: () => void
    onRestart: () => void
}) {
    const cpu = containerCpuMetric(container, globalReason)
    const memory = containerMemoryMetric(container, globalReason)
    const health = containerHealth(container)

    return (
        <tr className={`align-top text-ui-text ${selected ? 'bg-ui-primary/10' : ''}`}>
            <td className='py-3 pr-3'>
                <button type='button' onClick={onSelect} className='text-left'>
                    <span className='block font-semibold text-ui-text'>{container.name}</span>
                    <span className='mt-1 block max-w-72 truncate text-xs text-ui-muted'>{container.image || container.id}</span>
                </button>
            </td>
            <td className='px-3 py-3'><HealthPill health={health} /></td>
            <td className='px-3 py-3'><MetricText metric={cpu} /></td>
            <td className='px-3 py-3'><MetricText metric={memory} /></td>
            <td className='px-3 py-3'>{portLabel(container.ports)}</td>
            <td className='py-3 pl-3'>
                <div className='flex justify-end gap-1'>
                    <IconButton label={`Inspect ${container.name}`} onClick={onSelect}><ExternalLink className='h-4 w-4' /></IconButton>
                    <IconButton label={`Copy ${container.name}`} onClick={onCopy}><Copy className='h-4 w-4' /></IconButton>
                    <IconButton label={`Restart ${container.name}`} onClick={onRestart}><RefreshCcw className='h-4 w-4' /></IconButton>
                </div>
            </td>
        </tr>
    )
}

function ContainerDetails({
    container,
    globalReason,
    logs,
    logsReason,
    logsLoading,
    onRefreshLogs,
    onCopy,
    onRestart,
}: {
    container: DockerContainer | null
    globalReason?: string
    logs: RuntimeLog[]
    logsReason: string
    logsLoading: boolean
    onRefreshLogs: () => void
    onCopy: () => void
    onRestart: () => void
}) {
    if (!container) {
        return (
            <DashboardPanel className='p-4'>
                <EmptyState title='Select a container' body='Choose a container to inspect health, ports, restart count, and logs.' />
            </DashboardPanel>
        )
    }

    const cpu = containerCpuMetric(container, globalReason)
    const memory = containerMemoryMetric(container, globalReason)
    const health = containerHealth(container)

    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-start justify-between gap-3'>
                <div className='min-w-0'>
                    <h2 className='truncate text-base font-semibold text-ui-text'>{container.name}</h2>
                    <p className='mt-1 truncate text-sm text-ui-muted'>{container.image || 'image pending'}</p>
                </div>
                <HealthPill health={health} />
            </div>

            <div className='mt-4 grid gap-2 sm:grid-cols-2'>
                <Fact label='CPU' value={cpu.value} reason={cpu.reason} />
                <Fact label='Memory' value={memory.value} reason={memory.reason} />
                <Fact label='Uptime' value={formatDuration(container.uptime_seconds)} />
                <Fact label='Restarts' value={typeof container.restart_count === 'number' ? String(container.restart_count) : 'checking'} />
                <Fact label='Created' value={formatDateTime(container.created_at)} />
                <Fact label='Stats updated' value={formatDateTime(container.stats_updated_at)} />
            </div>

            <div className='mt-3 rounded-md border border-ui-border bg-ui-raised p-3 text-sm text-ui-muted'>
                <p className='font-semibold text-ui-text'>Ports</p>
                <p className='mt-1'>{portLabel(container.ports)}</p>
            </div>

            <div className='mt-3 flex flex-wrap gap-2'>
                <button type='button' onClick={onRefreshLogs} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm hover:bg-ui-raised'>
                    <RefreshCcw className={`h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} />
                    Logs
                </button>
                <button type='button' onClick={onCopy} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm hover:bg-ui-raised'>
                    <Copy className='h-4 w-4' />
                    Copy
                </button>
                <button type='button' onClick={onRestart} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 text-sm font-semibold text-ui-warning shadow-sm hover:bg-ui-warning/15'>
                    <RefreshCcw className='h-4 w-4' />
                    Restart
                </button>
            </div>

            <details className='mt-4 overflow-hidden rounded-md border border-ui-border bg-ui-canvas' data-system-container-logs-disclosure>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-ui-text outline-none transition hover:bg-ui-panel focus-visible:ring-2 focus-visible:ring-ui-primary/35 [&::-webkit-details-marker]:hidden'>
                    <span>Recent logs</span>
                    <Link href={`/dashboard/logs?service=${encodeURIComponent(container.name)}`} className='inline-flex items-center gap-1 text-xs font-semibold text-ui-primary hover:underline'>
                        Open feed
                        <ExternalLink className='h-3.5 w-3.5' />
                    </Link>
                </summary>
                {logsReason && (
                    <p className='mx-3 mt-2 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 py-2 text-sm text-ui-warning'>{logsReason}</p>
                )}
                <div className='max-h-72 overflow-auto border-t border-ui-border p-3 font-mono text-xs text-ui-text' data-system-container-log-tail>
                    {logs.length ? logs.slice(0, 24).map((log) => (
                        <p key={log.id} className='mb-2 wrap-break-word'>
                            <span className='text-ui-muted'>{formatLogTime(log.created_at)}</span>{' '}
                            <span className={logLevelClass(log.level)}>{log.level}</span>{' '}
                            {log.message}
                        </p>
                    )) : (
                        <p className='text-ui-muted'>{logsLoading ? 'Loading logs...' : 'Log stream is live; no recent line for this container.'}</p>
                    )}
                </div>
            </details>
        </DashboardPanel>
    )
}

function VmTableRow({ vm, metrics }: { vm: VM, metrics?: VMMetrics }) {
    const owner = vm.owner || vm.created_by || 'Unassigned'
    return (
        <tr className='text-ui-text'>
            <td className='py-3 pr-3 font-semibold text-ui-text'>{vm.name}</td>
            <td className='px-3 py-3'>{owner}</td>
            <td className='px-3 py-3'>{metrics ? formatPercent(metrics.cpu_usage_percent) : vm.limits_cpu || 'checking'}</td>
            <td className='px-3 py-3'>{metrics ? `${metrics.ram_used_mb}/${metrics.ram_total_mb} MB` : vm.limits_memory || 'checking'}</td>
            <td className='px-3 py-3'>{vm.status || 'Checking'}</td>
            <td className='py-3 pl-3 text-right'>
                <Link href={`/dashboard/vms/${vm.name}`} className='text-sm font-semibold text-ui-primary hover:underline'>Open</Link>
            </td>
        </tr>
    )
}

function SummaryCard({ item }: { item: SystemSummary }) {
    const tone = item.tone === 'bad'
        ? 'text-ui-danger'
        : item.tone === 'warn'
            ? 'text-ui-warning'
            : item.tone === 'ok'
                ? 'text-ui-success'
                : 'text-ui-primary'

    return (
        <DashboardPanel className='p-4'>
            <div className='flex items-center justify-between gap-3 text-ui-muted'>
                <span className='text-sm font-semibold'>{item.label}</span>
                <span className={tone}>{item.icon}</span>
            </div>
            <p className='mt-3 text-2xl font-semibold text-ui-text'>{item.value}</p>
            <p className='mt-1 text-xs font-medium text-ui-muted'>{item.note}</p>
        </DashboardPanel>
    )
}

function MetricText({ metric }: { metric: MetricState }) {
    return (
        <span className={metric.unavailable ? 'text-ui-warning' : 'text-ui-text'} title={metric.reason || metric.value}>
            {metric.value}
        </span>
    )
}

function Fact({ label, value, reason }: { label: string, value: string, reason?: string }) {
    return (
        <div className='rounded-md border border-ui-border bg-ui-raised p-3'>
            <p className='text-xs font-semibold uppercase text-ui-muted'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text'>{value}</p>
            {reason && <p className='mt-1 text-xs text-ui-warning'>{reason}</p>}
        </div>
    )
}

function HealthPill({ health }: { health: ReturnType<typeof containerHealth> }) {
    const tone = health.tone === 'ok'
        ? 'border-ui-success/35 bg-ui-success/10 text-ui-success'
        : health.tone === 'warn'
            ? 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
            : health.tone === 'bad'
                ? 'border-ui-danger/35 bg-ui-danger/10 text-ui-danger'
                : 'border-ui-border bg-ui-raised text-ui-text'

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
            {health.tone === 'ok' ? <CheckCircle2 className='h-3.5 w-3.5' /> : health.tone === 'bad' ? <AlertTriangle className='h-3.5 w-3.5' /> : <Clock3 className='h-3.5 w-3.5' />}
            {health.label}
        </span>
    )
}

function StatusBadge({ fresh }: { fresh: boolean }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
            fresh ? 'border-ui-success/35 bg-ui-success/10 text-ui-success' : 'border-ui-warning/35 bg-ui-warning/10 text-ui-warning'
        }`}>
            {fresh ? <CheckCircle2 className='h-3.5 w-3.5' /> : <AlertTriangle className='h-3.5 w-3.5' />}
            {fresh ? 'Fresh' : 'Stale'}
        </span>
    )
}

function IconButton({ label, onClick, children }: { label: string, onClick: () => void, children: ReactNode }) {
    return (
        <button
            type='button'
            onClick={onClick}
            aria-label={label}
            title={label}
            className='grid h-8 w-8 place-items-center rounded-md border border-ui-border bg-ui-panel text-ui-muted shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-raised hover:text-ui-primary'
        >
            {children}
        </button>
    )
}

function LinkButton({ href, icon, label }: { href: string, icon: ReactNode, label: string }) {
    return (
        <Link href={href} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm transition hover:border-ui-primary/35 hover:bg-ui-raised hover:text-ui-primary'>
            {icon}
            {label}
        </Link>
    )
}

function EmptyState({ title, body }: { title: string, body: string }) {
    return (
        <div className='rounded-md border border-dashed border-ui-border bg-ui-raised px-4 py-6 text-sm text-ui-muted'>
            <p className='font-semibold text-ui-text'>{title}</p>
            <p className='mt-1'>{body}</p>
        </div>
    )
}

function formatLoad(load: number[] | undefined): string {
    if (!load?.length) return 'Connecting'
    return load.map((value) => typeof value === 'number' ? value.toFixed(2) : String(value)).join(' / ')
}

function portLabel(ports?: DockerContainerPort[]) {
    if (!ports?.length) return 'Private network only'
    return ports.map((port) => {
        const target = port.public_port ? `${port.public_port}->${port.private_port}` : String(port.private_port)
        return `${target}/${port.type}`
    }).join(', ')
}

function sourceLabel(source?: string) {
    if (!source) return 'checking source'
    return source.replace(/_/g, ' ')
}

function formatLogTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toISOString().slice(11, 19)
}

function logLevelClass(level: RuntimeLog['level']) {
    if (level === 'error' || level === 'fatal') return 'text-ui-danger'
    if (level === 'warn') return 'text-ui-warning'
    if (level === 'debug') return 'text-ui-primary'
    return 'text-ui-success'
}

async function responseErrorMessage(response: Response, label: string) {
    return responseErrorMessageSync(response.status, await response.text().catch(() => ''), label)
}

function responseErrorMessageSync(status: number, body: string, label: string) {
    try {
        const parsed = JSON.parse(body) as { error?: unknown, message?: unknown }
        const message = typeof parsed.error === 'string'
            ? parsed.error
            : typeof parsed.message === 'string'
                ? parsed.message
                : ''
        if (message) return `${label} reported ${status}: ${message}`
    } catch {
        // Plain text response bodies fall through.
    }

    return body.trim()
        ? `${label} reported ${status}: ${body.trim().slice(0, 300)}`
        : `${label} reported ${status}.`
}
