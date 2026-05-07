import { expect, test, type BrowserContext, type Page } from '@playwright/test'

async function addLocalAuthCookies(context: BrowserContext, baseURL: string | undefined) {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    const hostname = new URL(cookieUrl).hostname
    if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
        return
    }

    await context.addCookies([
        { name: 'access_token', value: encodeURIComponent('playwright-token'), url: cookieUrl },
        { name: 'id', value: 'playwright-user', url: cookieUrl },
    ])
}

async function openWorkspaceChat(page: Page) {
    await page.getByRole('button', { name: 'Open workspace chat' }).click()
    await expect(page.getByText('AI assistant')).toBeVisible({ timeout: 5000 })
}

async function mockShareApi(page: Page) {
    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'ask-build-workflow',
                alias: body.path || body.name || body.id || 'ask-build-workflow',
                path: body.path || body.name || body.id || 'ask-build-workflow',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'ask-build-workflow'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '<main><h1>Starter page</h1></main>',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })
}

test('share chat keeps Ask read-only and Build reviewable without showing raw code first', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await mockShareApi(page)

    const workflowRequests: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { context?: string }
        const contextPayload = JSON.parse(body.context || '{}') as { workflow?: string, writesAllowed?: boolean }
        workflowRequests.push(`${contextPayload.workflow}:${contextPayload.writesAllowed}`)
        if (contextPayload.workflow === 'ask') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    message: 'This is a starter page. Ask mode can explain it without changing files.',
                }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    '```tsx',
                    'export default function Page() { return <main className="raw-code">Hidden</main> }',
                    '```',
                    'Prepared a cleaner landing page.',
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: 'export default function Page() { return <main><h1>Cleaner landing page</h1></main> }',
                    })}</hanasand-tool>`,
                ].join('\n'),
            }),
        })
    })

    await page.goto('/s/ask-build-workflow?new=1')
    await openWorkspaceChat(page)

    await expect(page.getByText('Ask mode will not change files.')).toBeVisible()
    await expect(page.getByText('Build is opt-in.')).toHaveCount(0)
    await page.getByPlaceholder('Ask about this project...').fill('explain what this is')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })
    await expect.poll(() => workflowRequests).toEqual(['ask:false'])
    await expect(page.getByText('What changed')).toHaveCount(0)

    await page.getByRole('button', { name: 'Build' }).click()
    await expect(page.getByText('Build is opt-in.')).toBeVisible()
    await expect(page.getByText('No files change until you approve the What changed cards.')).toBeVisible()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make it better')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect.poll(() => workflowRequests).toEqual(['ask:false', 'build:true'])
    await expect(page.getByText('Prepared a cleaner landing page.')).toBeVisible()
    await expect(page.getByText('Open What changed for the summary. Advanced diffs stay collapsed for developers.')).toBeVisible()
    await expect(page.getByText('What changed', { exact: true })).toBeVisible()
    await expect(page.getByText('Updated the visible website')).toBeVisible()
    await expect(page.locator('article').filter({ hasText: 'Prepared a cleaner landing page.' }).getByText('export default function Page')).toHaveCount(0)
    await expect(page.getByText('hanasand-tool')).not.toBeVisible()
})
