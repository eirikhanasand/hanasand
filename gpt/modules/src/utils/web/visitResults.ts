import { Page } from 'puppeteer'

export default async function visitResults(page: Page, results: Result[], visited: Visited[], probableSites: string[]) {
    let resultsVisited = false
    for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (!r || !r.link) continue
        const linkLower = r.link.toLowerCase()
        if (probableSites.some((keyword) => linkLower.includes(keyword))) {
            console.log('Found probable site link in search results:', r.link)
            try {
                await page.goto(r.link, { waitUntil: 'domcontentloaded', timeout: 60000 })
            } catch (e) {
                // @ts-expect-error
                console.warn('Navigation to probable site link warning:', e.message || e)
            }

            const start = r.link.indexOf('https://') + 8
            const end = r.link.indexOf('.')
            const nameOfSite = r.link.slice(start, end)
            const directImagePath = `tmp/${nameOfSite}.png` as `${string}.png`
            await page.screenshot({ path: directImagePath, fullPage: true }).catch(e => console.warn('screenshot fail:', e))
            visited.push({ url: page.url(), screenshot: directImagePath })
            resultsVisited = true
            break
        }
    }

    return resultsVisited
}
