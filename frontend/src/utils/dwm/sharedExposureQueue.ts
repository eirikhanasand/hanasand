import { tiScraperApiBase } from './scraperApiBase'

const allowedParams = new Set(['limit', 'offset', 'q', 'company', 'actor', 'category', 'size', 'country', 'from', 'to'])

export async function fetchSharedExposureQueue(
    searchParams: Pick<URLSearchParams, 'entries'>,
    options: {
        env?: Record<string, string | undefined>
        fetcher?: typeof fetch
        timeoutMs?: number
    } = {},
) {
    const env = options.env ?? process.env
    const serviceToken = env.TI_SCRAPER_SERVICE_TOKEN?.trim()
    if (!serviceToken) {
        return Response.json({ error: { code: 'ti_backend_unavailable', message: 'Threat activity is temporarily unavailable.' } }, { status: 503 })
    }

    const target = new URL('/v1/dwm/exposure-queue', tiScraperApiBase(env))
    for (const [key, value] of searchParams.entries()) {
        if (allowedParams.has(key)) target.searchParams.append(key, value)
    }
    target.searchParams.set('tenantId', 'default')

    return (options.fetcher ?? fetch)(target, {
        cache: 'no-store',
        headers: { 'x-hanasand-service-token': serviceToken },
        signal: AbortSignal.timeout(options.timeoutMs ?? 12_000),
    })
}
