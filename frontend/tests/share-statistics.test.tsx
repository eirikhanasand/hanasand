// @ts-expect-error Bun provides this module when running tests.
import { expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { countLines } from '../src/utils/share/countLines'

let shares: Share[] | string = []
mock.module('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'test-session' }) }) }))
mock.module('next/navigation', () => ({ useRouter: () => ({ refresh() {} }), redirect: () => { throw new Error('Unexpected redirect') } }))
mock.module('../src/utils/share/getUserShares', () => ({ getUserShares: async () => shares }))
const { default: Shares } = await import('../src/components/share/dashboard/projects')

test('counts physical lines including blank lines and all common line endings', () => {
    for (const [content, expected] of [['', 0], ['one two three', 1], ['one\n', 1], ['one\ntwo', 2], ['one\r\ntwo\r\n', 2], ['one\rtwo\r', 2], ['\n', 1], ['one\n\ntwo\n', 3], ['  ', 1]] as const) {
        expect(countLines(content)).toBe(expected)
    }
})

test('empty shares hide statistics and retain the create action', async () => {
    shares = []
    const html = renderToStaticMarkup(await Shares())
    expect(html).not.toContain('Share statistics')
    expect(html).toContain('Create your first share')
    expect(html).toContain('href="/s"')
})

test('populated shares show line totals and line counts in rows', async () => {
    const share: Share = { id: 'code', alias: 'Code', path: 'code.ts', content: 'one two\n\nthree\n', wordCount: 99, estimatedMinutes: 1, timestamp: '2026-09-19T10:00:00Z', git: null, locked: false, owner: 'test', parent: '' }
    shares = [share, { ...share, id: 'note', content: 'single line', locked: true }]
    const html = renderToStaticMarkup(await Shares())
    expect(html).toContain('Share statistics')
    expect(html).toContain('total lines shared')
    expect(html).toMatch(/4<\/div><p[^>]*>total lines shared/)
    expect(html).toContain('3 lines')
    expect(html).toContain('1 line')
    expect(html).not.toContain('words')
})

test('load errors do not show misleading zero statistics', async () => {
    shares = 'Unable to load shares.'
    const html = renderToStaticMarkup(await Shares())
    expect(html).not.toContain('Share statistics')
    expect(html).toContain('Unable to load shares.')
})
