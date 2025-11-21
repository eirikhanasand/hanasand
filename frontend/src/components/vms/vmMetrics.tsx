import Field from './field'

type VMMetricsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    metrics: VMMetrics[] | null
}

export default function VMMetrics({ boxStyle, boxTitleStyle, vm, metrics }: VMMetricsProps) {
    const displayMetrics = Array.isArray(metrics) && metrics.length ? JSON.stringify(metrics) : 'Coming soon'

    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Metrics</h1>
            <Field title='Metrics' value={displayMetrics} />
            {/* {details ? <div>
                <Field title='Status' value={vm.status} />
                {uniquePowerState && <Field title='Last power state' value={details.volatile_last_state_power} />}
                <Field title='Operating System (OS)' value={`${details.config_image_os} ${details.config_image_version}`} />
                <Field title='Config Image Release' value={details.config_image_release} />
                <Field title='Config Image serial' value={details.config_image_serial} />
                <Field title='Config Image Type' value={details.config_image_type} />
                <Field title='Config Image Description' value={details.config_image_description} />
                <Field title='Config Image Architecture' value={details.config_image_architecture} />
                <Field title='Config Image Label' value={details.config_image_label} />
                <Field title='Base image' value={details.volatile_base_image} />
                <Field title='Cloud Init Instance ID' value={details.volatile_cloud_init_instance_id} />
                <Field title='UUID' value={details.volatile_uuid} />
                {uniqueGeneration && <Field title='UUID Generation' value={details.volatile_uuid_generation} />}
                <Field title='Virtual Socket ID' value={details.volatile_vsock_id} />
                <Field title='Architecture' value={details.architecture} />
                {uniqueArchitecture && <Field title='Config Architecture' value={details.config_architecture} />}
            </div> : <h1>Unable to get metrics. Please try again later, refresh the page, or check again using the button in the top right.'</h1>} */}
        
            {/* <div className="grid gap-4">
                {vms.map(vm => {
                    const metrics = vmMetrics
                        .filter(m => m.name === vm.name)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]

                    const isExpanded = expandedVMs.includes(vm.name)
                    return (
                        <div key={vm.name} className="rounded-2xl p-4 backdrop-blur-md outline outline-white/10">
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
                    )
                })}
            </div> */}
        </div>
    )
}
