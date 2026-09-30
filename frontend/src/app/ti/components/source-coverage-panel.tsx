'use client'

import { TI_DOSSIER_SOURCE_FAMILY_ROWS, captureCoverageLabel, formatDate } from '../pageClientShared'
import { coverageMissingLabel, formatLabel } from '../pageModel'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'

export default function SourceCoveragePanel({ coverage }: { coverage: TiActorIntelligenceProfile['sourceCoverage'] }) {
    const metrics = [
        { label: 'Source results', value: String(coverage.totalRows) },
        { label: 'Dated activity', value: String(coverage.datedRows) },
        { label: 'Source status', value: captureCoverageLabel(coverage) },
        { label: 'Latest', value: coverage.latestReportDate ? formatDate(coverage.latestReportDate) : 'Not dated' },
    ]
    const coverageCopy = coverage.captureRows
        ? 'Replayable source captures are attached for analyst review.'
        : coverage.missing.includes('sourceProvenance[].captureId')
            ? 'Attach capture evidence before case replay or delivery review.'
            : coverage.stale ? 'Refresh source coverage before sending this to review.' : 'Evidence dates and source references are current.'
    return (
        <div data-ti-source-coverage='true' className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-raised'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-muted dark:text-ui-muted'>Source coverage</p>
                    <p className='mt-1 text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                        {coverageCopy}
                    </p>
                </div>
                <span className={coverage.stale ? 'rounded-md bg-ui-warning/10 px-2 py-1 text-[11px] font-semibold text-ui-warning dark:bg-ui-warning/10 dark:text-ui-warning' : 'rounded-md bg-ui-success/10 px-2 py-1 text-[11px] font-semibold text-ui-success dark:bg-ui-success/10 dark:text-ui-success'}>
                    {coverage.stale ? 'review' : 'ready'}
                </span>
            </div>
            <div className='mt-3 grid grid-cols-2 gap-2'>
                {metrics.map(metric => (
                    <div key={metric.label} className='min-w-0 rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'>
                        <p className='text-[11px] font-semibold uppercase text-ui-muted dark:text-ui-muted'>{metric.label}</p>
                        <p className='mt-1 wrap-break-word text-xs font-semibold text-ui-text dark:text-ui-text'>{metric.value}</p>
                    </div>
                ))}
            </div>
            <div className='mt-3 flex flex-wrap gap-1.5'>
                {coverage.sourceFamilies.length ? coverage.sourceFamilies.slice(0, TI_DOSSIER_SOURCE_FAMILY_ROWS).map(item => (
                    <span key={item.family} className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-text dark:border-ui-border dark:bg-ui-panel dark:text-ui-text'>
                        {formatLabel(item.family)} · {item.count}
                    </span>
                )) : <span className='text-xs text-ui-muted dark:text-ui-muted'>Source family coverage is not mapped yet.</span>}
                {coverage.sourceFamilies.length > TI_DOSSIER_SOURCE_FAMILY_ROWS ? <span className='rounded-md border border-ui-border bg-ui-panel px-2 py-1 text-[11px] font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-panel dark:text-ui-muted'>+{coverage.sourceFamilies.length - TI_DOSSIER_SOURCE_FAMILY_ROWS} more</span> : null}
            </div>
            {coverage.missing.length ? (
                <div className='mt-3 rounded-md border border-ui-warning/35 bg-ui-warning/10 p-2 text-xs leading-5 text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'>
                    Needs {coverage.missing.map(coverageMissingLabel).join(', ')}.
                </div>
            ) : null}
        </div>
    )
}
