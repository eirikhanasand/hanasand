import { expect, test, type APIRequestContext, type BrowserContext, type Page } from '@playwright/test'

const apiBase = process.env.PLAYWRIGHT_API_BASE || 'http://127.0.0.1:8080/api'
const password = `Aa11!!${Date.now()}Bb22!!`

test.describe('mail workspace', () => {
    test.setTimeout(180_000)

    test('sent and received mail surface in the UI end to end', async ({ browser, request, baseURL }) => {
        const runId = Date.now()
        const suffix = String(runId).slice(-6)
        const senderId = `pms${suffix}`
        const recipientId = `pmr${suffix}`

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

            await expect(senderPage).toHaveURL(/\/dashboard\/mail/)
            await expect(recipientPage).toHaveURL(/\/dashboard\/mail/)
            await expect(composeButton(senderPage)).toBeVisible()
            await expect(composeButton(recipientPage)).toBeVisible()

            const outboundSubject = `PW outbound ${runId}`
            const outboundBody = `From sender ${runId}`

            await composeButton(senderPage).click()
            await expect(composeForm(senderPage)).toBeVisible()
            await toInput(senderPage).fill(`${recipientId}@hanasand.com`)
            await subjectInput(senderPage).fill(outboundSubject)
            await bodyInput(senderPage).fill(outboundBody)
            await sendButton(senderPage).click()

            await expect(subjectText(senderPage, outboundSubject)).toBeVisible({ timeout: 30_000 })
            await expect(bodyText(senderPage, outboundBody)).toBeVisible({ timeout: 30_000 })

            await recipientPage.bringToFront()
            await recipientPage.waitForTimeout(1000)
            await expect(subjectText(recipientPage, outboundSubject)).toBeVisible({ timeout: 45_000 })
            await subjectText(recipientPage, outboundSubject).click()
            await expect(bodyText(recipientPage, outboundBody)).toBeVisible({ timeout: 30_000 })

            const replyBody = `Reply from recipient ${runId}`
            await recipientPage.getByRole('button', { name: 'Reply' }).click()
            await expect(composeForm(recipientPage)).toBeVisible()
            await bodyInput(recipientPage).fill(replyBody)
            await sendButton(recipientPage).click()

            await expect(subjectText(recipientPage, `Re: ${outboundSubject}`)).toBeVisible({ timeout: 30_000 })

            await senderPage.bringToFront()
            await inboxButton(senderPage).click()
            await expect(subjectText(senderPage, `Re: ${outboundSubject}`)).toBeVisible({ timeout: 45_000 })
            await subjectText(senderPage, `Re: ${outboundSubject}`).click()
            await expect(bodyText(senderPage, replyBody)).toBeVisible({ timeout: 30_000 })
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
    const cookieUrl = 'https://hanasand.com'
    await context.addCookies([
        { name: 'id', value: encodeURIComponent(auth.id), url: cookieUrl, expires, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'name', value: encodeURIComponent(auth.name), url: cookieUrl, expires, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'access_token', value: encodeURIComponent(auth.token), url: cookieUrl, expires, httpOnly: false, secure: true, sameSite: 'Lax' },
        { name: 'roles', value: encodeURIComponent(JSON.stringify(auth.roles || [])), url: cookieUrl, expires, httpOnly: false, secure: true, sameSite: 'Lax' },
    ])
}

function composeButton(page: Page) {
    return page.getByTestId('mail-compose-button').or(page.getByRole('button', { name: 'Compose' }))
}

function composeForm(page: Page) {
    return page.getByTestId('mail-compose-form').or(page.locator('form').filter({ has: page.getByPlaceholder('To') }).first())
}

function toInput(page: Page) {
    return page.getByTestId('mail-compose-to').or(page.getByPlaceholder('To'))
}

function subjectInput(page: Page) {
    return page.getByTestId('mail-compose-subject').or(page.getByPlaceholder('Subject'))
}

function bodyInput(page: Page) {
    return page.getByTestId('mail-compose-body').or(page.getByPlaceholder('Write your message...'))
}

function sendButton(page: Page) {
    return page.getByTestId('mail-compose-send').or(page.getByRole('button', { name: 'Send' }))
}

function inboxButton(page: Page) {
    return page.getByTestId('mail-mailbox-inbox').or(page.getByRole('button', { name: /Inbox/i }))
}

function subjectText(page: Page, value: string) {
    return page.getByText(value, { exact: true }).first()
}

function bodyText(page: Page, value: string) {
    return page.getByText(value, { exact: true }).first()
}
