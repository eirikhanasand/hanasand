const successfulTickMaxAgeMs = 120_000
export const maxActiveLogPassMs = 10 * 60_000

export function isLogProcessorHealthy(input: {
    shuttingDown: boolean
    lastSuccessfulTickAt: number | null
    processingStartedAt: number | null
    consecutiveFailures: number
}, now = Date.now()) {
    const successfulTickFresh = input.lastSuccessfulTickAt !== null
        && now - input.lastSuccessfulTickAt >= 0
        && now - input.lastSuccessfulTickAt <= successfulTickMaxAgeMs
    const activePassFresh = input.processingStartedAt !== null
        && now - input.processingStartedAt >= 0
        && now - input.processingStartedAt <= maxActiveLogPassMs
    return !input.shuttingDown && input.consecutiveFailures < 10 && (successfulTickFresh || activePassFresh)
}
