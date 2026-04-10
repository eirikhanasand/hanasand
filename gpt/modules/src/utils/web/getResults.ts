import { Page } from 'puppeteer'

// Gets results (title/link/snippet) — skips scripts/styles since these are DOM queries
export default async function getResults(page: Page, limit: number) {
    const results = await page.evaluate((limit) => {
        const items = Array.from(document.querySelectorAll('div[jscontroller][data-hveid], div.g, .g')) as HTMLElement[]
        const out = []
        for (const item of items) {
            const a = item.querySelector('a')
            const h3 = item.querySelector('h3') || item.querySelector('h2')
            // @ts-expect-error
            const snippet = item.querySelector('.IsZvec, .VwiC3b, .aCOpRe')?.innerText || item.innerText || ''
            if (a && h3 && a.href) {
                out.push({ title: h3.innerText.trim(), link: a.href, snippet: snippet.trim() })
            }
            if (out.length >= limit) break
        }
        return out
    }, limit)

    console.log('Scraped results count:', results.length)

    return results
}
