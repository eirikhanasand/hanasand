import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { renderToReadableStream } from 'react-dom/server'

let organizationId = ''
let response = { ok: true, json: async () => ({ organizations: [] as Array<{ id: string, name: string, role: string }> }) }
mock.module('next/navigation', () => ({ useSearchParams: () => new URLSearchParams({ organizationId }) }))
mock.module('@/app/api/organizations/_organizationApiProxy', () => ({
    proxyOrganizationApiRequest: async (_request: unknown, path: string, options: { method: string }) => {
        assert.equal(path, '/organizations')
        assert.equal(options.method, 'GET')
        return response
    },
}))
const { default: Page } = await import('../src/app/organizations/page')

const emptyPage = await Page()
assert.deepEqual(emptyPage.props.initialOrganizations, [])
const emptyHtml = await new Response(await renderToReadableStream(emptyPage)).text()
assert(emptyHtml.includes('data-org-create-primary'))
assert(!emptyHtml.includes('lg:grid-cols-[21rem_minmax(0,1fr)]'), 'The empty creation form must be full width before hydration')
assert(!emptyHtml.includes('>Workspaces<'), 'The initial empty state must not show the temporary workspace list')

response = { ok: true, json: async () => ({ organizations: [
    { id: 'first', name: 'First organization', role: 'member' },
    { id: 'second', name: 'Selected organization', role: 'owner' },
] }) }
organizationId = 'second'
const populatedPage = await Page()
const populatedHtml = await new Response(await renderToReadableStream(populatedPage)).text()
assert(populatedHtml.includes('lg:grid-cols-[21rem_minmax(0,1fr)]'))
assert(populatedHtml.includes('data-org-create-compact'))
assert(!populatedHtml.includes('data-org-create-primary'))
assert(populatedHtml.includes('Selected organization'))
assert(populatedHtml.includes('admin controls enabled'), 'The requested organization must be selected on the server')

response = { ...response, ok: false }
const failedPage = await Page()
assert.equal(failedPage.props.initialOrganizations, undefined, 'A failed request must remain retryable in the browser')
const failedHtml = await new Response(await renderToReadableStream(failedPage)).text()
assert(!failedHtml.includes('lg:grid-cols-[21rem_minmax(0,1fr)]'), 'A retry must not squeeze the creation form into a sidebar')
console.log('Organization initial rendering passes for empty, selected, and failed requests.')
