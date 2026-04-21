import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
const password = `Aa11!!${Date.now()}Bb22!!`

test.describe('mail workspace', () => {
    test.setTimeout(180_000)

    test('sent and received mail surface in the UI end to end', async ({ browser, request, baseURL }) => {
        const runId = Date.now()
        const senderId = `pw_mail_sender_${runId}`
        const recipientId = `pw_mail_recipient_${runId}`

        const senderAuth = await createUser(request, senderId, 'Mail Sender')
        const recipientAuth = await createUser(request, recipientId, 'Mail Recipient')

        const senderContext = await browser.newContext({ baseURL })
        const recipientContext = await browser.newContext({ baseURL })
        const senderPage = await senderContext.newPage()
        const recipientPage = await recipientContext.newPage()

        try {
            await authenticateContext(senderContext, senderAuth)
            await authenticateContext(recipientContext, recipientAuth)

            await senderPage.goto('/dashboard/mail')
            await recipientPage.goto('/dashboard/mail')

            await expect(senderPage.getByTestId('mail-compose-button')).toBeVisible()
            await expect(recipientPage.getByTestId('mail-compose-button')).toBeVisible()

            const outboundSubject = `PW outbound ${runId}`
            const outboundBody = `From sender ${runId}`

            await senderPage.getByTestId('mail-compose-button').click()
            await expect(senderPage.getByTestId('mail-compose-form')).toBeVisible()
            await senderPage.getByTestId('mail-compose-to').fill(`${recipientId}@hanasand.com`)
            await senderPage.getByTestId('mail-compose-subject').fill(outboundSubject)
            await senderPage.getByTestId('mail-compose-body').fill(outboundBody)
            await senderPage.getByTestId('mail-compose-send').click()

            await expect(senderPage.getByText(outboundSubject, { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(senderPage.getByText(outboundBody, { exact: true })).toBeVisible({ timeout: 30_000 })

            await recipientPage.bringToFront()
            await recipientPage.waitForTimeout(1000)
            await expect(recipientPage.getByText(outboundSubject, { exact: true })).toBeVisible({ timeout: 45_000 })
            await recipientPage.getByText(outboundSubject, { exact: true }).click()
            await expect(recipientPage.getByText(outboundBody, { exact: true })).toBeVisible({ timeout: 30_000 })

            const replyBody = `Reply from recipient ${runId}`
            await recipientPage.getByRole('button', { name: 'Reply' }).click()
            await expect(recipientPage.getByTestId('mail-compose-form')).toBeVisible()
            await recipientPage.getByTestId('mail-compose-body').fill(replyBody)
            await recipientPage.getByTestId('mail-compose-send').click()

            await expect(recipientPage.getByText(`Re: ${outboundSubject}`, { exact: true })).toBeVisible({ timeout: 30_000 })

            await senderPage.bringToFront()
            await senderPage.getByTestId('mail-mailbox-inbox').click()
            await expect(senderPage.getByText(`Re: ${outboundSubject}`, { exact: true })).toBeVisible({ timeout: 45_000 })
            await senderPage.getByText(`Re: ${outboundSubject}`, { exact: true }).click()
            await expect(senderPage.getByText(replyBody, { exact: true })).toBeVisible({ timeout: 30_000 })
        } finally {
            await senderContext.close()
            await recipientContext.close()
            await deleteUser(request, senderId, password)
            await deleteUser(request, recipientId, password)
        }
    })
})

async function createUser(request: APIRequestContext, id: string, name: string) {
    const response = await request.post(`${apiBase}/user`, {
        data: { id, name, password },
    })
    expect(response.ok()).toBeTruthy()
    return await response.json() as {
        id: string
        name: string
        token: string
        expires_at: string
        roles?: string[]
    }
}

async function deleteUser(request: APIRequestContext, id: string, secret: string) {
    const loginResponse = await request.post(`${apiBase}/auth/login/${id}`, {
        data: { password: secret },
    })

    if (!loginResponse.ok()) {
        return
    }

    const token = (await loginResponse.json()).token as string
    await request.delete(`${apiBase}/user/self`, {
        headers: {
            Authorization: `Bearer ${decodeURIComponent(token)}`,
            id,
            'Content-Type': 'application/json',
        },
        data: { id },
    })
}

async function authenticateContext(context: BrowserContext, auth: {
    id: string
    name: string
    token: string
    expires_at: string
    roles?: string[]
}) {
    const expires = Math.floor(new Date(auth.expires_at).getTime() / 1000)
    await context.addCookies([
        { name: 'id', value: auth.id, domain: 'hanasand.com', path: '/', expires, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'name', value: auth.name, domain: 'hanasand.com', path: '/', expires, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'access_token', value: auth.token, domain: 'hanasand.com', path: '/', expires, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'roles', value: JSON.stringify(auth.roles || []), domain: 'hanasand.com', path: '/', expires, httpOnly: false, secure: true, sameSite: 'Lax' },
    ])
}
