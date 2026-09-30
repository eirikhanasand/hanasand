'use client'

import { decisionStepStatusClass, decisionStepStatusLabel, type SectionOverviewItem } from '../pageModel'

export default function SectionOverviewRail({ items }: { items: SectionOverviewItem[] }) {
    return (
        <div data-ti-section-rail='true' className='grid min-w-0 gap-1.5 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-5'>
            {items.map(item => (
                <div key={item.label} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2.5 py-2 dark:border-ui-border dark:bg-ui-raised'>
                    <div className='flex flex-wrap items-center justify-between gap-1.5'>
                        <p className='min-w-0 wrap-break-word text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{item.label}</p>
                        <span className={decisionStepStatusClass(item.state)}>{decisionStepStatusLabel(item.state)}</span>
                    </div>
                    <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{item.value}</p>
                </div>
            ))}
        </div>
    )
}
