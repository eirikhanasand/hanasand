'use client'

import { formatDate } from '../pageClientShared'
import { formatLabel } from '../pageModel'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'

export default function ActorUpdateTimeline({ timeline }: { timeline: TiActorIntelligenceProfile['updateTimeline'] }) {
    return <section className='grid gap-2'>
        <div><h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>Recent changes</h2></div>
        {timeline.length ? <ol className='grid gap-2'>{timeline.slice(0, 8).map((item, index) => <li key={`${item.updatedAt}:${index}`} className='rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs text-ui-muted dark:text-ui-muted'><time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time><span>{item.assertionKind === 'inferred' ? 'Inferred' : 'Extracted'}{item.confidence ? ` · ${Math.round(item.confidence * 100)}% confidence` : ''}</span></div>
            {item.sourceName ? <p className='mt-1 text-xs text-ui-muted dark:text-ui-muted'>Source: {item.sourceUrl ? <a className='text-ui-primary underline underline-offset-2' href={item.sourceUrl} target='_blank' rel='noopener noreferrer'>{item.sourceName}</a> : item.sourceName}</p> : null}
            <ul className='mt-2 grid gap-1 text-sm text-ui-text dark:text-ui-text'>{item.changes.slice(0, 6).map((change, changeIndex) => <li key={`${change.field}:${changeIndex}`}><span className='font-semibold'>{formatLabel(change.field)}:</span> {change.previousValue == null ? 'Not previously recorded' : String(change.previousValue)} → {String(change.newValue ?? 'Removed')}</li>)}</ul>
        </li>)}</ol> : <p className='rounded-lg border border-dashed border-ui-border p-3 text-sm text-ui-muted dark:border-ui-border dark:text-ui-muted'>No profile changes are recorded yet.</p>}
    </section>
}
