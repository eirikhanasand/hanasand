'use client'

import type { ReactNode } from 'react'
import type { TrafficMetric } from '@/utils/monitoring/types'

export function StatCard({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-xl border border-ui-border bg-ui-panel p-4'>
            <div className='flex items-center justify-between text-ui-muted'>
                <span className='text-[11px] font-medium uppercase tracking-[0.18em]'>{label}</span>
                <div className='rounded-full border border-ui-border bg-ui-raised p-2'>{icon}</div>
            </div>
            <div className='mt-3 text-2xl font-semibold text-ui-text'>{value}</div>
        </div>
    )
}

export function InsightCard({ children, icon, title }: { children: ReactNode, icon: ReactNode, title: string }) {
    return (
        <section className='rounded-2xl border border-ui-border bg-ui-panel p-4 shadow-lg'>
            <div className='mb-3 flex items-center gap-3'>
                <div className='rounded-full border border-ui-border bg-ui-raised p-2 text-ui-muted'>{icon}</div>
                <h2 className='font-semibold text-ui-text'>{title}</h2>
            </div>
            {children}
        </section>
    )
}

export function SignalGroup({
    entries,
    title,
    valueLabel,
}: {
    entries: TrafficMetric[]
    title: string
    valueLabel: string
}) {
    return (
        <div className='mb-4 last:mb-0'>
            <div className='mb-2 text-xs font-medium uppercase tracking-[0.18em] text-ui-muted'>{title}</div>
            <div className='space-y-2'>
                {entries.length ? entries.slice(0, 4).map((entry) => (
                    <div key={entry.key} className='rounded-xl border border-ui-border bg-ui-panel px-3 py-2'>
                        <div className='truncate text-sm font-medium text-ui-text'>{entry.key}</div>
                        <div className='mt-1 text-xs text-ui-muted'>{entry.count} {valueLabel}</div>
                    </div>
                )) : <EmptyCopy text={`${title} update as the live stream receives request rows.`} />}
            </div>
        </div>
    )
}

export function EmptyCopy({ text }: { text: string }) {
    return (
        <div className='rounded-xl border border-dashed border-ui-border bg-ui-canvas px-3 py-4 text-sm text-ui-muted'>
            {text}
        </div>
    )
}

export function ZoomButton({ label, onClick, wide = false }: { label: string, onClick: () => void, wide?: boolean }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`rounded-full border border-ui-border bg-ui-raised px-3 py-1.5
                text-sm text-ui-text transition hover:border-ui-primary hover:bg-ui-panel
                ${wide ? 'min-w-18' : 'min-w-10'}`}
        >
            {label}
        </button>
    )
}
