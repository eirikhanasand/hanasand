'use client'

import { ReactNode } from 'react'

export default function ActorSummaryFact({ icon, label, value, meta }: { icon: ReactNode; label: string; value: string; meta: string }) {
    return (
        <div className='min-w-0 border-l border-ui-border py-1 pl-2 dark:border-ui-border'>
            <p className='inline-flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>
                <span className='shrink-0 text-ui-primary dark:text-ui-primary'>{icon}</span>
                <span className='truncate'>{label}</span>
            </p>
            <p className='mt-0.5 wrap-break-word text-sm font-semibold leading-5 text-ui-text dark:text-ui-text'>{value}</p>
            <p className='mt-0.5 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>{meta}</p>
        </div>
    )
}
