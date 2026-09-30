'use client'

import { sourceHealthChipClass } from '../pageClientShared'
import { TiSearchResponse } from '@/utils/ti/search'

export default function ActorIdentityPanel({ identity }: { identity: NonNullable<TiSearchResponse['actorIdentity']> }) {
    return (
        <section data-ti-actor-identity='true' className='min-w-0 border-y border-ui-border py-3 dark:border-ui-border'>
            <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                <div className='min-w-0'>
                    <p className='text-xs font-semibold uppercase text-ui-primary dark:text-ui-primary'>Actor reference</p>
                </div>
                {identity.ambiguous ? <span className={sourceHealthChipClass('review')}>multiple matches</span> : null}
            </div>
            <ul className='mt-3 grid min-w-0 gap-2'>
                {identity.candidates.map(candidate => (
                    <li key={`${candidate.catalogId}:${candidate.externalId}`} className='min-w-0 border-t border-ui-border pt-2 dark:border-ui-border'>
                        <div className='flex min-w-0 flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                                <p className='wrap-break-word text-sm font-semibold text-ui-text dark:text-ui-text'>{candidate.canonicalName} · {candidate.externalId}</p>
                                <p className='mt-1 wrap-break-word text-xs leading-5 text-ui-muted dark:text-ui-muted'>
                                    {candidate.associatedNames.length ? `Also known as ${candidate.associatedNames.slice(0, 5).join(', ')}` : 'Public actor reference'}
                                </p>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        </section>
    )
}
