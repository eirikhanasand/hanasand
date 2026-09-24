import { Clock3 } from 'lucide-react'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import { format } from 'sql-formatter'
import type { DatabaseQueryActivity } from '@/utils/db/internal'

hljs.registerLanguage('sql', sql)

export function QueryCode({ query }: { query: string | null }) {
    let formatted = query || 'Query text unavailable'
    try {
        formatted = format(formatted, { language: 'postgresql', tabWidth: 2 })
    } catch {
        // PostgreSQL can return partial statements; keep their original text visible.
    }
    return <pre tabIndex={0} aria-label='SQL query' className='max-h-[32rem] overflow-auto rounded-md border border-ui-border bg-ui-canvas p-4 text-sm leading-6 text-ui-text focus-visible:outline-ui-primary [&_.hljs-keyword]:font-semibold [&_.hljs-keyword]:text-ui-primary [&_.hljs-string]:text-ui-success [&_.hljs-comment]:text-ui-muted [&_.hljs-built_in]:text-ui-text [&_.hljs-number]:text-ui-primary'>
        <code dangerouslySetInnerHTML={{ __html: hljs.highlight(formatted, { language: 'sql' }).value }} />
    </pre>
}

export default function QueryCard({ query, duration }: { query: DatabaseQueryActivity, duration: string }) {
    return <div className='min-w-0 space-y-3' data-query-card>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ui-muted'>
            <span className='font-medium text-ui-text'>{query.database || 'Unknown database'}</span>
            <span className='rounded bg-ui-primary/10 px-2 py-1 text-xs text-ui-primary'>{query.state || 'Unknown state'}</span>
            <span className={`inline-flex items-center gap-1 text-xs ${query.isLongRunning ? 'font-semibold text-ui-warning' : ''}`}><Clock3 aria-hidden className='h-3.5 w-3.5' />{duration}{query.isLongRunning ? ' · Long-running' : ''}</span>
        </div>
        <dl className='flex flex-wrap gap-x-8 gap-y-2 text-sm'>
            {[
                ['User', query.user], ['Wait', [query.waitEventType, query.waitEvent].filter(Boolean).join(' / ') || 'None'],
            ].map(([label, value]) => <div key={label} className='min-w-0'><dt className='text-xs text-ui-muted'>{label}</dt><dd className='mt-1 wrap-break-word text-ui-text'>{value || 'Unknown'}</dd></div>)}
        </dl>
        <QueryCode query={query.query} />
    </div>
}
