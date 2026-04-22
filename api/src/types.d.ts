type User = {
    id: string
    name: string
    avatar: string
}

type Role = {
    id: number
    name: string
    description?: string
    created_by: string
    created_at: string
    updated_at: string
}

type Test = {
    id: number
    url: string
    timeout: number
    stages: object & { default: boolean }
    status: string
    logs: object[]
    errors: object[]
    duration: { milliseconds: number }
    created_at: string
    finished_at: string
    exit_code: number
    visits: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    summary: any
}

type PostVmDetails = {
    name: string
    status: string
    type: string
    architecture: string
    created: string
    last_used: string
    config_architecture: string
    config_image_architecture: string
    config_image_description: string
    config_image_label: string
    config_image_os: string
    config_image_release: string
    config_image_serial: string
    config_image_type: string
    config_image_version: string
    limits_cpu: string
    limits_memory: string
    volatile_base_image: string
    volatile_cloud_init_instance_id: string
    volatile_eth0_hwaddr: string
    volatile_last_state_power: string
    volatile_uuid: string
    volatile_uuid_generation: string
    volatile_vsock_id: string
    device_eth0_ipv4_address: string
    device_eth0_name: string
    device_eth0_network: string
    device_eth0_type: string
    ephemeral: string
    stateful: string
    description: string
    profiles: string[]
}

type GPT_SocketState = {
    clientName: string | null
    role: 'producer' | 'observer'
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

type GPT_Client = {
    name: string
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

type GPT_ChatRole = 'system' | 'user' | 'assistant'

type GPT_ChatMessage = {
    role: GPT_ChatRole
    content: string
}

type GPT_PromptRequest = {
    type: 'prompt_request'
    conversationId: string
    clientName?: string
    messages: GPT_ChatMessage[]
    maxTokens?: number
    temperature?: number
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

type AIImportedRepoFile = {
    path: string
    name: string
    content: string
}

type AIRepositorySyncEvent = {
    timestamp: string
    status: 'ready' | 'syncing' | 'error'
    source: 'import' | 'refresh' | 'sync'
    message: string
}

type AIImportedRepo = {
    id: string
    name: string
    fullName: string
    branch: string
    defaultBranch: string
    sourcePath: string
    sourceUrl: string
    syncStatus: 'ready' | 'syncing' | 'error'
    lastSyncedAt: string | null
    lastSyncError: string | null
    syncHistory: AIRepositorySyncEvent[]
    truncated: boolean
    importedAt: string
    files: AIImportedRepoFile[]
}
