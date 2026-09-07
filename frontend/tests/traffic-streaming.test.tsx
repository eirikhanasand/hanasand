import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { createElement } from 'react'
import { renderToReadableStream } from 'react-dom/server'

let finish: (value: unknown) => void = () => {}
const pending = new Promise(resolve => { finish = resolve })
mock.module('@/utils/monitoring/data', () => ({
    getTrafficDomains: async () => ({ domains: [] }),
    getTrafficMetrics: () => pending,
    getTrafficRecords: async () => ({ result: [], total: 0 }),
}))
for (const name of ['getBlocklist', 'getDomains', 'getIPs', 'getLogs', 'getMetrics', 'getUAs']) {
    mock.module('@/utils/traffic/' + name, () => ({ default: async () => [] }))
}
mock.module('@/components/monitoring/traffic/domainSelector', () => ({ default: () => createElement('span', null, 'Domain selector') }))
mock.module('@/components/monitoring/traffic/trafficMap', () => ({ default: () => createElement('span', null, 'Traffic map') }))
mock.module('@/components/monitoring/traffic/traffic', () => ({ default: () => null }))
mock.module('../src/app/dashboard/traffic/pageClient', () => ({ default: () => createElement('span', null, 'Operations loaded') }))
const { default: Page } = await import('../src/app/dashboard/traffic/page')
const stream = await renderToReadableStream(await Page({ searchParams: Promise.resolve({}) }))
const reader = stream.getReader()
const first = await Promise.race([
    reader.read(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Traffic query blocked initial rendering')), 1000)),
])
assert(!first.done)
const shell = new TextDecoder().decode(first.value)
assert(shell.includes('Loading traffic statistics'))
assert(shell.includes('Request operations'))
finish({ top_domains: [], top_methods: [], top_status_codes: [] })
let html = shell
for (;;) { const chunk = await reader.read(); if (chunk.done) break; html += new TextDecoder().decode(chunk.value) }
assert(html.includes('Traffic map'))
assert(html.includes('Operations loaded'))
console.log('PASS: delayed traffic data does not block the page shell or independent operations; completed statistics stream in.')
