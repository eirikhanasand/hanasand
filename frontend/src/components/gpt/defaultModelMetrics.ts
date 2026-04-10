export default function defaultModelMetrics(): GPT_ModelMetrics {
    return {
        conversationId: null,
        status: 'idle',
        currentTokens: 0,
        maxTokens: 0,
        promptTokens: 0,
        generatedTokens: 0,
        contextTokens: 0,
        contextMaxTokens: 0,
        tps: 0,
        lastUpdated: null,
        lastError: null,
    }
}
