type SQLParamType = (string | number | null | boolean | string[] | Date | Buffer)[]

type GPT_Client = {
    name: string
    displayName?: string | null
    modelId?: string | null
    profile?: string | null
    ram: GPT_RAM[]
    cpu: GPT_CPU[]
    gpu: GPT_GPU[]
    model: GPT_ModelMetrics
}

type GPT_RAM = {
    name: string
    load: number
}

type GPT_CPU = {
    name: string
    load: number
}

type GPT_GPU = {
    name: string
    load: number
}

type GPT_ModelStatus = 'idle' | 'preparing' | 'generating' | 'error'

type GPT_ModelMetrics = {
    conversationId: string | null
    status: GPT_ModelStatus
    currentTokens: number
    maxTokens: number
    promptTokens: number
    generatedTokens: number
    contextTokens: number
    contextMaxTokens: number
    tps: number
    lastUpdated: string | null
    lastError: string | null
}

type GPT_ChatRole = 'system' | 'user' | 'assistant' | 'tool'

type GPT_ChatMessage = {
    role: GPT_ChatRole
    content: string
    tool_call_id?: string
}

type AIArtifact = {
    kind: 'screenshot' | 'log' | 'command' | 'http' | 'file' | 'link' | 'diff'
    title: string
    path?: string | null
    url?: string | null
    content?: string | null
    language?: string | null
    dataUrl?: string | null
}

type GPT_PromptRequest = {
    type: 'prompt_request'
    conversationId: string
    clientName?: string
    messages: GPT_ChatMessage[]
    maxTokens?: number
    temperature?: number
}

type GPT_LlamaSlot = {
    id: number
    id_task?: number
    n_ctx?: number
    is_processing?: boolean
    params?: {
        max_tokens?: number
    }
    next_token?: {
        n_decoded?: number
        n_remain?: number
    }
}
