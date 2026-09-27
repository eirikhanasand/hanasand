import assert from 'node:assert/strict'
// @ts-expect-error Bun supplies this module for focused checks.
import { mock } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

let articles: unknown[] = []
let thoughts: unknown[] = []
mock.module('../src/utils/organizations/fetchWorkspaceContent', () => ({ default: async (kind: string) => kind === 'articles' ? articles : thoughts }))
mock.module('../src/components/articles/dashboardArticle', () => ({ default: () => null }))
mock.module('../src/components/thoughts/dashboardThought', () => ({ default: () => null }))
const { default: Articles } = await import('../src/app/dashboard/articles/page')
const { default: Thoughts } = await import('../src/app/dashboard/thoughts/page')

for (const articleYear of [2025, new Date().getFullYear(), 2027]) {
    articles = [{ id: 'article', title: 'Example article', content: 'Example', created: `${articleYear}-10-12T12:38:00`, metadata: { wordCount: 810, estimatedMinutes: 4, author: 'Ada', category: 'Research', pageVisits: 42 } }]
    const html = renderToStaticMarkup(await Articles())
    assert(html.includes('aria-label="Show article analytics"'))
    assert(html.includes('aria-expanded="false"'))
    assert(!html.includes('id="article-analytics"'))
    assert(!html.includes('810 words'))
    assert(!html.includes('indexed'))
    assert(!html.includes('new drafts and deletes'))
    assert(html.includes('>1 Article</span>'))
    assert(html.includes('<table'))
    for (const label of ['Title', 'Author', 'Publish date', 'Page visits', 'Category']) assert(html.includes(label))
    for (const label of ['Filter by title', 'Filter by author', 'Filter by publish date', 'Filter by minimum page visits', 'Filter by category']) assert(html.includes(label))
    assert(html.includes('Ada'))
    assert(html.includes('Research'))
    assert(html.includes('42'))
    assert(!html.includes('Editorial queue'))
}
articles = []
assert(renderToStaticMarkup(await Articles()).includes('Publish your first article'))
for (const entries of [[], [{ id: 'thought', title: 'Why?', created_at: '2025-10-12T12:38:00', created_by: 'author' }]]) {
    thoughts = entries
    const html = renderToStaticMarkup(await Thoughts())
    assert(!html.includes('href="/notes"'))
    assert(!/notebook|real note|research note/i.test(html))
    if (!entries.length) {
        assert(!html.includes('Share a short philosophical question to give visitors something to think about.'))
        assert(!html.includes('Create your first thought</a>'))
        assert(html.includes('href="/content/thoughts/create"'))
        assert(html.includes('text-ui-on-primary'))
    }
}
console.log('Content pages: conditional years, concise article labels and distinct thoughts copy pass.')
