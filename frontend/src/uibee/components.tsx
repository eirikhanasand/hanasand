'use client'

import type { ReactNode } from 'react'

type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'unknown'

export function Toggle<T extends string | boolean>(props: {
    value: T
    onChange: (value: T) => void
    left: { value: T, text?: string, label?: string, icon?: ReactNode }
    right: { value: T, text?: string, label?: string, icon?: ReactNode }
}) {
    return (
        <div className='inline-flex rounded-full border border-white/10 bg-white/3 p-1 text-xs text-bright/70'>
            {[props.left, props.right].map(option => {
                const active = option.value === props.value
                return (
                    <button
                        key={String(option.value)}
                        type='button'
                        onClick={() => props.onChange(option.value)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                            active ? 'bg-white/12 text-bright' : 'hover:bg-white/5'
                        }`}
                    >
                        {option.icon}
                        {option.text || option.label || String(option.value)}
                    </button>
                )
            })}
        </div>
    )
}

export function SeverityPill({ severity, count, compact }: {
    severity: SeverityLevel
    count: number
    compact?: boolean
}) {
    const tone = severityTone[severity] || 'border-white/10 text-bright/70'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${compact ? '' : 'text-xs'} ${tone}`}>
            <span>{severity}</span>
            <span className='text-[10px] tracking-normal'>{count}</span>
        </span>
    )
}

const severityTone: Record<SeverityLevel, string> = {
    critical: 'border-red-400/25 bg-red-500/8 text-red-100',
    high: 'border-orange-400/25 bg-orange-500/8 text-orange-100',
    medium: 'border-amber-300/25 bg-amber-400/8 text-amber-100',
    low: 'border-emerald-400/25 bg-emerald-500/8 text-emerald-100',
    unknown: 'border-white/10 bg-white/3 text-bright/70',
}
