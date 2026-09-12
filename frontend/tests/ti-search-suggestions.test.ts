import { test, expect } from 'bun:test'
import { searchSuggestions } from '../src/components/ti/searchSuggestions'

test('empty search suggests only the three most recent searches', () => {
    expect(searchSuggestions('', ['APT29', 'LockBit', 'example.com', 'older'], ['Saved'])).toEqual(['APT29', 'LockBit', 'example.com'])
    expect(searchSuggestions('', [], [])).toEqual([])
})

test('partial terms match history, saved searches and starter examples without duplicates', () => {
    expect(searchSuggestions('29', [], [])).toEqual(['APT29'])
    expect(searchSuggestions('APT 29', ['apt29'], ['APT29'])).toEqual(['apt29'])
    expect(searchSuggestions('example', ['EXAMPLE.org'], ['example.com'])).toEqual(['EXAMPLE.org', 'example.com'])
    expect(searchSuggestions('no-match', [], [])).toEqual([])
    expect(searchSuggestions('a', Array.from({ length: 10 }, (_, i) => `actor${i}`), []).length).toBe(6)
})

test('history is bounded, deduplicated and isolated by account; unavailable storage does not block search', async () => {
    const { readSearchHistory, rememberSearch } = await import('../src/components/ti/searchSuggestions')
    const original = Object.getOwnPropertyDescriptors(globalThis)
    const data = new Map<string, string>()
    Object.defineProperties(globalThis, {
        document: { configurable: true, value: { cookie: 'id=alice' } },
        window: { configurable: true, value: { dispatchEvent: () => true } },
        localStorage: { configurable: true, value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) } },
    })
    try {
        rememberSearch('APT29'); rememberSearch('LockBit'); rememberSearch('apt29')
        expect(readSearchHistory()).toEqual(['apt29', 'LockBit'])
        document.cookie = 'id=bob'
        expect(readSearchHistory()).toEqual([])
        data.set('hanasand:ti:search-history:bob', '{bad json')
        expect(readSearchHistory()).toEqual([])
        for (let i = 0; i < 40; i++) rememberSearch(`term${i}`)
        expect(readSearchHistory()).toHaveLength(30)
        expect(readSearchHistory()[0]).toBe('term39')
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage disabled') } })
        expect(() => rememberSearch('APT29')).not.toThrow()
        expect(readSearchHistory()).toEqual([])
    } finally {
        for (const key of ['document', 'window', 'localStorage']) {
            if (original[key]) Object.defineProperty(globalThis, key, original[key])
            else Reflect.deleteProperty(globalThis, key)
        }
    }
})
