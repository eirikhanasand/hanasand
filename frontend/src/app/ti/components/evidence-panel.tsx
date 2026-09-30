'use client'


export default function EvidencePanel({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
            <ul className='mt-2 grid list-disc gap-1 pl-4 text-sm leading-6 text-ui-muted dark:text-ui-muted'>
                {children}
            </ul>
        </div>
    )
}
