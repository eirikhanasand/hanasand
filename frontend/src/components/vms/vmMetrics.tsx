import Field from './field'

type VMMetricsProps = {
    boxStyle: string
    boxTitleStyle: string
    vm: VM
    metrics: VMMetrics[] | null
}

export default function VMMetrics({ boxStyle, boxTitleStyle, metrics }: VMMetricsProps) {
    const latest = Array.isArray(metrics) && metrics.length
        ? [...metrics].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        : null

    return (
        <div className={boxStyle}>
            <h1 className={boxTitleStyle}>Metrics</h1>
            {latest ? (
                <div>
                    {Date.now() - new Date(latest.created_at).getTime() > 180_000 && <p className='mb-3 text-sm text-ui-muted'>Metrics have not updated recently.</p>}
                    <Field title='Power' value={latest.power_state} />
                    <Field title='CPU' value={`${formatNumber(latest.cpu_usage_percent)}% across ${latest.cpu_cores ?? "—"} cores`} />
                    <Field title='Memory' value={`${formatMb(latest.ram_used_mb)} / ${formatMb(latest.ram_total_mb)}`} />
                    <Field title='Disk' value={`${formatMb(latest.disk_used_mb)} / ${formatMb(latest.disk_total_mb)}`} />
                    <Field title='Network' value={`${formatNumber(latest.net_in_kbps)} kbps in · ${formatNumber(latest.net_out_kbps)} kbps out`} />
                    <Field title='Uptime' value={formatDuration(latest.uptime_seconds)} />
                    <Field title='Updated' value={new Date(latest.created_at).toLocaleString()} underline={false} />
                </div>
            ) : (
                <p className='text-sm text-ui-muted'>Metrics are unavailable.</p>
            )}
        </div>
    )
}

function formatNumber(value: number | string | null) {
    const numeric = value === null ? NaN : Number(value)
    return Number.isFinite(numeric) ? numeric.toFixed(numeric >= 10 ? 1 : 2) : '—'
}

function formatMb(raw: number | string | null) {
    const value = raw === null ? NaN : Number(raw)
    if (!Number.isFinite(value)) return '—'
    if (value >= 1024) return `${(value / 1024).toFixed(1)} GB`
    return `${Math.round(value)} MB`
}

function formatDuration(raw: number | string | null) {
    const seconds = raw === null ? NaN : Number(raw)
    if (!Number.isFinite(seconds)) return '—'
    if (seconds <= 0) return '0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours) return `${hours}h ${minutes}m`
    return `${minutes}m`
}
