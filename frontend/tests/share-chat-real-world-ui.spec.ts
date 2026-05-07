import { expect, test } from '@playwright/test'

test.describe.configure({ mode: 'serial' })
test.setTimeout(120_000)

type AppStory = {
    id: number
    prompt: string
    expected: string
}

const stories: AppStory[] = [
    { id: 801, prompt: 'Make this a retainer page, but keep boundaries obvious. No payment stuff.', expected: 'retainer' },
    { id: 802, prompt: 'I clean houses. Make page practical. No booking.', expected: 'cleaning' },
    { id: 803, prompt: 'Access request info, no passwords, approvals clear.', expected: 'access' },
    { id: 804, prompt: 'Refund policy page. Fair, no dark patterns.', expected: 'refund' },
    { id: 805, prompt: 'Minor outage page. Calm, status, affected stuff, cadence.', expected: 'incident' },
    { id: 806, prompt: 'Proofing info. Review process, timeline, no gallery.', expected: 'proofing' },
    { id: 807, prompt: 'Volunteer page, roles, time, training. Don\'t pretend signup works.', expected: 'volunteer' },
    { id: 808, prompt: 'Budget review page. Careful boundaries. No advice.', expected: 'budget' },
    { id: 809, prompt: 'Audit prep, calm checklist, no upload portal.', expected: 'audit' },
    { id: 810, prompt: 'Waitlist page. No patient details.', expected: 'waitlist' },
    { id: 811, prompt: 'Partner onboarding page. Steps and docs. No upload.', expected: 'partner' },
    { id: 812, prompt: 'Procurement help page. Make it less corporate.', expected: 'procurement' },
    { id: 813, prompt: 'Beta feedback page. Useful feedback, what not to send, privacy.', expected: 'feedback' },
    { id: 814, prompt: 'Repair request info, emergency caveat, no login.', expected: 'repair' },
    { id: 815, prompt: 'Workshop page. What to bring, accessibility, no tickets.', expected: 'workshop' },
    { id: 816, prompt: 'Warranty page with exclusions and proof needed.', expected: 'warranty' },
    { id: 817, prompt: 'Migration page. Reassuring, risks, checklist, no login.', expected: 'migration' },
    { id: 818, prompt: 'Catering page, menus, lead time, quote path. No checkout.', expected: 'catering' },
    { id: 819, prompt: 'Legal intake page. Warnings, conflict caveat, no legal advice.', expected: 'legal' },
    { id: 820, prompt: 'Client handoff page. Deliverables, limits, maintenance, no dashboard.', expected: 'handoff' },
]

test('share chat surfaces progress, context, and review gates for ambiguous app stories', async ({ page, context, baseURL }) => {
    const cookieUrl = baseURL || 'http://127.0.0.1:3000'
    await context.addCookies([
        { name: 'access_token', value: encodeURIComponent('playwright-token'), url: cookieUrl },
        { name: 'id', value: 'playwright-user', url: cookieUrl },
    ])

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-ui-story',
                alias: body.path || body.name || body.id || 'app-ui-story',
                path: body.path || body.name || body.id || 'app-ui-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-ui-story'
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: shareId,
                alias: shareId,
                path: shareId,
                content: '',
                owner: 'playwright-user',
                parent: '',
                type: 'file',
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string }
        const matchingStory = stories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Prepared a focused ${matchingStory!.expected} page with narrow scope and reviewable changes.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>No fake portals, payments, or sensitive data collection.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of stories) {
        await page.goto(`/s/app-ui-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Review gate')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(/Prepared a focused/)).toBeVisible()
        await expect(page.getByText('Review gate')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('No fake portals, payments, or sensitive data collection.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(stories.length)
})
