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

const speedReviewStories: AppStory[] = [
    { id: 841, prompt: 'Make this not embarrassing for a studio.', expected: 'studio' },
    { id: 842, prompt: 'Make it sound real, but don\'t overpromise.', expected: 'positioning' },
    { id: 843, prompt: 'Procurement page. Safer, shorter, no portal.', expected: 'procurement' },
    { id: 844, prompt: 'Make handoff clearer. Mention limits.', expected: 'handoff' },
    { id: 845, prompt: 'I need a simple page for my class.', expected: 'class' },
    { id: 846, prompt: 'Outage note. Calm. No fake status.', expected: 'outage' },
    { id: 847, prompt: 'Waitlist info, but don\'t collect health stuff.', expected: 'waitlist' },
    { id: 848, prompt: 'Catering page. Keep allergy wording careful.', expected: 'catering' },
    { id: 849, prompt: 'Access page. No passwords. Make approvals clear.', expected: 'access' },
    { id: 850, prompt: 'Volunteers. Roles, shifts, training. Keep it honest.', expected: 'volunteers' },
    { id: 851, prompt: 'Proofing page. Feedback rules and usage caveat.', expected: 'proofing' },
    { id: 852, prompt: 'Visit prep. Access, timing, safety. No booking.', expected: 'visit' },
    { id: 853, prompt: 'Budget review. Useful, not financial advice.', expected: 'budget' },
    { id: 854, prompt: 'Feedback page. Tell people what helps.', expected: 'feedback' },
    { id: 855, prompt: 'Repair request info. Emergencies separate.', expected: 'repair' },
    { id: 856, prompt: 'Intake page. Conflict check. No advice.', expected: 'intake' },
    { id: 857, prompt: 'Workshop page. Bring-list and accessibility.', expected: 'workshop' },
    { id: 858, prompt: 'Migration page. Checklist, risks, reassuring.', expected: 'migration' },
    { id: 859, prompt: 'Warranty page. Proof, exclusions, next steps.', expected: 'warranty' },
    { id: 860, prompt: 'Audit prep page. Checklist only. No upload.', expected: 'audit' },
]

const toolFrictionStories: AppStory[] = [
    { id: 861, prompt: 'make it investor safe but not cringe', expected: 'investor' },
    { id: 862, prompt: 'idk, customer dashboard vibes, but just the page', expected: 'dashboard' },
    { id: 863, prompt: 'my boss wants proof we know what changed', expected: 'change-log' },
    { id: 864, prompt: 'agency client is picky. make first screen better.', expected: 'agency' },
    { id: 865, prompt: 'newbie mode: I sell plants, make the site useful', expected: 'plants' },
    { id: 866, prompt: 'corporate procurement hates fluff. fix it.', expected: 'procurement' },
    { id: 867, prompt: 'designer asked for taste, founder asked for speed', expected: 'studio-brief' },
    { id: 868, prompt: 'the page feels scammy. remove risky promises.', expected: 'trust' },
    { id: 869, prompt: 'make support page less annoying, no ticket system', expected: 'support' },
    { id: 870, prompt: 'compliance will read this, keep claims boring', expected: 'compliance' },
    { id: 871, prompt: 'turn this into a local gym page, no fake booking', expected: 'gym' },
    { id: 872, prompt: 'we need release notes customers can understand', expected: 'release-notes' },
    { id: 873, prompt: 'make a contractor handoff thing, but quick', expected: 'contractor' },
    { id: 874, prompt: 'finance team asked for cost page. careful wording.', expected: 'costs' },
    { id: 875, prompt: 'school club page, make parents trust it', expected: 'school-club' },
    { id: 876, prompt: 'sales overpromised. make this honest.', expected: 'honest-sales' },
    { id: 877, prompt: 'ops needs a checklist, not a novel', expected: 'ops-checklist' },
    { id: 878, prompt: 'restaurant site, allergies careful, no orders', expected: 'restaurant' },
    { id: 879, prompt: 'make security review page from nothing', expected: 'security-review' },
    { id: 880, prompt: 'the user is lost. show what happens next.', expected: 'next-steps' },
]

const contextBudgetStories: AppStory[] = [
    { id: 881, prompt: 'this is too much, make the page obvious', expected: 'obvious' },
    { id: 882, prompt: 'client asked "more premium" and left', expected: 'premium' },
    { id: 883, prompt: 'small clinic, but dont collect anything weird', expected: 'clinic' },
    { id: 884, prompt: 'enterprise buyer skim only, make it survive', expected: 'enterprise-skim' },
    { id: 885, prompt: 'my cousin needs a portfolio by tonight', expected: 'portfolio' },
    { id: 886, prompt: 'make the home page stop wasting words', expected: 'concise-home' },
    { id: 887, prompt: 'founder is panicking, calm landing page', expected: 'calm-launch' },
    { id: 888, prompt: 'we got burned by hidden changes before', expected: 'visible-changes' },
    { id: 889, prompt: 'nonprofit page, honest ask, no fake donate', expected: 'nonprofit' },
    { id: 890, prompt: 'security vendor page. no badges we dont have', expected: 'vendor-security' },
    { id: 891, prompt: 'make it clear what I do. I fix bikes.', expected: 'bike-repair' },
    { id: 892, prompt: 'law office but careful, no advice', expected: 'law-office' },
    { id: 893, prompt: 'architect site. designer will judge it.', expected: 'architect' },
    { id: 894, prompt: 'ops wants proof, users want simple', expected: 'ops-proof' },
    { id: 895, prompt: 'make it good for a boring B2B thing', expected: 'b2b' },
    { id: 896, prompt: 'course page. no fake enrollment.', expected: 'course' },
    { id: 897, prompt: 'pricing page but we dont know prices yet', expected: 'pricing' },
    { id: 898, prompt: 'status page copy, no fake uptime', expected: 'status-copy' },
    { id: 899, prompt: 'portfolio for a photographer, no gallery backend', expected: 'photographer' },
    { id: 900, prompt: 'make next step dead obvious for a total beginner', expected: 'beginner-next-step' },
]

const shareBrowserEvidenceStories: AppStory[] = [
    { id: 1021, prompt: 'does this look live or am i kidding myself', expected: 'live-proof' },
    { id: 1022, prompt: 'designer says first screen feels wrong, look at it', expected: 'first-screen' },
    { id: 1023, prompt: 'newbie asks where contact is', expected: 'contact-path' },
    { id: 1024, prompt: 'corporate buyer needs pricing obvious but not fake', expected: 'pricing-proof' },
    { id: 1025, prompt: 'phone users complain, dont just lint', expected: 'mobile-proof' },
    { id: 1026, prompt: 'agency client wants proof before applying anything', expected: 'proof-before-apply' },
    { id: 1027, prompt: 'public sector page, screen reader basics first', expected: 'accessibility-proof' },
    { id: 1028, prompt: 'founder says it feels scammy, check visible claims', expected: 'trust-proof' },
    { id: 1029, prompt: 'restaurant owner wants booking but no fake booking', expected: 'booking-proof' },
    { id: 1030, prompt: 'ops asks what changed and whether it is visible', expected: 'ops-visible-proof' },
    { id: 1031, prompt: 'investor link goes out today, verify the page surface', expected: 'investor-proof' },
    { id: 1032, prompt: 'compliance wants docs visible without upload portal', expected: 'docs-proof' },
    { id: 1033, prompt: 'user says blank page, dont reassure me', expected: 'blank-proof' },
    { id: 1034, prompt: 'total beginner needs next step obvious', expected: 'next-step-proof' },
    { id: 1035, prompt: 'designer asked for less generic copy, inspect headings', expected: 'copy-proof' },
    { id: 1036, prompt: 'support page is annoying, check buttons and forms', expected: 'support-proof' },
    { id: 1037, prompt: 'sales overpromised, show visible proof and caveats', expected: 'claims-proof' },
    { id: 1038, prompt: 'another agent will continue this, make evidence visible', expected: 'handoff-proof' },
    { id: 1039, prompt: 'codex terminal hides too much, prove the ui is better', expected: 'terminal-contrast-proof' },
    { id: 1040, prompt: 'are we still building the best autonomous website builder', expected: 'drift-proof' },
]

const shareEvidenceTargetStories: AppStory[] = [
    { id: 1041, prompt: 'look at the actual page, not a sample site', expected: 'actual-page' },
    { id: 1042, prompt: 'client says preview is broken, use the right link', expected: 'right-link' },
    { id: 1043, prompt: 'newbie says where am i supposed to click', expected: 'current-share-clicks' },
    { id: 1044, prompt: 'designer says inspect the page i am on', expected: 'current-page-design' },
    { id: 1045, prompt: 'corporate review wants proof from this share', expected: 'share-proof' },
    { id: 1046, prompt: 'do not hallucinate the preview url', expected: 'no-hallucinated-url' },
    { id: 1047, prompt: 'support says blank page on this exact share', expected: 'exact-share-blank' },
    { id: 1048, prompt: 'ops wants evidence attached to this workspace', expected: 'workspace-evidence' },
    { id: 1049, prompt: 'agency handoff needs the visible share url', expected: 'handoff-url' },
    { id: 1050, prompt: 'pricing needs proof from our page', expected: 'our-pricing-proof' },
    { id: 1051, prompt: 'mobile complaint is about this share only', expected: 'share-mobile-proof' },
    { id: 1052, prompt: 'accessibility pass on the current page', expected: 'current-accessibility' },
    { id: 1053, prompt: 'investor opens the share link today', expected: 'investor-share-link' },
    { id: 1054, prompt: 'compliance asks what public users see here', expected: 'public-share-compliance' },
    { id: 1055, prompt: 'restaurant owner says booking is hidden here', expected: 'booking-current-share' },
    { id: 1056, prompt: 'founder says it looks scammy here', expected: 'claims-current-share' },
    { id: 1057, prompt: 'another agent must continue from this url', expected: 'handoff-current-url' },
    { id: 1058, prompt: 'terminal agents lose the page context, dont', expected: 'terminal-context-proof' },
    { id: 1059, prompt: 'prove this is still about shipping websites', expected: 'shipping-proof' },
    { id: 1060, prompt: 'ambiguous: fix the thing users see', expected: 'visible-thing' },
]

const visibleProofTargetStories: AppStory[] = [
    { id: 1061, prompt: 'wait, what page are you checking', expected: 'visible-target' },
    { id: 1062, prompt: 'designer wants to know the exact inspected page', expected: 'designer-visible-target' },
    { id: 1063, prompt: 'newbie needs the link shown before sending', expected: 'newbie-visible-link' },
    { id: 1064, prompt: 'corporate reviewer asks for source of proof', expected: 'corporate-proof-source' },
    { id: 1065, prompt: 'ops says do not hide the target in logs', expected: 'ops-visible-target' },
    { id: 1066, prompt: 'agency client wants the page url in the ui', expected: 'agency-visible-url' },
    { id: 1067, prompt: 'support wants to avoid checking the wrong share', expected: 'support-right-share' },
    { id: 1068, prompt: 'founder is worried about hallucinated browser checks', expected: 'founder-proof-target' },
    { id: 1069, prompt: 'accessibility reviewer needs target before proof', expected: 'a11y-target-visible' },
    { id: 1070, prompt: 'pricing proof must show which page was read', expected: 'pricing-target-visible' },
    { id: 1071, prompt: 'mobile bug is only on this share', expected: 'mobile-target-visible' },
    { id: 1072, prompt: 'compliance asks for evidence source', expected: 'compliance-source' },
    { id: 1073, prompt: 'investor handoff needs visible page source', expected: 'investor-source' },
    { id: 1074, prompt: 'restaurant owner asks what page you inspected', expected: 'restaurant-source' },
    { id: 1075, prompt: 'terminal agents hide too much state', expected: 'terminal-state-visible' },
    { id: 1076, prompt: 'another agent should not guess the url', expected: 'handoff-no-guess' },
    { id: 1077, prompt: 'client says prove the exact thing users see', expected: 'exact-visible-proof' },
    { id: 1078, prompt: 'designer says no hidden context please', expected: 'designer-no-hidden-context' },
    { id: 1079, prompt: 'beginner asks why proof is trustworthy', expected: 'beginner-trust' },
    { id: 1080, prompt: 'are we still reducing token bloat', expected: 'target-reduces-bloat' },
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

test('share chat keeps the mobile chat viewport unobscured by the explorer rail', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)
    await page.setViewportSize({ width: 520, height: 820 })

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-mobile-chat-story',
                alias: body.path || body.name || body.id || 'app-mobile-chat-story',
                path: body.path || body.name || body.id || 'app-mobile-chat-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-mobile-chat-story'
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

    await page.goto('/s/app-mobile-chat-861?new=1')
    await expect(page.getByRole('button', { name: 'Open file explorer' })).toHaveCount(1)
    await page.getByRole('button', { name: 'Open workspace chat' }).click()

    await expect(page.getByText('Chat workspace')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open file explorer' })).toHaveCount(0)
    await expect(page.getByPlaceholder('Ask Hanasand AI to change this project...')).toBeVisible()
    await expect(page.getByText('No auto-apply')).toBeVisible()
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

test('share chat reaches concise two-file review quickly for speed-review stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-speed-review-story',
                alias: body.path || body.name || body.id || 'app-speed-review-story',
                path: body.path || body.name || body.id || 'app-speed-review-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-speed-review-story'
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
        const matchingStory = speedReviewStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Done: ${matchingStory!.expected}. Review the two files before applying.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Useful, careful, and scoped. No fake portals, guarantees, uploads, or payments.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/brief.tsx',
                        content: `export const brief = { topic: '${matchingStory!.expected}', review: 'Manual apply only', scope: 'Two small files' }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of speedReviewStories) {
        await page.goto(`/s/app-speed-review-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Done: ${story.expected}. Review the two files before applying.`)).toBeVisible({ timeout: 3000 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('2 file changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/brief.tsx')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(3000)
    }

    expect(handledPrompts).toHaveLength(speedReviewStories.length)
})

test('share chat avoids bloat and exposes review controls for tool-friction stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-tool-friction-story',
                alias: body.path || body.name || body.id || 'app-tool-friction-story',
                path: body.path || body.name || body.id || 'app-tool-friction-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-tool-friction-story'
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
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = toolFrictionStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2600)
        expect(body.prompt).toContain('Keep visible prose to at most 5 short sentences')
        expect(body.context?.length || 0).toBeLessThan(12_000)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Two scoped files are waiting for review.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Clear next step, careful claims, and no fake backend promises.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/review-notes.ts',
                        content: 'export const reviewNotes = [\'Manual review before apply\', \'No fake payments, portals, uploads, guarantees, or hidden background work\']',
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of toolFrictionStories) {
        await page.goto(`/s/app-tool-friction-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Two scoped files are waiting for review.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('2 file changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/review-notes.ts')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        await expect(page.getByText('No fake payments, portals, uploads, guarantees, or hidden background work')).toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(toolFrictionStories.length)
})

test('share chat keeps context lean while resolving context-budget stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-context-budget-story',
                alias: body.path || body.name || body.id || 'app-context-budget-story',
                path: body.path || body.name || body.id || 'app-context-budget-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-context-budget-story'
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
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = contextBudgetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.context?.length || 0).toBeLessThan(9_000)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Review the files, then apply.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Plain next step, careful scope, and no invented system behind it.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/decision.ts',
                        content: `export const decision = { changed: '${matchingStory!.expected}', mode: 'lean context', apply: 'manual' }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of contextBudgetStories) {
        await page.goto(`/s/app-context-budget-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Review the files, then apply.`)).toBeVisible({ timeout: 2200 })
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/decision.ts')).toBeVisible()
        await expect(page.getByText('lean context')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2200)
    }

    expect(handledPrompts).toHaveLength(contextBudgetStories.length)
})

test('share page AI shows browser proof in the website UI for ambiguous build stories', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-share-browser-proof-story',
                alias: body.path || body.name || body.id || 'app-share-browser-proof-story',
                path: body.path || body.name || body.id || 'app-share-browser-proof-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-share-browser-proof-story'
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

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url || 'https://example.com',
                title: 'Share Preview OK',
                textExcerpt: 'Visible preview with hero, pricing, contact, booking caveat, and next step.',
                structure: {
                    headings: ['Visible preview', 'Pricing', 'Contact'],
                    links: [
                        { text: 'Contact support', href: '/contact' },
                        { text: 'Pricing', href: '/pricing' },
                    ],
                    buttons: ['Start review', 'Book demo'],
                    inputs: ['Email address / email'],
                    forms: ['Email address / email | Start review'],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = shareBrowserEvidenceStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        expect(body.maxTokens).toBeLessThanOrEqual(2200)
        expect(body.prompt).toContain('Use browser evidence before claiming a page works')
        expect(body.context?.length || 0).toBeLessThan(9_000)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. Browser proof is visible before apply.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: 'https://example.com',
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Visible proof first, careful claims, no fake backend promises.</p></main> }`,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/proof.ts',
                        content: `export const proof = { browser: true, apply: 'manual', topic: '${matchingStory!.expected}' }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of shareBrowserEvidenceStories) {
        await page.goto(`/s/app-share-browser-proof-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Ready', { exact: true })).toBeVisible()
        await expect(page.getByText('No auto-apply')).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. Browser proof is visible before apply.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Browser proof visible for https://example.com.')).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Browser proof', { exact: true }).last()).toBeVisible()
        await expect(page.getByText('Visible preview').last()).toBeVisible()
        await expect(page.getByText('Contact support -> /contact').last()).toBeVisible()
        await expect(page.getByText('Viewport meta present').last()).toBeVisible()
        await expect(page.getByText('Screenshot not available yet').last()).toBeVisible()
        await expect(page.getByText('2 pending changes')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('Create app/proof.ts')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(shareBrowserEvidenceStories.length)
})

test('share page AI uses the current share URL for browser evidence instead of generic examples', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-share-evidence-target-story',
                alias: body.path || body.name || body.id || 'app-share-evidence-target-story',
                path: body.path || body.name || body.id || 'app-share-evidence-target-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-share-evidence-target-story'
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

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-share-target-')
        expect(body.url).not.toBe('https://example.com')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url,
                title: 'Current Share Evidence',
                textExcerpt: 'Current share proof with visible navigation and no generic sample target.',
                structure: {
                    headings: ['Current share proof', 'Visible next step'],
                    links: [{ text: 'Open share', href: body.url }],
                    buttons: ['Apply after review'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, maxTokens?: number, context?: string }
        const matchingStory = shareEvidenceTargetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-share-target-${matchingStory!.id}`
        expect(body.prompt).toContain('Browser evidence targets:')
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.prompt).toContain(`"url":"${expectedUrl}"`)
        expect(body.prompt).not.toContain('"url":"https://example.com"')
        expect(body.context).toContain(expectedUrl)
        expect(body.context?.length || 0).toBeLessThan(9_500)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. I checked the current share URL, not a sample page.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Current-share evidence first, then manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of shareEvidenceTargetStories) {
        await page.goto(`/s/app-share-target-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. I checked the current share URL, not a sample page.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof visible for https://hanasand.com/s/app-share-target-${story.id}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Current share proof').last()).toBeVisible()
        await expect(page.getByText(`Open share -> https://hanasand.com/s/app-share-target-${story.id}`).last()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('Create app/page.tsx')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(shareEvidenceTargetStories.length)
})

test('share page AI shows the browser proof target before users send ambiguous prompts', async ({ page, context, baseURL }) => {
    await addLocalAuthCookies(context, baseURL)

    await page.route('https://cdn.hanasand.com/api/share', async (route) => {
        const body = route.request().postDataJSON() as { id?: string, path?: string, name?: string, content?: string, type?: string }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: body.id || 'app-visible-proof-target-story',
                alias: body.path || body.name || body.id || 'app-visible-proof-target-story',
                path: body.path || body.name || body.id || 'app-visible-proof-target-story',
                content: body.content || '',
                owner: 'playwright-user',
                parent: '',
                type: body.type || 'folder',
                tree: [],
            }),
        })
    })

    await page.route(/https:\/\/cdn\.hanasand\.com\/api\/share\/.+/, async (route) => {
        const shareId = route.request().url().split('/').pop() || 'app-visible-proof-target-story'
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

    await page.route('**/api/tools/browser/task', async (route) => {
        const body = route.request().postDataJSON() as { url?: string }
        expect(body.url).toContain('https://hanasand.com/s/app-visible-target-')
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                url: body.url,
                title: 'Visible Target Evidence',
                textExcerpt: 'The proof target is visible before the user sends.',
                structure: {
                    headings: ['Visible proof target', 'Trustworthy evidence'],
                    links: [{ text: 'Current target', href: body.url }],
                    buttons: ['Review'],
                    inputs: [],
                    forms: [],
                    hasViewportMeta: true,
                },
                screenshotPath: null,
                consoleMessages: ['Fetched browser target without executing client-side JavaScript.'],
                pageErrors: [],
            }),
        })
    })

    const handledPrompts: string[] = []
    await page.route('**/api/tools/ai', async (route) => {
        const body = route.request().postDataJSON() as { prompt?: string, context?: string }
        const matchingStory = visibleProofTargetStories.find((story) => body.prompt?.includes(story.prompt))
        expect(matchingStory).toBeTruthy()
        const expectedUrl = `https://hanasand.com/s/app-visible-target-${matchingStory!.id}`
        expect(body.prompt).toContain(`Current share page: ${expectedUrl}`)
        expect(body.context).toContain(expectedUrl)
        handledPrompts.push(matchingStory!.prompt)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                message: [
                    `Ready: ${matchingStory!.expected}. The proof target was visible before the check.`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'browser_task',
                        url: expectedUrl,
                        captureScreenshot: true,
                        timeoutMs: 16000,
                    })}</hanasand-tool>`,
                    `<hanasand-tool>${JSON.stringify({
                        action: 'upsert_share',
                        path: 'app/page.tsx',
                        content: `export default function Page() { return <main><h1>${matchingStory!.expected}</h1><p>Visible proof target, compact response, manual apply.</p></main> }`,
                    })}</hanasand-tool>`,
                ].join('\n\n'),
            }),
        })
    })

    for (const story of visibleProofTargetStories) {
        const expectedUrl = `https://hanasand.com/s/app-visible-target-${story.id}`
        await page.goto(`/s/app-visible-target-${story.id}?new=1`)
        await page.getByRole('button', { name: 'Open workspace chat' }).click()
        await expect(page.getByText('Current share target')).toBeVisible()
        await expect(page.getByText(expectedUrl)).toBeVisible()

        await page.getByPlaceholder('Ask Hanasand AI to change this project...').fill(story.prompt)
        const startedAt = Date.now()
        await page.getByRole('button', { name: 'Send message' }).click()

        await expect(page.getByText(`Ready: ${story.expected}. The proof target was visible before the check.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText(`Browser proof visible for ${expectedUrl}.`)).toBeVisible({ timeout: 2500 })
        await expect(page.getByText('Visible proof target').last()).toBeVisible()
        await expect(page.getByText('1 pending change')).toBeVisible()
        await expect(page.getByText('hanasand-tool')).not.toBeVisible()
        expect(Date.now() - startedAt).toBeLessThan(2500)
    }

    expect(handledPrompts).toHaveLength(visibleProofTargetStories.length)
})
