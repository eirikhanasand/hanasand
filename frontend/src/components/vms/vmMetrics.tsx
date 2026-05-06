import Field from './field'

type VMMetricsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    metrics: VMMetrics[] | null
}

export default function VMMetrics({ boxStyle, boxTitleStyle, vm, metrics }: VMMetricsProps) {
    const latest = Array.isArray(metrics) && metrics.length
        ? [...metrics].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null

    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Metrics</h1>
            {latest ? (
                <div>
                    <Field title='Power' value={latest.power_state} />
                    <Field title='CPU' value={`${formatNumber(latest.cpu_usage_percent)}% across ${latest.cpu_cores} cores`} />
                    <Field title='Memory' value={`${formatMb(latest.ram_used_mb)} / ${formatMb(latest.ram_total_mb)}`} />
                    <Field title='Disk' value={`${formatMb(latest.disk_used_mb)} / ${formatMb(latest.disk_total_mb)}`} />
                    <Field title='Network' value={`${formatNumber(latest.net_in_kbps)} kbps in · ${formatNumber(latest.net_out_kbps)} kbps out`} />
                    <Field title='Uptime' value={formatDuration(latest.uptime_seconds)} />
                    <Field title='Updated' value={new Date(latest.created_at).toLocaleString()} underline={false} />
                </div>
            ) : (
                <div className='rounded-xl border border-white/10 bg-white/[0.035] p-3'>
                    <p className='text-sm font-medium text-bright/78'>No live metrics yet</p>
                    <p className='mt-1 text-xs leading-5 text-bright/48'>
                        {vm.name} is visible, but no telemetry sample has been reported for this machine.
                    </p>
                </div>
            )}
        </div>
    )
}

function formatNumber(value: number) {
    return Number.isFinite(value) ? value.toFixed(value >= 10 ? 1 : 2) : '0'
}

function formatMb(value: number) {
    if (!Number.isFinite(value)) return '0 MB'
    if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
    return `${Math.round(value)} MB`
}

function formatDuration(seconds: number) {
    if (!Number.isFinite(seconds) || seconds <= 0) return 'Not running'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours) return `${hours}h ${minutes}m`
    return `${minutes}m`
}
