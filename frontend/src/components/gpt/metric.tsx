type MetricProps = {
    metric: number
    label?: string
    size?: 'md' | 'lg'
}

export default function Metric({ metric, label, size = 'md' }: MetricProps) {
    const tone = metric < 50
        ? 'border-ui-success/30 bg-ui-success/10 text-ui-success'
        : metric < 75
            ? 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning'
            : 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger'
    const textSize = size === 'lg' ? 'text-2xl' : 'text-sm'

    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${tone}`}>
            {label ? <span className='text-[10px] uppercase tracking-[0.18em] text-current/80'>{label}</span> : null}
            <span className={textSize}>{metric}%</span>
        </span>
    )
}
