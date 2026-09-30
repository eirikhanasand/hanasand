'use client'

import { type AnalystWorkItem } from '../pageModel'

export default function EvidenceQueueFilters({
    kind,
    source,
    confidence,
    sort,
    sources,
    sourceCounts,
    onKindChange,
    onSourceChange,
    onConfidenceChange,
    onSortChange,
}: {
    kind: AnalystWorkItem['kind'] | 'all'
    source: string
    confidence: 'all' | 'high' | 'medium'
    sort: 'priority' | 'confidence' | 'freshness'
    sources: string[]
    sourceCounts: Array<{ source: string; count: number }>
    onKindChange: (value: AnalystWorkItem['kind'] | 'all') => void
    onSourceChange: (value: string) => void
    onConfidenceChange: (value: 'all' | 'high' | 'medium') => void
    onSortChange: (value: 'priority' | 'confidence' | 'freshness') => void
}) {
    return (
        <div data-ti-evidence-filters='true' className='mt-3 grid gap-2'>
            <div className='grid grid-cols-2 gap-2'>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Type</span>
                    <select value={kind} onChange={event => onKindChange(event.target.value as AnalystWorkItem['kind'] | 'all')} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>All results</option>
                        <option value='activity'>Activity</option>
                        <option value='exposure'>Recent attacks</option>
                        <option value='victim'>Victim</option>
                        <option value='tradecraft'>Methods</option>
                        <option value='collection'>Open questions</option>
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Evidence strength</span>
                    <select value={confidence} onChange={event => onConfidenceChange(event.target.value as 'all' | 'high' | 'medium')} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>Any</option>
                        <option value='high'>Strong</option>
                        <option value='medium'>Moderate</option>
                    </select>
                </label>
            </div>
            <div className='grid grid-cols-2 gap-2'>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source</span>
                    <select value={source} onChange={event => onSourceChange(event.target.value)} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>All sources</option>
                        {sources.map(item => <option key={item} value={item}>{item}</option>)}
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Sort</span>
                    <select value={sort} onChange={event => onSortChange(event.target.value as 'priority' | 'confidence' | 'freshness')} className='h-9 min-w-0 rounded-lg border border-ui-border bg-ui-panel px-2 text-xs font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='priority'>Priority</option>
                        <option value='confidence'>Evidence strength</option>
                        <option value='freshness'>Freshness</option>
                    </select>
                </label>
            </div>
            {sourceCounts.length ? (
                <p data-ti-source-count-summary='true' className='line-clamp-2 text-[11px] leading-5 text-ui-muted dark:text-ui-muted'>
                    {sourceCounts.slice(0, 3).map(item => `${item.source} ${item.count}`).join(' · ')}
                    {sourceCounts.length > 3 ? ` · +${sourceCounts.length - 3} more` : ''}
                </p>
            ) : null}
        </div>
    )
}
