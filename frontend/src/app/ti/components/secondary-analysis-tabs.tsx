'use client'

import { type SecondaryAnalysisView, secondaryAnalysisViews } from '../pageClientShared'

export default function SecondaryAnalysisTabs({ active, onSelect }: { active: SecondaryAnalysisView; onSelect: (view: SecondaryAnalysisView) => void }) {
    return (
        <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-canvas' data-ti-secondary-analysis-tabs='true'>
            <div className='grid grid-cols-2 gap-1.5 sm:grid-cols-5' role='tablist' aria-label='Actor detail work areas'>
                {secondaryAnalysisViews.map(view => {
                    const selected = view.id === active
                    return (
                        <button
                            key={view.id}
                            type='button'
                            role='tab'
                            aria-selected={selected}
                            onClick={() => onSelect(view.id)}
                            className={`grid min-h-10 min-w-0 content-center rounded-md border px-2 py-1.5 text-left text-xs transition focus:outline-none focus:ring-2 focus:ring-ui-primary/35 ${selected ? 'border-ui-primary/35 bg-ui-primary/10 text-ui-on-primary dark:border-ui-primary/40 dark:bg-ui-primary/15 dark:text-ui-on-primary' : 'border-ui-border bg-ui-panel text-ui-muted hover:bg-ui-raised dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted dark:hover:bg-ui-raised'}`}
                        >
                            <span className='wrap-break-word font-semibold'>{view.label}</span>
                            <span className='hidden wrap-break-word text-[11px] md:block'>{view.detail}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
