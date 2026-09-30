'use client'

import { type TiActorIntelligenceProfile } from '@/utils/ti/actorIntelligence'
import CoverageFallbackMetric from './coverage-fallback-metric'
import EmptyActorMap from './empty-actor-map'

export default function MapCoverageFallback({ regions, compact = false }: { regions: string[]; actor: TiActorIntelligenceProfile; compact?: boolean }) {
    return (
        <div data-ti-geo-coverage-fallback='true' className={`${compact ? 'gap-2 p-3' : 'gap-3 p-4'} grid bg-ui-panel dark:bg-ui-canvas`}>
            <EmptyActorMap compact={compact} />
            <p className='text-sm leading-6 text-ui-muted dark:text-ui-muted'>It is currently unknown where this threat actor operates or who their targets are.</p>
            <div className={`grid gap-2 ${compact ? 'sm:grid-cols-1' : 'md:grid-cols-1'}`}>
                <CoverageFallbackMetric label='Regions' value={regions.length ? regions.join(', ') : 'Unknown'} />
            </div>
            {regions.length ? (
                <div className='flex flex-wrap gap-2'>
                    {regions.map(region => (
                        <span key={region} className='rounded-md border border-ui-primary/35 bg-ui-primary/10 px-2 py-1 text-xs font-semibold text-ui-primary dark:border-ui-primary/35 dark:bg-ui-primary/10 dark:text-ui-primary'>{region}</span>
                    ))}
                </div>
            ) : null}
        </div>
    )
}
