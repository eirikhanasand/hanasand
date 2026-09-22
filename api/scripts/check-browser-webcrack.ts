import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { watchWebCrackOutput, readWebCrackOutput, submitWebCrackSample } from '../src/handlers/onionSession/webcrack'

const browser = await chromium.launch({ headless: true })
try {
    const page = await browser.newPage()
    await watchWebCrackOutput(page)
    await page.goto('https://webcrack.netlify.app/', { waitUntil: 'domcontentloaded' })
    await page.locator('.monaco-editor').first().waitFor()
    await submitWebCrackSample(page, 'console["log"]("hel" + "lo");')
    const output = await readWebCrackOutput(page)
    assert(!output.error, output.error)
    assert.match(output.code || '', /console\.log\(["']hello["']\)/)
    console.log('WebCrack live integration passed: extracted completed deobfuscated code.')
} finally { await browser.close() }
