import { Page } from 'puppeteer'

export default async function handlePageResponse(page: Page, ) {
    page.on('request', r => console.log('Request:', r.url()))
    page.on('response', res => console.log('Response:', res.status(), res.url()))
}
