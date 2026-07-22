import { expect, test } from '@playwright/test'

test('register page sends managed onboarding requests through contact intake', async ({ page }) => {
    await page.route('**/api/commercial/contact-requests', async (route) => {
        expect(route.request().headers()['idempotency-key']).toBeTruthy()
        const body = route.request().postDataJSON() as Record<string, unknown>
        expect(body).toMatchObject({
            name: 'Avery Chen',
            email: 'avery@acme.test',
            company: 'Acme Security',
            subject: 'Managed Hanasand onboarding request',
            intent: 'enterprise',
            plan: 'managed-onboarding',
            deliveryPreference: 'not-sure',
            replyWindow: 'this-week',
            securityReview: true,
        })
        expect(String(body.message)).toContain('Vendor monitoring for Acme suppliers')

        await route.fulfill({
            status: 202,
            contentType: 'application/json',
            body: JSON.stringify({
                accepted: true,
                ticketId: 'HS-20260705-ABC12345',
                nextStep: 'Expect a reply by email with coverage fit, setup steps, and security review material.',
            }),
        })
    })

    await page.goto('/register')

    await expect(page.locator('[data-managed-onboarding-intake="true"]')).toBeVisible()
    await expect(page.getByText('Creates an intake ticket for coverage fit')).toBeVisible()
    await expect(page.locator('#register-email')).toHaveCount(0)
    await expect(page.locator('#register-company')).toHaveCount(0)

    await page.getByLabel('Name').first().fill('Avery Chen')
    await page.getByLabel('Work email').fill('avery@acme.test')
    await page.getByLabel('Company').fill('Acme Security')
    await page.getByLabel('Monitoring context').fill('Vendor monitoring for Acme suppliers with SSO and DPA review before rollout.')
    await page.getByRole('button', { name: 'Send setup request' }).click()

    const result = page.locator('[data-managed-onboarding-result="true"]')
    await expect(result).toContainText('Setup request received')
    await expect(result).toContainText('HS-20260705-ABC12345')
    await expect(result).toContainText('security review material')
})
