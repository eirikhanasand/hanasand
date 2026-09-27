import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

const now = Date.now()
const makeArticle = (id: string, ageDays: number) => ({
    id,
    size: 100,
    created: new Date(now - ageDays * 24 * 60 * 60 * 1000).toISOString(),
    modified: new Date(now - ageDays * 24 * 60 * 60 * 1000).toISOString(),
    title: id,
    content: 'Article body',
    metadata: { image: '', description: 'Description', wordCount: 20, estimatedMinutes: 1 },
})

const articles = [makeArticle('older article', 30)]
mock.module('../src/utils/articles/staticArticles.json', () => ({ default: articles }))
mock.module('../src/components/articles/articleNotificationFromSearchParams', () => ({ default: () => null }))

const { default: Articles } = await import('../src/components/articles/articles')

let html = renderToStaticMarkup(await Articles({ recent: true, backfill: false }))
assert(html.includes('Articles about my projects, technology, and work.'))
assert(!html.includes('Recently published'))
assert(!html.includes('No recent articles right now.'))
assert(html.includes('All articles'))
assert(html.includes('older article'))

articles.splice(0, articles.length, makeArticle('recent article', 1), makeArticle('older article', 30))
html = renderToStaticMarkup(await Articles({ recent: true, backfill: false }))
assert(html.includes('Recently published'))
assert(html.includes('recent article'))
assert(html.includes('All articles'))

articles.splice(0, articles.length)
html = renderToStaticMarkup(await Articles({ recent: true, backfill: false }))
assert(!html.includes('Recently published'))
assert(!html.includes('No recent articles right now.'))
assert(!html.includes('No articles published.'))

console.log('Public articles omit the recent section when its list is empty.')

