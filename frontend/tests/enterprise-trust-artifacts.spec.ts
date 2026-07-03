import { expect, test } from '@playwright/test'

const artifacts = [
    {
        path: '/trust/security-overview',
        required: [/Security overview/i, /No SOC 2 or ISO 27001 certificate is claimed/i, /Metadata-first/i],
    },
    {
        path: '/trust/dpa-and-data',
        required: [/DPA readiness/i, /Signed DPA/i, /Retention posture/i, /breach notification/i],
    },
    {
        path: '/trust/subprocessors',
        required: [/Subprocessor register/i, /Hosting\/runtime/i, /Customer-selected destinations/i, /named provider\/region/i],
    },
    {
        path: '/trust/sla-onboarding',
        required: [/Enterprise onboarding/i, /Support and SLA/i, /SSO\/SAML\/OIDC/i, /SCIM/i],
    },
] as const

test.describe('enterprise trust artifacts', () => {
    for (const artifact of artifacts) {
        test(`${artifact.path} exposes current enterprise-review facts without fake certification claims`, async ({ page }) => {
            const response = await page.goto(artifact.path)
            expect(response?.status(), `${artifact.path} should load`).toBeLessThan(500)
            const main = page.locator('main').filter({ hasText: artifact.required[0] }).last()
            await expect(main, `${artifact.path} should render the artifact content`).toContainText(artifact.required[0], { timeout: 30_000 })

            const body = await main.innerText()
            for (const pattern of artifact.required) {
                expect(body, `${artifact.path} should include ${pattern}`).toMatch(pattern)
            }

            expect(body, `${artifact.path} must not claim certification`).not.toMatch(/\b(SOC 2|ISO 27001)\s+(certified|compliant)\b/i)
        })
    }
})
