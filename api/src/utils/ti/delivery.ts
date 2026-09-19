export async function getDeliverySummary(fetchImpl: typeof fetch = fetch) {
    const base = process.env.TI_SCRAPER_API_BASE?.replace(/\/$/, '')
    const token = process.env.TI_SCRAPER_SERVICE_TOKEN?.trim()
    if (!base || !token) throw new Error('Delivery monitoring is not configured.')
    const response = await fetchImpl(`${base}/v1/intel/timeliness/summary`, {
        headers: { 'x-hanasand-service-token': token }, signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) throw new Error(`Delivery metrics returned HTTP ${response.status}.`)
    const payload = await response.json() as { generatedAt: string, summary: { recordCount: number, needsReportCount: number, status: string, criticalThreshold: number } }
    if (!Number.isInteger(payload.summary?.needsReportCount) || payload.summary.needsReportCount < 0) throw new Error('Delivery backlog count is unavailable.')
    return payload
}
