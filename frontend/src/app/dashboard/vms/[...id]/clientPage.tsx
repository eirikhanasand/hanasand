'use client'

import { useState } from 'react'
import Link from 'next/link'
import { RefreshCcw, Cpu, Server, HardDrive } from 'lucide-react'

type SystemDashboardProps = {
    vm: VM
    vmMetrics: VMMetrics[]
}

export default function VMClient({
    vm,
    vmMetrics
}: SystemDashboardProps) {
    const [expandedVMs, setExpandedVMs] = useState<string[]>([])
    const metrics = vmMetrics
        .filter(m => m.name === vm.name)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

    const isExpanded = expandedVMs.includes(vm.name)

    function toggleVM(vmId: string) {
        setExpandedVMs(prev => prev.includes(vmId) ? prev.filter(id => id !== vmId) : [...prev, vmId])
    }

    async function handleRestartVM(vmId: string) {
        await fetch(`/api/vm/${vmId}/restart`, { method: 'POST' })
    }

    return (
        <div className="grid gap-2">
            <div>
                <h2 className="font-semibold text-xl mb-2">Virtual Machines</h2>
                <div className="grid gap-2">
                    <div key={vm.name} className="rounded-lg p-2 backdrop-blur-md outline outline-white/10">
                        <div className="flex justify-between items-center cursor-pointer" onClick={() => toggleVM(vm.name)}>
                            <h3 className="font-semibold">{vm.name}</h3>
                            <div className="flex gap-2 items-center">
                                <button onClick={e => { e.stopPropagation(); handleRestartVM(vm.name) }} className="hover:text-green-400">
                                    <RefreshCcw />
                                </button>
                                <Link href={`/dashboard/vm/${vm.name}`} className="hover:text-blue-400">Details</Link>
                            </div>
                        </div>
                        {isExpanded && metrics && (
                            <div className="mt-2 text-sm grid gap-1">
                                <p className="flex items-center gap-1"><Cpu className="w-4 h-4" /> CPU: {metrics.cpu_usage_percent}% ({metrics.cpu_cores} cores)</p>
                                <p className="flex items-center gap-1"><HardDrive className="w-4 h-4" /> RAM: {metrics.ram_used_mb}/{metrics.ram_total_mb} MB</p>
                                <p className="flex items-center gap-1"><HardDrive className="w-4 h-4" /> Disk: {metrics.disk_used_mb}/{metrics.disk_total_mb} MB</p>
                                <p className="flex items-center gap-1"><Server className="w-4 h-4" /> GPU: {metrics.gpu_usage_percent}% ({metrics.gpu_memory_used_mb}/{metrics.gpu_memory_total_mb} MB)</p>
                                <p>System Temp: {metrics.system_temperature}°C</p>
                                <p>GPU Temp: {metrics.gpu_temperature}°C</p>
                                <p>Power State: {metrics.power_state}</p>
                                <p>Uptime: {Math.floor(metrics.uptime_seconds / 3600)}h</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
