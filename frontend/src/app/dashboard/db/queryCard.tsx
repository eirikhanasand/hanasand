import { ChevronDown, Clock3 } from 'lucide-react'
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

export default function QueryCard({ query, duration, expanded = false }: { query: DatabaseQueryActivity, duration: string, expanded?: boolean }) {
    const preview = (query.query || 'Query text unavailable').replace(/\s+/g, ' ').trim()
    return <details open={expanded || undefined} className='group/query min-w-0 rounded-lg border border-ui-border bg-ui-raised/40' data-query-card>
        <summary className='flex cursor-pointer list-none items-start gap-3 rounded-lg p-4 transition hover:bg-ui-primary/5 focus-visible:outline-ui-primary [&::-webkit-details-marker]:hidden'>
            <ChevronDown aria-hidden className='mt-1 h-4 w-4 shrink-0 text-ui-primary transition group-open/query:rotate-180' />
            <span className='min-w-0 flex-1'>
                <code className='block truncate text-sm font-semibold text-ui-text'>{preview.length > 100 ? `${preview.slice(0, 100)}…` : preview}</code>
                <span className='mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ui-muted'>
                    <span>{query.database || 'Unknown database'}</span>
                    <span className='rounded bg-ui-primary/10 px-2 py-1 text-ui-primary'>{query.state || 'Unknown state'}</span>
                    <span className={`inline-flex items-center gap-1 ${query.isLongRunning ? 'font-semibold text-ui-warning' : ''}`}><Clock3 aria-hidden className='h-3.5 w-3.5' />{duration}{query.isLongRunning ? ' · Long-running' : ''}</span>
                </span>
            </span>
        </summary>
        <div className='space-y-4 border-t border-ui-border p-4'>
            <dl className='grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3'>
                {[
                    ['Database', query.database], ['User', query.user], ['State', query.state],
                    ['Duration', duration], ['Wait', [query.waitEventType, query.waitEvent].filter(Boolean).join(' / ') || 'None'],
                ].map(([label, value]) => <div key={label} className='min-w-0'><dt className='text-xs text-ui-muted'>{label}</dt><dd className='mt-1 break-words font-medium text-ui-text'>{value || 'Unknown'}</dd></div>)}
            </dl>
            <QueryCode query={query.query} />
        </div>
    </details>
}
