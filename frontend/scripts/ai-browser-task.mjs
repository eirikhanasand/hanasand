import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const input = await readStdin()
const payload = JSON.parse(input)
const artifactDir = process.env.HANASAND_BROWSER_ARTIFACT_DIR || process.cwd()

await mkdir(artifactDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()
const consoleMessages = []
const pageErrors = []

page.on('console', (message) => {
    consoleMessages.push(`[${message.type()}] ${message.text()}`)
})
page.on('pageerror', (error) => {
    pageErrors.push(error.message)
})

try {
    await page.goto(payload.url, {
        waitUntil: 'networkidle',
        timeout: payload.timeoutMs || 120000,
    })

    for (const action of payload.actions || []) {
        if (action.action === 'click') {
            await page.locator(action.selector).first().click()
            continue
        }
        if (action.action === 'fill') {
            await page.locator(action.selector).first().fill(action.value)
            continue
        }
        if (action.action === 'press') {
            await page.locator(action.selector).first().press(action.key)
            continue
        }
        if (action.action === 'wait_for_selector') {
            await page.locator(action.selector).first().waitFor({ timeout: payload.timeoutMs || 120000 })
            continue
        }
        if (action.action === 'wait_for_text') {
            await page.getByText(action.text, { exact: false }).first().waitFor({ timeout: payload.timeoutMs || 120000 })
            continue
        }
        if (action.action === 'wait_for_timeout') {
            await page.waitForTimeout(action.timeoutMs)
        }
    }

    const screenshotPath = payload.captureScreenshot
        ? path.join(artifactDir, `browser-task-${Date.now()}.png`)
        : null

    if (screenshotPath) {
        await page.screenshot({ path: screenshotPath, fullPage: true })
    }

    const bodyText = await page.locator('body').innerText().catch(() => '')
    const result = {
        ok: true,
        url: page.url(),
        title: await page.title(),
        textExcerpt: bodyText.slice(0, 5000),
        screenshotPath,
        consoleMessages: consoleMessages.slice(-50),
        pageErrors: pageErrors.slice(-20),
    }

    process.stdout.write(JSON.stringify(result))
} finally {
    await context.close()
    await browser.close()
}

async function readStdin() {
    const chunks = []
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk))
    }
    return Buffer.concat(chunks).toString('utf8')
}
