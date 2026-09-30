'use client'

import { citationNames, formatDate } from '../pageClientShared'
import { ActorMark } from '@/components/ti/actorMark'
import { actorSummary, usefulActorSummary } from '@/utils/ti/actorSummary'
import { TiSearchResponse } from '@/utils/ti/search'
import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import ActorDescription from './actor-description'
import EvidenceMetric from './evidence-metric'

export default function ActorProfileHeader({ result, title, actor, aliases, summary, actorQuery = true, activeCitation, onCitationClick }: {
    result: TiSearchResponse
    title: string
    actor: TiActorIntelligenceProfile
    aliases: string[]
    summary?: string
    references?: Array<{ name: string; url?: string }>
    actorQuery?: boolean
    activeCitation?: number | null
    onCitationClick?: (number: number) => void
}) {
    const externalId = result.actorIdentity?.candidates.length === 1 ? result.actorIdentity.candidates[0]?.externalId : undefined
    const catalogCandidate = result.actorIdentity?.candidates.length === 1 ? result.actorIdentity.candidates[0] : undefined
    const catalogDescription = result.actorIdentity?.candidates.length === 1 ? result.actorIdentity.candidates[0]?.description : undefined
    const description = usefulActorSummary(catalogDescription) || usefulActorSummary(summary) || actorSummary({
        name: title,
        aliases,
        actorClass: actor.actorClass,
        attribution: actor.attribution,
        targetSectors: actor.targetSectors,
        geographies: actor.geographies,
        malwareTools: actor.malwareTools,
    }) || `${title} is a tracked threat actor.`
    const facts = [
        actor.motivation.length ? { label: 'Motivation', value: actor.motivation.slice(0, 2).join('; ') } : null,
        aliases.length ? { label: 'Also known as', value: aliases.slice(0, 4).join(', ') } : null,
        actor.lastSeen ? { label: 'Last seen', value: formatDate(actor.lastSeen) } : null,
    ].filter((fact): fact is { label: string; value: string } => Boolean(fact))
    const citations = citationNames(description)
    return <section data-ti-actor-info='true' className='grid gap-4'>
        <div>
            <div className='flex items-center gap-3'>
                <ActorMark name={title} size='md' />
                <div className='flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1'>
                    <h1 className='wrap-break-word text-3xl font-semibold tracking-normal text-ui-text dark:text-ui-text md:text-4xl'>{title}{actorQuery && externalId ? ` · ${externalId}` : ''}</h1>
                    {catalogCandidate ? <span className='text-[11px] font-medium text-ui-primary/70 dark:text-ui-primary/70'>Created {formatDate(catalogCandidate.createdAt)} · Updated {formatDate(catalogCandidate.modifiedAt)}</span> : null}
                </div>
            </div>
            <ActorDescription description={description} citations={citations} activeCitation={activeCitation ?? null} onCitationClick={onCitationClick ?? (() => undefined)} />
        </div>
        {facts.length ? <div className='grid gap-3 sm:grid-cols-2'>
            {facts.map(fact => <EvidenceMetric key={fact.label} label={fact.label} value={fact.value} />)}
        </div> : null}
    </section>
}
