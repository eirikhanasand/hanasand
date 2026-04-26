import config from '#constants'

export function buildAiPreviewUrl(deploymentId: string) {
    const apiBase = String(config.self_url || 'https://api.hanasand.com/api/auth/token').replace(/\/auth\/token\/?$/, '')
    return `${apiBase}/ai/previews/${encodeURIComponent(deploymentId)}`
}
