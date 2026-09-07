import assert from 'node:assert/strict'
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
const originalFetch = globalThis.fetch
globalThis.fetch = (async () => Response.json(publicTiOpenApi)) as typeof fetch
try {
    const { default: Page } = await import('../src/app/dashboard/api-docs/content')
    const html = await new Response(await renderToReadableStream(await Page())).text()
    for (const key of keys) assert(html.includes(`data-api-response-example="${key}"`), `Example not rendered: ${key}`)
    assert(html.includes('Fictional example'))
    assert(html.includes('href="/api/openapi/ti"'))
    assert(html.includes('Missing or invalid credentials'), 'Resolve OpenAPI response references to descriptions')
    assert(!html.includes('#/components/responses/Unauthorized'))
} finally {
    globalThis.fetch = originalFetch
}
const customerLinks = navigationLinks(getDashboardNavigation({ id: 'user_example', isAdmin: false, canManageSystem: false, canManageContent: false }))
assert(customerLinks.some(link => link.label === 'OpenAPI JSON' && link.href === '/api/openapi/ti'))
console.log('All 54 endpoints render fictional examples; public examples validate against OpenAPI and customer navigation links the specification.')
