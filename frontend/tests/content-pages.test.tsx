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

const year = new Date().getFullYear()
for (const articleYear of [year - 1, year, year + 1]) {
    articles = [{ id: 'article', title: 'Example article', content: 'Example', created: `${articleYear}-10-12T12:38:00`, metadata: { wordCount: 810, estimatedMinutes: 4 } }]
    const html = renderToStaticMarkup(await Articles())
    assert.equal(html.includes(String(articleYear)), articleYear !== year, 'Only dates outside the current year should display their year')
    assert(html.includes('810 words'))
    assert(!html.includes('indexed'))
    assert(!html.includes('new drafts and deletes'))
    assert(html.includes('>articles</p>'))
}
articles = []
assert(renderToStaticMarkup(await Articles()).includes('Publish your first article'))
for (const entries of [[], [{ id: 'thought', title: 'Why?', created_at: '2025-10-12T12:38:00', created_by: 'author' }]]) {
    thoughts = entries
    const html = renderToStaticMarkup(await Thoughts())
    assert(!html.includes('href="/notes"'))
    assert(!/notebook|real note|research note/i.test(html))
    assert(html.includes('philosophical question'))
    if (!entries.length) assert(html.includes('href="/content/thoughts/create"'))
}
console.log('Content pages: conditional years, concise article labels and distinct thoughts copy pass.')
