import defaultModelMetrics from './defaultModelMetrics'

export default function normalizeClient(client: GPT_Client): GPT_Client {
    return {
        ...client,
        ram: Array.isArray(client.ram) ? client.ram : [],
        cpu: Array.isArray(client.cpu) ? client.cpu : [],
        gpu: Array.isArray(client.gpu) ? client.gpu : [],
        model: {
            ...defaultModelMetrics(),
            ...(client.model || {}),
        },
    }
}
