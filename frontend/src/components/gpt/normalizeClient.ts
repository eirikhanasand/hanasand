import defaultModelMetrics from './defaultModelMetrics'

export default function normalizeClient(client: GPT_Client): GPT_Client {
    return {
        ...client,
        model: {
            ...defaultModelMetrics(),
            ...(client.model || {}),
        },
    }
}
