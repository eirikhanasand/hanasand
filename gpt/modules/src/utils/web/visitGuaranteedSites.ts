import { Page } from 'puppeteer'

// If the expected results were not found using google, go directly to them and screenshot them
export default async function visitGuaranteedSites(page: Page, visited: Visited[], probableSitesVisited: boolean, guaranteedSites: string[]) {
    if (!probableSitesVisited) {
        for (const site of guaranteedSites) {
            console.log(`Desired results not found through Google — navigating directly to ${site}`)
            try {
                await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 60000 })
            } catch (e) {
                // @ts-expect-error
                console.warn(`Direct navigation warning: ${e.message || e}`)
            }
            const start = site.indexOf('https://') + 8
            const end = site.indexOf('.')
            const nameOfSite = site.slice(start, end)
            const directImagePath = `tmp/${nameOfSite}-direct.png` as `${string}.png`
            await page.screenshot({ path: directImagePath, fullPage: true }).catch(e => console.warn('screenshot fail:', e))
            visited.push({ url: page.url(), screenshot: directImagePath })
        }
    }
}
