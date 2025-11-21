'use client'

import { RefreshCcw, Cpu, HardDrive, StopCircle } from 'lucide-react'
import SystemDashboardVMListItem from '@/components/vms/systemDashboardVMListItem'
import { getCookie } from '@/utils/cookies/cookies'
import { useRouter } from 'next/navigation'
import useClearStateAfter from '@/hooks/useClearStateAfter'
import stopAllVms from '@/utils/vms/fetch/stopAllVms'
import Notify from '@/components/notify/notify'

type SystemDashboardProps = {
    systemMetrics: SystemMetric[]
    dockerContainers: DockerContainer[]
    vms: VM[]
    vmMetrics: VMMetrics[]
}

export default function SystemDashboard({ systemMetrics, dockerContainers, vms }: SystemDashboardProps) {
    const router = useRouter()
    const { condition: message, setCondition: setMessage } = useClearStateAfter()
    const runningVms = vms.filter((vm) => vm.status.toLowerCase() === 'running').length
    const stoppedVms = vms.filter((vm) => vm.status.toLowerCase() === 'stopped').length
    const vmOverviewClass = "bg-bright/3 text-sm outline outline-dark rounded-md py-0.5 px-4 text-bright/80"
    const idleVms = vms.length - runningVms - stoppedVms

    async function handleRestartContainer(containerId: string) {
        await fetch(`/api/docker/${containerId}/restart`, { method: 'POST' })
    }

    async function handleStopAll() {
        const token = getCookie('access_token')
        const id = getCookie('id')
        if (!token || !id) {
            return router.push(`/logout?path=/login%3Fpath%3D/dashboard/system%26expired=true`)
        }

        const response = await stopAllVms(token, id)
        setMessage(response.message)
    }

    return (
        <div className="grid gap-6">
            <Notify absolute className='px-8' color='bg-blue-500' background='bg-dark/40 outline outline-dark text-bright/80' message={message} />
            <div className='outline outline-dark rounded-md p-2 space-y-2'>
                <h1 className="font-semibold text-xl text-bright/80">System Metrics</h1>
                <div className="grid md:grid-cols-3 gap-4">
                    {systemMetrics.map(metric => (
                        <div key={metric.name} className="rounded-2xl p-4 backdrop-blur-md outline outline-white/10 flex flex-col gap-2">
                            <h2 className="font-semibold text-lg">{metric.name}</h2>
                            <span className="text-sm text-gray-300">{metric.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className='outline outline-dark rounded-md p-2 space-y-2'>
                <h1 className="font-semibold text-xl text-bright/80">Docker Containers</h1>
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
                <div className='flex justify-between items-center'>
                    <div className='flex gap-2 items-center'>
                        <h1 className="font-semibold text-xl text-bright/80">Virtual Machines</h1>
                        <h1 className={vmOverviewClass}>{runningVms} Running</h1>
                        <h1 className={vmOverviewClass}>{idleVms} Idle</h1>
                        <h1 className={vmOverviewClass}>{stoppedVms} Stopped</h1>
                    </div>
                    <div onClick={handleStopAll} className='flex gap-2 items-center py-0.5 px-6 rounded-md hover:outline hover:outline-red-500/35 hover:bg-red-500/20 cursor-pointer text-bright/80 group'>
                        <StopCircle className='w-4 h-4 group-hover:stroke-red-500' />
                        <h1 className="text-sm">Stop all</h1>
                    </div>
                </div>
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
                {vms.map((vm) => <SystemDashboardVMListItem key={vm.name} vm={vm} />)}
            </div>
        </div>
    )
}
