import config from '#constants'

type ModelLaneConfig = {
    id: string
    url: string
    model?: string
    label?: string
    tier: 'fast' | 'strong'
    gpuIndices: number[]
    maxRequests: number
    contextMaxTokens: number
    routeWeight: number
}

function parseLaneConfigs(): ModelLaneConfig[] {
    const raw = process.env.MODEL_LANES
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as Partial<ModelLaneConfig>[]
            if (Array.isArray(parsed) && parsed.length) {
                return parsed
                    .filter((lane) => lane.url)
                    .map((lane, index) => ({
                        id: lane.id || `lane-${index}`,
                        url: String(lane.url).replace(/\/+$/, ''),
                        model: lane.model,
                        label: lane.label,
                        tier: lane.tier === 'strong' ? 'strong' : 'fast',
                        gpuIndices: Array.isArray(lane.gpuIndices) && lane.gpuIndices.length
                            ? lane.gpuIndices.map(Number).filter(Number.isFinite)
                            : [index],
                        maxRequests: Math.max(1, Number(lane.maxRequests || process.env.HANASAND_VLLM_MAX_NUM_SEQS || 4)),
                        contextMaxTokens: Math.max(0, Number(lane.contextMaxTokens || process.env.HANASAND_MODEL_CONTEXT_MAX_TOKENS || process.env.HANASAND_VLLM_MAX_MODEL_LEN || 0)),
                        routeWeight: Math.max(1, Number(lane.routeWeight || 1)),
                    }))
            }
        } catch (error) {
            console.warn('Unable to parse MODEL_LANES:', error)
        }
    }

    return (config.model_apis.length ? config.model_apis : [config.model_api]).map((url, index) => ({
        id: `lane-${index}`,
        url,
        tier: 'fast',
        gpuIndices: [index],
        maxRequests: Math.max(1, Number(process.env.HANASAND_VLLM_MAX_NUM_SEQS || 4)),
        contextMaxTokens: Math.max(0, Number(process.env.HANASAND_MODEL_CONTEXT_MAX_TOKENS || process.env.HANASAND_VLLM_MAX_MODEL_LEN || 0)),
        routeWeight: 1,
    }))
}

const laneConfigs = parseLaneConfigs()
const laneInflight = new Map(laneConfigs.map((lane) => [lane.url, 0]))
let nextLaneIndex = 0

function requestNeedsStrongLane(request?: GPT_PromptRequest) {
    const content = request?.messages.map((message) => message.content).join('\n') || ''
    return /\b(build|implement|create|make|generate|scaffold|docker|compose|deploy|website|web app|next\.?js|project|agent|autonomous|fix|debug|refactor|test)\b/i.test(content)
}

export function acquireModelLane(request?: GPT_PromptRequest) {
    const preferredTier = requestNeedsStrongLane(request) ? 'strong' : 'fast'
    const preferredLanes = laneConfigs.filter((lane) => lane.tier === preferredTier)
    const candidateLanes = preferredLanes.length ? preferredLanes : laneConfigs
    let selected = candidateLanes[0]?.url || config.model_api
    let selectedLoad = Number.POSITIVE_INFINITY

    for (let offset = 0; offset < candidateLanes.length; offset += 1) {
        const index = (nextLaneIndex + offset) % candidateLanes.length
        const candidate = candidateLanes[index]
        const load = (laneInflight.get(candidate.url) || 0) / candidate.routeWeight
        if (load < selectedLoad) {
            selected = candidate.url
            selectedLoad = load
            nextLaneIndex = (index + 1) % candidateLanes.length
        }
    }

    laneInflight.set(selected, (laneInflight.get(selected) || 0) + 1)
    return selected
}

export function releaseModelLane(baseUrl: string) {
    laneInflight.set(baseUrl, Math.max(0, (laneInflight.get(baseUrl) || 0) - 1))
}

export function getModelLaneSnapshot() {
    return laneConfigs.map((lane, index) => {
        const activeRequests = laneInflight.get(lane.url) || 0
        return {
            id: lane.id || `lane-${index}`,
            index,
            url: lane.url,
            model: lane.model,
            label: lane.label,
            tier: lane.tier,
            gpuIndex: lane.gpuIndices[0] || index,
            gpuIndices: lane.gpuIndices,
            activeRequests,
            maxRequests: lane.maxRequests,
            queuedRequests: Math.max(0, activeRequests - lane.maxRequests),
            availableRequests: Math.max(0, lane.maxRequests - activeRequests),
            contextMaxTokens: lane.contextMaxTokens,
        }
    })
}
