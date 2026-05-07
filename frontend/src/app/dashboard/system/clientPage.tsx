'use client'

import { Activity, Cpu, FolderKanban, HardDrive, MemoryStick, RefreshCcw, ServerCog, StopCircle, Thermometer, Workflow } from 'lucide-react'
import VmRow from '@/components/vms/vmRow'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import stopAllVms from '@/utils/vms/fetch/stopAllVms'
import restartDocker from '@/utils/vms/fetch/restartDocker'
import ErrorNotice from '@/components/error/errorNotice'
import { DashboardPanel } from '@/components/dashboard/ui'

type SystemDashboardProps = {
    system: SystemSnapshot | null
    dockerContainers: DockerContainer[]
    vms: VM[]
    vmMetrics: VMMetrics[]
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '—'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let n = bytes
    let i = 0
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024
        i++
    }
    const decimals = i === 0 ? 0 : 2
    return `${n.toFixed(decimals)} ${units[i]}`
}

function formatLoad(load: number[] | undefined): string {
    if (!load?.length) return '—'
    return load.map((v) => (typeof v === 'number' ? v.toFixed(2) : String(v))).join(' / ')
}

function systemToMetricCards(system: SystemSnapshot): SystemMetric[] {
    const { load, memory, swap, disk, temperature, powerUsage, processes, os } = system
    return [
        { name: 'Load average (1 / 5 / 15 min)', value: formatLoad(load), icon: <Activity className='h-4 w-4' /> },
        {
            name: 'Memory',
            value: `${memory.percent}% — ${formatBytes(memory.used)} / ${formatBytes(memory.total)}`,
            icon: <MemoryStick className='h-4 w-4' />
        },
        { name: 'Swap usage', value: String(swap).includes('%') ? String(swap) : `${swap}%`, icon: <Workflow className='h-4 w-4' /> },
        { name: 'Disk', value: disk, icon: <FolderKanban className='h-4 w-4' /> },
        { name: 'Temperature', value: temperature, icon: <Thermometer className='h-4 w-4' /> },
        { name: 'Power usage', value: powerUsage, icon: <Cpu className='h-4 w-4' /> },
        { name: 'Processes', value: processes, icon: <ServerCog className='h-4 w-4' /> },
        { name: 'OS', value: os, icon: <HardDrive className='h-4 w-4' /> },
    ]
}

export default function SystemDashboard({ system, dockerContainers, vms, vmMetrics }: SystemDashboardProps) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const normalizedDockerContainers = Array.isArray(dockerContainers)
        ? dockerContainers.filter((container): container is DockerContainer => Boolean(container))
        : []
    const normalizedVms = Array.isArray(vms)
        ? vms.filter((vm): vm is VM => Boolean(vm))
        : []
    const normalizedMetrics = Array.isArray(vmMetrics)
        ? vmMetrics.filter((metric): metric is VMMetrics => Boolean(metric))
        : []
    const runningVms = normalizedVms.filter((vm) => (vm.status ?? '').toLowerCase() === 'running').length
    const stoppedVms = normalizedVms.filter((vm) => (vm.status ?? '').toLowerCase() === 'stopped').length
    const vmOverviewClass = 'rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-medium text-bright/58'
    const idleVms = normalizedVms.length - runningVms - stoppedVms

    const metricCards = system ? systemToMetricCards(system) : []

    async function handleRestartContainer(containerId: string) {
        setMessage(await restartDocker(containerId))
    }

    async function handleStopAll() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return router.push('/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true')
        }

        const response = await stopAllVms(token, id)
        setMessage(response.message)
    }

    return (
        <div className='grid gap-3'>
            <ErrorNotice compact variant='info' className='max-w-2xl' message={message as string | null} />
            <DashboardPanel className='grid gap-3 p-4'>
                <h1 className='text-base font-medium text-bright'>System metrics</h1>
                {!system ? (
                    <p className='text-sm text-bright/40'>No system metrics available.</p>
                ) : (
                    <>
                        <div className='grid gap-2 md:grid-cols-3 xl:grid-cols-4'>
                            {metricCards.map((metric) => (
                                <div key={metric.name} className='flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3'>
                                    <div className='flex items-center justify-between text-bright/38'>
                                        <h2 className='text-sm font-medium text-bright/82'>{metric.name}</h2>
                                        {metric.icon}
                                    </div>
                                    <span className='wrap-break-word text-sm text-bright/42'>{metric.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className='grid gap-2 md:grid-cols-2'>
                            <div className='flex min-h-0 flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3'>
                                <div className='flex items-center justify-between text-bright/38'>
                                    <h2 className='text-sm font-medium text-bright/82'>IPv4</h2>
                                    <HardDrive className='h-4 w-4' />
                                </div>
                                <pre className='max-h-40 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs text-bright/42'>
                                    {system.ipv4?.length ? system.ipv4.join('\n') : '—'}
                                </pre>
                            </div>
                            <div className='flex min-h-0 flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3'>
                                <div className='flex items-center justify-between text-bright/38'>
                                    <h2 className='text-sm font-medium text-bright/82'>IPv6</h2>
                                    <HardDrive className='h-4 w-4' />
                                </div>
                                <pre className='max-h-40 overflow-y-auto whitespace-pre-wrap break-all font-mono text-xs text-bright/42'>
                                    {system.ipv6?.length ? system.ipv6.join('\n') : '—'}
                                </pre>
                            </div>
                        </div>
                    </>
                )}
            </DashboardPanel>

            <DashboardPanel className='grid gap-3 p-4'>
                <h1 className='text-base font-medium text-bright'>Docker containers</h1>
                <div className='grid gap-2 md:grid-cols-3'>
                    {normalizedDockerContainers.map(container => (
                        <div key={container.id} className='flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-3'>
                            <div className='flex items-center justify-between'>
                                <h3 className='text-sm font-medium text-bright/82'>{container.name}</h3>
                                <button type='button' onClick={() => handleRestartContainer(container.id)} className='grid h-8 w-8 place-items-center rounded-lg text-bright/45 hover:bg-white/10 hover:text-bright' aria-label={`Restart ${container.name}`}>
                                    <RefreshCcw className='h-4 w-4' />
                                </button>
                            </div>
                            <div className='flex flex-col gap-1 text-sm text-bright/45'>
                                <p className='flex items-center gap-1'><Cpu className='w-4 h-4' /> CPU: {container.cpu}%</p>
                                <p className='flex items-center gap-1'><HardDrive className='w-4 h-4' /> Memory: {container.memory} MB</p>
                                <p>Status: {container.status}</p>
                            </div>
                        </div>
                    ))}
                    {!normalizedDockerContainers.length ? <EmptyState text='No Docker containers reported yet.' /> : null}
                </div>
            </DashboardPanel>

            <DashboardPanel className='grid gap-3 p-4'>
                <div className='flex items-center justify-between gap-3'>
                    <div className='flex flex-wrap items-center gap-2'>
                        <h1 className='text-base font-medium text-bright'>Virtual machines</h1>
                        <span className={vmOverviewClass}>{runningVms} Running</span>
                        <span className={vmOverviewClass}>{idleVms} Idle</span>
                        <span className={vmOverviewClass}>{stoppedVms} Stopped</span>
                    </div>
                    <button type='button' onClick={handleStopAll} className='group flex h-9 items-center gap-2 rounded-lg border border-red-300/10 bg-red-500/10 px-3 text-sm font-medium text-red-100/80 hover:bg-red-500/20'>
                        <StopCircle className='w-4 h-4 group-hover:stroke-red-500' />
                        Stop all
                    </button>
                </div>
                {normalizedVms.length ? <div className='overflow-x-auto'>
                    <div className='min-w-[74rem]'>
                        <div className='grid items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] p-2 text-xs font-semibold text-bright/45 lg:grid-cols-[minmax(14rem,1.3fr)_minmax(10rem,1fr)_7rem_10rem_minmax(9rem,0.95fr)_minmax(9rem,0.95fr)_7rem_minmax(16rem,1.4fr)_6.5rem]'>
                            <h1>Name</h1>
                            <h1>Owner</h1>
                            <h1>CPU</h1>
                            <h1>Memory</h1>
                            <h1>Created at</h1>
                            <h1>Last used</h1>
                            <h1>Status</h1>
                            <h1>Tags</h1>
                            <h1 className='text-right'>Actions</h1>
                        </div>
                        {normalizedVms.map((vm) => {
                            const latestMetrics = normalizedMetrics
                                .filter((metric) => metric.name === vm.name)
                                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

                            return <VmRow key={vm.name} vm={vm} metrics={latestMetrics} />
                        })}
                    </div>
                </div> : <EmptyState text='No virtual machines reported yet.' />}
            </DashboardPanel>
        </div>
    )
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className='rounded-lg border border-dashed border-white/10 bg-white/[0.025] px-3 py-4 text-sm text-bright/42'>
            {text}
        </div>
    )
}
