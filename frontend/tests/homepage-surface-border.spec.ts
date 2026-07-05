import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()

const sampledSurfaces = [
    ['exposure panel', '[data-home-exposure-panel="true"]'],
    ['exposure panel header', '[data-home-exposure-panel-header="true"]'],
    ['exposure panel toolbar', '[data-home-exposure-panel-toolbar="true"]'],
    ['exposure table header', '[data-home-exposure-panel-table-header="true"]'],
    ['product status panel', '[data-home-product-status="true"]'],
    ['operator paths panel', '[data-home-operator-paths="true"]'],
    ['operator paths header', '[data-home-operator-paths-header="true"]'],
    ['workflow coverage table header', '[data-home-workflow-coverage-table-header="true"]'],
    ['alert path panel', '[data-home-workflow-panel="true"]'],
    ['alert path header', '[data-home-workflow-panel-header="true"]'],
    ['alert path step', '[data-home-workflow-step="true"]'],
    ['example card', '[data-home-example-card="true"]'],
    ['example card footer', '[data-home-example-card-footer="true"]'],
    ['solution card', '[data-home-solution-card="true"]'],
    ['status fact card', '[data-home-status-fact="true"]'],
] as const

test.describe('homepage surface border theme tokens', () => {
    for (const theme of ['dark', 'light'] as const) {
        test(`homepage cards and panels use the shared ${theme} surface border`, async ({ page }, testInfo) => {
            const baseURL = testInfo.project.use.baseURL || 'http://127.0.0.1:3000'
            await page.context().addCookies([{ name: 'theme', value: theme, url: baseURL }])

            await page.goto('/', { waitUntil: 'domcontentloaded' })
            await expect(page.locator('[data-home-exposure-panel="true"]')).toBeVisible()
            await expect(page.locator('body')).not.toContainText(/coverage\s+\d+\/\d+\s+customer paths live/i)
            await expect(page.locator('body')).not.toContainText(/customer routes\s+activating/i)
            await expect(page.locator('body')).not.toContainText(/bloom filter/i)
            await expect(page.locator('body')).not.toContainText(/\b(readiness|proof|receipt|contract|control room|named examples|dashboard slop)\b/i)

            const report = await page.evaluate((surfaces) => {
                function normalizeColor(value: string) {
                    const probe = document.createElement('span')
                    probe.style.color = value
                    document.body.appendChild(probe)
                    const normalized = window.getComputedStyle(probe).color
                    probe.remove()
                    return normalized
                }

                function parseRgb(value: string) {
                    const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
                    if (!match) return parseOklab(value)
                    return {
                        r: Number(match[1]),
                        g: Number(match[2]),
                        b: Number(match[3]),
                        a: match[4] === undefined ? 1 : Number(match[4]),
                    }
                }

                function parseOklab(value: string) {
                    const match = value.match(/oklab\(\s*([-\d.]+%?)\s+([-\d.]+%?)\s+([-\d.]+%?)(?:\s*\/\s*([-\d.]+%?))?\s*\)/)
                    if (!match) throw new Error(`Unsupported color: ${value}`)

                    const L = parseCssNumber(match[1], 1)
                    const a = parseCssNumber(match[2], 0.4)
                    const b = parseCssNumber(match[3], 0.4)
                    const alpha = match[4] === undefined ? 1 : parseCssNumber(match[4], 1)
                    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
                    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
                    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

                    return {
                        r: linearToRgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
                        g: linearToRgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
                        b: linearToRgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
                        a: alpha,
                    }
                }

                function parseCssNumber(value: string, percentBase: number) {
                    return value.endsWith('%') ? Number(value.slice(0, -1)) / 100 * percentBase : Number(value)
                }

                function linearToRgb(value: number) {
                    const clamped = Math.min(1, Math.max(0, value))
                    const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055
                    return Math.round(encoded * 255)
                }

                function srgb(value: number) {
                    const channel = value / 255
                    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
                }

                function luminance(color: ReturnType<typeof parseRgb>) {
                    return 0.2126 * srgb(color.r) + 0.7152 * srgb(color.g) + 0.0722 * srgb(color.b)
                }

                function contrast(first: ReturnType<typeof parseRgb>, second: ReturnType<typeof parseRgb>) {
                    const light = Math.max(luminance(first), luminance(second))
                    const dark = Math.min(luminance(first), luminance(second))
                    return (light + 0.05) / (dark + 0.05)
                }

                function effectiveBackground(element: Element) {
                    let current: Element | null = element
                    while (current) {
                        const background = window.getComputedStyle(current).backgroundColor
                        if (parseRgb(background).a > 0) return background
                        current = current.parentElement
                    }
                    return window.getComputedStyle(document.body).backgroundColor
                }

                const token = normalizeColor(window.getComputedStyle(document.documentElement).getPropertyValue('--landing-surface-border').trim())
                return surfaces.map(([label, selector]) => {
                    const element = document.querySelector(selector)
                    if (!element) throw new Error(`Missing sampled homepage surface: ${selector}`)
                    const styles = window.getComputedStyle(element)
                    const border = styles.borderTopColor
                    const borderRgb = parseRgb(border)
                    const background = effectiveBackground(element)

                    return {
                        label,
                        selector,
                        border,
                        token,
                        background,
                        contrast: contrast(borderRgb, parseRgb(background)),
                        maxChannel: Math.max(borderRgb.r, borderRgb.g, borderRgb.b),
                    }
                })
            }, sampledSurfaces)

            for (const sample of report) {
                expect(sample.border, `${sample.label} should use --landing-surface-border`).toBe(sample.token)
            }

            if (theme === 'dark') {
                for (const sample of report) {
                    expect(sample.maxChannel, `${sample.label} border should not drift toward near-white in dark theme`).toBeLessThan(170)
                    expect(sample.contrast, `${sample.label} border should stay low-contrast against its dark surface`).toBeLessThanOrEqual(2.4)
                }
            }
        })
    }
})

test('homepage exposure queue empty state reads like monitoring product copy', async () => {
    const source = await readFile(path.join(root, 'src/app/homeExposureQueueClient.tsx'), 'utf8')

    expect(source).toContain('Monitoring company mentions across exposure sources.')
    expect(source).toContain('Monitoring exposure sources.')
    expect(source).not.toContain('Checking for new company mentions...')
    expect(source).not.toContain('Checking for new company mentions.')
})
