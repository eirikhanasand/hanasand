// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { useSmoothedCount } from '../src/app/dashboard/rules/use-smoothed-count'

function Count({ target, previousSample }: { target: number | null, previousSample?: number }) {
    return createElement('span', null, useSmoothedCount(target, 10_000, previousSample))
}

test('rule counts initially render the previous server sample', () => {
    expect(renderToStaticMarkup(createElement(Count, { target: 42, previousSample: 31 }))).toBe('<span>31</span>')
})

test('rule counts fall back to the actual target when no earlier server sample exists', () => {
    expect(renderToStaticMarkup(createElement(Count, { target: 42 }))).toBe('<span>42</span>')
    expect(renderToStaticMarkup(createElement(Count, { target: null }))).toBe('<span></span>')
})
