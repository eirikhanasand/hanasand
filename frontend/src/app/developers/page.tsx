import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Braces, FileJson, KeyRound, ShieldCheck } from 'lucide-react'
import { buildRouteMetadata } from '../seo'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import CopyCodeButton from './copyCodeButton'
import ApiKeyOnboarding from './apiKeyOnboarding'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Developers',
    description: 'Versioned Hanasand public-intelligence API contract, authentication, pagination, limits, and generated client setup.',
    path: '/developers',
    keywords: ['hanasand developers', 'threat intelligence api', 'public intelligence api'],
})

type OpenApiOperation = { operationId?: string, summary?: string, description?: string, security?: Array<Record<string, unknown>>, requestBody?: { content?: { 'application/json'?: { schema?: { $ref?: string } } } }, responses?: Record<string, { description?: string } | { $ref?: string }> }
type OpenApiDocument = { info: { title: string, version: string, description?: string, 'x-compatibility-policy'?: string, 'x-idempotency-policy'?: string }, servers?: Array<{ url: string }>, paths: Record<string, Partial<Record<'get' | 'post', OpenApiOperation>>>, components?: { securitySchemes?: { ApiKey?: { name?: string } }, responses?: Record<string, { description?: string }> } }

export default async function DevelopersPage() {
    const contract = await loadContract()
    if (!contract) return <Unavailable />

    const server = contract.servers?.[0]?.url ?? 'https://api.hanasand.com/api/v1'
    const endpoints = Object.entries(contract.paths).flatMap(([path, methods]) => (['get', 'post'] as const).flatMap(method => {
        const operation = methods[method]
        return operation ? [{ method: method.toUpperCase(), path, summary: operation.summary ?? operation.operationId ?? path, access: operationAccessLabel(operation.security), scope: `${method.toUpperCase()} /api/v1${path}` }] : []
    }))
    const firstProtected = endpoints.find(endpoint => endpoint.method === 'GET' && endpoint.access !== 'Anonymous') ?? endpoints[0]
    const apiKeyHeader = contract.components?.securitySchemes?.ApiKey?.name ?? 'X-API-Key'
    const requestExample = `curl "${server}${firstProtected.path}?limit=20" \\\n  -H "${apiKeyHeader}: $HANASAND_API_KEY"`
    const typeCommand = 'npx openapi-typescript https://hanasand.com/api/openapi/ti -o src/hanasand-api.d.ts'
    const clientExample = `import createClient from 'openapi-fetch'
import type { paths } from './hanasand-api'

const api = createClient<paths>({
  baseUrl: '${server}',
  headers: { '${apiKeyHeader}': process.env.HANASAND_API_KEY! }
})

const { data, error } = await api.GET('${firstProtected.path}', {
  params: { query: { limit: 20 } }
})
if (error) throw new Error(error.error.message)`
    const errorRows = Object.entries(contract.components?.responses ?? {}).filter(([name]) => ['BadRequest', 'Unauthorized', 'Forbidden', 'RateLimited', 'InternalError', 'Unavailable'].includes(name))

    return (
        <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas text-ui-text'>
            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:px-8 lg:flex-row lg:items-end lg:justify-between'>
                    <div className='max-w-3xl'>
                        <p className='text-sm font-semibold uppercase text-ui-primary'>API v{contract.info.version}</p>
                        <h1 className='mt-2 text-4xl font-semibold tracking-normal'>{contract.info.title}</h1>
                        <p className='mt-4 text-base leading-7 text-ui-muted'>{contract.info.description}</p>
                    </div>
                    <div className='flex flex-wrap gap-3'>
                        <Link href='/register?path=%2Fdevelopers%23api-access' className='inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90'>Create API key<ArrowRight className='h-4 w-4' /></Link>
                        <Link href='/api/openapi/ti' className='inline-flex h-11 items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold text-ui-text transition hover:border-ui-primary'><FileJson className='h-4 w-4' />OpenAPI JSON</Link>
                    </div>
                </div>
            </section>

            <ApiKeyOnboarding server={server} />

            <section className='border-b border-ui-border'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-9 md:px-8 lg:grid-cols-2'>
                    <CodeBlock title='Authenticated request' code={requestExample} />
                    <div className='rounded-lg border border-ui-border bg-ui-panel p-5'>
                        <div className='flex items-center gap-2'><KeyRound className='h-5 w-5 text-ui-primary' /><h2 className='text-lg font-semibold'>Authentication</h2></div>
                        <p className='mt-3 text-sm leading-7 text-ui-muted'>Send a provisioned key in <code className='font-semibold text-ui-text'>{apiKeyHeader}</code>. Single search is anonymously rate-limited; batch search and most collection routes accept an exact method-and-route key scope or an authenticated session. Tenant-scoped alerts require an organization API key.</p>
                        <p className='mt-3 text-sm leading-7 text-ui-muted'>Responses include <code>X-Request-Id</code> and quota headers. API responses are <code>no-store</code>; failures and partial batches keep their real status.</p>
                    </div>
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto max-w-7xl px-4 py-9 md:px-8'>
                    <h2 className='text-2xl font-semibold'>Endpoints</h2>
                    <div className='mt-5 overflow-x-auto rounded-lg border border-ui-border'>
                        <table className='w-full min-w-[820px] text-left text-sm'>
                            <thead className='bg-ui-raised text-ui-muted'><tr><th className='p-3'>Method</th><th className='p-3'>Path</th><th className='p-3'>Purpose</th><th className='p-3'>Access</th><th className='p-3'>Key scope</th></tr></thead>
                            <tbody>{endpoints.map(endpoint => <tr key={`${endpoint.method}:${endpoint.path}`} className='border-t border-ui-border'><td className='p-3 font-semibold text-ui-success'>{endpoint.method}</td><td className='p-3 font-mono'>{endpoint.path}</td><td className='p-3'>{endpoint.summary}</td><td className='p-3 text-ui-muted'>{endpoint.access}</td><td className='p-3 font-mono text-xs text-ui-muted'>{endpoint.access === 'Anonymous' ? 'None' : endpoint.scope}</td></tr>)}</tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className='border-b border-ui-border'>
                <div className='mx-auto grid max-w-7xl gap-6 px-4 py-9 md:px-8 lg:grid-cols-2'>
                    <CodeBlock title='Generate TypeScript types' code={typeCommand} />
                    <CodeBlock title='Typed client' code={clientExample} />
                </div>
            </section>

            <section className='border-b border-ui-border bg-ui-panel'>
                <div className='mx-auto grid max-w-7xl gap-8 px-4 py-9 md:px-8 lg:grid-cols-2'>
                    <div><h2 className='text-2xl font-semibold'>Stable errors</h2><div className='mt-4 grid gap-2'>{errorRows.map(([name, response]) => <div key={name} className='grid grid-cols-[8rem_1fr] gap-3 border-b border-ui-border py-3 text-sm'><code className='font-semibold'>{name}</code><span className='text-ui-muted'>{response.description}</span></div>)}</div></div>
                    <div><h2 className='text-2xl font-semibold'>Compatibility</h2><p className='mt-4 text-sm leading-7 text-ui-muted'>{contract.info['x-compatibility-policy']}</p><p className='mt-3 text-sm leading-7 text-ui-muted'>{contract.info['x-idempotency-policy']}</p></div>
                </div>
            </section>

            <section>
                <div className='mx-auto flex max-w-7xl gap-3 px-4 py-9 md:px-8'><ShieldCheck className='mt-1 h-5 w-5 shrink-0 text-ui-primary' /><div><h2 className='font-semibold'>Evidence boundary</h2><p className='mt-2 text-sm leading-6 text-ui-muted'>Public responses exclude raw stolen material, restricted locators, customer tenant data, secrets, and internal object references.</p></div></div>
            </section>
        </main>
    )
}

function CodeBlock({ title, code }: { title: string, code: string }) {
    return <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-text'><div className='flex items-center justify-between gap-3 border-b border-ui-border/40 px-4 py-3 text-sm font-semibold text-ui-canvas'><span className='flex items-center gap-2'><Braces className='h-4 w-4 text-ui-primary' />{title}</span><CopyCodeButton value={code} /></div><pre className='overflow-x-auto whitespace-pre-wrap p-5 text-sm leading-7 text-ui-canvas/85'>{code}</pre></div>
}

function operationAccessLabel(security: OpenApiOperation['security']) {
    if (security?.length === 0) return 'Anonymous'
    const schemes = new Set((security ?? []).flatMap(requirement => Object.keys(requirement)))
    const apiKey = schemes.has('ApiKey')
    const session = schemes.has('SessionBearer') || schemes.has('SessionId')
    if (apiKey && session) return 'API key or session'
    if (apiKey) return 'API key'
    if (session) return 'Session'
    return 'Authenticated'
}

async function loadContract(): Promise<OpenApiDocument | null> {
    try {
        const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/v1/openapi.json`, { cache: 'no-store' })
        if (!response.ok) return null
        const contract = await response.json() as OpenApiDocument
        return contract.info && contract.paths ? contract : null
    } catch {
        return null
    }
}

function Unavailable() {
    return <main className='min-h-[calc(100vh-4.5rem)] bg-ui-canvas px-4 py-16 text-ui-text'><div className='mx-auto max-w-3xl rounded-lg border border-ui-border bg-ui-panel p-8'><FileJson className='h-6 w-6 text-ui-warning' /><h1 className='mt-4 text-3xl font-semibold'>API reference unavailable</h1><p className='mt-3 text-ui-muted'>The live API contract could not be loaded. No cached or handwritten reference is being shown.</p></div></main>
}
