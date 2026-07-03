const localDefault = 'http://127.0.0.1:8097'
const dockerDefault = 'http://ti-scraper:8097'

export function tiScraperApiBase(env: Record<string, string | undefined> = process.env) {
    const explicit = env.TI_SCRAPER_API_BASE?.trim()
    if (explicit) return trimSlash(explicit)

    const localOverride = env.HANASAND_TI_SCRAPER_LOCAL_BASE?.trim()
    if (localOverride) return trimSlash(localOverride)

    return env.NODE_ENV === 'production' ? dockerDefault : localDefault
}

function trimSlash(value: string) {
    return value.replace(/\/$/, '')
}
