'use client'


export default function EvidenceMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className='min-w-0 border-l border-ui-border py-1 pl-2 dark:border-ui-border'>
            <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{label}</p>
            <p className='mt-0.5 wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{value || 'Not stated'}</p>
        </div>
    )
}
