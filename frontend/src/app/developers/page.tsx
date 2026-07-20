import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Braces, CheckCircle2, FileJson, KeyRound, ShieldCheck } from 'lucide-react'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Developers',
    description: 'Hanasand threat-intelligence search API reference, authentication, limits, and response contract.',
    path: '/developers',
    keywords: ['hanasand developers', 'threat intelligence api', 'threat intelligence search'],
})

const requestExample = `curl https://hanasand.com/api/ti/search \\
  -H "X-API-Key: $HANASAND_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query":"APT29"}'`

const endpoints = [
    { method: 'POST', path: '/api/ti/search', body: '{ "query": string }', limit: '2-200 characters' },
    { method: 'POST', path: '/api/ti/search/batch', body: '{ "queries": string[] }', limit: '25 unique queries' },
]

const responseFields = [
    ['status', 'ready, partial, searching, or review_required'],
    ['confidence', 'Normalized 0-1 confidence for the returned answer'],
    ['sources', 'Source references supporting the result'],
    ['recentActivity', 'Dated recent activity rows'],
    ['actionability', 'Watchlist suitability and evidence gaps'],
    ['notes', 'Collection, freshness, and review limitations'],
]

const errors = [
    ['400', 'Invalid query or oversized batch'],
    ['401', 'Missing, invalid, disabled, or expired API key'],
    ['403', 'The key does not have access to the requested method and route'],
    ['429', 'A configured key or account rate limit was exceeded'],
    ['502', 'The threat-intelligence search service is temporarily unavailable'],
]

export default function DevelopersPage() {
    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-12 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center'>
                    <div className='grid gap-5'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>API reference</p>
                        <h1 className='text-4xl font-semibold tracking-normal md:text-5xl'>Threat intelligence search</h1>
                        <p className='max-w-2xl text-base leading-7 text-ui-muted'>
                            Query the same search used by Hanasand. Responses include cited sources, confidence, freshness, review state, and explicit gaps.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            <Link href='/contact?intent=api' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>
                                Request API access
                                <ArrowRight className='h-4 w-4' />
                            </Link>
                            <a href='/api/openapi/ti' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'>
                                <FileJson className='h-4 w-4' />
                                OpenAPI JSON
                            </a>
                        </div>
                    </div>

                    <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-text shadow-md'>
                        <div className='flex items-center gap-2 border-b border-ui-border/40 px-4 py-3 text-sm font-semibold text-ui-canvas'>
                            <Braces className='h-4 w-4 text-ui-primary' />
                            First request
                        </div>
                        <pre className='overflow-x-auto whitespace-pre-wrap p-5 text-sm leading-7 text-ui-canvas/85'>{requestExample}</pre>
                    </div>
                </div>
            </section>

            <section className='border-b border-ui-border'>
                <div className='mx-auto max-w-7xl px-4 py-10 md:px-8'>
                    <div className='mb-5 flex items-center gap-3'>
                        <KeyRound className='h-5 w-5 text-ui-primary' />
                        <h2 className='text-2xl font-semibold'>Authentication</h2>
                    </div>
                    <p className='max-w-3xl text-sm leading-7 text-ui-muted'>
                        Send the provisioned key in <code className='font-semibold text-ui-text'>X-API-Key</code>. Keys are shown once when created, stored as hashes, expire on their configured date, and are limited to assigned methods, routes, and request budgets. Do not put keys in query strings or browser code.
                    </p>
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto max-w-7xl px-4 py-10 md:px-8'>
                    <h2 className='mb-5 text-2xl font-semibold'>Endpoints</h2>
                    <div className='overflow-x-auto rounded-lg border border-ui-border'>
                        <table className='w-full min-w-[680px] text-left text-sm'>
                            <thead className='bg-ui-raised text-ui-muted'><tr><th className='p-3'>Method</th><th className='p-3'>Path</th><th className='p-3'>JSON body</th><th className='p-3'>Limit</th></tr></thead>
                            <tbody>{endpoints.map(endpoint => <tr key={endpoint.path} className='border-t border-ui-border'><td className='p-3 font-semibold text-ui-success'>{endpoint.method}</td><td className='p-3 font-mono'>{endpoint.path}</td><td className='p-3 font-mono'>{endpoint.body}</td><td className='p-3 text-ui-muted'>{endpoint.limit}</td></tr>)}</tbody>
                        </table>
                    </div>
                    <p className='mt-4 text-sm text-ui-muted'>Batch results preserve input order. Search responses use <code>Cache-Control: no-store</code>. Rate-limit and reset headers are returned with each request.</p>
                </div>
            </section>

            <section className='border-b border-ui-border'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-8 lg:grid-cols-2'>
                    <div>
                        <h2 className='mb-5 text-2xl font-semibold'>Response contract</h2>
                        <div className='grid gap-2'>{responseFields.map(([field, description]) => <div key={field} className='grid grid-cols-[9rem_1fr] gap-3 border-b border-ui-border py-3 text-sm'><code className='font-semibold'>{field}</code><span className='text-ui-muted'>{description}</span></div>)}</div>
                    </div>
                    <div>
                        <h2 className='mb-5 text-2xl font-semibold'>Errors</h2>
                        <div className='grid gap-2'>{errors.map(([status, description]) => <div key={status} className='grid grid-cols-[4rem_1fr] gap-3 border-b border-ui-border py-3 text-sm'><code className='font-semibold'>{status}</code><span className='text-ui-muted'>{description}</span></div>)}</div>
                    </div>
                </div>
            </section>

            <section className='bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-5 px-4 py-10 md:px-8 lg:grid-cols-3'>
                    <div className='flex gap-3'><ShieldCheck className='mt-1 h-5 w-5 shrink-0 text-ui-primary' /><div><h2 className='font-semibold'>Evidence boundaries</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>The API excludes raw stolen material, secrets, restricted locators, and internal object references.</p></div></div>
                    <div className='flex gap-3'><CheckCircle2 className='mt-1 h-5 w-5 shrink-0 text-ui-primary' /><div><h2 className='font-semibold'>Current scope</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>External access currently covers single and batch search. Organization alert and webhook administration remain session-bound.</p></div></div>
                    <div className='flex gap-3'><FileJson className='mt-1 h-5 w-5 shrink-0 text-ui-primary' /><div><h2 className='font-semibold'>Versioning</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>The OpenAPI document is versioned independently. Additive response fields may appear without a major version change.</p></div></div>
                </div>
            </section>
        </main>
    )
}
