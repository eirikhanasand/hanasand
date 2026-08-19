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

export default async function ApiDocsPage() {
    const contract = await loadContract()
    if (!contract) return <DashboardPage><DashboardHeader eyebrow='Developer tools' title='API docs' description='The API contract could not be loaded.' /><DashboardPanel className='p-4 text-sm text-ui-danger'>The live API contract is temporarily unavailable. Try again shortly.</DashboardPanel></DashboardPage>

    const server = contract.servers?.[0]?.url || 'https://api.hanasand.com/api/v1'
    const operations = Object.entries(contract.paths).flatMap(([path, methods]) => Object.entries(methods).map(([method, operation]) => ({ path, method: method.toUpperCase(), operation: operation as Operation })))
    const schemaEntries = Object.entries(contract.components?.schemas || {})

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
    return <span className='ml-auto inline-flex items-center gap-1 rounded-full border border-ui-border px-2 py-1 text-[10px] font-semibold text-ui-muted'>{anonymous ? 'Anonymous' : <><LockKeyhole className='h-3 w-3' />Authenticated</>}</span>
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
