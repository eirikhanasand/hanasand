import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { renderToReadableStream } from 'react-dom/server'

let authenticated = true
let renderedParams: Record<string, string> = {}
mock.module('next/headers', () => ({ cookies: async () => ({
    get: (name: string) => authenticated ? { value: name === 'id' ? 'support-user' : 'test-token' } : undefined,
}) }))
mock.module('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`redirect:${url}`) }, useSearchParams: () => new URLSearchParams(renderedParams) }))

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
const render = async (params: Record<string, string> = {}) => {
    renderedParams = params
    return new Response(await renderToReadableStream(await Page({ searchParams: Promise.resolve(params) }))).text()
}

const html = await render()
for (const text of ['Search audit events', 'impersonation.start', 'support.organization.invite', 'Example customer', 'Example organization', 'session-1']) {
    assert(html.includes(text), `Missing audit content: ${text}`)
}
assert(html.includes('aria-controls="audit-detail-101"'), 'Each row must control its own inline details')
for (const removed of ['Support actions', 'Task controls', 'Customer lookup', 'Support inspection', 'Inspect access', 'Audit snapshot', '<aside', 'Start session']) assert(!html.includes(removed), `Removed UI must stay absent: ${removed}`)
assert(!html.includes('undefined'), 'Current audit fields must not render as undefined')
assert(html.includes('Notifications: 1 event to review'))
assert(html.includes('aria-label="Audit notifications"'))
assert(!/<details[^>]* open/.test(html), 'Notifications and filters must stay collapsed initially')
const focusFilters: Record<string, string>[] = [{ action: events[1].event_type }, { entity: 'invite-2' }, { target: 'org-2' }]
for (const params of focusFilters) {
    const focusedHtml = await render(params)
    assert(/data-audit-event-id="102" data-helpdesk-focused-event="true"/.test(focusedHtml), 'Selection must use the API event, object and subject fields')
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
assert(legacyHtml.includes('commercial-acceptance-mruaroxh'), 'Display labels must preserve recorded identifiers')
assert.equal(legacyEvents[0].target_name, 'Commercial Acceptance', 'Presentation must not rewrite recorded audit data')

const deletionEvents = [
    { ...events[1], id: 201, event_type: 'organization.deleted', target_name: undefined,
        object_id: 'deleted-org-1', organization_id: 'deleted-org-1', organization_name: 'First organization',
        request_id: undefined, subject_id: undefined, context: { name: 'First organization', cleanup: 'remove-acceptance-tenants', previousStatus: 'active' } },
    { ...events[1], id: 202, event_type: 'organization.deleted', target_name: undefined,
        object_id: 'deleted-org-2', organization_id: 'deleted-org-2', organization_name: undefined,
        request_id: undefined, subject_id: undefined, context: { name: 'Deleted organization', cleanup: 'remove-acceptance-tenants', previousStatus: 'active' } },
]
response = () => Response.json({ events: deletionEvents })
const deletionHtml = await render({ event: '202', q: 'organization', severity: 'warning', support: 'invite', limit: '50' })
assert.equal(new URL(requestUrl).searchParams.has('event'), false, 'Selection must not become an API filter')
assert.equal(new URL(requestUrl).searchParams.get('q'), 'organization')
assert(!deletionHtml.includes('href="/helpdesk?event='), 'Selecting an event must not navigate to the server')
assert.equal((deletionHtml.match(/<article /g) || []).length, 2, 'Selecting one event must keep the timeline intact')
assert(/data-audit-event-id="202" data-helpdesk-focused-event="true"/.test(deletionHtml), 'Events without request or entity IDs must be individually selectable')
assert(deletionHtml.match(/id="audit-detail-202"[\s\S]*?<dd[^>]*>Deleted organization<\/dd>/), 'Selected detail must use the recorded organization name')
assert(!deletionHtml.includes('deleted-org-1') && !deletionHtml.includes('deleted-org-2'), 'Organization names should replace target UUIDs')
assert(!deletionHtml.includes('cleanup:') && !deletionHtml.includes('previousStatus:') && !deletionHtml.includes('name:'), 'Raw context summaries must not be rendered')
assert(!deletionHtml.includes('Selected detail') && !deletionHtml.includes('checking'))
assert(deletionHtml.includes('aria-expanded="true"'), 'The expanded row must be exposed to assistive technology')
const firstSelectionHtml = await render({ event: '201' })
assert(/data-audit-event-id="201" data-helpdesk-focused-event="true"/.test(firstSelectionHtml))
const staleSelectionHtml = await render({ event: '999' })
assert(/data-audit-event-id="201" data-helpdesk-focused-event="true"/.test(staleSelectionHtml), 'Unavailable selections must fall back to a visible event')


response = () => Response.json({ events: [{ ...events[0], severity: 'critical' }, { ...events[1], severity: 'critical' }] })
const criticalHtml = await render()
assert(criticalHtml.includes('Notifications: 2 events to review'), 'An event that is critical and denied must only be counted once')
const notifications = criticalHtml.split('aria-label="Audit notifications"')[1].split('</details>')[0]
assert(notifications.includes('impersonation.start') && notifications.includes('support.organization.invite'), 'The notification panel must expose every counted event')
assert(notifications.includes('>Notifications</h2>'))
assert(!notifications.includes('In these results') && !notifications.includes('>Critical</div>'), 'The panel should only list notifications')

response = () => Response.json({ events: [{ ...events[0], object_type: 'user', object_id: null, target_name: null, context: { targetId: 'deleted-admin', targetSource: 'Retained request log' } }] })
const recoveredHtml = await render()
assert(recoveredHtml.includes('deleted-admin') && recoveredHtml.includes('Retained request log'), 'Recovered user identity and its source must survive the server/client boundary')
assert(recoveredHtml.includes('Acknowledge'))
response = () => Response.json({ events: [{ ...events[0], severity: 'critical', acknowledged_at: '2026-09-20T01:00:00Z', acknowledged_by: 'operator', context: { targetName: 'Former administrator', targetId: 'deleted-admin' }, target_name: null, object_id: null }] })
const acknowledgedHtml = await render()
assert(acknowledgedHtml.includes('Former administrator'), 'Deleted account names must use the recorded snapshot')
assert(acknowledgedHtml.includes('Notifications: 0 events to review') && acknowledgedHtml.includes('Mark unread'))
assert(acknowledgedHtml.includes('impersonation.start'), 'Acknowledgment must retain the original audit entry')

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
