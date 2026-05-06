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
        <div className='min-w-0 rounded-lg border border-bright/8 bg-black/12 px-2.5 py-2'>
            <div className='mb-0.5 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-bright/35'>
                {icon}
                {label}
            </div>
            <div className={`truncate text-sm font-semibold ${toneClass}`}>{value}</div>
        </div>
    )
}
