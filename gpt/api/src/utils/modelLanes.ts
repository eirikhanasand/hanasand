import config from '#constants'

const laneUrls = config.model_apis.length ? config.model_apis : [config.model_api]
const laneInflight = new Map(laneUrls.map((url) => [url, 0]))
let nextLaneIndex = 0

export function acquireModelLane() {
    let selected = laneUrls[0] || config.model_api
    let selectedLoad = Number.POSITIVE_INFINITY

    for (let offset = 0; offset < laneUrls.length; offset += 1) {
        const index = (nextLaneIndex + offset) % laneUrls.length
        const candidate = laneUrls[index]
        const load = laneInflight.get(candidate) || 0
        if (load < selectedLoad) {
            selected = candidate
            selectedLoad = load
            nextLaneIndex = (index + 1) % laneUrls.length
        }
    }

    laneInflight.set(selected, (laneInflight.get(selected) || 0) + 1)
    return selected
}

export function releaseModelLane(baseUrl: string) {
    laneInflight.set(baseUrl, Math.max(0, (laneInflight.get(baseUrl) || 0) - 1))
}

export function getModelLaneSnapshot() {
    const maxSequences = Number(process.env.HANASAND_VLLM_MAX_NUM_SEQS || 4)
    const contextMaxTokens = Number(process.env.HANASAND_MODEL_CONTEXT_MAX_TOKENS || process.env.HANASAND_VLLM_MAX_MODEL_LEN || 0)

    return laneUrls.map((url, index) => {
        const activeRequests = laneInflight.get(url) || 0
        return {
            id: `lane-${index}`,
            index,
            url,
            gpuIndex: index,
            activeRequests,
            maxRequests: maxSequences,
            queuedRequests: Math.max(0, activeRequests - maxSequences),
            availableRequests: Math.max(0, maxSequences - activeRequests),
            contextMaxTokens,
        }
    })
}
