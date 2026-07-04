'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCcw, Cpu, Server, HardDrive } from 'lucide-react'
import restartDocker from '@/utils/vms/fetch/restartDocker'
import manageVM from '@/utils/vms/fetch/manage/manage'

type SystemDashboardProps = {
    systemMetrics: SystemMetric[]
    dockerContainers: DockerContainer[]
    vms: VM[]
    vmMetrics: VMMetrics[]
}

export default function SystemDashboard({
    systemMetrics,
    dockerContainers,
    vms,
    vmMetrics
}: SystemDashboardProps) {
    const [expandedVMs, setExpandedVMs] = useState<string[]>([])

    function toggleVM(vmId: string) {
        setExpandedVMs(prev => prev.includes(vmId) ? prev.filter(id => id !== vmId) : [...prev, vmId])
    }

    async function handleRestartContainer(containerId: string) {
        await restartDocker(containerId)
    }

    async function handleRestartVM(vmId: string) {
        await manageVM(vmId, 'restart')
    }

    return (
        <div className='grid gap-6'>

            <div className='grid gap-4 md:grid-cols-3'>
                {systemMetrics.map(metric => (
                    <div key={metric.name} className='flex flex-col gap-2 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                        <h2 className='text-lg font-semibold text-ui-text'>{metric.name}</h2>
                        <span className='text-sm text-ui-muted'>{metric.value}</span>
                    </div>
                ))}
            </div>

            <div>
                <h2 className='mb-2 text-xl font-semibold text-ui-text'>Docker Containers</h2>
                <div className='grid gap-4 md:grid-cols-3'>
                    {dockerContainers.map(container => (
                        <div key={container.id} className='flex flex-col gap-2 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                            <div className='flex items-center justify-between gap-3'>
                                <h3 className='min-w-0 truncate font-semibold text-ui-text'>{container.name}</h3>
                                <button
                                    type='button'
                                    aria-label={`Restart ${container.name}`}
                                    onClick={() => handleRestartContainer(container.id)}
                                    className='grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-muted transition hover:border-ui-primary hover:text-ui-primary'
                                >
                                    <RefreshCcw className='h-4 w-4' />
                                </button>
                            </div>
                            <div className='flex flex-col gap-1 text-sm text-ui-muted'>
                                <p className='flex items-center gap-1'><Cpu className='h-4 w-4 text-ui-primary' /> CPU: {container.cpu}%</p>
                                <p className='flex items-center gap-1'><HardDrive className='h-4 w-4 text-ui-primary' /> Memory: {container.memory} MB</p>
                                <p>Status: {container.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <h2 className='mb-2 text-xl font-semibold text-ui-text'>Virtual Machines</h2>
                <div className='grid gap-4'>
                    {vms.map(vm => {
                        const metrics = vmMetrics
                            .filter(m => m.name === vm.name)
                            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

                        const isExpanded = expandedVMs.includes(vm.name)
                        return (
                            <div key={vm.name} className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm'>
                                <div className='flex cursor-pointer items-center justify-between gap-3' onClick={() => toggleVM(vm.name)}>
                                    <h3 className='min-w-0 truncate font-semibold text-ui-text'>{vm.name}</h3>
                                    <div className='flex shrink-0 items-center gap-2'>
                                        <button
                                            type='button'
                                            aria-label={`Restart ${vm.name}`}
                                            onClick={e => { e.stopPropagation(); handleRestartVM(vm.name) }}
                                            className='grid h-8 w-8 place-items-center rounded-lg border border-ui-border bg-ui-raised text-ui-muted transition hover:border-ui-primary hover:text-ui-primary'
                                        >
                                            <RefreshCcw className='h-4 w-4' />
                                        </button>
                                        <Link href={`/dashboard/vm/${vm.name}`} className='inline-flex h-8 items-center rounded-lg border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary hover:text-ui-primary'>Details</Link>
                                    </div>
                                </div>
                                {isExpanded && metrics && (
                                    <div className='mt-3 grid gap-1 text-sm text-ui-muted'>
                                        <p className='flex items-center gap-1'><Cpu className='h-4 w-4 text-ui-primary' /> CPU: {metrics.cpu_usage_percent}% ({metrics.cpu_cores} cores)</p>
                                        <p className='flex items-center gap-1'><HardDrive className='h-4 w-4 text-ui-primary' /> RAM: {metrics.ram_used_mb}/{metrics.ram_total_mb} MB</p>
                                        <p className='flex items-center gap-1'><HardDrive className='h-4 w-4 text-ui-primary' /> Disk: {metrics.disk_used_mb}/{metrics.disk_total_mb} MB</p>
                                        <p className='flex items-center gap-1'><Server className='h-4 w-4 text-ui-primary' /> GPU: {metrics.gpu_usage_percent}% ({metrics.gpu_memory_used_mb}/{metrics.gpu_memory_total_mb} MB)</p>
                                        <p>System Temp: {metrics.system_temperature}°C</p>
                                        <p>GPU Temp: {metrics.gpu_temperature}°C</p>
                                        <p>Power State: {metrics.power_state}</p>
                                        <p>Uptime: {Math.floor(metrics.uptime_seconds / 3600)}h</p>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
