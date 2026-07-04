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
        <div className='inline-flex rounded-full border border-ui-border bg-ui-panel p-1 text-xs text-ui-muted'>
            {[props.left, props.right].map(option => {
                const active = option.value === props.value
                return (
                    <button
                        key={String(option.value)}
                        type='button'
                        onClick={() => props.onChange(option.value)}
                        aria-pressed={active}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                            active ? 'bg-ui-raised text-ui-text' : 'hover:bg-ui-raised hover:text-ui-text'
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
    const tone = severityTone[severity] || 'border-ui-border text-ui-muted'
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${compact ? '' : 'text-xs'} ${tone}`}>
            <span>{severity}</span>
            <span className='text-[10px] tracking-normal'>{count}</span>
        </span>
    )
}

const severityTone: Record<SeverityLevel, string> = {
    critical: 'border-ui-danger/30 bg-ui-danger/10 text-ui-danger',
    high: 'border-ui-danger/25 bg-ui-danger/10 text-ui-danger',
    medium: 'border-ui-warning/30 bg-ui-warning/10 text-ui-warning',
    low: 'border-ui-success/30 bg-ui-success/10 text-ui-success',
    unknown: 'border-ui-border bg-ui-panel text-ui-muted',
}
