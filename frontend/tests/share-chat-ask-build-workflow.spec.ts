import { expect, test, type BrowserContext, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

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

test('share chat flags generic AI-looking design and remembers brand style cues', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await mockShareApi(page)

    let run = 0
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string }
        const contextPayload = JSON.parse(body.context || '{}') as { designDifferentiationMode?: boolean, designMemory?: { tokens?: string[] } | null }
        expect(contextPayload.designDifferentiationMode).toBe(true)
        if (run === 1) {
            expect(contextPayload.designMemory?.tokens || []).toContain('premium')
        }
        run += 1

        const genericContent = [
            'export default function Page() {',
            'return <main className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 text-white">',
            '<section className="rounded-3xl border bg-white/10 shadow-2xl"><h1>Unlock your potential</h1></section>',
            '<article className="rounded-3xl border bg-white/10 shadow-2xl">Powerful platform</article>',
            '<article className="rounded-3xl border bg-white/10 shadow-2xl">Seamless experience</article>',
            '<article className="rounded-3xl border bg-white/10 shadow-2xl">Built for modern teams</article>',
            '</main> }',
        ].join('\n')
        const distinctContent = [
            'export const brandTokens = { "--studio-ink": "#15120f", "--studio-paper": "#f8f1e7", "--studio-copper": "#a45d32" }',
            'export default function Page() {',
            'return <main style={brandTokens} className="mx-auto grid max-w-5xl gap-8 px-5 py-8 text-[var(--studio-ink)]">',
            '<section className="grid gap-4 border-l-4 border-[var(--studio-copper)] pl-5"><h1>Premium studio intake with a calm editorial rhythm</h1><p>Art direction: warm atelier photography, quiet copper icons, honest project limits.</p></section>',
            '<img src="/studio-workbench.jpg" alt="Studio workbench with project materials" />',
            '</main> }',
        ].join('\n')

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    run === 1 ? 'Prepared visual direction.' : 'Refined the studio brand direction.',
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: run === 1 ? genericContent : distinctContent,
                    })}</hanasand-tool>`,
                    run === 1 ? '' : `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'docs/brand-kit.md',
                        content: 'Brand kit: premium studio palette, warm atelier photo direction, quiet copper icons, and theme tokens for future edits.',
                    })}</hanasand-tool>`,
                ].join('\n'),
            }),
        })
    })

    await page.goto('/s/design-quality-workflow?new=1')
    await openWorkspaceChat(page)
    await page.getByRole('button', { name: 'Build' }).click()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make this premium and not look AI-generated')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Design quality')).toBeVisible()
    await expect(page.getByText('Design risks looking generic or AI-generated.').first()).toBeVisible()
    await expect(page.getByText(/generic AI-builder phrases/i)).toBeVisible()

    await page.getByRole('button', { name: 'Discard' }).click()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make it distinct with brand tokens and asset direction')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Design memory')).toBeVisible()
    await expect(page.getByText('premium', { exact: true })).toBeVisible()
    await expect(page.getByText('Design has specific tokens, assets, hierarchy, and responsive signals.').first()).toBeVisible()
})

test('share chat sends niche design briefs and expects brand kit asset guidance', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await mockShareApi(page)

    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { context?: string, prompt?: string }
        const contextPayload = JSON.parse(body.context || '{}') as {
            designBrief?: {
                businessType?: string
                assetPipeline?: string[]
                tokenPlan?: string[]
                templateCaveat?: string
            }
        }
        expect(contextPayload.designBrief?.businessType).toBe('restaurant')
        expect(contextPayload.designBrief?.assetPipeline?.join(' ')).toContain('dietary')
        expect(contextPayload.designBrief?.tokenPlan?.join(' ')).toContain('appetite')
        expect(contextPayload.designBrief?.templateCaveat).toContain('not a fixed template')

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    'Prepared a restaurant direction with assets.',
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: [
                            'export const tokens = { "--restaurant-paper": "#fff8ed", "--restaurant-ink": "#23160f", "--restaurant-tomato": "#b73f2e" }',
                            'export default function Page() {',
                            'return <main style={tokens} className="mx-auto grid max-w-5xl gap-7 px-5 py-8 text-[var(--restaurant-ink)]">',
                            '<section className="grid gap-3 border-l-4 border-[var(--restaurant-tomato)] pl-5"><h1>Neighborhood bistro menu with honest allergy notes</h1><p>Hours, menu highlights, location, and dietary caveats stay visible before any inquiry.</p></section>',
                            '<img src="/restaurant-counter.jpg" alt="Restaurant counter with seasonal plates" />',
                            '</main> }',
                        ].join('\n'),
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'docs/brand-kit.md',
                        content: [
                            '# Brand kit',
                            'Theme tokens: restaurant-paper, restaurant-ink, restaurant-tomato.',
                            'Asset pipeline: real food and interior photos, dietary icons, no fake ordering or booking.',
                            'Image direction: warm counter photography, menu detail shots, staff-approved captions.',
                            'Template note: this is a starting direction, not a locked restaurant template.',
                        ].join('\n'),
                    })}</hanasand-tool>`,
                ].join('\n'),
            }),
        })
    })

    await page.goto('/s/restaurant-design-workflow?new=1')
    await openWorkspaceChat(page)
    await page.getByRole('button', { name: 'Build' }).click()
    await page.getByPlaceholder('Describe what you want to build or change...').fill('make a restaurant site that does not look like a generic AI template')
    await page.getByRole('button', { name: 'Send message' }).click({ force: true })

    await expect(page.getByText('Design memory')).toBeVisible()
    await expect(page.getByText('restaurant', { exact: true })).toBeVisible()
    await expect(page.getByText('Updated the project instructions')).toBeVisible()
    await expect(page.getByText('Design has specific tokens, assets, hierarchy, and responsive signals.').first()).toBeVisible()
})
