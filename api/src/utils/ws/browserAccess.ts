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
        profileTools: access.advancedAnalysis && Array.isArray(message.profileTools) ? message.profileTools : [],
        paidAuthorized: false,
    }
}
