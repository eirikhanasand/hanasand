import assert from 'node:assert/strict'

const { default: fallbackArticles, findFallbackArticle } = await import('../src/utils/articles/fallbackArticles.ts')

assert.equal(fallbackArticles.length, 6, 'expected the six local personal archive articles')
assert.deepEqual(
    fallbackArticles.map((article) => article.id),
    ['bot', 'cache', 'event', 'lsm', 'readme', 'theme'],
    'fallback article ids should match the public archive slugs'
)
assert.equal(findFallbackArticle('readme')?.id, 'readme', 'plain slugs should resolve')
assert.equal(findFallbackArticle('readme.md')?.id, 'readme', '.md slugs should resolve')
assert.equal(findFallbackArticle('missing-article'), null, 'unknown slugs should not fake success')

const originalFetch = globalThis.fetch
const { default: fetchArticle } = await import('../src/utils/articles/fetchArticle.ts')
const { default: fetchArticles } = await import('../src/utils/articles/fetchArticles.ts')

try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'missing' }), { status: 404 })
    assert.equal((await fetchArticle('lsm.md'))?.id, 'lsm', 'known API 404 articles should use fallback content')
    assert.equal(await fetchArticle('missing.md'), null, 'unknown API 404 articles should stay missing')

    globalThis.fetch = async () => {
        throw new Error('network down')
    }
    assert.equal((await fetchArticle('theme.md'))?.id, 'theme', 'network errors should use fallback content')
    assert.equal((await fetchArticles(false)).length, 6, 'article list network errors should use fallback articles')

    const recent = await fetchArticles(true)
    assert.equal(recent.recent.length, 4, 'recent fallback should keep four primary articles')
    assert.equal(recent.articles.length, 2, 'recent fallback should keep older articles separately')
} finally {
    globalThis.fetch = originalFetch
}

console.log('Article fallback checks passed.')
