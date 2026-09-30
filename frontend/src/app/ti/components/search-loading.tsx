'use client'

import { Loader2 } from 'lucide-react'

export default function SearchLoading({ query }: { query: string }) {
    return <section data-ti-search-loading='true' className='grid min-h-48 place-items-center rounded-lg border border-ui-border bg-ui-panel p-6 shadow-sm dark:border-ui-border dark:bg-ui-panel'>
        <div className='inline-flex items-center gap-3 text-sm font-semibold text-ui-muted dark:text-ui-muted' role='status' aria-live='polite'>
            <Loader2 className='h-5 w-5 animate-spin text-ui-loader' />
            Searching {query ? `“${query}”` : 'threat intelligence'}…
        </div>
    </section>
}
