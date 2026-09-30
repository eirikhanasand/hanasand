'use client'

import { TI_MOBILE_SOURCE_FILTER_OPTIONS } from '../pageClientShared'
import { BellRing, CheckCircle2, ClipboardList, Send } from 'lucide-react'
import { displayRequirementText, severityClass, sourceBasisLabel, type AnalystWorkItem } from '../pageModel'
import StripActionButton from './strip-action-button'

export default function MobileEvidenceWorkbar({
    selected,
    filteredCount,
    totalCount,
    kind,
    source,
    confidence,
    sourceCounts,
    onKindChange,
    onSourceChange,
    onConfidenceChange,
    onMarkReviewed,
    onEscalate,
    onWatchlist,
    onCase,
    watchlistHref,
    caseHref,
    alertHref,
    caseAvailable,
}: {
    selected: AnalystWorkItem
    filteredCount: number
    totalCount: number
    kind: AnalystWorkItem['kind'] | 'all'
    source: string
    confidence: 'all' | 'high' | 'medium'
    sourceCounts: Array<{ source: string; count: number }>
    onKindChange: (value: AnalystWorkItem['kind'] | 'all') => void
    onSourceChange: (value: string) => void
    onConfidenceChange: (value: 'all' | 'high' | 'medium') => void
    onMarkReviewed: () => void
    onEscalate: () => void
    onWatchlist: () => void
    onCase: () => void
    watchlistHref?: string
    caseHref?: string
    alertHref?: string
    caseAvailable: boolean
}) {
    const kindOptions: Array<{ value: AnalystWorkItem['kind'] | 'all'; label: string }> = [
        { value: 'all', label: 'All' },
        { value: 'activity', label: 'Activity' },
        { value: 'exposure', label: 'Recent attacks' },
        { value: 'victim', label: 'Victims' },
        { value: 'tradecraft', label: 'Methods' },
        { value: 'collection', label: 'Open questions' },
    ]
    return (
        <section data-ti-mobile-workbar='true' className='lg:hidden sticky top-2 z-20 grid min-w-0 gap-2 rounded-lg border border-ui-border bg-ui-panel/95 p-2 shadow-sm backdrop-blur dark:border-ui-border dark:bg-ui-panel/95'>
            <div className='flex min-w-0 items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{filteredCount}/{totalCount} results</p>
                    <p className='mt-0.5 line-clamp-1 text-xs font-semibold text-ui-text dark:text-ui-text'>{displayRequirementText(selected.title)}</p>
                </div>
                <span className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold ${severityClass(selected.severity)}`}>{selected.severity}</span>
            </div>
            <div data-ti-mobile-selected-context='true' className='grid gap-1 rounded-md border border-ui-border bg-ui-panel px-2 py-1.5 dark:border-ui-border dark:bg-ui-raised'>
                <p className='line-clamp-2 text-[11px] leading-4 text-ui-muted dark:text-ui-muted'>{displayRequirementText(selected.detail)}</p>
                <div className='flex min-w-0 flex-wrap gap-1.5 text-[10px] font-semibold text-ui-muted dark:text-ui-muted'>
                    <span>{selected.timestamp}</span>
                    <span>{selected.source}</span>
                    <span>{sourceBasisLabel(selected.confidence)}</span>
                    <a href='#ti-selected-evidence' className='inline-flex min-h-6 items-center rounded-md px-1 text-ui-primary dark:text-ui-primary'>Detail</a>
                </div>
            </div>

            <div data-ti-mobile-filter-controls='true' className='grid min-w-0 grid-cols-3 gap-1.5'>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Type</span>
                    <select value={kind} onChange={event => onKindChange(event.target.value as AnalystWorkItem['kind'] | 'all')} className='h-8 min-w-0 rounded-md border border-ui-border bg-ui-panel px-1.5 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        {kindOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source</span>
                    <select value={source} onChange={event => onSourceChange(event.target.value)} className='h-8 min-w-0 rounded-md border border-ui-border bg-ui-panel px-1.5 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>All</option>
                        {sourceCounts.slice(0, TI_MOBILE_SOURCE_FILTER_OPTIONS).map(item => <option key={item.source} value={item.source}>{item.source} ({item.count})</option>)}
                    </select>
                </label>
                <label className='grid min-w-0 gap-1'>
                    <span className='text-[10px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>Basis</span>
                    <select value={confidence} onChange={event => onConfidenceChange(event.target.value as 'all' | 'high' | 'medium')} className='h-8 min-w-0 rounded-md border border-ui-border bg-ui-panel px-1.5 text-[11px] font-semibold text-ui-text outline-none focus:border-ui-primary focus:ring-2 focus:ring-ui-primary/20 dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        <option value='all'>Any</option>
                        <option value='high'>Strong</option>
                        <option value='medium'>Moderate</option>
                    </select>
                </label>
            </div>

            <div data-ti-mobile-console-links='true' className='grid grid-cols-4 gap-1.5'>
                <StripActionButton icon={<BellRing className='h-3 w-3' />} onClick={onWatchlist} href={watchlistHref} iconOnly>Watch</StripActionButton>
                <StripActionButton icon={<ClipboardList className='h-3 w-3' />} onClick={onCase} href={caseHref} disabled={!caseHref && !caseAvailable} iconOnly>Open case</StripActionButton>
                <StripActionButton icon={<Send className='h-3 w-3' />} onClick={onEscalate} href={alertHref} iconOnly>Escalate</StripActionButton>
                <StripActionButton icon={<CheckCircle2 className='h-3 w-3' />} onClick={onMarkReviewed} iconOnly>Review</StripActionButton>
            </div>
        </section>
    )
}
