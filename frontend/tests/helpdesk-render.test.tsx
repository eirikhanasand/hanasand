import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { renderToReadableStream } from 'react-dom/server'

let authenticated = true
mock.module('next/headers', () => ({ cookies: async () => ({
    get: (name: string) => authenticated ? { value: name === 'id' ? 'support-user' : 'test-token' } : undefined,
}) }))
mock.module('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) } }))
mock.module('../src/app/dashboard/helpdesk/accessRecoveryForm', () => ({ default: () => null }))

// The audit endpoint returns system-event fields, not the retired admin-audit columns.
const events = [
    {
        id: 101, event_type: 'impersonation.start', severity: 'notice', outcome: 'success',
        source: 'admin', service: 'hanasand-api', actor_id: 'support-user', actor_name: 'Support agent',
        object_type: 'user', object_id: 'customer-1', target_name: 'Example customer',
        organization_id: 'org-1', organization_name: 'Example organization', subject_id: 'session-1',
        request_id: 'request-1', reason: 'Investigate customer support case', context: { scope: 'read' },
        ip: '192.0.2.1', user_agent: 'Test', created_at: '2026-09-19T10:00:00Z',
    },
    {
        id: 102, event_type: 'support.organization.invite', severity: 'warning', outcome: 'denied',
        source: 'admin', service: 'hanasand-api', actor_id: 'support-user',
        object_type: 'organization', object_id: 'org-2', subject_id: 'invite-2', request_id: 'request-2',
        reason: 'Invite requires approval', created_at: '2026-09-19T11:00:00Z',
    },
]
let response = () => Response.json({ events })
let requestUrl = ''
let fetchCount = 0
globalThis.fetch = (async (input: string | URL | Request, options?: RequestInit) => {
    fetchCount++
    requestUrl = String(input)
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-token')
    assert.equal(new Headers(options?.headers).get('id'), 'support-user')
    assert.equal(options?.cache, 'no-store', 'Audit responses must bypass the size-limited data cache')
    return response()
}) as typeof fetch

const { default: Page } = await import('../src/app/dashboard/helpdesk/page')
const render = async (params: Record<string, string> = {}) => new Response(await renderToReadableStream(
    await Page({ searchParams: Promise.resolve(params) }),
)).text()

const html = await render()
for (const text of ['Search audit events', 'impersonation.start', 'support.organization.invite', 'Example customer', 'Example organization', 'session-1']) {
    assert(html.includes(text), `Missing audit content: ${text}`)
}
assert(html.includes('request=request-1&amp;entity=session-1'), 'Focus must preserve request and subject identifiers')
assert(!html.includes('undefined'), 'Current audit fields must not render as undefined')
assert(html.includes('1 denied event need review'))
assert(/>Sessions<\/div><div[^>]*>1<\/div>/.test(html), 'Session count must use event_type')
assert(/>Recovery<\/div><div[^>]*>1<\/div>/.test(html), 'Recovery count must use event_type')
const focusFilters: Record<string, string>[] = [{ action: events[1].event_type }, { entity: 'invite-2' }, { target: 'org-2' }]
for (const params of focusFilters) {
    const focusedHtml = await render(params)
    assert(focusedHtml.match(/>Selected event<\/p><h2[^>]*>support.organization.invite<\/h2>/), 'Selection must use the API event, object and subject fields')
    const query = new URL(requestUrl).searchParams
    for (const [key, value] of Object.entries(params)) assert.equal(query.get(key), value)
}

const legacyEvents = [
    { ...events[0], actor_name: 'Hanasand Commercial Acceptance', target_name: 'Commercial Acceptance',
        organization_name: 'Commercial Acceptance mruaroxh', subject_id: 'commercial-acceptance-mruaroxh',
        reason: 'Removed Commercial Acceptance', context: { name: 'Commercial Acceptance' } },
    { ...events[1], target_name: 'Commercial Acceptance mrubl4uc540203',
        organization_id: 'org-2', organization_name: 'Commercial Acceptance mrubl4uc540203',
        context: { name: 'Commercial Acceptance mrubl4uc540203' } },
]
response = () => Response.json({ events: legacyEvents })
const legacyHtml = await render({ request: 'request-2' })
assert(!legacyHtml.includes('Commercial Acceptance'), 'Legacy test names must have natural display labels throughout the page')
assert(legacyHtml.includes('Test account') && legacyHtml.includes('Test organization mrubl4uc540203'))
assert(legacyHtml.includes('entity=commercial-acceptance-mruaroxh'), 'Display labels must preserve the original identifiers in Focus links')
assert.equal(legacyEvents[0].target_name, 'Commercial Acceptance', 'Presentation must not rewrite recorded audit data')

response = () => Response.json({ events: [] })
assert((await render()).includes('No matching support events'))
response = () => Response.json({ error: 'Forbidden' }, { status: 403 })
assert((await render()).includes('Audit service reported 403.'))
response = () => { throw new Error('Connection failed') }
assert((await render()).includes('Audit API is unavailable.'))
authenticated = false
const before = fetchCount
await assert.rejects(render(), /redirect:.*login/)
assert.equal(fetchCount, before, 'Unauthenticated visits must not query audit events')
console.log('Helpdesk renders current audit events, counts, focus filters, empty/error states and authentication correctly.')
