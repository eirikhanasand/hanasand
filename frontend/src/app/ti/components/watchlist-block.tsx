'use client'


export default function WatchlistBlock({ title, values }: { title: string; values: string[] }) {
    const visible = values.slice(0, 6)
    return (
        <div className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>{title}</p>
            <div className='mt-2 flex flex-wrap gap-1.5'>
                {visible.length ? visible.map(value => (
                    <span key={value} className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{value}</span>
                )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Add matching values before opening this result for review.</span>}
            </div>
        </div>
    )
}
