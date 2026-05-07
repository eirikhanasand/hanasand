import { expect, test, type BrowserContext } from '@playwright/test'

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

const transparencyStories: AppStory[] = [
    { id: 821, prompt: 'Make a launch page. I need to see changes before they land.', expected: 'launch' },
    { id: 822, prompt: 'Turn this into a tasteful services page, but show me what file changed.', expected: 'services' },
    { id: 823, prompt: 'Make this an incident notes page. Tell me what context you used.', expected: 'incident' },
    { id: 824, prompt: 'Make a page for my tutoring thing.', expected: 'tutoring' },
    { id: 825, prompt: 'Access request instructions. No secrets.', expected: 'access' },
    { id: 826, prompt: 'Warranty page. Conditions and proof. Short.', expected: 'warranty' },
    { id: 827, prompt: 'Deletion request page. No personal details.', expected: 'deletion' },
    { id: 828, prompt: 'Page for repair requests. No login.', expected: 'repair' },
    { id: 829, prompt: 'Beta feedback page. Privacy, what helps, what not to send.', expected: 'feedback' },
    { id: 830, prompt: 'Handoff page. Deliverables, limits, maintenance. No dashboard.', expected: 'handoff' },
    { id: 831, prompt: 'Budget review page. No financial advice.', expected: 'budget' },
    { id: 832, prompt: 'Waitlist page. Updates and timing, no patient info.', expected: 'waitlist' },
    { id: 833, prompt: 'Procurement help, less corporate, docs and timeline.', expected: 'procurement' },
    { id: 834, prompt: 'Visit prep page. Access, safety, timing. No booking.', expected: 'visit' },
    { id: 835, prompt: 'Volunteer page. Roles and time commitment.', expected: 'volunteer' },
    { id: 836, prompt: 'Catering page. Lead time, dietary caveat, no checkout.', expected: 'catering' },
    { id: 837, prompt: 'Proofing instructions. Feedback, timeline, usage caveat.', expected: 'proofing' },
    { id: 838, prompt: 'Migration page. Checklist and risks, reassuring.', expected: 'migration' },
    { id: 839, prompt: 'Intake page. Conflict caveat, no legal advice.', expected: 'legal' },
    { id: 840, prompt: 'Workshop page. What to bring and accessibility.', expected: 'workshop' },
]

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

test('share chat surfaces progress, context, and review gates for ambiguous app stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

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
        await expect(page.getByText('No auto-apply')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(/Prepared a focused/)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('No fake portals, payments, or sensitive data collection.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(stories.length)
})

test('share chat makes no-auto-apply and pending-file state explicit for transparency stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-transparency-story',
                alias: body.path || body.name || body.id || 'app-transparency-story',
                path: body.path || body.name || body.id || 'app-transparency-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-transparency-story'
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
        const matchingStory = transparencyStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Prepared ${matchingStory!.expected} changes for manual review.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Manual review required before apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of transparencyStories) {
        await page.goto(`/s/app-transparency-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('No auto-apply')).toBeVisible()
        await expect(page.getByText('Current file context')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Prepared ${story.expected} changes for manual review.`)).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('Manual review required before apply.')).toBeVisible()
    }

    expect(handledPrompts).toHaveLength(transparencyStories.length)
})
