import Ajv2020 from 'ajv/dist/2020.js'
import { publicTiOpenApi } from '../src/contracts/publicTiOpenApi.ts'
import { createPublicTiClient } from '../sdk/publicTiClient.ts'

const baseUrl = process.env.PUBLIC_API_BASE ?? 'https://api.hanasand.com/api/v1'
const apiKey = process.env.PUBLIC_API_KEY
if (!apiKey) throw new Error('PUBLIC_API_KEY is required for authenticated contract validation.')
const rateLimitKey = process.env.PUBLIC_API_RATE_LIMIT_KEY
if (!rateLimitKey) throw new Error('PUBLIC_API_RATE_LIMIT_KEY is required for rate-limit contract validation.')

const anonymous = createPublicTiClient({ baseUrl })
const authenticated = createPublicTiClient({ baseUrl, apiKey })
const checks: Array<{ path: string, method: string, response: Response, body: unknown }> = []

assertStatus(await capture('/ti/search', 'post', anonymous.POST('/ti/search', { body: { query: 'APT29' } })), 200)
assertStatus(await capture('/ti/search', 'post', anonymous.POST('/ti/search', { body: { query: 'x' } })), 400)
assertStatus(await capture('/actors', 'get', anonymous.GET('/actors', { params: { query: { limit: 1 } } })), 401)

const firstPage = await capture('/actors', 'get', authenticated.GET('/actors', { params: { query: { limit: 1 } } }))
assertStatus(firstPage, 200)
const cursor = (firstPage.data as { pagination?: { nextCursor?: string | null } } | undefined)?.pagination?.nextCursor
if (!cursor) throw new Error('Authenticated pagination proof requires a second actor page.')
assertStatus(await capture('/actors', 'get', authenticated.GET('/actors', { params: { query: { limit: 1, cursor } } })), 200)
assertStatus(await capture('/aliases', 'get', authenticated.GET('/aliases', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/incidents', 'get', authenticated.GET('/incidents', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/claims', 'get', authenticated.GET('/claims', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/evidence', 'get', authenticated.GET('/evidence', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/sources', 'get', authenticated.GET('/sources', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/validations', 'get', authenticated.GET('/validations', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/alerts', 'get', authenticated.GET('/alerts', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/evaluation', 'get', authenticated.GET('/evaluation', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/timeliness', 'get', authenticated.GET('/timeliness', { params: { query: { limit: 1 } } })), 200)
assertStatus(await capture('/ti/search/batch', 'post', authenticated.POST('/ti/search/batch', { body: { queries: ['APT29', 'CVE-2024-3094'] } })), 200, 207)

const rateLimited = createPublicTiClient({ baseUrl, apiKey: rateLimitKey })
for (let attempt = 0; attempt < 4; attempt += 1) {
    const call = await capture('/actors', 'get', rateLimited.GET('/actors', { params: { query: { limit: 1 } } }))
    if (call.response.status === 429) break
}
const rateLimitedCall = checks.find(check => check.response.status === 429)
if (!rateLimitedCall) throw new Error('The dedicated rate-limit key did not produce a 429 response.')
if (!rateLimitedCall.response.headers.get('retry-after')) throw new Error('The 429 response did not include Retry-After.')

for (const check of checks) {
    validateResponse(check.path, check.method, check.response.status, check.body)
    const requestId = check.response.headers.get('x-request-id')
    if (!requestId) throw new Error(`${check.method.toUpperCase()} ${check.path} did not include X-Request-Id.`)
    if (!check.response.headers.get('cache-control')?.includes('no-store')) throw new Error(`${check.method.toUpperCase()} ${check.path} was cacheable.`)
    if (check.response.status >= 400 && (check.body as { error?: { requestId?: string } } | undefined)?.error?.requestId !== requestId) {
        throw new Error(`${check.method.toUpperCase()} ${check.path} error request ID did not match its response header.`)
    }
}
console.log(JSON.stringify({ baseUrl, validated: checks.map(check => ({ method: check.method.toUpperCase(), path: check.path, status: check.response.status, requestId: check.response.headers.get('x-request-id') })) }, null, 2))

async function capture(path: string, method: string, request: Promise<{ data?: unknown, error?: unknown, response: Response }>) {
    const result = await request
    checks.push({ path, method, response: result.response, body: result.data ?? result.error })
    return result
}

function assertStatus(result: { response: Response }, ...expected: number[]) {
    if (!expected.includes(result.response.status)) throw new Error(`Expected HTTP ${expected.join(' or ')}, received ${result.response.status}.`)
}

function validateResponse(path: string, method: string, status: number, body: unknown) {
    const operation = (publicTiOpenApi.paths as Record<string, any>)[path]?.[method]
    const rawResponse = operation?.responses?.[String(status)] ?? operation?.responses?.default
    const response = rawResponse?.$ref ? resolveRef(rawResponse.$ref) : rawResponse
    const schema = response?.content?.['application/json']?.schema
    if (!schema) throw new Error(`OpenAPI does not document ${method.toUpperCase()} ${path} status ${status}.`)
    const ajv = new Ajv2020({ strict: false, formats: { 'date-time': true, uri: true } })
    ajv.addSchema(publicTiOpenApi, 'contract')
    const validate = ajv.compile(schema.$ref ? { $ref: `contract${schema.$ref}` } : schema)
    if (!validate(body)) throw new Error(`${method.toUpperCase()} ${path} ${status} violates OpenAPI: ${ajv.errorsText(validate.errors)}`)
}

function resolveRef(pointer: string) {
    return pointer.replace(/^#\//, '').split('/').reduce<any>((value, part) => value?.[part.replace(/~1/g, '/').replace(/~0/g, '~')], publicTiOpenApi)
}
