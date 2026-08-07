import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { fetchSharedExposureQueue } from '../src/utils/dwm/sharedExposureQueue'
import { exposureQueueFallback } from '../src/app/exposureQueue'

let requested: URL | undefined
let presentedToken = ''
const response = await fetchSharedExposureQueue(
    new URLSearchParams('tenantId=other&organizationId=other&limit=10&offset=20&country=Norway'),
    {
        env: {
            NODE_ENV: 'production',
            TI_SCRAPER_API_BASE: 'http://ti-scraper:8097',
            TI_SCRAPER_SERVICE_TOKEN: 'service-token',
        },
        fetcher: (async (input, init) => {
            requested = new URL(String(input))
            presentedToken = new Headers(init?.headers).get('x-hanasand-service-token') || ''
            return Response.json({ status: 'live', counts: { total: 2101 }, items: [{ id: 'capture-1' }] })
        }) as typeof fetch,
    },
)

assert.equal(response.status, 200)
assert.equal(requested?.pathname, '/v1/dwm/exposure-queue')
assert.equal(requested?.searchParams.get('tenantId'), 'default')
assert.equal(requested?.searchParams.get('organizationId'), null)
assert.equal(requested?.searchParams.get('limit'), '10')
assert.equal(requested?.searchParams.get('offset'), '20')
assert.equal(requested?.searchParams.get('country'), 'Norway')
assert.equal(presentedToken, 'service-token')

const unavailable = await fetchSharedExposureQueue(new URLSearchParams(), {
    env: { NODE_ENV: 'production', TI_SCRAPER_API_BASE: 'http://ti-scraper:8097' },
    fetcher: (() => {
        throw new Error('fetch must not run without the internal service token')
    }) as typeof fetch,
})
assert.equal(unavailable.status, 503)

const delayed = await fetchSharedExposureQueue(new URLSearchParams({ limit: '1' }), {
    env: {
        NODE_ENV: 'production',
        TI_SCRAPER_API_BASE: 'http://ti-scraper:8097',
        TI_SCRAPER_SERVICE_TOKEN: 'service-token',
    },
    fetcher: (async (_input, init) => {
        await waitForBackend(3_600, init?.signal)
        return Response.json({
            status: 'stale',
            counts: { total: 2_781 },
            items: [{ id: 'capture-stale', actor: 'Observed actor', company: 'Observed company' }],
        })
    }) as typeof fetch,
})
const delayedPayload = await delayed.json() as { status?: string, counts?: { total?: number }, items?: unknown[] }
assert.equal(delayed.status, 200)
assert.equal(delayedPayload.status, 'stale')
assert.equal(delayedPayload.counts?.total, 2_781)
assert.equal(delayedPayload.items?.length, 1)

const checking = exposureQueueFallback('checking', 10)
assert.equal(checking.status, 'checking')
assert.equal(checking.counts?.total, undefined)
assert.equal(checking.page?.total, undefined)

const homePageSource = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8')
const activityPageSource = readFileSync(new URL('../src/app/activity/page.tsx', import.meta.url), 'utf8')
const activityClientSource = readFileSync(new URL('../src/app/activity/activityClient.tsx', import.meta.url), 'utf8')
const homeClientSource = readFileSync(new URL('../src/app/homeExposureQueueClient.tsx', import.meta.url), 'utf8')
assert(!homePageSource.includes('|| emptyExposureQueue'))
assert(!activityPageSource.includes('|| emptyExposureQueue'))
assert(homeClientSource.includes('initialQueue.status') && homeClientSource.includes('void refresh()'))
assert(homeClientSource.includes('Feed is stale'))
assert(activityClientSource.includes('emptyActivityTitle(queue.status)'))
assert(activityClientSource.includes('Checking live activity.'))

console.log('shared exposure activity contract ok')

function waitForBackend(delayMs: number, signal?: AbortSignal | null) {
    return new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs)
        signal?.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(signal.reason)
        }, { once: true })
    })
}
