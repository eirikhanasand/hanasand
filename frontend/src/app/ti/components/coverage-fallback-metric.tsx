'use client'


export default function CoverageFallbackMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-3 py-2 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{label}</p>
            <p className='mt-1 wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{value}</p>
        </div>
    )
}
