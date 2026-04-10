import puppeteer from 'puppeteer'
import handleConsent from './handleConsent.ts'
import sleep from './sleep.ts'

export default async function openBrowserAndHandleConsent(query: string) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    })

    const page = await browser.newPage()

    const macUserAgent = 'Mozilla/5.0 (Macintosh Intel Mac OS X 13_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.117 Safari/537.36'
    await page.setUserAgent(macUserAgent)
    await page.setViewport({ width: 1366, height: 768 })

    const searchQuery = encodeURIComponent(query)
    const googleUrl = `https://www.google.com/search?q=${searchQuery}`
    console.log('Navigating to', googleUrl)
    await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(err => {
        console.warn('Initial goto warning/timeout:', err.message || err)
    })

    const consentHandled = await handleConsent(page)
    if (consentHandled) {
        try {
            await page.waitForSelector('div.g, #search', { timeout: 10000 })
        } catch (e) {
            // no-op
        }
    }

    await sleep(2000)

    return { browser, page }
}
