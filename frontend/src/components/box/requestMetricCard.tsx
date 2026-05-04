import type { ReactNode } from 'react'

export default function RequestMetricCard({
    label,
    value,
    tone,
    icon,
}: {
    label: string
    value: string
    tone: 'good' | 'bad' | 'neutral'
    icon?: ReactNode
}) {
    const toneClass = tone === 'good'
        ? 'text-emerald-300'
        : tone === 'bad'
            ? 'text-red-300'
            : 'text-bright'

    return (
        <div className='rounded-lg border border-white/8 bg-black/10 px-3 py-2'>
            <div className='mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-bright/35'>
                {icon}
                {label}
            </div>
            <div className={`text-sm font-semibold ${toneClass}`}>{value}</div>
        </div>
    )
}
