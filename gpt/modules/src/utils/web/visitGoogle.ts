import { Page } from 'puppeteer'

// Screenshots the Google results page and records the url
export default async function visitGoogle(page: Page) {
    const visited = [] as Visited[]
    const googleScreenshot = 'tmp/google.png'
    await page.screenshot({ path: googleScreenshot, fullPage: true }).catch(e => console.warn('screenshot fail:', e))
    visited.push({ url: page.url(), screenshot: googleScreenshot })
    return visited
}
