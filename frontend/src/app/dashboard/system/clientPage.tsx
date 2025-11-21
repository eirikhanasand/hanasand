'use client'

import { RefreshCcw, Cpu, HardDrive } from 'lucide-react'
import SystemDashboardVMListItem from '@/components/vms/systemDashboardVMListItem'

type SystemDashboardProps = {
    systemMetrics: SystemMetric[]
    dockerContainers: DockerContainer[]
    vms: VM[]
    vmMetrics: VMMetrics[]
}

export default function SystemDashboard({ systemMetrics, dockerContainers, vms }: SystemDashboardProps) {
    async function handleRestartContainer(containerId: string) {
        await fetch(`/api/docker/${containerId}/restart`, { method: 'POST' })
    }

    return (
        <div className="grid gap-6">

            <div className="grid md:grid-cols-3 gap-4">
                {systemMetrics.map(metric => (
                    <div key={metric.name} className="rounded-2xl p-4 backdrop-blur-md outline outline-white/10 flex flex-col gap-2">
                        <h2 className="font-semibold text-lg">{metric.name}</h2>
                        <span className="text-sm text-gray-300">{metric.value}</span>
                    </div>
                ))}
            </div>

            <div>
                <h2 className="font-semibold text-xl mb-2">Docker Containers</h2>
                <div className="grid md:grid-cols-3 gap-4">
                    {dockerContainers.map(container => (
                        <div key={container.id} className="rounded-2xl p-4 backdrop-blur-md outline outline-white/10 flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">{container.name}</h3>
                                <button onClick={() => handleRestartContainer(container.id)} className="hover:text-green-400">
                                    <RefreshCcw />
                                </button>
                            </div>
                            <div className="text-sm flex flex-col gap-1">
                                <p className="flex items-center gap-1"><Cpu className="w-4 h-4" /> CPU: {container.cpu}%</p>
                                <p className="flex items-center gap-1"><HardDrive className="w-4 h-4" /> Memory: {container.memory} MB</p>
                                <p>Status: {container.status}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='outline outline-dark rounded-md p-2 space-y-2'>
                <h2 className="font-semibold text-xl mb-2">Virtual Machines</h2>
                <div className='flex w-full gap-2 p-2 rounded-md bg-bright/3 font-semibold text-bright/80'>
                    <h1 className='w-full'>Name</h1>
                    <h1 className='w-full'>Owner</h1>
                    <h1 className='min-w-25'>CPU</h1>
                    <h1 className='min-w-25'>Memory</h1>
                    <h1 className='w-full'>Created at</h1>
                    <h1 className='w-full'>Last used</h1>
                    <h1 className='min-w-25'>Status</h1>
                    <h1 className='w-full'>Tags</h1>
                </div>
                {vms.map((vm) => <SystemDashboardVMListItem vm={vm} />)}
            </div>
        </div>
    )
}
