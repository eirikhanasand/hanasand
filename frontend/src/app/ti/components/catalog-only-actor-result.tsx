'use client'

import { citationNames } from '../pageClientShared'
import { buildActorIntelligence } from '@/utils/ti/actorIntelligence'
import { humanizeSlug } from '../../seo'
import { TiSearchResponse } from '@/utils/ti/search'
import { usefulActorSummary } from '@/utils/ti/actorSummary'
import { useState } from 'react'
import { victimObservationsFor } from '@/utils/ti/actorProfile'
import ActorProfileHeader from './actor-profile-header'
import ActorProfileSections from './actor-profile-sections'
import ActorReferences from './actor-references'
import ThreatActorMap from './threat-actor-map'

export default function CatalogOnlyActorResult({ result, identity }: { result: TiSearchResponse; identity: NonNullable<TiSearchResponse['actorIdentity']> }) {
    const candidate = !identity.ambiguous && identity.candidates.length === 1 ? identity.candidates[0] : undefined
    const title = candidate?.canonicalName ?? humanizeSlug(result.query)
    const victims = victimObservationsFor(result)
    const actor = buildActorIntelligence(result, victims)
    const [activeCitation, setActiveCitation] = useState<number | null>(null)
    const description = usefulActorSummary(candidate?.description) || `${title} is a tracked threat actor.`
    const citations = citationNames(description)
    return (
        <section data-ti-catalog-only='true' className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
            <div className='grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(24rem,0.85fr)] xl:items-start'>
                <ActorProfileHeader result={result} title={title} actor={actor} aliases={result.aliases} summary={candidate?.description} references={candidate?.referenceSources} activeCitation={activeCitation} onCitationClick={setActiveCitation} />
                <ThreatActorMap actor={actor} result={result} compact />
            </div>
            <ActorProfileSections result={result} actor={actor} victims={victims} />
            <ActorReferences citations={citations} references={candidate?.referenceSources} activeCitation={activeCitation} />
        </section>
    )
}
