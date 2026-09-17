// Translate machine-generated monitor output when presenting cases. Stored evidence,
// fingerprints, and user-authored comments remain unchanged.
export function readableMonitoringMessage(message: string): string {
    const http = /^JSON source returned HTTP (\d{3})\.$/.exec(message)
    if (http) return http[1] === '503'
        ? 'The health endpoint was unavailable and returned HTTP 503.'
        : `The health endpoint returned HTTP ${http[1]}.`
    const match = /^JSON (check passed|threshold exceeded): ([\w*.-]+) = ([\s\S]*); alert (gt|gte|lt|lte|eq|ne) ([\s\S]*) \((first|max|min|avg)\)\.$/.exec(message)
    if (!match) return message
    const [, outcome, path, observed, , , aggregate] = match
    const passed = outcome === 'check passed'
    if (path === 'ok' && aggregate === 'first' && ['true', 'false'].includes(observed)) {
        if (passed && observed === 'true') return 'The service reports that it is healthy.'
        return `The check ${passed ? 'passed' : 'failed'}. The service reports that it is ${observed === 'true' ? 'healthy' : 'unhealthy'}.`
    }
    const value = aggregate === 'max' ? 'highest value' : aggregate === 'min' ? 'lowest value' : aggregate === 'avg' ? 'average value' : path.includes('*') ? 'first value' : 'value'
    return `The check ${passed ? 'passed' : 'failed'}. The ${value} reported for "${path}" was ${observed}.`
}
