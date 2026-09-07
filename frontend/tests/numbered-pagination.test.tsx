import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import PageNavigation from '../src/components/dashboard/page-navigation'
import { pageNumber } from '../src/utils/pagination'

test('page links support previous and next without cursor parameters', () => {
    const html = renderToStaticMarkup(<PageNavigation page={2} total={125} hasNext href={page => `/ti/sources?scope=global&q=feed&page=${page}`} label='Source pages' />)
    assert.ok(html.includes('page=1'))
    assert.ok(html.includes('page=3'))
    assert.ok(html.includes('Page 2 of 3'))
    assert.ok(!html.includes('cursor'))
    const last = renderToStaticMarkup(<PageNavigation page={3} total={125} hasNext={false} href={page => `?page=${page}`} label='Source pages' />)
    assert.ok(!last.includes('>Next<'))
    assert.ok(last.includes('>Previous<'))
})
test('invalid page URLs return to the first page', () => {
    for (const value of [undefined, '', '0', '-1', '1.5', 'bad', 'Infinity', '9007199254740991']) assert.equal(pageNumber(value), 1)
    assert.equal(pageNumber(['2']), 2)
})
