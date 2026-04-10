type MetricProps = {
    metric: number
    label?: string
    size?: 'md' | 'lg'
}

export default function Metric({ metric, label, size = 'md' }: MetricProps) {
    const tone = metric < 50
        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
        : metric < 75
            ? 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400'
            : 'border-red-500/20 bg-red-500/10 text-red-400'
    const textSize = size === 'lg' ? 'text-2xl' : 'text-sm'

    return (
        <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold ${tone}`}>
            {label ? <span className='text-[10px] uppercase tracking-[0.18em] text-current/80'>{label}</span> : null}
            <span className={textSize}>{metric}%</span>
        </span>
    )
}
