import { Page } from 'puppeteer'

// Visits sites desired by the user
export default async function visitObligatorySites(page: Page, visited: Visited[], mustVisit: string[]) {
    for (const site of mustVisit) {
        console.log(`Must visit - navigating to ${site}`)
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
