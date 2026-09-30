'use client'

import { displayRequirementText, unique } from '../pageModel'
import { TiSearchResponse } from '@/utils/ti/search'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import ActorUpdateTimeline from './actor-update-timeline'

export default function ActorProfileSections({ result, actor, victims }: { result: TiSearchResponse; actor: TiActorIntelligenceProfile; victims: ReturnType<typeof victimObservationsFor> }) {
    const sections = [
        { title: 'Motivation', items: actor.motivation, empty: 'Motivation unknown.' },
        { title: 'Activity', items: [...actor.campaigns, ...result.recentActivity.slice(0, 4).map(item => item.title)], empty: 'No activity found.' },
        { title: 'Victims and sectors', items: [...actor.targetSectors, ...victims.slice(0, 4).map(item => `${item.victim}${item.country !== 'Country not stated' ? ` · ${item.country}` : ''}`)], empty: 'No victims or sectors found.' },
        { title: 'Malware and tools', items: actor.malwareTools, empty: 'No malware or tools found.' },
        { title: 'TTPs', items: actor.techniqueCoverage.map(item => item.attackId ? `${item.attackId} · ${item.name}` : item.name), empty: 'No techniques found.' },
    ]
    return <section data-ti-actor-profile='true' className='grid gap-4 border-y border-ui-border py-4 dark:border-ui-border'>
        <div className='grid gap-4 md:grid-cols-2'>
            {sections.map(section => <section key={section.title} className='min-w-0 rounded-lg border border-ui-border bg-ui-panel p-3 dark:border-ui-border dark:bg-ui-panel'>
                <h2 className='text-base font-semibold text-ui-text dark:text-ui-text'>{section.title}</h2>
                {section.items.length ? <ul className='mt-2 grid gap-2'>{unique(section.items).slice(0, 8).map(item => <li key={item} className='wrap-break-word text-sm leading-6 text-ui-text dark:text-ui-text'>{displayRequirementText(item)}</li>)}</ul> : <p className='mt-2 text-sm leading-6 text-ui-muted dark:text-ui-muted'>{section.empty}</p>}
            </section>)}
        </div>
        <ActorUpdateTimeline timeline={actor.updateTimeline} />
    </section>
}
