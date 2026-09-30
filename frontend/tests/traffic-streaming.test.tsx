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
mock.module('@/components/monitoring/traffic/trafficOverview', () => ({ default: () => createElement('span', null, 'Graphs loaded') }))
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
finish({ top_domains: [], top_methods: [], top_status_codes: [] })
let html = shell
for (;;) { const chunk = await reader.read(); if (chunk.done) break; html += new TextDecoder().decode(chunk.value) }
assert(html.includes('Graphs loaded'))
assert(!html.includes('Traffic map'))
console.log('PASS: the overview streams its graphs after traffic metrics load.')
