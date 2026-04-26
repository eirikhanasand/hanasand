'use client'

import { Activity, Cpu, FolderKanban, HardDrive, MemoryStick, RefreshCcw, ServerCog, StopCircle, Thermometer, Workflow } from 'lucide-react'
import SystemDashboardVMListItem from '@/components/vms/systemDashboardVMListItem'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import stopAllVms from '@/utils/vms/fetch/stopAllVms'
import restartDocker from '@/utils/vms/fetch/restartDocker'
import Notify from '@/components/notify/notify'

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
    const vmOverviewClass = 'bg-bright/3 text-sm outline outline-dark rounded-md py-0.5 px-4 text-bright/80'
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
        <div className='grid gap-6'>
            <Notify absolute className='px-8' color='bg-blue-500' background='bg-dark/40 outline outline-dark text-bright/80' message={message} />
            <div className='rounded-md p-2 space-y-2'>
                <h1 className='font-semibold text-xl text-bright/80'>System Metrics</h1>
                {!system ? (
                    <p className='text-sm text-gray-400'>No system metrics available.</p>
                ) : (
                    <>
                        <div className='grid md:grid-cols-3 gap-4'>
                            {metricCards.map((metric) => (
                                <div key={metric.name} className='rounded-2xl bg-dark/35 p-4 outline outline-dark flex flex-col gap-2'>
                                    <div className='flex items-center justify-between text-[#fd8738]'>
                                        <h2 className='font-semibold text-lg text-bright/90'>{metric.name}</h2>
                                        {metric.icon}
                                    </div>
                                    <span className='text-sm text-gray-300 wrap-break-word'>{metric.value}</span>
                                </div>
                            ))}
                        </div>
                        <div className='grid md:grid-cols-2 gap-4 pt-2'>
                            <div className='rounded-2xl bg-dark/35 p-4 outline outline-dark flex flex-col gap-2 min-h-0'>
                                <div className='flex items-center justify-between text-[#fd8738]'>
                                    <h2 className='font-semibold text-lg text-bright/90'>IPv4</h2>
                                    <HardDrive className='h-4 w-4' />
                                </div>
                                <pre className='text-xs text-gray-300 whitespace-pre-wrap break-all max-h-40 overflow-y-auto font-mono'>
                                    {system.ipv4?.length ? system.ipv4.join('\n') : '—'}
                                </pre>
                            </div>
                            <div className='rounded-2xl bg-dark/35 p-4 outline outline-dark flex flex-col gap-2 min-h-0'>
                                <div className='flex items-center justify-between text-[#fd8738]'>
                                    <h2 className='font-semibold text-lg text-bright/90'>IPv6</h2>
                                    <HardDrive className='h-4 w-4' />
                                </div>
                                <pre className='text-xs text-gray-300 whitespace-pre-wrap break-all max-h-40 overflow-y-auto font-mono'>
                                    {system.ipv6?.length ? system.ipv6.join('\n') : '—'}
                                </pre>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className='rounded-md p-2 space-y-2'>
                <h1 className='font-semibold text-xl text-bright/80'>Docker Containers</h1>
                <div className='grid md:grid-cols-3 gap-4'>
                    {normalizedDockerContainers.map(container => (
                        <div key={container.id} className='rounded-2xl p-4 backdrop-blur-md outline outline-white/10 flex flex-col gap-2'>
                            <div className='flex justify-between items-center'>
                                <h3 className='font-semibold'>{container.name}</h3>
                                <button onClick={() => handleRestartContainer(container.id)} className='hover:text-green-400'>
                                    <RefreshCcw />
                                </button>
                            </div>
                            <div className='text-sm flex flex-col gap-1'>
                                <p className='flex items-center gap-1'><Cpu className='w-4 h-4' /> CPU: {container.cpu}%</p>
                                <p className='flex items-center gap-1'><HardDrive className='w-4 h-4' /> Memory: {container.memory} MB</p>
                                <p>Status: {container.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='rounded-md p-2 space-y-2'>
                <div className='flex justify-between items-center'>
                    <div className='flex flex-wrap gap-2 items-center'>
                        <h1 className='font-semibold text-xl text-bright/80'>Virtual Machines</h1>
                        <h1 className={vmOverviewClass}>{runningVms} Running</h1>
                        <h1 className={vmOverviewClass}>{idleVms} Idle</h1>
                        <h1 className={vmOverviewClass}>{stoppedVms} Stopped</h1>
                    </div>
                    <div onClick={handleStopAll} className='flex gap-2 items-center py-0.5 px-6 rounded-md hover:outline hover:outline-red-500/35 hover:bg-red-500/20 cursor-pointer text-bright/80 group'>
                        <StopCircle className='w-4 h-4 group-hover:stroke-red-500' />
                        <h1 className='text-sm'>Stop all</h1>
                    </div>
                </div>
                <div className='overflow-x-auto'>
                    <div className='min-w-[74rem]'>
                        <div className='grid items-center gap-2 rounded-md bg-bright/3 p-2 font-semibold text-bright/80 lg:grid-cols-[minmax(14rem,1.3fr)_minmax(10rem,1fr)_7rem_10rem_minmax(9rem,0.95fr)_minmax(9rem,0.95fr)_7rem_minmax(16rem,1.4fr)_6.5rem]'>
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

                            return <SystemDashboardVMListItem key={vm.name} vm={vm} metrics={latestMetrics} />
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
