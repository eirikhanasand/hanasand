'use client'

import type { ReactNode } from 'react'
import type { TrafficMetric } from '@/utils/monitoring/types'

export function StatCard({ icon, label, value }: { icon: ReactNode, label: string, value: string }) {
    return (
        <div className='rounded-xl border border-white/10 bg-black/60 p-4'>
            <div className='flex items-center justify-between text-white/60'>
                <span className='text-[11px] font-medium uppercase tracking-[0.18em]'>{label}</span>
                <div className='rounded-full border border-white/10 bg-white/5 p-2'>{icon}</div>
            </div>
            <div className='mt-3 text-2xl font-semibold text-white'>{value}</div>
        </div>
    )
}

export function InsightCard({ children, icon, title }: { children: ReactNode, icon: ReactNode, title: string }) {
    return (
        <section className='rounded-2xl border border-white/10 bg-black/60 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.18)]'>
            <div className='mb-3 flex items-center gap-3'>
                <div className='rounded-full border border-white/10 bg-white/5 p-2 text-white/80'>{icon}</div>
                <h2 className='font-semibold text-white'>{title}</h2>
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
            <div className='mb-2 text-xs font-medium uppercase tracking-[0.18em] text-white/60'>{title}</div>
            <div className='space-y-2'>
                {entries.length ? entries.slice(0, 4).map((entry) => (
                    <div key={entry.key} className='rounded-xl border border-white/10 bg-black/60 px-3 py-2'>
                        <div className='truncate text-sm font-medium text-white'>{entry.key}</div>
                        <div className='mt-1 text-xs text-white/60'>{entry.count} {valueLabel}</div>
                    </div>
                )) : <EmptyCopy text={`No ${title.toLowerCase()} available yet.`} />}
            </div>
        </div>
    )
}

export function EmptyCopy({ text }: { text: string }) {
    return (
        <div className='rounded-xl border border-dashed border-white/10 bg-black/40 px-3 py-4 text-sm text-white/60'>
            {text}
        </div>
    )
}

export function ZoomButton({ label, onClick, wide = false }: { label: string, onClick: () => void, wide?: boolean }) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`rounded-full border border-white/10 bg-white/5 px-3 py-1.5
                text-sm text-white transition hover:border-white/20 hover:bg-white/10
                ${wide ? 'min-w-18' : 'min-w-10'}`}
        >
            {label}
        </button>
    )
}
