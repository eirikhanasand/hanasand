type User = {
    id: string
    name: string
    avatar: string
}

type Role = {
    id: string
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
    summary: any
    latest_run_summary?: any
    previous_run_summary?: any
    latest_run_number?: number
    p95_delta_ms?: number | null
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
    displayName?: string | null
    modelId?: string | null
    profile?: string | null
    ram: GPT_RAM[]
    cpu: GPT_CPU[]
    gpu: GPT_GPU[]
    lanes?: GPT_ModelLaneMetrics[]
    power?: GPT_ModelPowerMetrics
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
    memoryUsedMb?: number
    memoryTotalMb?: number
    powerDrawWatts?: number
    powerLimitWatts?: number
    temperatureC?: number
}

type GPT_ModelLaneMetrics = {
    id: string
    index: number
    url: string
    model?: string
    label?: string
    tier?: 'fast' | 'strong'
    gpuIndex: number
    gpuIndices?: number[]
    gpuName: string
    gpuLoad: number
    activeRequests: number
    maxRequests: number
    queuedRequests: number
    availableRequests: number
    contextMaxTokens: number
    memoryUsedMb: number
    memoryTotalMb: number
    powerDrawWatts: number
    powerLimitWatts: number
    temperatureC: number
}

type GPT_ModelPowerMetrics = {
    totalWatts: number
    monthlyKwh: number
    sampledAt: string
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

type AgentVmMissingCapability = {
    key: 'remote_command_execution' | 'remote_file_write' | 'remote_terminal_stream' | 'remote_repo_sync'
    reason: string
}

type AgentVmTarget = {
    id: string
    name: string
    owner: string
    createdBy: string
    accessUsers: string[]
    status: string
    type: string
    architecture: string
    imageDescription: string
    createdAt: string
    lastUsedAt: string
    lastCheckedAt: string
    network: {
        ipv4: string
        sshHost: string | null
        sshUser: string
    }
    resources: {
        cpu: string
        memory: string
    }
    capabilities: {
        canView: boolean
        canConnect: boolean
        canManage: boolean
        canSyncAuthorizedKeys: boolean
        canExecuteRemoteCommands: boolean
        canWriteRemoteFiles: boolean
        supportedActions: Array<'start' | 'stop' | 'restart'>
        supportedConnectionMethods: Array<'ssh'>
        missingCapabilities: AgentVmMissingCapability[]
    }
    endpoints: {
        summary: string
        details: string
        connection: string
        syncAuthorizedKeys: string
        request: string
        actions: Partial<Record<'start' | 'stop' | 'restart', string>>
    }
    suggestedFlow: {
        selection: 'vm' | 'unavailable'
        connect: string | null
        prerequisites: string[]
        notes: string[]
    }
}

type AgentExecutionTarget = {
    id: string
    label: string
    kind: 'local_workspace' | 'vm'
    transport: 'local_process' | 'hanasand_vm_api'
    summary: string
    readiness: 'ready' | 'partial'
    trustBoundary: 'local' | 'remote'
    target: AgentVmTarget | {
        kind: 'local_workspace'
        supportedWorkspaceKinds: Array<'share' | 'repo'>
        supportedOperations: string[]
        missingCapabilities: string[]
    }
}

type AIDeploymentStatus = 'planned' | 'syncing' | 'building' | 'running' | 'healthchecking' | 'blocked' | 'failed'

type AIDeploymentStage = 'planned' | 'sync_access' | 'clone' | 'sync' | 'install' | 'build' | 'run' | 'healthcheck' | 'healthcheck_failed' | 'blocked' | 'manual_step_required'

type AIDeploymentEvent = {
    stage: AIDeploymentStage
    message: string
    timestamp: string
}

type AIDeployment = {
    id: string
    ownerId: string
    conversationId: string
    repositoryId: string | null
    workspaceKind: 'share' | 'repo' | null
    workspaceId: string | null
    vmName: string
    serviceName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    startedBy: string | null
    status: AIDeploymentStatus
    previewUrl: string | null
    healthcheckUrl: string | null
    events: AIDeploymentEvent[]
    failureReason: string | null
    createdAt: string
    updatedAt: string
    completedAt: string | null
}

type AIUsageEventKind =
    | 'conversation_created'
    | 'message_written'
    | 'ai_run_completed'
    | 'ai_run_failed'
    | 'ai_run_platform_error'
    | 'browser_proof_completed'
    | 'build_minutes_recorded'
    | 'deploy_minutes_recorded'
    | 'cache_hit'
    | 'deployment_started'
    | 'release_recorded'
    | 'rollback_marked'
    | 'collaborator_invited'
    | 'collaborator_removed'

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

type AISyncProgress = {
    syncedFiles: number
    totalFiles: number
    currentPath: string | null
}

type AIRepositorySyncEvent = {
    timestamp: string
    status: 'ready' | 'syncing' | 'error'
    source: 'import' | 'refresh' | 'sync'
    message: string
}

type AIImportedRepo = {
    id: string
    ownerId: string
    accessScope: 'owned' | 'shared_conversation'
    name: string
    fullName: string
    branch: string
    defaultBranch: string
    sourcePath: string
    sourceUrl: string
    authMode: 'public' | 'github_token'
    authHint: string | null
    syncStatus: 'ready' | 'syncing' | 'error'
    lastSyncedAt: string | null
    lastSyncError: string | null
    syncHistory: AIRepositorySyncEvent[]
    stackType: AIStackType
    stackReason: string | null
    stackSupported: boolean
    truncated: boolean
    importedAt: string
    credential: AIRepositoryCredentialSummary
    files: AIImportedRepoFile[]
}

type AIStackType = 'nextjs_docker' | 'fastify_postgres' | 'fastify_worker_redis' | 'unknown'

type AIDeploymentAccessPolicy = 'owner_only' | 'collaborators' | 'public_preview'

type AIReleaseStatus = 'current' | 'superseded' | 'failed' | 'rollback_target' | 'rolled_back' | 'restored_source'

type AIRelease = {
    id: string
    ownerId: string
    conversationId: string
    deploymentId: string | null
    vmName: string
    stackType: AIStackType
    accessPolicy: AIDeploymentAccessPolicy
    status: AIReleaseStatus
    previewUrl: string | null
    createdBy: string | null
    createdAt: string
    updatedAt: string
    notes: string | null
    trust?: AIReleaseTrust
}

type AIReleaseTrust = {
    versionHistory: {
        releaseId: string
        status: AIReleaseStatus
        createdAt: string
        updatedAt: string
        summary: string
    }
    recovery: {
        rollbackAvailable: boolean
        rollbackLabel: string
        backupBeforeRiskyChanges: boolean
        backupPolicy: string
    }
    exports: {
        zipAvailable: boolean
        githubAvailable: boolean
        zipLabel: string
        githubLabel: string
    }
    handoffReport: string[]
    noLockIn: {
        headline: string
        bullets: string[]
    }
    supportBundle: {
        available: boolean
        url: string
        includes: string[]
        requestIds: string[]
    }
    sla: {
        tier: string
        promise: string
    }[]
}

type AIUsageEventKind =
    | 'conversation_created'
    | 'message_written'
    | 'ai_run_completed'
    | 'ai_run_failed'
    | 'ai_run_platform_error'
    | 'browser_proof_completed'
    | 'build_minutes_recorded'
    | 'deploy_minutes_recorded'
    | 'cache_hit'
    | 'deployment_started'
    | 'release_recorded'
    | 'rollback_marked'
    | 'collaborator_invited'
    | 'collaborator_removed'

type AIUsageEvent = {
    ownerId: string
    ownerName: string | null
    actorId: string | null
    actorName: string | null
    conversationId: string | null
    deploymentId: string | null
    releaseId: string | null
    kind: AIUsageEventKind
    units: number
    billableUnits?: number
    estimatedCostNok?: number
    billingMode?: string
    outcome?: string
    metadata: Record<string, unknown>
    createdAt: string
}

type AIOwnershipSummary = {
    ownerIds: string[]
    repositoryOwnerIds: string[]
    vmOwnerIds: string[]
    ownedConversationCount: number
    sharedConversationCount: number
    collaboratorSeatCount: number
    repositoryCount: number
    externalRepositoryCount: number
    deploymentCount: number
    releaseCount: number
    externalVmCount: number
    usageEventCount24h: number
    usageUnitCount24h: number
    deploymentEventCount24h: number
    activeActorCount24h: number
    boundaryWarnings: string[]
    recentUsage: AIUsageEvent[]
}

type AIDeployQuota = {
    used: number
    limit: number
    remaining: number
    windowMinutes: number
    resetsAt: string
    activeRunning: number
    maxRunning: number
    runningRemaining: number
    sharedAcrossCollaborators: boolean
}

type AIRepositoryCredentialSummary = {
    provider: 'github_pat'
    hasCredential: boolean
    tokenHint: string | null
    attachedAt: string | null
    lastUsedAt: string | null
    lastValidatedAt: string | null
}

type AIGitStatusFile = {
    path: string
    index: string
    workingTree: string
    selected: boolean
}

type AIGitStatus = {
    files: AIGitStatusFile[]
    branchSummary: string | null
}

type AIRuntimeStatus = 'offline' | 'idle' | 'preparing' | 'generating' | 'error'

type AIRuntimeToolState = 'running' | 'completed' | 'error'

type AIRuntimeToolRun = {
    conversationId: string | null
    label: string
    detail: string | null
    state: AIRuntimeToolState
    updatedAt: string
}

type AIRuntimeFailure = {
    source: 'model' | 'tool' | 'conversation'
    message: string
    conversationId: string | null
    updatedAt: string
}

type AIRuntimeWorkspace = {
    conversationId: string | null
    workspaceId: string | null
    workspaceKind: 'share' | 'repo' | null
    shareIds: string[]
    workspaceMeta: Record<string, unknown>
}

type AIRuntimeState = {
    status: AIRuntimeStatus
    connectedClientCount: number
    connectedModelNames: string[]
    activeConversationId: string | null
    activeWorkspace: AIRuntimeWorkspace
    lastToolRun: AIRuntimeToolRun | null
    lastFailure: AIRuntimeFailure | null
    lastUpdatedAt: string | null
}

type RateLimitScope = 'anonymous' | 'authenticated' | 'internal'

type RateLimitRule = {
    windowMs: number
    maxRequests: number
}

type RateLimitOverride = {
    id: string
    enabled: boolean
    method: string
    route: string
    scope: RateLimitScope
    windowMs: number
    maxRequests: number
}

type RateLimitSettings = {
    enabled: boolean
    defaults: Record<RateLimitScope, RateLimitRule>
    overrides: RateLimitOverride[]
    updatedAt: string | null
    updatedBy: string | null
}

type RateLimitRoute = {
    method: string
    route: string
}

type ApiKeyPeriodLimits = {
    perSecond: number | null
    perMinute: number | null
    perHour: number | null
    perDay: number | null
}

type ApiKeyTierPreset = 'starter' | 'growth' | 'business' | 'internal' | 'custom'

type ApiKeyTierDefinition = {
    id: ApiKeyTierPreset
    label: string
    description: string
    defaultLimits: ApiKeyPeriodLimits
}

type ApiKeyScopeRule = {
    id: string
    enabled: boolean
    method: string
    route: string
    limits: ApiKeyPeriodLimits
}

type ApiKeySummary = {
    id: string
    ownerId: string
    name: string
    tier: ApiKeyTierPreset | string
    description: string | null
    enabled: boolean
    keyPrefix: string
    createdAt: string
    updatedAt: string
    expiresAt: string | null
    lastUsedAt: string | null
    scopes: ApiKeyScopeRule[]
}

type ApiKeyCreateResult = {
    apiKey: ApiKeySummary
    secret: string
}
