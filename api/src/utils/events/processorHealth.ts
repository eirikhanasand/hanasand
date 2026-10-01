const successfulTickMaxAgeMs = 120_000
export const maxActiveLogPassMs = 10 * 60_000

export function isLogProcessorHealthy(input: {
    shuttingDown: boolean
    lastSuccessfulTickAt: number | null
    processingStartedAt: number | null
    consecutiveFailures: number
    lastLiveTickAt?: number | null
    liveProcessingStartedAt?: number | null
    liveConsecutiveFailures?: number
}, now = Date.now()) {
    const successfulTickFresh = input.lastSuccessfulTickAt !== null
        && now - input.lastSuccessfulTickAt >= 0
        && now - input.lastSuccessfulTickAt <= successfulTickMaxAgeMs
    const activePassFresh = input.processingStartedAt !== null
        && now - input.processingStartedAt >= 0
        && now - input.processingStartedAt <= maxActiveLogPassMs
    const livePathRequired = input.lastLiveTickAt !== undefined || input.liveProcessingStartedAt !== undefined
    const liveTickFresh = input.lastLiveTickAt !== null && input.lastLiveTickAt !== undefined
        && now - input.lastLiveTickAt >= 0
        && now - input.lastLiveTickAt <= successfulTickMaxAgeMs
    const livePassFresh = input.liveProcessingStartedAt !== null && input.liveProcessingStartedAt !== undefined
        && now - input.liveProcessingStartedAt >= 0
        && now - input.liveProcessingStartedAt <= maxActiveLogPassMs
    const livePathHealthy = !livePathRequired || ((input.liveConsecutiveFailures ?? 0) < 10 && (liveTickFresh || livePassFresh))
    return !input.shuttingDown && input.consecutiveFailures < 10 && (successfulTickFresh || activePassFresh) && livePathHealthy
}
