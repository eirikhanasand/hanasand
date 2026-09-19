import assert from 'node:assert/strict'
import { currentOpenApi } from '../src/utils/api/currentOpenApi'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { hasAppSidebar } from '../src/utils/routes/appRoutes'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { renderToReadableStream } from 'react-dom/server'
import { publicTiOpenApi } from '../../api/src/contracts/publicTiOpenApi'
import { responseExamples } from '../src/app/dashboard/api-docs/responseExamples'
import { getDashboardNavigation, navigationLinks } from '../src/utils/layout/dashboardNavigation'

const require = createRequire(`${process.cwd()}/package.json`)
const Ajv = require('ajv')
const ajv = new Ajv()
const publicOperations = Object.entries(publicTiOpenApi.paths).flatMap(([path, methods]) => Object.entries(methods as Record<string, { responses: Record<string, { content: Record<string, { schema: unknown }> }> }>).map(([method, operation]) => ({ key: `${method.toUpperCase()} ${path}`, operation })))
for (const { key, operation } of publicOperations) {
    const sample = responseExamples[key]
    assert(sample, `Missing example for ${key}`)
    const schema = operation.responses[sample.status]?.content['application/json'].schema
    assert(schema, `Example status is undocumented for ${key}`)
    const validate = ajv.compile({ components: { schemas: publicTiOpenApi.components.schemas }, ...schema as object })
    assert(validate(sample.body), `${key}: ${JSON.stringify(validate.errors)}`)
}
const source = readFileSync('src/app/dashboard/api-docs/content.tsx', 'utf8')
const applicationKeys = [...source.matchAll(/method: '([A-Z]+)', path: '([^']+)'/g)].map(match => `${match[1]} ${match[2]}`)
const keys = [...publicOperations.map(item => item.key), ...applicationKeys]
assert.equal(keys.length, 54)
assert.deepEqual(Object.keys(responseExamples).sort(), [...keys].sort(), 'Every documented endpoint needs exactly one example')
for (const sample of Object.values(responseExamples)) {
    const strings = (value: unknown): string[] => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : []
    for (const value of strings(sample.body)) {
        if (value.startsWith('https://')) {
            const host = new URL(value).hostname
            assert(host === 'example.com' || host.endsWith('.example.com'), `Example URL must use a reserved domain: ${host}`)
        }
    }
}
const current = currentOpenApi(publicTiOpenApi)
assert(!JSON.stringify(current).includes('"deprecated":true'))
assert(!JSON.stringify(current).includes('nextCursor'))
assert(!JSON.stringify(current).includes('#/components/parameters/Cursor'))
assert(JSON.stringify(publicTiOpenApi).includes('nextCursor'), 'Keep the runtime compatibility contract unchanged')
const checkReferences = (value: unknown) => {
    if (!value || typeof value !== 'object') return
    const node = value as Record<string, unknown>
    if (typeof node.$ref === 'string' && node.$ref.startsWith('#/')) {
        const target = node.$ref.slice(2).split('/').reduce<unknown>((result, key) => (result as Record<string, unknown>)?.[key], current)
        assert(target, `Dangling reference: ${node.$ref}`)
    }
    Object.values(node).forEach(checkReferences)
}
checkReferences(current)
const fixture = { paths: { '/test': { get: { deprecated: true }, post: { responses: {} } } }, components: { schemas: { Item: { properties: { old: { deprecated: true }, active: { type: 'string' } }, required: ['old', 'active'] } } } }
assert.deepEqual(currentOpenApi(fixture), { paths: { '/test': { post: { responses: {} } } }, components: { schemas: { Item: { properties: { active: { type: 'string' } }, required: ['active'] } } } })
const originalFetch = globalThis.fetch
globalThis.fetch = (async () => Response.json(publicTiOpenApi)) as typeof fetch
try {
    const { default: Page } = await import('../src/app/dashboard/api-docs/content')
    const html = await new Response(await renderToReadableStream(await Page())).text()
    for (const key of keys) assert(html.includes(`data-api-response-example="${key}"`), `Example not rendered: ${key}`)
    assert(html.includes('Fictional example'))
    const actors = html.match(/<details[^>]*>[\s\S]*?<code[^>]*>\/actors<\/code>[\s\S]*?<\/details>/)?.[0] || ''
    assert(actors.includes('No request body.'))
    assert(!actors.includes('>Request</p>'), 'Bodyless endpoints must not render an empty request panel')
    assert(actors.includes('</div></div><div class="min-w-0 rounded-md border border-ui-border bg-ui-panel p-3" data-api-response-example="GET /actors"'), 'Responses and sample must be sibling columns')
    assert(html.replace(/<!--.*?-->/g, '').includes('Required JSON body'), 'Keep real request body documentation')
    assert(html.includes('href="/api/openapi"'))
    assert(html.includes('Missing or invalid credentials'), 'Resolve OpenAPI response references to descriptions')
    assert(!html.includes('#/components/responses/Unauthorized'))
    assert(!html.includes('href="/api/openapi" target="_blank"'), 'Browsing the spec must stay in the same tab')
    mock.module('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'docs-test' }) }) }))
    const { default: Preview } = await import('../src/app/api/openapi/page')
    const preview = await new Response(await renderToReadableStream(await Preview())).text()
    assert(preview.includes('aria-label="OpenAPI specification"'))
    assert(!preview.includes('nextCursor'))
    const { GET } = await import('../src/app/api/openapi/ti/route')
    assert.deepEqual(await (await GET()).json(), current, 'Raw JSON and preview use the same current contract')
    const rawLink = preview.match(/<a[^>]*href="\/api\/openapi\/ti"[^>]*>/)?.[0] || ''
    assert(rawLink.includes('target="_blank"'))
    assert(rawLink.includes('rel="noopener noreferrer"'))
    assert(preview.includes('Open raw JSON in a new tab'))
    globalThis.fetch = (async () => new Response('', { status: 503 })) as typeof fetch
    const unavailable = await new Response(await renderToReadableStream(await Preview())).text()
    assert(unavailable.includes('role="alert"'))
    assert(unavailable.includes('temporarily unavailable'))
    assert(hasAppSidebar('/api/openapi'))
} finally {
    globalThis.fetch = originalFetch
}
const customerLinks = navigationLinks(getDashboardNavigation({ id: 'user_example', isAdmin: false, canManageSystem: false, canManageContent: false }))
assert(customerLinks.some(link => link.label === 'OpenAPI JSON' && link.href === '/api/openapi'))
console.log('All 54 endpoints render fictional examples; public examples validate against OpenAPI and customer navigation links the specification.')
