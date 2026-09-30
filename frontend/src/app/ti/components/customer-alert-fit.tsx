'use client'

import { severityClass, type AlertPacket, type AnalystWorkItem, type WatchlistRelevance } from '../pageModel'
import WatchlistBlock from './watchlist-block'

export default function CustomerAlertFit({ selected, watchlist, alertPacket }: { selected: AnalystWorkItem; watchlist: WatchlistRelevance; alertPacket: AlertPacket | null }) {
    return (
        <div className='mt-4 rounded-lg border border-ui-border bg-ui-panel p-3'>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Customer Alert Fit</p>
                    <p className='mt-1 text-sm leading-6 text-ui-muted'>{alertPacket?.customerValue ?? watchlist.rationale}</p>
                </div>
                <span className={severityClass(selected.severity)}>{selected.kind === 'exposure' ? 'alert candidate' : 'context for watchlists'}</span>
            </div>
            <div className='mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
                <WatchlistBlock title='Matched watchlists' values={watchlist.matchedTerms} />
                <WatchlistBlock title='Watch terms' values={watchlist.terms} />
                <WatchlistBlock title='Organizations' values={watchlist.organizations} />
                <WatchlistBlock title='Sectors / countries' values={[...watchlist.sectors.slice(0, 4), ...watchlist.countries.slice(0, 4)]} />
            </div>
            {watchlist.domains.length ? (
                <div className='mt-3'>
                    <p className='text-xs font-semibold uppercase text-ui-muted'>Domains to monitor</p>
                    <div className='mt-2 flex flex-wrap gap-2'>
                        {watchlist.domains.map(domain => <span key={domain} className='rounded-full border border-ui-border bg-ui-panel px-2.5 py-1 text-xs font-semibold text-ui-text'>{domain}</span>)}
                    </div>
                </div>
            ) : null}
        </div>
    )
}
