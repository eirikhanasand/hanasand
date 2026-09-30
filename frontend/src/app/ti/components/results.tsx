'use client'

import { TiSearchResponse } from '@/utils/ti/search'
import CatalogOnlyActorResult from './catalog-only-actor-result'
import EvidenceResults from './evidence-results'
import SearchLoading from './search-loading'

export default function Results({ result, error }: { result: TiSearchResponse; error: string }) {
    if (result.status === 'searching' || result.status === 'queued') return <SearchLoading query={result.query} />
    const catalogIdentity = result.actorIdentity
    if (catalogIdentity?.catalogMatched && !catalogIdentity.activityEvidenceAvailable) {
        return <CatalogOnlyActorResult result={result} identity={catalogIdentity} />
    }
    return <EvidenceResults result={result} error={error} />
}
