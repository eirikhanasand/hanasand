import type { Metadata } from 'next'
import Link from 'next/link'
import { Braces, Code2, ExternalLink, LockKeyhole } from 'lucide-react'
import { authApiUrl } from '@/utils/auth/authApiUrl'
import { DashboardHeader, DashboardPage, DashboardPanel } from '@/components/dashboard/ui'
import ApiDocsSearch from './apiDocsSearch'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
    title: 'API docs',
    description: 'Interactive-style reference for the Hanasand public intelligence API.',
}

type Schema = Record<string, unknown>
type ResponseSpec = { description?: string, content?: Record<string, unknown> }
type Operation = {
    operationId?: string
    summary?: string
    description?: string
    security?: Array<Record<string, unknown>>
    requestBody?: { required?: boolean, content?: Record<string, { schema?: Schema }> }
    responses?: Record<string, ResponseSpec | { $ref?: string }>
}
type Contract = {
    info: { title: string, version: string, description?: string }
    servers?: Array<{ url: string, description?: string }>
    paths: Record<string, Partial<Record<'get' | 'post' | 'put' | 'patch' | 'delete', Operation>>>
    components?: { schemas?: Record<string, Schema> }
}

type ApplicationEndpoint = { path: string, method: string, summary: string }

const applicationEndpoints: ApplicationEndpoint[] = [
    { method: 'GET', path: '/share/:id', summary: 'Read a shared file' },
    { method: 'GET', path: '/share/tree/:id', summary: 'Read a share file tree' },
    { method: 'GET', path: '/share/user/:id', summary: 'List the current user’s shares' },
    { method: 'GET', path: '/share/lock/:id', summary: 'Toggle a share lock' },
    { method: 'POST', path: '/share', summary: 'Create or update a shared file' },
    { method: 'PUT', path: '/share/:id', summary: 'Update a shared file' },
    { method: 'DELETE', path: '/share/:id', summary: 'Delete a shared file' },
    { method: 'GET', path: '/project/:alias', summary: 'Read a shared project' },
    { method: 'GET', path: '/projects/user/:id', summary: 'List the current user’s projects' },
    { method: 'DELETE', path: '/project/:alias', summary: 'Delete a shared project' },
    { method: 'GET', path: '/browser/profiles', summary: 'Read browser sandbox profiles' },
    { method: 'PUT', path: '/browser/profiles', summary: 'Update browser sandbox profiles' },
    { method: 'GET', path: '/browser/stats', summary: 'Read browser usage statistics' },
    { method: 'GET', path: '/browser/runs', summary: 'List browser runs' },
    { method: 'GET', path: '/browser/runs/:id/report', summary: 'Read a browser run report' },
    { method: 'POST', path: '/browser/runs/:id/report', summary: 'Create a browser run report' },
    { method: 'GET', path: '/support/tickets', summary: 'List support tickets' },
    { method: 'POST', path: '/support/tickets', summary: 'Create a support ticket' },
    { method: 'GET', path: '/support/tickets/:id/messages', summary: 'List support messages' },
    { method: 'POST', path: '/support/tickets/:id/messages', summary: 'Post a support message' },
    { method: 'GET', path: '/ti/enrichment', summary: 'Read threat-intelligence enrichment' },
    { method: 'POST', path: '/ti/enrichment/run', summary: 'Run threat-intelligence enrichment' },
    { method: 'GET', path: '/ti/saved-searches', summary: 'List saved searches' },
    { method: 'POST', path: '/ti/saved-searches', summary: 'Save a search' },
    { method: 'DELETE', path: '/ti/saved-searches', summary: 'Delete a saved search' },
    { method: 'GET', path: '/organizations', summary: 'List organizations' },
    { method: 'POST', path: '/organizations', summary: 'Create an organization' },
    { method: 'GET', path: '/organizations/:id', summary: 'Read an organization' },
    { method: 'GET', path: '/organizations/:id/members', summary: 'List organization members' },
    { method: 'GET', path: '/organizations/:id/settings', summary: 'Read organization settings' },
    { method: 'PUT', path: '/organizations/:id/settings', summary: 'Update organization settings' },
    { method: 'GET', path: '/organizations/:id/api-keys', summary: 'List organization API keys' },
    { method: 'POST', path: '/organizations/:id/api-keys', summary: 'Create an organization API key' },
    { method: 'DELETE', path: '/organizations/:id/api-keys/:keyId', summary: 'Revoke an organization API key' },
    { method: 'GET', path: '/organizations/:id/watchlists', summary: 'List organization watchlists' },
    { method: 'POST', path: '/organizations/:id/watchlists', summary: 'Create a watchlist item' },
    { method: 'GET', path: '/dwm/webhook-destinations', summary: 'List webhook destinations' },
    { method: 'POST', path: '/dwm/webhook-destinations', summary: 'Create a webhook destination' },
    { method: 'PUT', path: '/dwm/webhook-destinations/:id', summary: 'Update a webhook destination' },
    { method: 'DELETE', path: '/dwm/webhook-destinations/:id', summary: 'Delete a webhook destination' },
    { method: 'GET', path: '/billing/subscription', summary: 'Read billing subscription' },
    { method: 'POST', path: '/billing/portal', summary: 'Create a billing portal session' },
].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))

export default async function ApiDocsPage() {
    const contract = await loadContract()
    if (!contract) return <DashboardPage><DashboardHeader eyebrow='Developer tools' title='API docs' description='The API contract could not be loaded.' /><DashboardPanel className='p-4 text-sm text-ui-danger'>The live API contract is temporarily unavailable. Try again shortly.</DashboardPanel></DashboardPage>

    const server = contract.servers?.[0]?.url || 'https://api.hanasand.com/api/v1'
    const operations = Object.entries(contract.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method: method.toUpperCase(), operation: operation as Operation }))).sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
    const schemaEntries = Object.entries(contract.components?.schemas || {}).sort(([a], [b]) => a.localeCompare(b))

    return (
        <DashboardPage>
            <DashboardHeader
                eyebrow='Developer tools'
                title={contract.info.title}
                description={contract.info.description || 'Use the production API with documented paths, authentication, request shapes, and response codes.'}
                actions={<div className='flex items-center gap-2'><ApiDocsSearch /><Link href='/developers' target='_blank' rel='noopener noreferrer' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-raised px-3 text-xs font-semibold text-ui-text transition hover:border-ui-primary'>Public guide <ExternalLink className='h-3.5 w-3.5' /></Link></div>}
            />

            <DashboardPanel className='grid gap-3 p-4 sm:grid-cols-3'>
                <Info label='Base URL' value={server} mono />
                <Info label='Version' value={`v${contract.info.version}`} />
                <Info label='Operations' value={String(operations.length)} />
            </DashboardPanel>

            <section className='grid gap-3' aria-label='API endpoints'>
                <div className='flex items-center gap-2'><Code2 className='h-4 w-4 text-ui-primary' /><h2 className='text-base font-semibold text-ui-text'>Endpoints</h2></div>
                {operations.map(({ path, method, operation }) => <div key={`${method}:${path}`} data-api-search={`${method} ${path} ${operation.summary || operation.operationId || ''}`}><Endpoint path={path} method={method} operation={operation} /></div>)}
            </section>

            <section className='grid gap-3' aria-label='Application API endpoints'>
                <div><div className='flex items-center gap-2'><Code2 className='h-4 w-4 text-ui-primary' /><h2 className='text-base font-semibold text-ui-text'>Application API</h2></div><p className='mt-1 text-sm text-ui-muted'>Customer-facing dashboard, sharing, support, browser, organization, and billing endpoints.</p></div>
                {applicationEndpoints.map(endpoint => <div key={`${endpoint.method}:${endpoint.path}`} data-api-search={`${endpoint.method} ${endpoint.path} ${endpoint.summary}`}><Endpoint path={endpoint.path} method={endpoint.method} operation={{ summary: endpoint.summary }} /></div>)}
            </section>

            {schemaEntries.length ? <section className='grid gap-3'><div className='flex items-center gap-2'><Braces className='h-4 w-4 text-ui-primary' /><h2 className='text-base font-semibold text-ui-text'>Schemas</h2></div><div className='grid gap-2'>{schemaEntries.map(([name, schema]) => <details key={name} data-api-search={`${name} ${JSON.stringify(schema)}`} className='rounded-lg border border-ui-border bg-ui-panel'><summary className='cursor-pointer px-4 py-3 text-sm font-semibold text-ui-text'>{name}</summary><pre className='overflow-x-auto border-t border-ui-border bg-ui-canvas p-4 text-xs leading-6 text-ui-muted'>{JSON.stringify(schema, null, 2)}</pre></details>)}</div></section> : null}
        </DashboardPage>
    )
}

function Endpoint({ path, method, operation }: { path: string, method: string, operation: Operation }) {
    const requestSchema = operation.requestBody?.content?.['application/json']?.schema
    const responses = Object.entries(operation.responses || {})
    return <details className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel' open={method === 'GET' && path === '/actors'}>
        <summary className='flex cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3'>
            <span className={`rounded-md px-2 py-1 text-[11px] font-bold ${method === 'GET' ? 'bg-ui-success/15 text-ui-success' : 'bg-ui-primary/15 text-ui-primary'}`}>{method}</span>
            <code className='font-mono text-sm font-semibold text-ui-text'>{path}</code>
            <span className='text-sm text-ui-muted'>{operation.summary || operation.operationId || 'API operation'}</span>
            <AuthBadge security={operation.security} />
        </summary>
        <div className='grid gap-4 border-t border-ui-border bg-ui-canvas p-4'>
            {operation.description ? <p className='text-sm leading-6 text-ui-muted'>{operation.description}</p> : null}
            <div className='grid gap-3 md:grid-cols-2'>
                <div className='rounded-md border border-ui-border bg-ui-panel p-3'><p className='text-[11px] font-semibold uppercase text-ui-muted'>Request</p><p className='mt-2 text-sm text-ui-text'>{requestSchema ? `${operation.requestBody?.required ? 'Required' : 'Optional'} JSON body` : 'No request body'}</p>{requestSchema ? <pre className='mt-2 overflow-x-auto text-xs leading-5 text-ui-muted'>{JSON.stringify(requestSchema, null, 2)}</pre> : null}</div>
                <div className='rounded-md border border-ui-border bg-ui-panel p-3'><p className='text-[11px] font-semibold uppercase text-ui-muted'>Responses</p><div className='mt-2 grid gap-2'>{responses.map(([status, response]) => <div key={status} className='flex items-start gap-2 text-sm'><code className={`font-semibold ${status.startsWith('2') ? 'text-ui-success' : 'text-ui-warning'}`}>{status}</code><span className='text-ui-muted'>{'$ref' in response ? response.$ref : 'description' in response ? response.description || 'Response' : 'Response'}</span></div>)}</div></div>
            </div>
        </div>
    </details>
}

function AuthBadge({ security }: { security?: Array<Record<string, unknown>> }) {
    const anonymous = Array.isArray(security) && security.length === 0
    return <span className='ml-auto inline-flex items-center gap-1 rounded-full border border-ui-border px-2 py-1 text-[10px] font-semibold text-ui-muted'>{anonymous ? 'Public' : <><LockKeyhole className='h-3 w-3' />Authenticated</>}</span>
}

function Info({ label, value, mono = false }: { label: string, value: string, mono?: boolean }) {
    return <div className='min-w-0'><p className='text-[11px] font-semibold uppercase text-ui-muted'>{label}</p><p className={`mt-1 truncate text-sm text-ui-text ${mono ? 'font-mono' : 'font-semibold'}`}>{value}</p></div>
}

async function loadContract(): Promise<Contract | null> {
    try {
        const response = await fetch(`${authApiUrl().replace(/\/$/, '')}/v1/openapi.json`, { cache: 'no-store' })
        if (!response.ok) return null
        const contract = await response.json() as Contract
        return contract.info && contract.paths ? contract : null
    } catch {
        return null
    }
}
