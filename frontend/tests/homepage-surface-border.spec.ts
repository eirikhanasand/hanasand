import { expect, test } from '@playwright/test'

const sampledSurfaces = [
    ['exposure panel', '[data-home-exposure-panel="true"]'],
    ['product readiness panel', '[data-home-product-readiness="true"]'],
    ['workflow coverage panel', '[data-home-workflow-coverage="true"]'],
    ['example card', '[data-home-example-card="true"]'],
    ['solution card', '[data-home-solution-card="true"]'],
    ['readiness fact card', '[data-home-readiness-fact="true"]'],
] as const

test.describe('homepage surface border theme tokens', () => {
    for (const theme of ['dark', 'light'] as const) {
        test(`homepage cards and panels use the shared ${theme} surface border`, async ({ page }, testInfo) => {
            const baseURL = testInfo.project.use.baseURL || 'http://127.0.0.1:3000'
            await page.context().addCookies([{ name: 'theme', value: theme, url: baseURL }])

            await page.goto('/')
            await expect(page.locator('[data-home-exposure-panel="true"]')).toBeVisible()

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
                    if (!match) throw new Error(`Unsupported color: ${value}`)
                    return {
                        r: Number(match[1]),
                        g: Number(match[2]),
                        b: Number(match[3]),
                        a: match[4] === undefined ? 1 : Number(match[4]),
                    }
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
