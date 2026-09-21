import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

test('homepage exposure queue empty state reads like monitoring product copy', async () => {
    const source = await readFile(path.join(root, 'src/app/homeExposureQueueClient.tsx'), 'utf8')

    expect(source).toContain('className=\'w-full min-w-[56rem]\'')
    expect(source).toContain('border-b border-ui-border px-4 py-3 text-sm last:border-b-0')
    expect(source).toContain('Monitoring company mentions across exposure sources.')
    expect(source).toContain('Monitoring exposure sources.')
    expect(source).toContain('Live exposure feed is temporarily unavailable.')
    expect(source).toContain('Exposure feed temporarily unavailable.')
    expect(source).toMatch(/if \(status === 'unavailable'\) return 'Exposure feed temporarily unavailable\.'/)
    expect(source).not.toContain('Checking for new company mentions...')
    expect(source).not.toContain('Checking for new company mentions.')
})

test('site atmosphere layer stays inside the viewport', async () => {
    const source = await readFile(path.join(root, 'src/app/globals.css'), 'utf8')
    const block = source.match(/\.site-atmosphere\s*\{[^}]+\}/)?.[0] || ''
    const afterBlock = source.match(/\.site-atmosphere::after\s*\{[^}]+\}/)?.[0] || ''

    expect(block).toContain('inline-size: 100vw;')
    expect(block).toContain('block-size: 100vh;')
    expect(block).toContain('contain: strict;')
    expect(afterBlock).toContain('inset: 0;')
    expect(afterBlock).not.toContain('inset: -')
    expect(afterBlock).not.toContain('transform:')
})
