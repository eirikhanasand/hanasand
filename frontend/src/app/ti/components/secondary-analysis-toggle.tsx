'use client'


export default function SecondaryAnalysisToggle({ expanded, artifactCount, sourceCount, watchlistCount, gapCount, onToggle }: {
    expanded: boolean
    artifactCount: number
    sourceCount: number
    watchlistCount: number
    gapCount: number
    onToggle: () => void
}) {
    const summary = `${artifactCount} artifacts · ${sourceCount} sources · ${watchlistCount} watch terms · ${gapCount} source questions`
    return (
        <section id='ti-secondary-analysis' className='scroll-mt-24 border-y border-ui-border bg-ui-canvas px-3 py-2 dark:border-ui-border dark:bg-ui-canvas' data-ti-secondary-analysis-toggle='true'>
            <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Analysis workbenches</p>
                    <p className='mt-0.5 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {expanded ? 'Source, artifact, watchlist, and delivery workbenches are open.' : summary}
                    </p>
                </div>
                <button
                    type='button'
                    onClick={onToggle}
                    aria-expanded={expanded}
                    className='inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-ui-border bg-ui-panel px-3 text-xs font-semibold text-ui-text transition hover:bg-ui-raised focus:outline-none focus:ring-2 focus:ring-ui-primary/35 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text dark:hover:bg-ui-raised'
                >
                    {expanded ? 'Hide' : 'Show'}
                </button>
            </div>
        </section>
    )
}
