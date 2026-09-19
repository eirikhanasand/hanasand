export async function getIntelOperationsHealth() {
    const base = process.env.TI_SCRAPER_API_BASE || 'http://127.0.0.1:8097'
    const response = await fetch(`${base.replace(/\/$/, '')}/v1/intel/operations/health`, {
        headers: { 'x-hanasand-service-token': process.env.TI_SCRAPER_SERVICE_TOKEN || '' },
        signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`Intelligence health endpoint returned ${response.status}`)
    const data = await response.json()
    if (typeof data.collection?.critical !== 'boolean' || typeof data.enrichment?.critical !== 'boolean') throw new Error('Invalid intelligence health response')
    return data
}
