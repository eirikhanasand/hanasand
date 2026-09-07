import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { createElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'
let validation = { valid: true, state: 'valid', roles: [{ id: 'administrator' }] }
let statusCalls = 0
mock.module('@/utils/proxy/tokenIsValid', () => ({ default: async () => validation }))
let release: (value: unknown) => void = () => {}
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test' }) }) }))
mock.module('@/utils/status/getStatus', () => ({ default: async (options: { summary?: boolean }) => {
    statusCalls++
    assert.equal(options.summary, true)
    return new Promise(resolve => { release = resolve })
} }))
mock.module('../src/app/dashboard/overview/dwmOverviewPanel', () => ({ default: () => createElement('p', null, 'Monitoring starts independently') }))
const { default: Page } = await import('../src/app/dashboard/overview/page')
const page = await Page({})
const stream = await renderToReadableStream(page)
const reader = stream.getReader()
let shell = ''
await Promise.race([(async () => {
    while (!shell.includes('Checking service health')) {
        const chunk = await reader.read()
        assert(!chunk.done, 'Expected the dashboard shell')
        shell += new TextDecoder().decode(chunk.value)
    }
})(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Status blocked the dashboard shell')), 1000))])
assert(shell.includes('Monitoring starts independently'))
assert(shell.includes('Checking service health'))
release({ generated_at: '', checks: [], history: [], incidents: [], overall: 'down' })
let rest = ''
for (;;) { const chunk = await reader.read(); if (chunk.done) break; rest += new TextDecoder().decode(chunk.value) }
assert(rest.includes('Service health is temporarily unavailable'))
console.log('Dashboard streams before status resolves and shows an honest unavailable state.')

for (const roles of [[], [{ id: 'users' }], [{ id: 'system_admin' }], [{ id: 'owner' }]]) {
    validation = { valid: true, state: 'valid', roles }
    const callsBefore = statusCalls
    const html = await new Response(await renderToReadableStream(await Page({}))).text()
    assert(html.includes('Monitoring starts independently'))
    assert(!html.includes('Checking service health'))
    assert(!html.includes('Service health'))
    assert.equal(statusCalls, callsBefore, 'Non-admins must not fetch service health')
}
for (const state of ['invalid', 'unavailable']) {
    validation = { valid: false, state, roles: [{ id: 'administrator' }] }
    const callsBefore = statusCalls
    const html = await new Response(await renderToReadableStream(await Page({}))).text()
    assert(!html.includes('Service health'))
    assert.equal(statusCalls, callsBefore, 'Unverified sessions must not fetch service health')
}
for (const role of ['administrator', 'admin']) {
    validation = { valid: true, state: 'valid', roles: [{ id: role }] }
    const adminStream = await renderToReadableStream(await Page({}))
    release({ generated_at: new Date().toISOString(), checks: [], history: [], incidents: [], overall: 'degraded' })
    const html = await new Response(adminStream).text()
    assert(html.includes('Service health'))
    assert(html.includes('need attention'))
}
console.log('Service health is visible only to verified admins; customer dashboards never fetch it.')
