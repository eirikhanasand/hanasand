'use client'

import InfoTip from './info-tip'

export default function Panel({ title, description, icon, children }: { title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className='min-w-0 border border-ui-border bg-ui-panel p-4 dark:border-ui-border dark:bg-ui-panel'>
            <div className='mb-2 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'>
                <span className='text-ui-primary dark:text-ui-primary'>{icon}</span>
                <span className='min-w-0 wrap-break-word'>{title}</span>
                {description ? <InfoTip label={description} /> : null}
            </div>
            {children}
        </section>
    )
}
