export type BrowserAccess = {
    paid: boolean
    concurrentLimit: number
    sessionSeconds: number
    advancedAnalysis: boolean
}

const paidConcurrency: Record<string, number> = { browser: 3, starter: 3, team: 5, business: 10, volume: 20 }

export function browserAccess(plan: string): BrowserAccess {
    const concurrentLimit = Object.hasOwn(paidConcurrency, plan) ? paidConcurrency[plan] : 0
    const paid = Boolean(concurrentLimit)
    return { paid, concurrentLimit: concurrentLimit || 1, sessionSeconds: paid ? 1800 : 300, advancedAnalysis: paid }
}

export function browserStartOptions(message: Record<string, unknown>, access: BrowserAccess) {
    const requested = Number(message.durationSeconds) || Number(message.durationMinutes) * 60
    return {
        ...message,
        durationSeconds: Number.isFinite(requested) && requested > 0 ? Math.max(60, Math.min(requested, access.sessionSeconds)) : access.sessionSeconds,
        durationMinutes: undefined,
        profileTools: Array.isArray(message.profileTools) ? message.profileTools.filter(tool => access.advancedAnalysis || freeTriageTool(tool)) : [],
        paidAuthorized: false,
    }
}

function freeTriageTool(tool: unknown) {
    if (!tool || typeof tool !== 'object') return false
    const { id, url } = tool as { id?: string; url?: string }
    return (id === 'virustotal' && url === 'https://www.virustotal.com/gui/search/{url}')
        || (id === 'urlquery' && url === 'https://urlquery.net/search?q={url}')
        || (id === 'webcrack' && url === 'https://webcrack.netlify.app/')
}
