'use client'

import { DashboardPanel } from '@/components/dashboard/ui'
import { useState } from 'react'

type VMDetailClientProps = {
    vm: VM
    metrics: VMMetrics[]
}

export default function VMDetailClient({ vm, metrics }: VMDetailClientProps) {
    void vm
    const [latestMetrics] = useState(metrics[0])

    return (
        <DashboardPanel className='flex flex-col gap-4 p-4'>
            <div className='flex justify-between items-center'>
                <h2 className='text-base font-semibold text-bright'>Metrics</h2>
            </div>
            {latestMetrics && (
                <div className='grid md:grid-cols-2 gap-4 text-sm'>
                    <div>
                        <p>CPU: {latestMetrics.cpu_usage_percent}% ({latestMetrics.cpu_cores} cores)</p>
                        <p>RAM: {latestMetrics.ram_used_mb}/{latestMetrics.ram_total_mb} MB</p>
                        <p>GPU: {latestMetrics.gpu_usage_percent}% ({latestMetrics.gpu_memory_used_mb}/{latestMetrics.gpu_memory_total_mb} MB)</p>
                        <p>Disk: {latestMetrics.disk_used_mb}/{latestMetrics.disk_total_mb} MB</p>
                    </div>
                    <div>
                        <p>System Temp: {latestMetrics.system_temperature}°C</p>
                        <p>GPU Temp: {latestMetrics.gpu_temperature}°C</p>
                        <p>Power State: {latestMetrics.power_state}</p>
                        <p>Uptime: {Math.floor(latestMetrics.uptime_seconds / 3600)}h</p>
                    </div>
                </div>
            )}
        </DashboardPanel>
    )
}
