import { strict as assert } from 'node:assert'
import { fetchSharedExposureQueue } from '../src/utils/dwm/sharedExposureQueue'

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

console.log('shared exposure activity contract ok')
